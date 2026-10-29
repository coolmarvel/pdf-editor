/**
 * 소스 문서 수명주기 + 페이지 렌더 + 텍스트 스팬 (Rust/wasm 엔진, 모노레포 ADR-0003).
 * 저장소(바이트·엔진 문서 id)는 `./registry.ts`. 여기는 표시 크기 · 캔버스 렌더 · 텍스트 스팬(텍스트 수정·검색) · 전부 해제.
 * 워커가 죽어 registry 가 문서를 다시 열면(`onDocsReopened`) 스팬 캐시를 비우고 렌더 세대를 올려 모든 캔버스를 다시 그린다.
 */
import { matchFontFamily } from '@renderer/editor/draw'
import { clearImageCache } from '@renderer/editor/canvasUtil'
import { DEFAULT_PAGE_SIZE, type PageRef } from '@core/pages'
import { wasmEngine } from '@renderer/engine/client'
import type { EnginePageSpans, RenderHandle } from '@renderer/engine/types'
import { clearRegistry, engineDocOf, onDocsReopened } from './registry'
import { bumpRenderEpoch } from './renderEpoch'

export { registerDoc, getAllDocBytes, getDocBytes } from './registry'
export type { RenderHandle } from '@renderer/engine/types'

/** 텍스트 스팬 추출 결과 캐시 — (docId, pageIndex, extraRotation) 의 순수 함수라 문서가 살아있는 동안 재사용 */
const spanCache = new Map<string, Promise<TextSpan[]>>()

onDocsReopened(() => {
  spanCache.clear()
  bumpRenderEpoch()
})

/** 빈 페이지의 표시 크기(pt) — 사용자 회전이 90/270 이면 가로세로 교환 */
function blankSizeOf(ref: PageRef): { w: number; h: number } {
  const { w, h } = ref.blankSize ?? DEFAULT_PAGE_SIZE
  return ref.extraRotation % 180 === 0 ? { w, h } : { w: h, h: w }
}

/** 문서 단위 자원 전부 해제: 엔진 문서(워커 종료)·스팬 캐시·이미지 디코드 캐시 */
export function clearDocs(): void {
  clearRegistry()
  spanCache.clear()
  clearImageCache()
}

/** 표시 기준 페이지 크기 (pt). 소스 자체 회전(엔진이 반영) + 사용자 추가 회전 */
export async function getDisplaySize(ref: PageRef): Promise<{ w: number; h: number }> {
  if (ref.docId === 'blank') return blankSizeOf(ref)
  const [w, h] = await wasmEngine.pageSize(await engineDocOf(ref.docId), ref.pageIndex)
  return ref.extraRotation % 180 === 0 ? { w, h } : { w: h, h: w }
}

/**
 * 페이지를 캔버스에 렌더 (scale = CSS px / pt 비율 × devicePixelRatio 등 호출부 결정).
 * 반환값 = 렌더 손잡이(빈 페이지는 undefined). 워커 안 래스터는 동기라 중간에 끊지 못한다 — `cancel()` 은 결과를 버리고,
 * 같은 캔버스의 아직 보내지 않은 옛 요청은 클라이언트 큐가 버린다(promise 가 RenderingCancelledException 으로 거부).
 * opts.onTask 는 요청 직후(완료 전) 호출되고, opts.signal 이 abort 된 뒤에는 캔버스에 손대지 않는다. opts.key 는 렌더 큐 합치기 키(기본 = 페이지·본문/썸네일).
 */
