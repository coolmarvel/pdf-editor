import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ChevronDown, ChevronUp, Hand, ZoomIn, ZoomOut } from './icons'

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
  // 폰 폭(< 600px): '페이지:' 라벨과 손 도구를 숨기고 여백을 줄여 필이 문서를 덜 가리게
  const narrowW = useMediaQuery('(max-width: 599.95px)')
  // 낮은 화면(< 480px, 폰 가로 회전): 상단 크롬(헤더+툴바+서브툴바 ≈ 160px) 뒤에 남는 문서 영역이 200px 남짓이라
  // 필이 페이지 중앙을 가렸다 → 오른쪽 아래 모서리로 옮기고 축소. 폭 조건이 아닌 높이 조건
  const short = useMediaQuery('(max-height: 479.95px)')
  const narrow = narrowW || short

  const iconSx = { color: '#fff' }
  return (
    <Box
      data-testid="floating-pager"
      sx={{
        position: 'absolute',
        bottom: short ? 8 : narrow ? 12 : 18,
        // translateX(-50%) 는 반픽셀 오프셋으로 글자를 흐리게 만든다 → margin auto 로 중앙 정렬
        left: short ? 'auto' : 0,
        right: short ? 8 : 0,
        mx: short ? 0 : 'auto',
        width: 'fit-content',
        bgcolor: 'rgba(19,44,31,.95)' /* 딥 그린-슬레이트 (pdfguru의 중성 다크 필과 구분) */,
        borderRadius: 99,
        px: narrow ? 1.5 : 2.5,
        py: short ? 0.2 : 0.6,
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: narrow ? 0.25 : 0.5,
        maxWidth: 'calc(100% - 16px)',
        boxShadow: 4,
        zIndex: 20
      }}
    >
      {!narrow && <Typography sx={{ color: '#cfe0d5', mr: 1, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('pageLabel')}</Typography>}
      <IconButton size="small" sx={iconSx} disabled={currentPage <= 0} onClick={() => requestScrollTo(Math.max(0, currentPage - step))}>
        <ChevronUp />
      </IconButton>
      <Typography sx={{ color: '#fff', mx: 0.5, fontSize: 16, whiteSpace: 'nowrap', flexShrink: 0 }} fontWeight={700}>
        {Math.min(currentPage + 1, pages.length)}/{pages.length}
      </Typography>
      <IconButton size="small" sx={iconSx} disabled={currentPage >= pages.length - 1} onClick={() => requestScrollTo(Math.min(pages.length - 1, currentPage + step))}>
        <ChevronDown />
      </IconButton>
      <Tooltip title={t('zoomIn')}>
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom * 1.2)}>
          <ZoomIn />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('zoomOut')}>
        <IconButton size="small" sx={iconSx} onClick={() => setZoom(zoom / 1.2)}>
          <ZoomOut />
        </IconButton>
      </Tooltip>
      {!narrow && (
        <Tooltip title={t('handTool')}>
          <IconButton size="small" sx={{ ...iconSx, bgcolor: tool === 'hand' ? 'rgba(255,255,255,.25)' : undefined }} onClick={() => setTool(tool === 'hand' ? 'select' : 'hand')}>
            <Hand fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
