import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import KeyboardArrowUpRounded from '@mui/icons-material/KeyboardArrowUpRounded'
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded'
import ZoomInRounded from '@mui/icons-material/ZoomInRounded'
import ZoomOutRounded from '@mui/icons-material/ZoomOutRounded'
import PanToolRounded from '@mui/icons-material/PanToolRounded'
import { useEditor } from '@renderer/store/editor'

/** 하단 중앙 플로팅 페이저 (pdfguru의 다크 필) */
export default function FloatingPager(): JSX.Element {
  const pages = useEditor((s) => s.pages)
  const currentPage = useEditor((s) => s.currentPage)
  const requestScrollTo = useEditor((s) => s.requestScrollTo)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)

  const iconSx = { color: '#fff' }
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 18,
        // translateX(-50%) 는 반픽셀 오프셋으로 글자를 흐리게 만든다 → margin auto 로 중앙 정렬
        left: 0,
        right: 0,
        mx: 'auto',
        width: 'fit-content',
        bgcolor: 'rgba(30,36,50,.92)',
        borderRadius: 99,
        px: 2.5,
        py: 0.6,
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 0.5,
        boxShadow: 4,
        zIndex: 20
      }}
    >
      <Typography sx={{ color: '#cfd6e4', mr: 1, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0 }}>페이지:</Typography>
      <IconButton size="small" sx={iconSx} disabled={currentPage <= 0} onClick={() => requestScrollTo(currentPage - 1)}>
        <KeyboardArrowUpRounded />
      </IconButton>
      <Typography sx={{ color: '#fff', mx: 0.5, fontSize: 16, whiteSpace: 'nowrap', flexShrink: 0 }} fontWeight={700}>
        {Math.min(currentPage + 1, pages.length)}/{pages.length}
      </Typography>
      <IconButton size="small" sx={iconSx} disabled={currentPage >= pages.length - 1} onClick={() => requestScrollTo(currentPage + 1)}>
        <KeyboardArrowDownRounded />
      </IconButton>
      <Tooltip title="확대">
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom * 1.2)}>
          <ZoomInRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title="축소">
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom / 1.2)}>
          <ZoomOutRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title="손 도구 (드래그로 이동)">
        <IconButton size="small" sx={{ ...iconSx, bgcolor: tool === 'hand' ? 'rgba(255,255,255,.25)' : undefined }} onClick={() => setTool(tool === 'hand' ? 'select' : 'hand')}>
          <PanToolRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