export async function renderPage(
  ref: PageRef,
  canvas: HTMLCanvasElement,
  scale: number,
  opts?: { signal?: AbortSignal; onTask?: (task: RenderHandle) => void; key?: string }
): Promise<RenderHandle | undefined> {
  if (opts?.signal?.aborted) return undefined
  if (ref.docId === 'blank') {
    const { w, h } = blankSizeOf(ref)
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return undefined
  }
  const engineDoc = await engineDocOf(ref.docId)
  if (opts?.signal?.aborted) return undefined
  let cancelled = false
  // key = 페이지·캔버스 종류(배율로 구분: 썸네일과 본문은 배율이 다르다). 저장처럼 밀려나면 안 되는 렌더는 호출부가 고유 key 를 준다
  const key = opts?.key ?? `${ref.id}:${scale > 1 ? 'main' : 'thumb'}`
  const promise = wasmEngine.render(engineDoc, ref.pageIndex, scale, ref.extraRotation % 360, key).then((r) => {
    if (cancelled || opts?.signal?.aborted) return
    canvas.width = r.width
    canvas.height = r.height
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.rgba), r.width, r.height), 0, 0)
  })
  const handle: RenderHandle = {
    promise,
    cancel: () => {
      cancelled = true
    }
  }
  opts?.onTask?.(handle)
  await promise
  return handle
}

export interface TextSpan {
  /** 표시 공간 정규화 rect */
  rect: { x: number; y: number; w: number; h: number }
  text: string
  /** 글자 크기 (페이지 높이 대비 비율) */
  size: number
  /** 원본 서체를 우리 폰트 목록 키로 매핑한 값 — 텍스트 수정 시 승계 */
  font?: string
  bold?: boolean
  italic?: boolean
}

/** Edit Text·검색용: 페이지의 텍스트 스팬을 표시 공간 정규화 좌표로 추출 */
export function extractTextSpans(ref: PageRef): Promise<TextSpan[]> {
  if (ref.docId === 'blank') return Promise.resolve([])
  const key = `${ref.docId}:${ref.pageIndex}:${ref.extraRotation}`
  let p = spanCache.get(key)
  if (!p) {
    p = computeTextSpans(ref)
    spanCache.set(key, p)
    // 실패(워커 오류 등)는 캐시에 남기지 않는다 — 다음 호출이 재시도
    p.catch(() => spanCache.delete(key))
  }
  return p
}

async function computeTextSpans(ref: PageRef): Promise<TextSpan[]> {
  const page = await wasmEngine.pageTextSpans(await engineDocOf(ref.docId), ref.pageIndex)
  return engineSpansToTextSpans(page, ref.extraRotation)
}

/** 사용자 추가 회전(시계 방향)을 상자에 적용 — (w,h) 는 회전 전 프레임의 페이지 크기 */
function rotateRect(r: [number, number, number, number], rot: number, w: number, h: number): [number, number, number, number] {
  const [x0, y0, x1, y1] = r
  switch (rot) {
    case 90:
      return [h - y1, x0, h - y0, x1]
    case 180:
      return [w - x1, h - y1, w - x0, h - y0]
    case 270:
      return [y0, w - x1, y1, w - x0]
    default:
      return r
  }
}

/**
 * 엔진 스팬(`page_text_spans`: 텍스트 명령 하나 = 스팬 하나, 상자는 /Rotate 표시 프레임 pt·y 아래) → 편집기 `TextSpan`.
 * 상자는 어센더~디센더 em 상자의 합집합이라 흰 덮기가 글리프를 다 가린다. 서체는 BaseFont 이름을 `matchFontFamily` 로 우리 목록 키에 맞춘다
 * (못 맞추면 serif/mono 플래그로 Times·Courier, 그 밖은 Helvetica).
 */
export function engineSpansToTextSpans(page: EnginePageSpans, extraRotation: number): TextSpan[] {
  const rot = ((Math.round(extraRotation) % 360) + 360) % 360
  const [W, H] = rot % 180 === 0 ? [page.width, page.height] : [page.height, page.width]
  const out: TextSpan[] = []
  for (const s of page.spans) {
    if (!s.text.trim()) continue
    const [x0, y0, x1, y1] = rotateRect(s.rect, rot, page.width, page.height)
    out.push({
      rect: { x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H },
      text: s.text,
      size: s.size / H,
      font: matchFontFamily(s.pdfName, s.mono ? 'monospace' : s.serif ? 'serif' : 'sans-serif'),
      bold: s.bold,
      italic: s.italic
    })
  }
  return out
}
