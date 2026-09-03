import type { TextObj, EditTextObj } from '@core/objects'
import { TEXT_LINE_HEIGHT } from '@core/objects'
import { fontCss, measureTextWidthPx } from '@renderer/editor/draw'

interface Props {
  obj: TextObj | EditTextObj
  value: string
  /** 페이지 CSS 크기(px) — 글자 크기·상자 폭은 페이지 높이 비율로 저장돼 있어 px 환산에 필요 */
  cssW: number
  cssH: number
  /** 최초 1회 캐럿 위치(클릭 지점). 이후 타이핑 캐럿은 건드리지 않는다 */
  caret?: number
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
}

/** 인라인 텍스트 편집기 — 내용만큼 자라는 textarea. 확정 후 캔버스에 그려질 위치·글자와 정확히 겹치도록 테두리·패딩만큼 당겨 놓는다 */
export default function InlineTextEditor({ obj, value, cssW, cssH, caret, onChange, onCommit, onCancel }: Props): JSX.Element {
  const fontPx = obj.size * cssH
  const isText = obj.type === 'text'
  const padX = 6
  const padY = 4
  const bw = 1
  const textW = measureTextWidthPx(value, obj.size, obj.font, obj.bold, obj.italic, cssH)
  const lineCount = value.split('\n').length
  // editText 는 최소 원본 상자 폭, 그 외엔 내용 실측 폭 (textarea 기본 rows/cols 크기 방지)
  const minWpx = isText ? 0 : obj.box.w * cssW
  const innerW = Math.max(textW + Math.max(4, fontPx * 0.15), fontPx * 0.9, minWpx)
  // 상자 높이(h)가 내용보다 크면 세로 정렬 위치에 입력창을 띄운다 (그려질 위치와 일치)
  const contentHpx = lineCount * fontPx * TEXT_LINE_HEIGHT
  const boxHpx = isText && obj.h > 0 ? Math.max(obj.h * cssH, contentHpx) : contentHpx
  const vOff = !isText ? 0 : obj.valign === 'middle' ? (boxHpx - contentHpx) / 2 : obj.valign === 'bottom' ? boxHpx - contentHpx : 0
  return (
    <textarea
      autoFocus
      onFocus={(e) => { if (window.matchMedia('(pointer: coarse)').matches) e.currentTarget.scrollIntoView({ block: 'center', inline: 'nearest' }) }} // 소프트 키보드에 가리지 않게
      wrap="off"
      spellCheck={false}
      ref={(el) => {
        if (el && caret != null && el.dataset.caretApplied !== '1') {
          el.dataset.caretApplied = '1'
          const c = Math.min(caret, el.value.length)
          el.setSelectionRange(c, c)
        }
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
      style={{
        position: 'absolute',
        left: `${(isText ? obj.x : obj.box.x) * 100}%`,
        top: `calc(${(isText ? obj.y : obj.box.y) * 100}% + ${vOff}px)`,
        marginLeft: -(padX + bw),
        marginTop: -(padY + bw),
        boxSizing: 'border-box',
        width: innerW + (padX + bw) * 2,
        height: lineCount * fontPx * TEXT_LINE_HEIGHT + (padY + bw) * 2,
        padding: `${padY}px ${padX}px`,
        fontSize: fontPx,
        fontFamily: fontCss(obj.font),
        fontWeight: obj.bold ? 700 : 400,
        fontStyle: obj.italic ? 'italic' : 'normal',
        textDecoration: isText && obj.underline ? 'underline' : undefined,
        textAlign: isText ? obj.align : undefined,
        transform: isText && obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
        transformOrigin: 'center center',
        color: obj.color,
        caretColor: '#111',
        lineHeight: TEXT_LINE_HEIGHT,
        // "입력 팝업" 느낌 제거: 얇은 테두리만, 그림자 없음, 배경은 제자리 그대로 (editText 는 원본 글자를 덮어야 하므로 흰 배경)
        border: `${bw}px solid #7aabf0`,
        borderRadius: 2,
        outline: 'none',
        background: isText ? (obj.bgColor ?? 'transparent') : '#fff',
        resize: 'none',
        margin: 0,
        overflow: 'hidden',
        whiteSpace: 'pre',
        zIndex: 5
      }}
    />
  )
}
