/**
 * 저장 파이프라인 — Rust/wasm 엔진 `build_document`(모노레포 ADR-0003 3단계 쓰기 명세).
 *
 * 전략(v1.7.2 와 같은 결과 모양):
 * - 원본 페이지는 엔진이 **원본 문서당 복사기 하나**로 옮긴다(페이지 콘텐츠·서체·이미지 벡터 그대로, 공유 서체 1회).
 *   사용자 추가 회전·빈 페이지·삭제/복제/순서/가져오기는 페이지 명세(`doc/page/rotation`, 문서 없음 = 빈 페이지)로 표현된다.
 * - 오버레이(그리기·텍스트·도형·이미지·텍스트 수정의 흰 덮기)는 표시 공간에서 투명 PNG 한 장으로 렌더해 페이지 전체에 얹는다(`overlay`).
 *   (원본 PDF 내용은 벡터 유지, 얹은 것만 비트맵 — 객체를 벡터로 적는 모노레포의 `items` 경로는 쓰지 않는다)
 * - 링크/노트는 눈에 그리지 않고 실제 PDF 주석(Link/Text Annot)으로 넣는다(`links`/`notes`; 엔진이 https:// 를 붙이고 페이지 번호를 1..n 으로 자른다).
 */
import type { PageRef } from '@core/pages'
import type { PageObject } from '@core/objects'
import type { EngineBuildSpec, EngineLinkSpec, EngineNoteSpec, EnginePageSpec } from '@renderer/engine/types'
import { wasmEngine } from '@renderer/engine/client'
import { renderPage } from './docs'
import { engineDocOf } from './registry'
import { drawObjects, effectiveBlend } from '@renderer/editor/draw'
import { makeCanvas, releaseCanvas, canvasBytes, imageUrlsOf, preloadImage } from '@renderer/editor/canvasUtil'

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

/** 오버레이 PNG 바이트 (그릴 객체가 없으면 null). 임시 캔버스는 뽑는 즉시 비운다 — 저장 중 페이지 수만큼 쌓이지 않게 */
async function burnOverlayPng(objects: PageObject[], dw: number, dh: number, ref: PageRef): Promise<Uint8Array | null> {
  const drawable = objects.filter((o) => o.type !== 'link' && o.type !== 'note')
  if (drawable.length === 0) return null
  // 이미지 객체 사전 로드
  await Promise.all(imageUrlsOf(drawable).map(preloadImage))
  const scale = Math.min(BURN_SCALE, 4000 / Math.max(dw, dh))
  const W = Math.round(dw * scale)
  const H = Math.round(dh * scale)
  const { canvas, ctx } = makeCanvas(W, H)
  const temps: HTMLCanvasElement[] = [canvas]
  try {
    const blended = drawable.some((o) => effectiveBlend(o) !== 'normal')
    if (!blended) {
      drawObjects(ctx, drawable, W, H, 'export')
      return await canvasBytes(canvas, 'image/png')
    }

    // ── 혼합 모드가 있으면 페이지 래스터를 백드롭으로 깔고 블렌드한 뒤,
    //    객체가 덮는 영역만 남긴다(destination-in) — 그 조각을 원본 벡터 위에 얹으면
    //    화면과 동일한 블렌드 결과가 되고 나머지 영역은 벡터가 유지된다.
    const pageCanvas = document.createElement('canvas')
    temps.push(pageCanvas)
    // 화면 렌더와 다른 key — 같은 페이지의 화면 렌더가 큐에서 이 요청을 밀어내지 않게
    await renderPage(ref, pageCanvas, scale, { key: `${ref.id}:export` })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(pageCanvas, 0, 0, W, H)
    drawObjects(ctx, drawable, W, H, 'export')
    // 커버리지 마스크 (반투명 객체도 완전히 남도록 알파 증폭 — 굽힌 픽셀에 이미 혼합 결과가 들어있음)
    const { canvas: mask, ctx: mctx } = makeCanvas(W, H)
    temps.push(mask)
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
    return await canvasBytes(canvas, 'image/png')
  } finally {
    temps.forEach(releaseCanvas)
  }
}

export async function buildPdf(input: SaveInput): Promise<Uint8Array> {
  const bitmaps: Uint8Array[] = []
  const pages: EnginePageSpec[] = []
  for (const ref of input.pages) {
    const size = input.displaySizes[ref.id]
    if (!size) throw new Error(`no display size for page ${ref.id}`)
    const { w: dw, h: dh } = size
    const objects = input.objectsByPage[ref.id] ?? []
    const spec: EnginePageSpec = { width: dw, height: dh }
    if (ref.docId !== 'blank') {
      spec.doc = await engineDocOf(ref.docId)
      spec.page = ref.pageIndex
      spec.rotation = ((ref.extraRotation % 360) + 360) % 360
    }
    const png = await burnOverlayPng(objects, dw, dh, ref)
    if (png) {
      spec.overlay = bitmaps.length
      bitmaps.push(png)
    }
    const links: EngineLinkSpec[] = []
    const notes: EngineNoteSpec[] = []
    for (const o of objects) {
      if (o.type === 'link') {
        const r = o.rect
        const target = o.target.kind === 'url' ? { url: o.target.url } : { page: o.target.page }
        links.push({ x: r.x * dw, y: r.y * dh, w: r.w * dw, h: r.h * dh, ...target })
      } else if (o.type === 'note') {
        notes.push({ x: o.x * dw, y: o.y * dh, text: o.text, color: hexToRgb(o.color) })
      }
    }
    if (links.length) spec.links = links
    if (notes.length) spec.notes = notes
    pages.push(spec)
  }
  const build: EngineBuildSpec = { pages }
  return wasmEngine.buildDocument(JSON.stringify(build), bitmaps)
}
