/**
 * 소스 PDF 문서 저장소 + pdf.js 렌더링.
 *
 * 문서 상태(store)는 PageRef 배열만 들고 있고, 실제 바이트/pdf.js 프록시는 여기 모듈
 * 레벨 맵에 둔다(직렬화 불가능한 큰 객체를 zustand 밖으로 격리).
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageRef, Rotation } from '@core/pages'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

interface SourceDoc {
  bytes: Uint8Array
  proxy: PDFDocumentProxy
}

const docs = new Map<string, SourceDoc>()
let dseq = 0

export async function registerDoc(bytes: Uint8Array): Promise<{ docId: string; pageCount: number }> {
  // pdf.js가 버퍼를 detach 하므로 사본을 넘긴다
  const proxy = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  const docId = `doc-${++dseq}`
  docs.set(docId, { bytes, proxy })
  return { docId, pageCount: proxy.numPages }
}

export function getDocBytes(docId: string): Uint8Array {
  const d = docs.get(docId)
  if (!d) throw new Error(`unknown doc: ${docId}`)
  return d.bytes
}

export function clearDocs(): void {
  for (const d of docs.values()) void d.proxy.destroy()
  docs.clear()
}

/** 표시 기준 페이지 크기 (pt). 소스 자체 회전 + 사용자 추가 회전 반영 */
export async function getDisplaySize(ref: PageRef): Promise<{ w: number; h: number }> {
  if (ref.docId === 'blank') {
    const { w, h } = ref.blankSize ?? { w: 595, h: 842 }
    return ref.extraRotation % 180 === 0 ? { w, h } : { w: h, h: w }
  }
  const page = await docs.get(ref.docId)!.proxy.getPage(ref.pageIndex + 1)
  const vp = page.getViewport({ scale: 1, rotation: (page.rotate + ref.extraRotation) % 360 })
  return { w: vp.width, h: vp.height }
}

/** 페이지를 캔버스에 렌더 (scale = CSS px / pt 비율 × devicePixelRatio 등 호출부 결정) */
export async function renderPage(ref: PageRef, canvas: HTMLCanvasElement, scale: number): Promise<void> {
  if (ref.docId === 'blank') {
    const { w, h } = ref.blankSize ?? { w: 595, h: 842 }
    const dw = ref.extraRotation % 180 === 0 ? w : h
    const dh = ref.extraRotation % 180 === 0 ? h : w
    canvas.width = Math.round(dw * scale)
    canvas.height = Math.round(dh * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return
  }
  const page = await docs.get(ref.docId)!.proxy.getPage(ref.pageIndex + 1)
  const vp = page.getViewport({ scale, rotation: (page.rotate + ref.extraRotation) % 360 })
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(vp.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport: vp }).promise
}

export interface TextSpan {
  /** 표시 공간 정규화 rect */
  rect: { x: number; y: number; w: number; h: number }
  text: string
  /** 글자 크기 (페이지 높이 대비 비율) */
  size: number
}

/** Edit Text용: 페이지의 텍스트 스팬을 표시 공간 정규화 좌표로 추출 */
export async function extractTextSpans(ref: PageRef): Promise<TextSpan[]> {
  if (ref.docId === 'blank') return []
  const page = await docs.get(ref.docId)!.proxy.getPage(ref.pageIndex + 1)
  const rotation = (page.rotate + ref.extraRotation) % 360
  const vp = page.getViewport({ scale: 1, rotation })
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
