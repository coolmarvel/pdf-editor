/**
 * Rust 엔진 워커 — wasm 을 이 스레드에서만 올리고(메인 스레드는 블록되지 않는다) RPC 로 연산을 받는다.
 * 요청/응답 모양은 `./types`. 큰 버퍼(래스터·바이트)는 transfer. 모노레포 `packages/editor/src/renderer/engine/worker.ts` 의 부분집합.
 */
import init, * as engine from './pkg/pdf_engine.js'
import wasmUrl from './pkg/pdf_engine_bg.wasm?url'
import type { EngineOps, EngineRequest, EngineResponse } from './types'

// 워커 전역 — tsconfig 는 DOM lib 이라 WebWorker 타입이 없다. postMessage(transfer) 시그니처만 명시한다
const ctx = self as unknown as { onmessage: ((e: MessageEvent<EngineRequest>) => void) | null; postMessage(msg: EngineResponse, transfer?: Transferable[]): void }
const ready = init({ module_or_path: wasmUrl })

const ops: EngineOps = {
  version: () => engine.version(),
  open: (bytes) => engine.open(bytes),
  close: (doc) => engine.close(doc),
  pageCount: (doc) => engine.page_count(doc),
  pageSize: (doc, page) => {
    const [w, h] = engine.page_size(doc, page)
    return [w, h]
  },
  render: (doc, page, scale, rotation) => {
    const r = engine.render_page(doc, page, scale, rotation)
    try {
      // wasm-bindgen 이 돌려주는 Uint8Array 는 JS 힙 사본 — transfer 가능
      return { width: r.width, height: r.height, rgba: r.rgba.buffer as ArrayBuffer }
    } finally {
      r.free()
    }
  },
  pageTextSpans: (doc, page) => engine.page_text_spans(doc, page),
  setFallbackFont: (bytes) => engine.set_fallback_font(bytes),
  buildDocument: (spec, bitmaps) => engine.build_document(spec, bitmaps)
}

function transferables(result: unknown): Transferable[] {
  if (result instanceof Uint8Array) return [result.buffer as ArrayBuffer]
  if (result && typeof result === 'object' && 'rgba' in result) return [(result as { rgba: ArrayBuffer }).rgba]
  return []
}

ctx.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const { id, op, args } = e.data
  let res: EngineResponse
  try {
    await ready
    const fn = ops[op] as (...a: unknown[]) => unknown
    const result = fn(...(args as unknown[]))
    res = { id, ok: true, result }
    ctx.postMessage(res, transferables(result))
    return
  } catch (err) {
    res = { id, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  ctx.postMessage(res)
}
