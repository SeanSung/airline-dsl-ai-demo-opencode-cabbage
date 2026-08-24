// 旧路径 re-export，保持 App.tsx 中 `import { GBHSubmitBar } from './components/GBHSubmitBar'` 可用。
// 新代码请直接从 '@/components/map/GbhPanel' 引入 GbhPanel（以及 GbhSubmitStatus 类型）。
export { GbhPanel as GBHSubmitBar } from './map/GbhPanel'
export type { GbhSubmitStatus as SubmitStatus } from './map/GbhPanel'
