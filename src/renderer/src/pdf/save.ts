/**
 * 저장 파이프라인 (pdf-lib).
 *
 * 전략: 새 문서를 만들고 각 페이지를 **표시 방향 그대로 평탄화**해서 embedPage로 얹는다.
 * - 페이지 삭제/복제/순서/회전/빈페이지/가져오기가 전부 자연스럽게 처리된다.
 * - 오버레이(그리기·텍스트·도형·이미지)는 표시 공간에서 투명 PNG로 렌더해 페이지 전체에 얹는다.
 *   (원본 PDF 내용은 벡터 유지, 얹은 것만 비트맵)
 * - 링크/노트는 눈에 그리지 않고 실제 PDF 주석(Link/Text Annot)으로 넣는다.
 */
import { PDFDocument, PDFName, PDFString, PDFHexString, PDFArray, degrees } from 'pdf-lib'
import type { PDFPage, PDFObject } from 'pdf-lib'
import type { PageRef } from '@core/pages'
import type { PageObject, LinkObj, NoteObj } from '@core/objects'
import { getDocBytes, renderPage } from './docs'
import { drawObjects, preloadImage, effectiveBlend } from '@renderer/editor/draw'

/** 오버레이 굽기 해상도 (pt → px 배율). 2.5 ≈ 180dpi */
const BURN_SCALE = 2.5

