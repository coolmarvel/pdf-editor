/**
 * 소스 PDF 문서 저장소 + pdf.js 렌더링.
 *
 * 문서 상태(store)는 PageRef 배열만 들고 있고, 실제 바이트/pdf.js 프록시는 여기 모듈
 * 레벨 맵에 둔다(직렬화 불가능한 큰 객체를 zustand 밖으로 격리).
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, PageViewport, RenderTask } from 'pdfjs-dist'
import type { PageRef } from '@core/pages'
import { bumpDocSeq } from '@core/draft'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

interface SourceDoc {
  bytes: Uint8Array
  proxy: PDFDocumentProxy
}

const docs = new Map<string, SourceDoc>()
let dseq = 0
/** 텍스트 스팬 추출 결과 캐시 — (docId, pageIndex, extraRotation) 의 순수 함수라 문서가 살아있는 동안 재사용 */
const spanCache = new Map<string, Promise<TextSpan[]>>()

const DEFAULT_BLANK = { w: 595, h: 842 }

/** 빈 페이지의 표시 크기(pt) — 사용자 회전이 90/270 이면 가로세로 교환 */
function blankSizeOf(ref: PageRef): { w: number; h: number } {
  const { w, h } = ref.blankSize ?? DEFAULT_BLANK
  return ref.extraRotation % 180 === 0 ? { w, h } : { w: h, h: w }
}

/** 소스 페이지 프록시 + 표시 뷰포트(소스 자체 회전 + 사용자 추가 회전 반영) */
async function pageViewport(ref: PageRef, scale: number): Promise<{ page: pdfjsLib.PDFPageProxy; vp: PageViewport }> {
  const page = await docs.get(ref.docId)!.proxy.getPage(ref.pageIndex + 1)
  const vp = page.getViewport({ scale, rotation: (page.rotate + ref.extraRotation) % 360 })
  return { page, vp }
}

/**
 * 소스 문서 등록. id 를 주면 그 id 로 등록한다 — 임시 저장(draft) 복원 시 PageRef.docId 가 가리키는
 * 원래 id 를 그대로 살려야 하기 때문. 이때 내부 시퀀스를 그 숫자 뒤로 건너뛰어, 이후 새로 등록되는
 * 문서가 복원된 id 와 충돌하지 않게 한다.
 */
export async function registerDoc(bytes: Uint8Array, id?: string): Promise<{ docId: string; pageCount: number }> {
  // pdf.js가 버퍼를 detach 하므로 사본을 넘긴다
  const proxy = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  if (id) {
    dseq = bumpDocSeq(dseq, id)
    void docs.get(id)?.proxy.destroy()
  }
  const docId = id ?? `doc-${++dseq}`
  docs.set(docId, { bytes, proxy })
  return { docId, pageCount: proxy.numPages }
}

/** 등록된 모든 소스 문서의 바이트 (docId → bytes). 임시 저장 직렬화용 */
export function getAllDocBytes(): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const [id, d] of docs) out[id] = d.bytes
  return out
}

export function getDocBytes(docId: string): Uint8Array {
  const d = docs.get(docId)
  if (!d) throw new Error(`unknown doc: ${docId}`)
  return d.bytes
}

export function clearDocs(): void {
  for (const d of docs.values()) void d.proxy.destroy()
  docs.clear()
  spanCache.clear()
}

/** 표시 기준 페이지 크기 (pt). 소스 자체 회전 + 사용자 추가 회전 반영 */
export async function getDisplaySize(ref: PageRef): Promise<{ w: number; h: number }> {
  if (ref.docId === 'blank') return blankSizeOf(ref)
  const { vp } = await pageViewport(ref, 1)
  return { w: vp.width, h: vp.height }
}

/**
 * 페이지를 캔버스에 렌더 (scale = CSS px / pt 비율 × devicePixelRatio 등 호출부 결정).
 * 반환값 = pdf.js RenderTask (빈 페이지는 undefined). 호출부가 task.cancel() 로 진행 중 렌더를 끊을 수 있다
 * (줌 드래그처럼 같은 캔버스에 렌더가 연달아 걸릴 때). 취소되면 task.promise 가 RenderingCancelledException 으로 거부된다.
 * 기존처럼 `await renderPage(...)` 만 하면 렌더 완료까지 기다린다.
 * opts.onTask 는 render 시작 직후(완료 전) 호출되므로 여기서 받은 task 로 진행 중 렌더를 끊을 수 있고,
 * opts.signal 이 abort 된 뒤에는 캔버스에 손대지 않는다 (같은 캔버스에 렌더가 겹치면 pdf.js 가 두 번째를 거부한다).
 */
export async function renderPage(
  ref: PageRef,
  canvas: HTMLCanvasElement,
  scale: number,
  opts?: { signal?: AbortSignal; onTask?: (task: RenderTask) => void }
): Promise<RenderTask | undefined> {
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
  const { page, vp } = await pageViewport(ref, scale)
  // 뷰포트 준비 중 호출부가 취소했으면 캔버스를 건드리지 않는다 (진행 중인 이전 렌더를 깨지 않도록)
  if (opts?.signal?.aborted) return undefined
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d')!
  const task = page.render({ canvasContext: ctx, viewport: vp })
  // 완료를 기다리기 전에 task 를 넘겨 호출부가 진행 중 렌더를 실제로 cancel 할 수 있게 한다
  opts?.onTask?.(task)
  await task.promise
  return task
}

export interface TextSpan {
  /** 표시 공간 정규화 rect */
  rect: { x: number; y: number; w: number; h: number }
  text: string
  /** 글자 크기 (페이지 높이 대비 비율) */
  size: number
}

/** Edit Text용: 페이지의 텍스트 스팬을 표시 공간 정규화 좌표로 추출 */
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
  const { page, vp } = await pageViewport(ref, 1)
  const content = await page.getTextContent()
  const spans: TextSpan[] = []
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    // 텍스트 기준점(베이스라인 시작)을 뷰포트 공간으로
    const tx = pdfjsLib.Util.transform(vp.transform, item.transform)
    const fontH = Math.hypot(tx[2], tx[3])
    const dirX = tx[0] / (Math.hypot(tx[0], tx[1]) || 1)
    const dirY = tx[1] / (Math.hypot(tx[0], tx[1]) || 1)
    const wPx = item.width * vp.scale
    // 축 정렬 가정(0/90/180/270 회전): 시작점 + 진행방향으로 rect 구성
    const x0 = tx[4]
    const y0 = tx[5]
    const x1 = x0 + dirX * wPx
    const y1 = y0 + dirY * wPx
    const minX = Math.min(x0, x1)
    const minY = Math.min(y0, y1) - (dirY === 0 ? fontH : 0)
    const w = Math.max(Math.abs(x1 - x0), dirY !== 0 ? fontH : 0)
    const h = dirY === 0 ? fontH : Math.abs(y1 - y0)
    spans.push({
      rect: { x: minX / vp.width, y: minY / vp.height, w: w / vp.width, h: h / vp.height },
      text: item.str,
      size: fontH / vp.height
    })
  }
  return spans
}
