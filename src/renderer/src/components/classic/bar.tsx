/**
 * 툴바·옵션 바 공용 부품 — 클래식 문법(ADR-0004, sh-compositor `components/bar.tsx` 이식).
 * 직각 · 1px 테두리 · 24px 컨트롤 · 12px 라벨 · 베벨 면. 그룹은 "라벨: 컨트롤" 텍스트 문법, 그룹 사이는 음각 세로 구분선. 색·크기는 전부 classic/tokens.
 */
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import { ui } from '@renderer/theme'

const { color, chrome, size, space, font, surface, focusRing } = ui.classic

/** 통일된 컨트롤 높이 */
export const CTL_H = size.ctlMd

/** 베벨 면 박스 버튼 공통 (팔레트·슬라이더 팝오버 트리거·토글) */
export const bevelSx = {
  height: CTL_H,
  px: `${space.md}px`,
  border: `1px solid ${color.buttonBorder}`,
  background: surface.bevel,
  color: color.text,
  fontSize: font.md,
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: `${space.xs}px`,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  '& svg': { fontSize: size.icon },
  '&:hover': { background: surface.bevelHover, borderColor: color.hoverEdge },
  '&:active': { background: surface.bevelPressed },
  '&.Mui-focusVisible': focusRing,
  '&.Mui-disabled': { color: color.textDisabled, borderColor: color.border, background: color.sunken },
  '@media (pointer: coarse)': { minHeight: size.touch },
} as const

/** 켜진(눌린) 상태 — DEXT5 pressed 면 + edge 테두리 (굵게 켜짐·열린 드롭다운·활성 도구) */
export const pressedSx = {
  background: surface.pressed,
  borderColor: chrome.toolbarEdge,
  color: color.text,
  boxShadow: `inset 1px 1px 0 ${chrome.pressed}`,
  '&:hover': { background: surface.pressed, borderColor: color.hoverEdge },
} as const

/** 툴바 평면 버튼 — 테두리 없는 면, 호버에 1px 파란 테두리 + 흰 면, 활성은 눌린 면 (sh-web-editor 도구 버튼 문법) */
export const flatToolSx = {
  height: CTL_H,
  minWidth: CTL_H,
  px: `${space.sm}px`,
  gap: `${space.sm}px`,
  border: '1px solid transparent',
  color: color.text,
  fontSize: font.md,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  '& svg': { fontSize: size.icon, color: color.textSecondary },
  '&:hover': { bgcolor: color.canvas, borderColor: color.hoverEdge },
  '&:active': { background: surface.pressed, borderColor: chrome.toolbarEdge },
  '&.Mui-focusVisible': focusRing,
  '&.Mui-disabled': { color: color.textDisabled, '& svg': { color: color.textDisabled } },
  '@media (pointer: coarse)': { minHeight: size.touch, minWidth: size.touch },
} as const

/** 그룹: "라벨" + 컨트롤 (라벨에 툴팁). 클래식은 아이콘보다 글자 라벨 */
export function Group({ label, tooltip, children, testId }: { label?: string; tooltip?: string; children: React.ReactNode; testId?: string }): JSX.Element {
  const lab = label ? (
    <Box component="span" sx={{ fontSize: font.md, color: color.textSecondary, whiteSpace: 'nowrap', mr: `${space.xs}px` }}>
      {label}
    </Box>
  ) : null
  return (
    <Box data-testid={testId} sx={{ display: 'flex', alignItems: 'center', gap: `${space.sm}px`, flexShrink: 0 }}>
      {lab && (tooltip ? <Tooltip title={tooltip}>{lab}</Tooltip> : lab)}
      {children}
    </Box>
  )
}

/** 음각 세로 구분선 (진한 선 + 흰 선) */
export function GDivider(): JSX.Element {
  return <Box aria-hidden sx={{ width: '2px', height: 18, flexShrink: 0, mx: `${space.xs}px`, borderLeft: `1px solid ${chrome.separator}`, borderRight: `1px solid ${color.canvas}` }} />
}

/** 정사각 아이콘 토글/버튼 (베벨 면). on 이면 눌린 면 */
export function IconBevel({ icon, tooltip, on, onClick, disabled, testId, ariaLabel }: { icon: JSX.Element; tooltip: string; on?: boolean; onClick: (e: React.MouseEvent<HTMLElement>) => void; disabled?: boolean; testId?: string; ariaLabel?: string }): JSX.Element {
  return (
    <Tooltip title={tooltip}>
      <span style={{ display: 'inline-flex' }}>
        <ButtonBase onClick={onClick} disabled={disabled} aria-label={ariaLabel ?? tooltip} aria-pressed={on} data-testid={testId} sx={{ ...bevelSx, width: CTL_H, px: 0, justifyContent: 'center', ...(on ? pressedSx : null) }}>
          {icon}
        </ButtonBase>
      </span>
    </Tooltip>
  )
}

/** 옵션 바 안내 문구 */
export function Hint({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Box component="span" sx={{ fontSize: font.md, color: color.textSecondary, px: `${space.sm}px`, whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  )
}
