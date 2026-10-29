/**
 * 이미지 파일 → 1페이지 PDF 바이트.
 *
 * 왜 이렇게 하나: 이 앱의 페이지 모델(`core/pages.ts`)은 페이지를 `PageRef{docId,pageIndex}`
 * 참조로만 들고 실제 바이트는 저장 시점(`pdf/save.ts`)에 조립한다. 이미지 전용 페이지 타입을
 * 새로 만들면 저장·썸네일·회전·객체 얹기를 전부 분기해야 하므로, **이미지를 먼저 1페이지 PDF로
 * 감싸서** 기존 `pageImport(bytes)` 파이프라인에 그대로 흘려보낸다.
 *
 * 페이지 크기 정책:
 * - 기준 문서의 페이지 크기를 그대로 쓰고, 이미지는 비율 유지로 fit(잘림 없음).
 * - 이미지가 가로인데 기준 용지가 세로면 **같은 용지의 가로 방향**으로 자동 전환(그 반대도).
 *   → 용지 규격은 유지되면서 위아래 흰 띠 낭비가 사라진다.
 * - 여백 0 (가장자리까지 꽉).
 *
 * 조립: Rust 엔진 `buildDocument`(빈 페이지 + `under` 이미지). 비트맵은 PNG/JPEG 바이트 그대로, 그 외 포맷·EXIF 회전·과대 이미지는 캔버스로 다시 구운다.
 */
import type { EngineBuildSpec, EnginePageSpec } from '@renderer/engine/types'
import { wasmEngine } from '@renderer/engine/client'
import { makeCanvas, releaseCanvas, canvasBytes } from '@renderer/editor/canvasUtil'

/** 재인코딩 시 긴 변 상한 (A4 300dpi ≈ 3508px). 원본이 이보다 크면 저장 파일이 과하게 불어난다 */
const MAX_EDGE = 3508
/** 재인코딩 JPEG 품질 */
const JPEG_QUALITY = 0.92

export interface ImagePageOptions {
  /** 기준 페이지 크기(pt) */
  pageW: number
  /** 기준 페이지 크기(pt) */
  pageH: number
}

export const A4: ImagePageOptions = { pageW: 595.28, pageH: 841.89 }

/** 확장자가 아니라 매직 바이트로 판별 (사용자가 png 를 .jpg 로 저장해둔 경우가 흔하다) */
function sniff(raw: Uint8Array): 'jpeg' | 'png' | 'other' {
  if (raw[0] === 0xff && raw[1] === 0xd8) return 'jpeg'
  if (raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47) return 'png'
  return 'other'
}

/**
 * JPEG EXIF Orientation 태그(0x0112) 읽기. 1(정방향)/없음이면 원본 바이트를 그대로 임베드해
 * 화질·용량을 보존하고, 그 외(휴대폰 사진의 6/8 회전 등)면 캔버스로 다시 그려 방향을 굽는다.
 * 파싱 실패는 전부 1로 간주 (재인코딩하지 않음 = 기존 동작).
 */
function jpegOrientation(raw: Uint8Array): number {
  try {
    if (raw[0] !== 0xff || raw[1] !== 0xd8) return 1
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 2
    while (off + 4 <= raw.length) {
      if (dv.getUint8(off) !== 0xff) return 1
      const marker = dv.getUint8(off + 1)
      if (marker === 0xda || marker === 0xd9) return 1 // SOS/EOI — 이미지 데이터 시작
      const size = dv.getUint16(off + 2)
      if (size < 2) return 1
      if (marker === 0xe1 && off + 4 + 6 <= raw.length) {
        const app1 = off + 4
        if (dv.getUint32(app1) !== 0x45786966) return 1 // "Exif"
        const tiff = app1 + 6
        if (tiff + 8 > raw.length) return 1
        const little = dv.getUint16(tiff) === 0x4949
        const ifd0 = tiff + dv.getUint32(tiff + 4, little)
        if (ifd0 + 2 > raw.length) return 1
        const count = dv.getUint16(ifd0, little)
        for (let i = 0; i < count; i++) {
          const e = ifd0 + 2 + i * 12
          if (e + 12 > raw.length) return 1
          if (dv.getUint16(e, little) === 0x0112) return dv.getUint16(e + 8, little)
        }
        return 1
      }
      off += 2 + size
    }
  } catch {
    /* 손상된 EXIF — 원본 그대로 쓴다 */
  }
  return 1
}