interface SaveInput {
  pages: PageRef[]
  objectsByPage: Record<string, PageObject[]>
  /** 표시 크기(pt) — 스토어가 이미 알고 있는 값 (blank 포함) */
  displaySizes: Record<string, { w: number; h: number }>
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return [1, 0.9, 0.3]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

async function burnOverlayPng(objects: PageObject[], dw: number, dh: number, ref: PageRef): Promise<string | null> {
  const drawable = objects.filter((o) => o.type !== 'link' && o.type !== 'note')
  if (drawable.length === 0) return null
  // 이미지 객체 사전 로드
  await Promise.all(drawable.filter((o) => o.type === 'image').map((o) => preloadImage((o as { dataUrl: string }).dataUrl)))
  const canvas = document.createElement('canvas')
  const scale = Math.min(BURN_SCALE, 4000 / Math.max(dw, dh))
  const W = Math.round(dw * scale)
  const H = Math.round(dh * scale)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const blended = drawable.some((o) => effectiveBlend(o) !== 'normal')
  if (!blended) {
    drawObjects(ctx, drawable, W, H, 'export')
    return canvas.toDataURL('image/png')
  }

  // ── 혼합 모드가 있으면 페이지 래스터를 백드롭으로 깔고 블렌드한 뒤,
  //    객체가 덮는 영역만 남긴다(destination-in) — 그 조각을 원본 벡터 위에 얹으면
  //    화면과 동일한 블렌드 결과가 되고 나머지 영역은 벡터가 유지된다.
  const pageCanvas = document.createElement('canvas')
  await renderPage(ref, pageCanvas, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(pageCanvas, 0, 0, W, H)
  drawObjects(ctx, drawable, W, H, 'export')
  // 커버리지 마스크 (반투명 객체도 완전히 남도록 알파 증폭 — 굽힌 픽셀에 이미 혼합 결과가 들어있음)
  const mask = document.createElement('canvas')
  mask.width = W
  mask.height = H
  const mctx = mask.getContext('2d')!
  drawObjects(mctx, drawable, W, H, 'export')
  const mi = mctx.getImageData(0, 0, W, H)
  for (let i = 3; i < mi.data.length; i += 4) {
    const a = mi.data[i]
    if (a > 0) mi.data[i] = Math.min(255, a * 3)
  }
  mctx.putImageData(mi, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return canvas.toDataURL('image/png')
}

/** embedPage를 표시 방향에 맞게 회전해 얹는다. R = (소스회전 + 추가회전) % 360 */
function drawEmbeddedRotated(
  page: PDFPage,
  embedded: Awaited<ReturnType<PDFDocument['embedPage']>>,
  R: number,
  dw: number,
  dh: number
): void {
  switch (((R % 360) + 360) % 360) {
    case 0:
      page.drawPage(embedded, { x: 0, y: 0 })
      break
    case 90:
      // p → (0,dh) + rot(-90)·p = (py, dh-px)
      page.drawPage(embedded, { x: 0, y: dh, rotate: degrees(-90) })
      break
    case 180:
      page.drawPage(embedded, { x: dw, y: dh, rotate: degrees(180) })
      break
    case 270:
      page.drawPage(embedded, { x: dw, y: 0, rotate: degrees(90) })
      break
  }
}

export async function buildPdf(input: SaveInput): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const srcCache = new Map<string, PDFDocument>()

  async function srcDoc(docId: string): Promise<PDFDocument> {
    let d = srcCache.get(docId)
    if (!d) {
      d = await PDFDocument.load(getDocBytes(docId), { ignoreEncryption: true })
      srcCache.set(docId, d)
    }
    return d
  }

  const newPages: PDFPage[] = []
  const linkAnnots: { page: PDFPage; dw: number; dh: number; link: LinkObj }[] = []
  const noteAnnots: { page: PDFPage; dw: number; dh: number; note: NoteObj }[] = []

  for (const ref of input.pages) {
    const size = input.displaySizes[ref.id]
    if (!size) throw new Error(`no display size for page ${ref.id}`)
    const { w: dw, h: dh } = size
    const page = out.addPage([dw, dh])
    newPages.push(page)

    if (ref.docId !== 'blank') {
      const src = await srcDoc(ref.docId)
      const srcPage = src.getPage(ref.pageIndex)
      const srcRotate = srcPage.getRotation().angle
      const embedded = await out.embedPage(srcPage)
      drawEmbeddedRotated(page, embedded, srcRotate + ref.extraRotation, dw, dh)
    }

    const objects = input.objectsByPage[ref.id] ?? []
    const png = await burnOverlayPng(objects, dw, dh, ref)
    if (png) {
      const img = await out.embedPng(png)
      page.drawImage(img, { x: 0, y: 0, width: dw, height: dh })
    }
    for (const o of objects) {
      if (o.type === 'link') linkAnnots.push({ page, dw, dh, link: o })
      if (o.type === 'note') noteAnnots.push({ page, dw, dh, note: o })
    }
  }

  // ── 주석(Annots) 추가: 페이지가 전부 만들어진 뒤 (page 링크 대상 참조 필요) ──
  for (const { page, dw, dh, link } of linkAnnots) {
    const r = link.rect
    const x1 = r.x * dw
    const y1 = dh - (r.y + r.h) * dh
    const x2 = (r.x + r.w) * dw
    const y2 = dh - r.y * dh
    let action
    if (link.target.kind === 'url') {
      const url = /^https?:\/\//i.test(link.target.url) ? link.target.url : `https://${link.target.url}`
      action = out.context.obj({ Type: 'Action', S: 'URI', URI: PDFString.of(url) })
    } else {
      const idx = Math.min(Math.max(1, link.target.page), newPages.length) - 1
      action = out.context.obj({ Type: 'Action', S: 'GoTo', D: [newPages[idx].ref, PDFName.of('Fit')] })
    }
    const annot = out.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x1, y1, x2, y2],
      Border: [0, 0, 0],
      A: action
    })
    addAnnot(page, out, annot)
  }

  for (const { page, dw, dh, note } of noteAnnots) {
    const x = note.x * dw
    const y = dh - note.y * dh
    const annot = out.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [x, y - 20, x + 20, y],
      Contents: PDFHexString.fromText(note.text),
      Name: 'Comment',
      C: hexToRgb(note.color),
      F: 4 // Print flag
    })
    addAnnot(page, out, annot)
  }

  return out.save()
}

function addAnnot(page: PDFPage, doc: PDFDocument, annot: PDFObject): void {
  const ref = doc.context.register(annot)
  const existing = page.node.lookup(PDFName.of('Annots'))
  if (existing instanceof PDFArray) {
    existing.push(ref)
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([ref]))
  }
}
