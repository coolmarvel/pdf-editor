/**
 * 캔버스/이미지 공용 유틸 — 스탬프·워터마크·저장·이미지 가져오기·오버레이가 각자 들고 있던
 * "캔버스 만들기 → 그리기 → 비트맵 뽑기 → 버리기" 보일러플레이트를 한곳에 모은다.
 *
 * 임시 캔버스는 수 MB 짜리 백킹 스토어라 GC 를 기다리지 않고 `releaseCanvas` 로 즉시 비운다.
 */
import type { PageObject } from '@core/objects'

export interface Bitmap {
  dataUrl: string
  aspect: number
}

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  return { canvas, ctx }
}

/** 백킹 스토어 해제 (0×0 으로 만들면 즉시 메모리가 풀린다) */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}

/** PNG dataUrl + 종횡비. 뽑고 나면 캔버스는 비운다 (임시 캔버스 전용) */
export function toBitmap(canvas: HTMLCanvasElement): Bitmap {
  const out = { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }
  releaseCanvas(canvas)
  return out
}

/** 인코딩된 바이트 (toBlob — dataUrl/base64 왕복 없이 바로 Uint8Array). 캔버스는 호출부가 비운다 */
export async function canvasBytes(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality))
  if (!blob) throw new Error('image encode failed')
  return new Uint8Array(await blob.arrayBuffer())
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 이미지 파일 → dataUrl + 종횡비 */
export function fileToDataUrl(file: File): Promise<Bitmap> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  }).then((dataUrl) => loadImage(dataUrl).then((img) => ({ dataUrl, aspect: img.width / img.height })))
}

/** dataUrl(서명 등) → 투명 배경 PNG 바이트로 재인코딩 (JPEG 로 넣은 이미지도 PNG 컨테이너로 통일). 데스크톱 저장·웹 내려받기 공용 */
export async function signPngBytes(dataUrl: string): Promise<Uint8Array> {
  const img = await loadImage(dataUrl)
  const { canvas, ctx } = makeCanvas(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, 0, 0)
  try {
    return await canvasBytes(canvas, 'image/png')
  } finally {
    releaseCanvas(canvas)
  }
}

/**
 * 한 줄 텍스트 → 가운데 정렬 비트맵 (타이핑 서명·워터마크 공용).
 * 폭 = 실측 + padX*2 (최소 100px), 높이 = fontPx × lineFactor.
 */
export function renderTextBitmap(text: string, cssFont: string, color: string, opt: { fontPx: number; padX: number; lineFactor: number }): Bitmap {
  const { ctx: m } = makeCanvas(1, 1)
  m.font = cssFont
  const w = Math.max(m.measureText(text).width + opt.padX * 2, 100)
  releaseCanvas(m.canvas)
  const { canvas, ctx } = makeCanvas(Math.ceil(w), Math.ceil(opt.fontPx * opt.lineFactor))
  ctx.font = cssFont
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  return toBitmap(canvas)
}

// ── 이미지 객체 디코드 캐시 ──
// 프라미스를 캐시해 디코드 중에 다시 요청돼도 새 Image 를 만들지 않는다 (표준 프라미스 메모이즈).
// 그리기(drawObjects)는 동기라 완료된 요소는 loaded 에 따로 둔다.
const pending = new Map<string, Promise<HTMLImageElement>>()
const loaded = new Map<string, HTMLImageElement>()

/** dataUrl 이미지를 미리 로드. 같은 dataUrl 은 한 번만 디코드한다 */
export function preloadImage(dataUrl: string): Promise<HTMLImageElement> {
  let p = pending.get(dataUrl)
  if (!p) {
    p = loadImage(dataUrl).then((img) => {
      loaded.set(dataUrl, img)
      return img
    })
    // 실패는 캐시에 남기지 않는다 — 다음 호출이 재시도
    p.catch(() => pending.delete(dataUrl))
    pending.set(dataUrl, p)
  }
  return p
}

/** 문서를 닫을 때 디코드 캐시를 비운다 — 서명·스탬프·삽입 이미지 비트맵(수 MB씩)이 탭 수명 동안 남지 않게. 필요하면 preloadImage 가 다시 디코드한다 */
export function clearImageCache(): void {
  pending.clear()
  loaded.clear()
}

/** 디코드가 끝난 이미지 (없으면 undefined — 그리기는 건너뛴다) */
export function cachedImage(dataUrl: string): HTMLImageElement | undefined {
  return loaded.get(dataUrl)
}

/** 이미지/워터마크 객체의 dataUrl (그 외 객체는 없음) */
export function imageUrlsOf(objects: PageObject[]): string[] {
  const out: string[] = []
  for (const o of objects) if (o.type === 'image' || o.type === 'watermark') out.push(o.dataUrl)
  return out
}

/** 페이지 객체 중 이미지/워터마크를 전부 디코드해 둔다 (실패는 무시 — 해당 객체만 안 그려진다) */
export function preloadObjectImages(objects: PageObject[]): Promise<void> {
  return Promise.all(imageUrlsOf(objects).map((u) => preloadImage(u).catch(() => null))).then(() => undefined)
}
