/** 패널 제목 띠(22px) — 베벨 면 위에 굵은 라벨, 오른쪽에 작은 버튼 슬롯 (sh-form-designer `Designer.axaml` 패널 제목 문법) */
import Box from '@mui/material/Box'
import { ui } from '@renderer/theme'

const { chrome, size, space, font, surface, color } = ui.classic

export default function PanelTitle({ children, actions, testId }: { children: React.ReactNode; actions?: React.ReactNode; testId?: string }): JSX.Element {
  return (
    <Box
      data-testid={testId}
      sx={{
        height: size.panelTitle,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: `${space.sm}px`,
        px: `${space.base}px`,
        background: surface.bevel,
        borderBottom: `1px solid ${chrome.frame}`,
        fontSize: font.md,
        fontWeight: font.bold,
        color: color.text,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</Box>
      {actions}
    </Box>
  )
}