/** 비트맵을 캔버스로 다시 그려 인코딩. 투명 픽셀은 흰 종이 위에 얹는다(페이지 배경과 동일) */
async function reencode(bmp: ImageBitmap, asPng: boolean): Promise<{ bytes: Uint8Array; kind: 'jpeg' | 'png' }> {
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const { canvas, ctx } = makeCanvas(w, h)
  try {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    return { bytes: await canvasBytes(canvas, asPng ? 'image/png' : 'image/jpeg', JPEG_QUALITY), kind: asPng ? 'png' : 'jpeg' }
  } finally {
    releaseCanvas(canvas)
  }
}

/** 디코드 결과 — `passthrough` 면 원본 바이트(PNG/JPEG)를 그대로 임베드할 수 있다 */
interface DecodedImage {
  raw: Uint8Array
  type: 'jpeg' | 'png' | 'other'
  bmp: ImageBitmap
  passthrough: boolean
}

/**
 * 이미지 파일을 디코드한다. 디코딩 불가 포맷(HEIC/TIFF 등 Chromium 미지원)은 throw — 호출부에서 안내.
 * EXIF 회전은 브라우저가 적용해 준다 — 우리는 "적용 결과"(bmp)만 쓰면 된다. 호출자가 `bmp.close()` 를 책임진다.
 */
async function decodeImage(file: Blob): Promise<DecodedImage> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const type = sniff(raw)
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const oversized = Math.max(bmp.width, bmp.height) > MAX_EDGE
  const rotated = type === 'jpeg' && jpegOrientation(raw) !== 1
  return { raw, type, bmp, passthrough: type !== 'other' && !oversized && !rotated }
}

/** 용지(pw×ph)와 이미지 자리 — 이미지 방향에 맞춰 용지 방향만 전환(규격 유지), 비율 유지 fit, 가운데 */
function placeOnPaper(imgW: number, imgH: number, opt: ImagePageOptions): { pw: number; ph: number; x: number; y: number; w: number; h: number } {
  let pw = opt.pageW
  let ph = opt.pageH
  if (imgW > imgH !== pw > ph) {
    const t = pw
    pw = ph
    ph = t
  }
  const s = Math.min(pw / imgW, ph / imgH)
  const w = imgW * s
  const h = imgH * s
  return { pw, ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h }
}

/**
 * 이미지 여러 장 → 각각 1페이지인 PDF 한 개 (선택 순서 유지). Rust 엔진 `buildDocument` 에 이미지마다 빈 페이지 + `under` 이미지 한 장을
 * 명세로 보내 한 번에 조립한다. 첫 시도는 PNG/JPEG 원본 바이트 그대로(엔진이 디코드·JPEG 는 DCTDecode 통과) → 엔진이 못 읽는 변종
 * (16bit PNG 등)이면 빌드가 실패하므로 전부 캔버스로 다시 구워 한 번 재시도.
 */
export async function imageFilesToPdfBytes(files: Blob[], opt: ImagePageOptions): Promise<Uint8Array> {
  const decoded: DecodedImage[] = []
  try {
    for (const f of files) decoded.push(await decodeImage(f))
    const build = async (reencodeAll: boolean): Promise<Uint8Array> => {
      const bitmaps: Uint8Array[] = []
      const pages: EnginePageSpec[] = []
      for (const d of decoded) {
        // buildDocument 가 비트맵 버퍼를 transfer 하므로 원본은 사본으로 보낸다(재시도가 다시 쓸 수 있게)
        const bytes = d.passthrough && !reencodeAll ? d.raw.slice() : (await reencode(d.bmp, d.type === 'png')).bytes
        const { pw, ph, x, y, w, h } = placeOnPaper(d.bmp.width, d.bmp.height, opt)
        pages.push({ width: pw, height: ph, under: [{ bitmap: bitmaps.length, x, y, w, h }] })
        bitmaps.push(bytes)
      }
      const spec: EngineBuildSpec = { pages }
      return wasmEngine.buildDocument(JSON.stringify(spec), bitmaps)
    }
    if (!decoded.some((d) => d.passthrough)) return await build(true)
    try {
      return await build(false)
    } catch {
      return await build(true)
    }
  } finally {
    for (const d of decoded) d.bmp.close()
  }
}

/** 확장자/MIME 기반 1차 필터 (실제 판별은 매직 바이트) */
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.bmp,image/*'

export function isImageFile(f: File): boolean {
  if (f.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)
}
