/**
 * 소스 PDF 문서 저장소 + Rust 엔진 핸들 (모노레포 `renderer/pdf/registry.ts` 의 데스크톱판: 비밀번호·원본 서체 없음).
 * 문서 상태(store)는 PageRef 배열만 들고 있고, 실제 바이트/엔진 문서 id 는 여기 모듈 레벨 맵에 둔다.
 *
 * 등록 = 워커의 `open`. 워커가 트랩으로 죽으면(`onEngineReset`) 등록된 문서를 보관한 바이트로 새 워커에 **다시 연다** —
 * 호출부는 `engineDocOf` 로 다시 열기를 기다린 뒤 새 id 를 받고, `onDocsReopened` 구독자(`docs.ts`)가 캐시를 비우고 화면을 다시 그린다.
 */
import { bumpDocSeq } from '@core/draft'
import { onEngineReset, terminateEngine, wasmEngine } from '@renderer/engine/client'
import fallbackFontUrl from '@renderer/assets/fonts/NanumGothic-Regular.ttf?url'

interface SourceDoc {
  bytes: Uint8Array
  /** Rust 엔진 문서 id — 워커가 죽은 뒤 다시 열기 전(또는 실패)이면 null */
  engineDoc: number | null
}

const docs = new Map<string, SourceDoc>()
let dseq = 0

/**
 * 비내장 서체 대체: 엔진(hayro)은 표준 14 서체만 내장하므로 서체를 넣지 않은 한글 PDF 는 글자가 빠진다 —
 * 번들한 나눔고딕(OFL, `assets/fonts`)을 첫 문서를 여는 순간 한 번 등록한다. 실패해도 열기는 계속된다. 워커가 바뀌면 클라이언트가 다시 보낸다.
 */
let fallbackFont: Promise<void> | null = null
const FALLBACK_FONT_BUDGET_MS = 3000
export function ensureFallbackFont(): Promise<void> {
  if (!fallbackFont) {
    fallbackFont = (async () => {
      const res = await fetch(fallbackFontUrl)
      if (!res.ok) throw new Error(`fallback font ${res.status}`)
      await wasmEngine.setFallbackFont(new Uint8Array(await res.arrayBuffer()))
    })().catch((e) => {
      console.warn('fallback font unavailable', e)
      fallbackFont = null
    })
  }
  return Promise.race([fallbackFont, new Promise<void>((r) => setTimeout(r, FALLBACK_FONT_BUDGET_MS))])
}

/** 짧은 시간에 거듭 죽으면(같은 문서가 워커를 또 트랩시키는 경우) 다시 열지 않는다 — 무한 재시작 대신 렌더 오류로 남긴다 */
const RESET_WINDOW_MS = 10_000
const RESET_LIMIT = 3
const resetTimes: number[] = []
let reopening: Promise<void> | null = null
const reopenListeners = new Set<() => void>()

/** 워커가 죽은 뒤 등록 문서가 새 워커에 다시 열렸을 때 알림 */
export function onDocsReopened(fn: () => void): () => void {
  reopenListeners.add(fn)
  return () => reopenListeners.delete(fn)
}

async function reopenAll(): Promise<void> {
  for (const d of docs.values()) {
    try {
      d.engineDoc = await wasmEngine.open(d.bytes)
    } catch (e) {
      console.error('engine document reopen failed', e)
    }
  }
}

onEngineReset(() => {
  for (const d of docs.values()) d.engineDoc = null
  if (!docs.size) return
  const now = Date.now()
  while (resetTimes.length && now - resetTimes[0] > RESET_WINDOW_MS) resetTimes.shift()
  resetTimes.push(now)
  if (resetTimes.length > RESET_LIMIT) {
    console.error('pdf-engine worker keeps crashing; documents stay unavailable')
    for (const fn of reopenListeners) fn()
    return
  }
  const run = reopenAll().finally(() => {
    if (reopening === run) reopening = null
    for (const fn of reopenListeners) fn()
  })
  reopening = run
})

function destroy(d: SourceDoc): void {
  if (d.engineDoc !== null) void wasmEngine.close(d.engineDoc).catch(() => undefined)
}

/**
 * 소스 문서 등록. id 를 주면 그 id 로 등록한다 — 임시 저장(draft) 복원 시 PageRef.docId 가 가리키는
 * 원래 id 를 그대로 살려야 하기 때문. 이때 내부 시퀀스를 그 숫자 뒤로 건너뛰어, 이후 새로 등록되는
 * 문서가 복원된 id 와 충돌하지 않게 한다.
 */
export async function registerDoc(bytes: Uint8Array, id?: string): Promise<{ docId: string; pageCount: number }> {
  await ensureFallbackFont()
  const engineDoc = await wasmEngine.open(bytes)
  const pageCount = await wasmEngine.pageCount(engineDoc)
  if (id) {
    dseq = bumpDocSeq(dseq, id)
    const old = docs.get(id)
    if (old) destroy(old)
  }
  const docId = id ?? `doc-${++dseq}`
  docs.set(docId, { bytes, engineDoc })
  return { docId, pageCount }
}

/** 등록된 모든 소스 문서의 바이트 (docId → bytes). 임시 저장 직렬화용 */
export function getAllDocBytes(): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const [id, d] of docs) out[id] = d.bytes
  return out
}

function get(docId: string): SourceDoc {
  const d = docs.get(docId)
  if (!d) throw new Error(`unknown doc: ${docId}`)
  return d
}

export function getDocBytes(docId: string): Uint8Array {
  return get(docId).bytes
}

/** 등록 문서의 엔진 id — 워커 복구 중이면 다시 열릴 때까지 기다린다. 끝내 못 열렸으면 던진다 */
export async function engineDocOf(docId: string): Promise<number> {
  if (reopening) await reopening
  const id = get(docId).engineDoc
  if (id === null) throw new Error(`engine document unavailable: ${docId}`)
  return id
}

/** 전부 해제 — 워커도 내려 wasm 선형 메모리를 돌려준다 */
export function clearRegistry(): void {
  const hadEngine = [...docs.values()].some((d) => d.engineDoc !== null)
  for (const d of docs.values()) destroy(d)
  docs.clear()
  if (hadEngine) terminateEngine()
}
