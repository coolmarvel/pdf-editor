/**
 * 페이지 인터랙션 레이어의 커서 — SVG 데이터 URL 커서 팩토리 + 도구별 커서 규칙 (순수 함수·상수, React 무관).
 * SVG 커서는 1배율로만 래스터돼 고해상도에서 흐릿하다 → image-set 으로 2x 비트맵을 함께 제공.
 * 흰 외곽선(paint-order: stroke)으로 어두운 배경에서도 또렷하게.
 */

/** 회전 손잡이 전용 커서: 원형 화살표 */
const rotateCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Cpath d='M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z' fill='%231f2430' stroke='white' stroke-width='1.6' paint-order='stroke' stroke-linejoin='round'/%3E%3C/svg%3E")`
export const ROTATE_CURSOR = `-webkit-image-set(${rotateCursorSvg(24)} 1x, ${rotateCursorSvg(48)} 2x) 12 12, grab`

/** 그리기 지우개 커서: 속이 빈 원 (지우개 브러시). 판정 반경(ERASE_CURSOR_R_PX, erase.ts)은 이 원 r=8.5 와 1:1 (보이는 원만큼만 지운다) */
const eraseCursorSvg = (px: number): string =>
  `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='white' stroke-width='3.2'/%3E%3Ccircle cx='12' cy='12' r='8.5' fill='none' stroke='%231f2430' stroke-width='1.5'/%3E%3C/svg%3E")`
const ERASE_CURSOR = `-webkit-image-set(${eraseCursorSvg(24)} 1x, ${eraseCursorSvg(48)} 2x) 12 12, auto`

/** X/체크 도구 커서: 배치될 모양·크기 그대로 노출한다 (px = 화면상 배치 크기와 1:1). */
const MARK_VISUAL_RATIO = 0.75 // viewBox 안에서 마크가 차지하는 비율 (여백 = 흰 외곽선용)
const markCursorSvg = (kind: 'cross' | 'check', color: string, px: number): string => {
  const stroke = color || '#111111'
  const path =
    kind === 'cross'
      ? "<path d='M4 4 L28 28 M28 4 L4 28' />"
      : "<path d='M4 17 L13 26 L28 6' />"
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 32 32'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='white' stroke-width='6'>${path}</g><g stroke='${stroke}' stroke-width='3.4'>${path}</g></g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
/** markPx = 화면에 찍힐 마크의 px 크기 → 커서 박스는 외곽선 여백만큼 키우고 중앙 핫스팟 */
export const MARK_CURSOR = (kind: 'cross' | 'check', color: string, markPx: number): string => {
  const px = Math.min(64, Math.max(16, Math.round(markPx / MARK_VISUAL_RATIO)))
  const hot = Math.round(px / 2)
  return `-webkit-image-set(${markCursorSvg(kind, color, px)} 1x, ${markCursorSvg(kind, color, px * 2)} 2x) ${hot} ${hot}, default`
}

/** 커서 규칙 (Guru): 객체/스팬 호버 = 포인터(👆), 잡고 있는 동안·드래그 = 이동(✥), 그 외 도구별 */
export function cursorFor(a: { tool: string; movingNow: boolean; hoverHit: boolean; hasStrokes: boolean; markCursor: string | null }): string {
  if (a.movingNow) return 'move'
  switch (a.tool) {
    case 'hand':
      return 'grab'
    case 'select':
    case 'editText':
      return a.hoverHit ? 'pointer' : 'default'
    case 'addText':
      return 'text'
    case 'eraseDrawing':
      return a.hasStrokes ? ERASE_CURSOR : 'default' // 낙서가 있어야 지우개 원이 뜬다 (없으면 기본 커서)
    case 'highlight':
      return ERASE_CURSOR // 형광펜도 빈 원 브러시 커서 (사용자 요청)
    case 'cross':
    case 'check':
      return a.markCursor ?? 'default'
    case 'watermark':
      return 'default' // 클릭 배치 도구가 아니므로 + 커서를 쓰지 않는다
    default:
      return 'crosshair'
  }
}
