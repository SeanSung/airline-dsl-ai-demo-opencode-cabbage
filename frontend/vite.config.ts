import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from 'node:url'

const cesiumRoot = fileURLToPath(new URL('../node_modules/cesium/Build/Cesium', import.meta.url))

const cesiumDirs = ['Assets', 'Workers', 'Widgets', 'ThirdParty'] as const

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: cesiumDirs.map((dir) => ({
        src: `${cesiumRoot}/${dir}/**/*`,
        dest: `cesium/${dir}`,
        rename: { stripBase: 5 },
      })),
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
