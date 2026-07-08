import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import { useEditor } from '@renderer/store/editor'
import ThumbCanvas from './ThumbCanvas'

const THUMB_W = 150

export default function ThumbnailSidebar({ onManagePages }: { onManagePages: () => void }): JSX.Element {
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const currentPage = useEditor((s) => s.currentPage)
  const requestScrollTo = useEditor((s) => s.requestScrollTo)

  return (
    <Box sx={{ width: 208, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: '#fafafa', overflowY: 'auto', p: 1.5 }}>
      <Button fullWidth size="small" variant="outlined" color="inherit" startIcon={<GridViewRounded />} onClick={onManagePages} sx={{ mb: 1.5, borderRadius: 5, bgcolor: '#f0f0f2', borderColor: 'transparent' }}>
        페이지 관리
      </Button>
      {pages.map((p, i) => {
        const size = displaySizes[p.id] ?? { w: 595, h: 842 }
        const active = i === currentPage
        return (
          <Box key={p.id} sx={{ mb: 1.5, cursor: 'pointer' }} onClick={() => requestScrollTo(i)}>
            <Paper
              variant="outlined"
              sx={{
                overflow: 'hidden',
                borderColor: active ? 'secondary.main' : 'divider',
                borderWidth: active ? 2 : 1,
                borderRadius: 1.5
              }}
            >
              <ThumbCanvas page={p} width={THUMB_W * 2} pageW={size.w} />
            </Paper>
            <Typography variant="caption" display="block" textAlign="center" color={active ? 'secondary.main' : 'text.secondary'} fontWeight={active ? 700 : 400}>
              {i + 1}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
