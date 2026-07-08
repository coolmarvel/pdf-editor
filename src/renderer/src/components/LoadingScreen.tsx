import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import { useEditor } from '@renderer/store/editor'

export default function LoadingScreen(): JSX.Element {
  const progress = useEditor((s) => s.loadingProgress)
  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper elevation={4} sx={{ p: 5, width: 460, maxWidth: '90vw', borderRadius: 4, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          문서를 처리하는 중…
        </Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, my: 2 }} />
        <Typography color="text.secondary">{progress}%</Typography>
      </Paper>
    </Box>
  )
}
