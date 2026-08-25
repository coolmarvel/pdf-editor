/**
 * 워터마크 텍스트 → 비트맵 사전 렌더 (renderTypedSign 과 같은 접근).
 * 텍스트도 비트맵으로 만들어 두면 draw.ts 는 이미지 하나만 그리면 되고,
 * 화면 오버레이와 저장 굽기가 자동으로 동일해진다.
 */
import { fontCss } from '@renderer/editor/draw'
import { renderTextBitmap, type Bitmap } from '@renderer/editor/canvasUtil'

export function renderWatermarkText(text: string, font: string, color: string): Bitmap {
  const scale = 3
  const fontPx = 64 * scale
  return renderTextBitmap(text, `bold ${fontPx}px ${fontCss(font)}`, color, { fontPx, padX: 24 * scale, lineFactor: 1.3 })
}
