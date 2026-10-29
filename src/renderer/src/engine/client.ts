/**
 * Rust 엔진 클라이언트 — 워커 1개를 지연 생성하고 RPC 를 Promise 로 감싼다. 호출은 워커 안에서 순서대로 처리된다.
 * 문서 바이트는 `open` 때 사본을 transfer 해 엔진이 소유한다(`close` 로 해제). 모노레포 `renderer/engine/client.ts` 와 같은 동작.
 *
 * 렌더 합치기: wasm 렌더는 동기라 취소할 수 없다 — 줌 드래그처럼 같은 캔버스(key)에 렌더가 연달아 걸리면 **아직 보내지 않은** 옛 요청을
 * 버리고 최신 것만 보낸다(동시 in-flight 2). 버린 요청은 `RenderingCancelledException` 이름의 오류로 거부된다.
 * 워커가 죽으면(wasm 패닉 = abort) 모든 대기 요청을 거부하고 워커를 버린다 — `onEngineReset` 구독자(registry)가 등록 문서를 새 워커에 다시 연다.
 */
import type { EngineOp, EngineOps, EngineRaster, EngineRequest, EngineResponse } from './types'

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

class RenderCancelled extends Error {
  readonly name = 'RenderingCancelledException'
  constructor() {
    super('render superseded')
  }
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, Pending>()
const resetListeners = new Set<() => void>()
/** 마지막으로 등록한 대체 서체 바이트: 새 워커에 다시 보낸다 */
let fallbackFontBytes: Uint8Array | null = null

/** 워커가 죽거나 종료돼 엔진 문서 id 가 전부 무효가 됐을 때 알림 */
export function onEngineReset(fn: () => void): () => void {
  resetListeners.add(fn)
  return () => resetListeners.delete(fn)
}

function failAll(err: Error): void {
  for (const p of pending.values()) p.reject(err)
  pending.clear()
  renders.clear(err)
}

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'pdf-engine' })
  worker.onmessage = (e: MessageEvent<EngineResponse>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.ok) p.resolve(e.data.result)
    else {
      const err = new Error(e.data.error)
      p.reject(err)
      // wasm 트랩 뒤의 모듈은 못 쓴다 — 워커를 버리고 문서를 다시 열게 한다
      if (/RuntimeError|unreachable|memory access out of bounds/i.test(e.data.error)) terminateEngine(err)
    }
  }
  worker.onerror = (e) => terminateEngine(new Error(`pdf-engine worker: ${e.message}`))
  // 대체 서체는 wasm 인스턴스마다 따로다: 새 워커에는 첫 요청보다 먼저 다시 보낸다
  if (fallbackFontBytes) void post('setFallbackFont', [fallbackFontBytes.slice()]).catch(() => undefined)
  return worker
}

function post<K extends EngineOp>(op: K, args: Parameters<EngineOps[K]>, transfer?: Transferable[]): Promise<ReturnType<EngineOps[K]>> {
  const id = ++seq
  const req: EngineRequest<K> = { id, op, args }
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    ensureWorker().postMessage(req, transfer ?? [])
  })
}

/** 렌더 큐 — 같은 key(캔버스)의 미전송 요청은 최신 것으로 대체, 동시 in-flight 상한. 본문(`:main`)은 썸네일보다 먼저 */
class RenderQueue {
  private readonly queue: { key: string; args: Parameters<EngineOps['render']>; resolve: (r: EngineRaster) => void; reject: (e: Error) => void }[] = []
  private inflight = 0
  constructor(private readonly maxInflight: number) {}

  push(key: string | undefined, args: Parameters<EngineOps['render']>): Promise<EngineRaster> {
    return new Promise((resolve, reject) => {
      if (key) {
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i].key === key) {
            this.queue[i].reject(new RenderCancelled())
            this.queue.splice(i, 1)
          }
        }
      }
      const entry = { key: key ?? `anon-${++seq}`, args, resolve, reject }
      if (key?.endsWith(':main')) {
        const firstThumb = this.queue.findIndex((q) => !q.key.endsWith(':main'))
        if (firstThumb >= 0) this.queue.splice(firstThumb, 0, entry)
        else this.queue.push(entry)
      } else this.queue.push(entry)
      this.pump()
    })
  }

  /** 아직 보내지 않은 요청을 err 로 거부한다(보낸 요청은 failAll 의 거부가 각자 inflight 를 줄인다) */
  clear(err: Error): void {
    for (const q of this.queue.splice(0)) q.reject(err)
  }

  private pump(): void {
    while (this.inflight < this.maxInflight && this.queue.length) {
      const q = this.queue.shift()!
      this.inflight++
      post('render', q.args).then(
        (r) => {
          this.inflight--
          q.resolve(r)
          this.pump()
        },
        (e: Error) => {
          this.inflight--
          q.reject(e)
          this.pump()
        }
      )
    }
  }
}
const renders = new RenderQueue(2)

export const wasmEngine = {
  version: () => post('version', []),
  /** 바이트 사본을 transfer 한다 — 호출자의 bytes 는 그대로 남는다 */
  open: (bytes: Uint8Array) => {
    const copy = bytes.slice()
    return post('open', [copy], [copy.buffer as ArrayBuffer])
  },
  close: (doc: number) => post('close', [doc]),
  pageCount: (doc: number) => post('pageCount', [doc]),
  pageSize: (doc: number, page: number) => post('pageSize', [doc, page]),
  /** key = 같은 캔버스를 뜻하는 식별자 — 연달아 오면 최신 요청만 남는다 */
  render: (doc: number, page: number, scale: number, rotation: number, key?: string) => renders.push(key, [doc, page, scale, rotation]),
  pageTextSpans: (doc: number, page: number) => post('pageTextSpans', [doc, page]),
  setFallbackFont: (bytes: Uint8Array) => {
    fallbackFontBytes = bytes.slice()
    return post('setFallbackFont', [bytes])
  },
  /** 비트맵 버퍼는 transfer 한다(호출자는 다시 쓰지 않는다) */
  buildDocument: (spec: string, bitmaps: Uint8Array[]) =>
    post(
      'buildDocument',
      [spec, bitmaps],
      // 같은 버퍼를 두 번 넣으면 DataCloneError — 버퍼 단위로 한 번씩
      [...new Set(bitmaps.map((b) => b.buffer as ArrayBuffer))]
    )
}

/**
 * 워커 종료(문서 전부 닫을 때·트랩 뒤). 다음 호출이 다시 만든다 — wasm 선형 메모리도 함께 돌려준다.
 * 워커가 있었으면 대기 요청을 거부하고 `onEngineReset` 구독자에게 알린다.
 */
export function terminateEngine(reason: Error = new Error('pdf-engine worker terminated')): void {
  if (!worker) return
  worker.terminate()
  worker = null
  failAll(reason)
  for (const fn of resetListeners) fn()
}
