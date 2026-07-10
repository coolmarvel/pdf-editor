/**
 * 워터마크 텍스트 → 비트맵 사전 렌더 (renderTypedSign 과 같은 접근).
 * 텍스트도 비트맵으로 만들어 두면 draw.ts 는 이미지 하나만 그리면 되고,
 * 화면 오버레이와 저장 굽기가 자동으로 동일해진다.
 */
import { fontCss } from '@renderer/editor/draw'

export function renderWatermarkText(text: string, font: string, color: string): { dataUrl: string; aspect: number } {
  const scale = 3
  const fontPx = 64 * scale
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const cssFont = `bold ${fontPx}px ${fontCss(font)}`
  ctx.font = cssFont
  const w = Math.max(ctx.measureText(text).width + 24 * scale, 100)
  canvas.width = Math.ceil(w)
  canvas.height = Math.ceil(fontPx * 1.3)
  ctx.font = cssFont // canvas 크기 변경으로 리셋된 컨텍스트 복구
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height }
}
