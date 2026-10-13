import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import { ui } from '@renderer/theme'

const { chrome, space, font, surface } = ui.classic
const BAR_BORDER = `1px solid ${chrome.frame}`

/** 다이얼로그 제목 줄 (px 3 / py 2, 아래 구분선). action 이 있으면 우측 끝에 놓는다 */
export function DialogHeader({ title, action }: { title: string; action?: React.ReactNode }): JSX.Element {
  const label = <Typography sx={{ fontSize: font.xl, fontWeight: font.bold, whiteSpace: 'nowrap' }}>{title}</Typography>
  if (!action) return <Box sx={{ px: `${space.lg}px`, py: `${space.base}px`, borderBottom: BAR_BORDER, background: surface.chrome }}>{label}</Box>
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: `${space.lg}px`, py: `${space.base}px`, borderBottom: BAR_BORDER, background: surface.chrome }}>
      {label}
      {action}
    </Stack>
  )
}

/** 다이얼로그 하단 버튼 줄 (px 3 / py 1.8, 위 구분선). sx 로 여백·정렬을 덮어쓸 수 있다 */
export function DialogFooter({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }): JSX.Element {
  return (
    <Stack direction="row" alignItems="center" sx={[{ px: `${space.base}px`, py: `${space.base}px`, borderTop: BAR_BORDER, background: surface.status }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Stack>
  )
}
