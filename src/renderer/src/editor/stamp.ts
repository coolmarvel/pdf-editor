/**
 * 스탬프 비트맵 생성 — 프리셋/커스텀 모두 캔버스로 그려 dataUrl(ImageObj)로 얹는다.
 */

export interface StampSpec {
  text: string
  /** 테두리·글자 색 */
  color: string
  /** 옅은 배경색 */
  bg: string
  date?: string
  time?: string
}

export const PRESET_STAMPS: StampSpec[] = [
  { text: 'APPROVED', color: '#2e7d32', bg: '#dcedc8' },
  { text: 'NOT APPROVED', color: '#c62828', bg: '#ffcdd2' },
  { text: 'DRAFT', color: '#283593', bg: '#c5cae9' },
  { text: 'FINAL', color: '#2e7d32', bg: '#dcedc8' },
  { text: 'COMPLETED', color: '#2e7d32', bg: '#dcedc8' },
  { text: 'CONFIDENTIAL', color: '#283593', bg: '#c5cae9' },
  { text: 'FOR PUBLIC RELEASE', color: '#283593', bg: '#c5cae9' },
  { text: 'NOT FOR PUBLIC RELEASE', color: '#283593', bg: '#c5cae9' },
  { text: 'VOID', color: '#c62828', bg: '#ffcdd2' },
  { text: 'SIGN HERE', color: '#e65100', bg: '#ffe0b2' }
]

export const CUSTOM_STAMP_COLORS = [
  { color: '#c62828', bg: '#ffcdd2' },
  { color: '#e65100', bg: '#ffe0b2' },
  { color: '#2e7d32', bg: '#dcedc8' },
  { color: '#1565c0', bg: '#bbdefb' },
  { color: '#f9a825', bg: '#fff9c4' },
  { color: '#ad1457', bg: '#f8bbd0' }
]

/** 스탬프를 캔버스에 그려 { dataUrl, aspect(w/h) } 반환 */
export function renderStamp(spec: StampSpec): { dataUrl: string; aspect: number } {
  const scale = 3
  const fontPx = 34 * scale
  const subPx = 18 * scale
  const padX = 28 * scale
  const padY = 16 * scale
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `italic 800 ${fontPx}px Arial, sans-serif`
  ctx.font = font
  const textW = ctx.measureText(spec.text).width
  const sub = [spec.date, spec.time].filter(Boolean).join(' ')
  const w = Math.max(textW + padX * 2, 180 * scale)
  const h = padY * 2 + fontPx + (sub ? subPx + 6 * scale : 0)
  canvas.width = Math.ceil(w)
  canvas.height = Math.ceil(h)

  // 배경 + 테두리
  const r = 10 * scale
  ctx.beginPath()
  ctx.roundRect(3 * scale, 3 * scale, canvas.width - 6 * scale, canvas.height - 6 * scale, r)
  ctx.fillStyle = spec.bg
  ctx.fill()
  ctx.lineWidth = 3 * scale
  ctx.strokeStyle = spec.color
  ctx.stroke()

  // 본문
  ctx.font = font
  ctx.fillStyle = spec.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(spec.text, canvas.width / 2, padY)
  if (sub) {
    ctx.font = `700 ${subPx}px Arial, sans-serif`
    ctx.fillText(sub, canvas.width / 2, padY + fontPx + 4 * scale)
  }
  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }
}

/** 타이핑 서명 생성 (Sign > Type 탭) */
export function renderTypedSign(text: string, fontFamily: string, color: string): { dataUrl: string; aspect: number } {
  const scale = 3
  const fontPx = 64 * scale
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${fontPx}px ${fontFamily}`
  const w = Math.max(ctx.measureText(text).width + 40 * scale, 100)
  canvas.width = Math.ceil(w)
  canvas.height = Math.ceil(fontPx * 1.5)
  ctx.font = `${fontPx}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }
}

export const SIGN_FONTS = [
  `'Segoe Script', cursive`,
  `'Brush Script MT', cursive`,
  `'Comic Sans MS', cursive`,
  `'Ink Free', cursive`
]

/** 이미지 파일 → dataUrl + 종횡비 */
export function fileToDataUrl(file: File): Promise<{ dataUrl: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve({ dataUrl: reader.result as string, aspect: img.width / img.height })
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
