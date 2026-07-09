import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // ⚠ bytecodePlugin 금지: V8 바이트코드는 컴파일한 플랫폼에 종속 — WSL(Linux)에서 빌드한 .jsc 를
  // Windows 에서 실행하면 cachedDataRejected 로 앱이 안 뜬다 (v1.4.2 사고).
  // 소스 보호는 scripts/obfuscate.cjs (main/preload/renderer 난독화, 플랫폼 무관)가 담당.
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@core': resolve('src/core'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      // pdfjs 워커 사전 번들 이슈 회피
      exclude: ['pdfjs-dist']
    }
  }
})
