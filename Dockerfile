# syntax=docker/dockerfile:1

# ============ 前端构建阶段 ============
# 全量 npm ci：Vite 构建需要 Cesium（从根 node_modules 静态拷贝）等全部 workspace 依赖。
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app

# 先拷清单以利用层缓存
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

# 再拷源码构建（产物在 frontend/dist，含 Vite 拷贝的 cesium/ 静态资源）
COPY shared ./shared
COPY frontend ./frontend
RUN npm run build --workspace frontend

# ============ 前端运行镜像：Nginx 托管 SPA + 同源反代 /api ============
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

# ============ 后端运行镜像：Bun 直接跑 TS ============
# 使用 debian 基础的 bun 镜像（避免 alpine musl 下 bun:sqlite 原生模块兼容问题）。
FROM oven/bun:1 AS server
WORKDIR /app

# 仅安装 server + shared 的依赖（跳过 frontend 的 React/Cesium 等）

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
# 拷贝 frontend 清单仅为满足 root workspaces 解析；-w 过滤不会安装其依赖
COPY frontend/package.json ./frontend/package.json
# 仅安装 server 及其依赖的 shared（跳过 frontend 的 React/Cesium 等）
RUN bun install --production --filter '@airline-dsl/server'

# 拷贝源码（shared 被 server 通过 @airline-dsl/shared 引用）
COPY --chown=bun:bun shared ./shared
COPY --chown=bun:bun server ./server
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/airline.db

# Bun 镜像默认以非 root 用户 bun 运行；确保数据目录可写
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
WORKDIR /app/server

EXPOSE 3000
VOLUME ["/app/data"]

# /api/routes 只查 SQLite、不调 LLM，作为存活探针
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/routes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
