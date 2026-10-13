/** 문서 여는 동안의 진행 화면 — 클래식 대화상자 모양(제목 띠 + 진행 막대) */
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'

const { chrome, space, font, surface, shadow } = ui.classic

export default function LoadingScreen(): JSX.Element {
  const progress = useEditor((s) => s.loadingProgress)
  const t = useT()
  return (
    <Box className="classic-app" sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper variant="outlined" sx={{ width: 360, maxWidth: '90vw', border: `1px solid ${chrome.frame}`, boxShadow: shadow.dialog }}>
        <Box sx={{ px: `${space.lg}px`, py: `${space.base}px`, background: surface.chrome, borderBottom: `1px solid ${chrome.frame}`, fontSize: font.xl, fontWeight: font.bold, whiteSpace: 'nowrap' }}>{t('appName')}</Box>
        <Box sx={{ p: `${space.lg}px`, display: 'flex', flexDirection: 'column', gap: `${space.base}px` }}>
          <Typography sx={{ whiteSpace: 'nowrap' }}>문서를 처리하는 중…</Typography>
          <LinearProgress variant="determinate" value={progress} />
          <Typography className="tnum" color="text.secondary" sx={{ textAlign: 'right' }}>
            {progress}%
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
