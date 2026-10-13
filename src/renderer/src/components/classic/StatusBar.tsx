/**
 * 하단 상태 줄(22px) — 오목한 칸(pane)들 (ADR-0004, sh-compositor `chrome/StatusBar.tsx`·remote-assist status-bar 문법).
 * 왼쪽 메시지 칸이 남은 폭을 쓰고, 오른쪽 칸들은 내용 폭. 진행 중이면 메시지 칸 끝에 진행 막대.
 */
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import { ui } from '@renderer/theme'

const { color, chrome, size, space, font, surface } = ui.classic

/** 오목한 칸 — 클래식 상태 줄 패널. 위·왼쪽은 어두운 선, 아래·오른쪽은 흰 선 */
export function Pane({ children, grow, testId, sx }: { children: React.ReactNode; grow?: boolean; testId?: string; sx?: object }): JSX.Element {
  return (
    <Box
      className="tnum"
      data-testid={testId}
      sx={{
        height: 18,
        px: `${space.md}px`,
        display: 'flex',
        alignItems: 'center',
        gap: `${space.sm}px`,
        flex: grow ? 1 : 'none',
        minWidth: 0,
        borderTop: `1px solid ${chrome.statusTop}`,
        borderLeft: `1px solid ${chrome.statusTop}`,
        borderRight: `1px solid ${color.canvas}`,
        borderBottom: `1px solid ${color.canvas}`,
        fontSize: font.xs,
        color: color.textSecondary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

export interface StatusBarProps {
  /** 왼쪽 문장 (진행 중이면 진행 문구) */
  message: React.ReactNode
  /** 진행률 — undefined = 진행 없음, null = 불확정 */
  progress?: number | null
  /** 오른쪽 칸들 */
  panes: React.ReactNode[]
}

export default function StatusBar({ message, progress, panes }: StatusBarProps): JSX.Element {
  const busy = progress !== undefined
  return (
    <Box
      data-testid="statusbar"
      sx={{ height: size.statusBar, flexShrink: 0, display: 'flex', alignItems: 'center', gap: `${space.xs}px`, px: `${space.xs}px`, background: surface.status, borderTop: `1px solid ${chrome.frame}`, minWidth: 0 }}
    >
      <Pane grow>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', color: busy ? color.text : undefined }}>
          {message}
        </Box>
        {busy && <LinearProgress variant={progress != null ? 'determinate' : 'indeterminate'} value={progress ?? 0} sx={{ width: 120, height: 10, flexShrink: 0, ml: 'auto' }} />}
      </Pane>
      {panes}
    </Box>
  )
}
