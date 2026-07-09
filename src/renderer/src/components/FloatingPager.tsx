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
import { useT } from '@renderer/i18n'

/** 하단 중앙 플로팅 페이저 (pdfguru의 다크 필) */
export default function FloatingPager(): JSX.Element {
  const t = useT()
  const pages = useEditor((s) => s.pages)
  const currentPage = useEditor((s) => s.currentPage)
  const requestScrollTo = useEditor((s) => s.requestScrollTo)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const pageMode = useEditor((s) => s.pageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  // 두 쪽 + 한 장씩 보기에선 한 번에 두 페이지씩 넘긴다
  const step = pageMode === 'double' && pageTransition === 'paged' ? 2 : 1

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
        bgcolor: 'rgba(29,41,57,.95)' /* gray-800 */,
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
      <Typography sx={{ color: '#cfd6e4', mr: 1, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('pageLabel')}</Typography>
      <IconButton size="small" sx={iconSx} disabled={currentPage <= 0} onClick={() => requestScrollTo(Math.max(0, currentPage - step))}>
        <KeyboardArrowUpRounded />
      </IconButton>
      <Typography sx={{ color: '#fff', mx: 0.5, fontSize: 16, whiteSpace: 'nowrap', flexShrink: 0 }} fontWeight={700}>
        {Math.min(currentPage + 1, pages.length)}/{pages.length}
      </Typography>
      <IconButton size="small" sx={iconSx} disabled={currentPage >= pages.length - 1} onClick={() => requestScrollTo(Math.min(pages.length - 1, currentPage + step))}>
        <KeyboardArrowDownRounded />
      </IconButton>
      <Tooltip title={t('zoomIn')}>
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom * 1.2)}>
          <ZoomInRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('zoomOut')}>
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom / 1.2)}>
          <ZoomOutRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('handTool')}>
        <IconButton size="small" sx={{ ...iconSx, bgcolor: tool === 'hand' ? 'rgba(255,255,255,.25)' : undefined }} onClick={() => setTool(tool === 'hand' ? 'select' : 'hand')}>
          <PanToolRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
