/**
 * 스탬프 비트맵 생성 — 프리셋/커스텀 모두 캔버스로 그려 dataUrl(ImageObj)로 얹는다.
 * 프리셋 25종 = pdfguru 기본 스탬프 세트 (직사각 20 + 날짜자동 2 + 화살표 태그 3 + 도형 2).
 */

export interface StampSpec {
  text: string
  /** 테두리·글자 색 (진한 톤) */
  color: string
  /** 채움 배경색 (파스텔 톤) */
  bg: string
  /** rect(기본) | tagLeft(왼쪽 화살표 태그 — SIGN HERE 류) */
  shape?: 'rect' | 'tagLeft'
  /** 아이콘 스탬프 (text 무시): 빨간 X / 초록 체크 */
  icon?: 'cross' | 'check'
  /** true 면 선택 시점의 날짜·시간이 서브텍스트로 들어감 (REVISED/REJECTED) */
  autoDateTime?: boolean
  date?: string
  time?: string
}

// Guru 팔레트 근사
const GREEN = { color: '#37651d', bg: '#c0df9e' }
const RED = { color: '#c02b36', bg: '#fb9ba1' }
const INDIGO = { color: '#2b3390', bg: '#99a1dd' }
const PURPLE = { color: '#4b3ba8', bg: '#bfa9f2' }
const YELLOW = { color: '#a98a00', bg: '#fdf3a1' }

export const PRESET_STAMPS: StampSpec[] = [
  { text: 'APPROVED', ...GREEN },
  { text: 'NOT APPROVED', ...RED },
  { text: 'DRAFT', ...INDIGO },
  { text: 'FINAL', ...GREEN },
  { text: 'COMPLETED', ...GREEN },
  { text: 'CONFIDENTIAL', ...INDIGO },
  { text: 'FOR PUBLIC RELEASE', ...INDIGO },
  { text: 'NOT FOR PUBLIC RELEASE', ...INDIGO },
  { text: 'FOR COMMENT', ...INDIGO },
  { text: 'VOID', ...RED },
  { text: 'PRELIMINARY RESULTS', ...INDIGO },
  { text: 'INFORMATION ONLY', ...INDIGO },
  { text: '', ...RED, icon: 'cross' },
  { text: '', ...GREEN, icon: 'check' },
  { text: 'INITIAL HERE', ...PURPLE, shape: 'tagLeft' },
  { text: 'SIGN HERE', ...RED, shape: 'tagLeft' },
  { text: 'WITNESS', ...YELLOW, shape: 'tagLeft' },
  { text: 'AS IS', ...INDIGO },
  { text: 'DEPARTMENTAL', ...INDIGO },
  { text: 'EXPERIMENTAL', ...INDIGO },
  { text: 'EXPIRED', ...INDIGO },
  { text: 'SOLD', ...INDIGO },
  { text: 'TOP SECRET', ...RED },
  { text: 'REVISED', ...INDIGO, autoDateTime: true },
  { text: 'REJECTED', ...RED, autoDateTime: true }
]

export const CUSTOM_STAMP_COLORS = [
  { color: '#c02b36', bg: '#fb9ba1' },
  { color: '#b45309', bg: '#fcd9a8' },
  { color: '#37651d', bg: '#c0df9e' },
  { color: '#2b3390', bg: '#99a1dd' },
  { color: '#a98a00', bg: '#fdf3a1' },
  { color: '#9d174d', bg: '#f9b8d0' }
]

/** Guru 포맷의 현재 날짜·시간 ("07/09/2026", "04:56 PM") */
export function nowStampDateTime(): { date: string; time: string } {
  const n = new Date()
  const date = `${String(n.getMonth() + 1).padStart(2, '0')}/${String(n.getDate()).padStart(2, '0')}/${n.getFullYear()}`
  const h12 = n.getHours() % 12 === 0 ? 12 : n.getHours() % 12
  const time = `${String(h12).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')} ${n.getHours() < 12 ? 'AM' : 'PM'}`
  return { date, time }
}

/** 아이콘 스탬프 (굵은 X / 체크) */
function renderIconStamp(icon: 'cross' | 'check', color: string): { dataUrl: string; aspect: number } {
  const scale = 3
  const S = 96 * scale
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 16 * scale
  ctx.beginPath()
  if (icon === 'cross') {
    ctx.moveTo(S * 0.18, S * 0.18)
    ctx.lineTo(S * 0.82, S * 0.82)
    ctx.moveTo(S * 0.82, S * 0.18)
    ctx.lineTo(S * 0.18, S * 0.82)
  } else {
    ctx.moveTo(S * 0.14, S * 0.55)
    ctx.lineTo(S * 0.4, S * 0.82)
    ctx.lineTo(S * 0.86, S * 0.2)
  }
  ctx.stroke()
  return { dataUrl: canvas.toDataURL('image/png'), aspect: 1 }
}

/** 스탬프를 캔버스에 그려 { dataUrl, aspect(w/h) } 반환 (Guru 스타일: 파스텔 채움 + 진한 이탤릭) */
export function renderStamp(spec: StampSpec): { dataUrl: string; aspect: number } {
  if (spec.icon) {
    // 아이콘은 X=빨강, 체크=초록 고정 톤 (Guru)
    return renderIconStamp(spec.icon, spec.icon === 'cross' ? '#d5565e' : '#82b346')
  }
  const scale = 3
  const fontPx = 34 * scale
  const subPx = 15 * scale
  const padY = 12 * scale
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `italic 800 ${fontPx}px Arial, sans-serif`
  ctx.font = font
  const textW = ctx.measureText(spec.text).width
  const sub = [spec.date, spec.time].filter(Boolean).join(', ')
  const isTag = spec.shape === 'tagLeft'
  const bodyH = padY * 2 + fontPx + (sub ? subPx + 4 * scale : 0)
  const arrowW = isTag ? bodyH * 0.42 : 0
  const padX = 20 * scale
  const w = Math.max(textW + padX * 2, 150 * scale) + arrowW
  canvas.width = Math.ceil(w)
  canvas.height = Math.ceil(bodyH)
  const W = canvas.width
  const H = canvas.height
  const bw = 2.5 * scale // 테두리

  ctx.beginPath()
  if (isTag) {
    // 왼쪽 화살표 태그 (◁▭)
    ctx.moveTo(bw, H / 2)
    ctx.lineTo(arrowW + bw, bw)
    ctx.lineTo(W - bw, bw)
    ctx.lineTo(W - bw, H - bw)
    ctx.lineTo(arrowW + bw, H - bw)
    ctx.closePath()
  } else {
    ctx.roundRect(bw, bw, W - bw * 2, H - bw * 2, 3 * scale)
  }
  ctx.fillStyle = spec.bg
  ctx.fill()
  ctx.lineWidth = bw
  ctx.strokeStyle = spec.color
  ctx.stroke()

  // 본문 (태그는 화살표만큼 오른쪽으로)
  const cx = isTag ? arrowW + (W - arrowW) / 2 : W / 2
  ctx.font = font
  ctx.fillStyle = spec.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(spec.text, cx, padY)
  if (sub) {
    ctx.font = `700 ${subPx}px Arial, sans-serif`
    ctx.fillText(sub, cx, padY + fontPx + 4 * scale)
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
