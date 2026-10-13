/**
 * 에디터 상태 줄(22px) — 왼쪽 상태 문구, 오른쪽에 페이지 이동(▲ n/m ▼)·배율(+ % −/손)·객체 수·제작자 칸 (pdf-editor-live ADR-0004 포팅).
 * 옛 플로팅 페이저(다크 필)를 대체한다 — e2e 손잡이(`floating-pager`·버튼 순서·툴팁)는 그대로.
 */
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import { ChevronDown, ChevronUp, Hand, ZoomIn, ZoomOut } from './icons'
import StatusBar, { Pane } from './classic/StatusBar'

const { color, chrome, size, space, surface, focusRing } = ui.classic

/** 상태 줄 안의 작은 평면 버튼(14px 아이콘) — 호버에 흰 면 + 파란 테두리 */
function PaneBtn({ icon, title, onClick, disabled, on }: { icon: JSX.Element; title: string; onClick: () => void; disabled?: boolean; on?: boolean }): JSX.Element {
  return (
    <Tooltip title={title}>
      <span style={{ display: 'inline-flex' }}>
        <ButtonBase
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          aria-pressed={on}
          sx={{
            width: 16,
            height: 16,
            border: '1px solid transparent',
            color: color.textSecondary,
            '& svg': { fontSize: 14 },
            '&:hover': { bgcolor: color.canvas, borderColor: color.hoverEdge, color: color.text },
            '&.Mui-focusVisible': focusRing,
            '&.Mui-disabled': { color: color.textDisabled },
            ...(on ? { background: surface.pressed, borderColor: chrome.toolbarEdge, color: color.accentPressed } : null),
            '@media (pointer: coarse)': { width: size.touch, height: size.touch, '& svg': { fontSize: 18 } }
          }}
        >
          {icon}
        </ButtonBase>
      </span>
    </Tooltip>
  )
}

export default function EditorStatusBar(): JSX.Element {
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
  const objectCount = useEditor((s) => Object.values(s.objectsByPage).reduce((n, list) => n + list.length, 0))
  // 두 쪽 + 한 장씩 보기에선 한 번에 두 페이지씩 넘긴다
  const step = pageMode === 'double' && pageTransition === 'paged' ? 2 : 1

  return (
    <StatusBar
      message={t('statusReady')}
      panes={[
        <Pane key="pager" testId="floating-pager" sx={{ gap: `${space.xs}px`, '@media (pointer: coarse)': { height: size.touch + 2 } }}>
          <Box component="span" sx={{ mr: `${space.xs}px` }}>
            {t('statusPage')}
          </Box>
          <PaneBtn icon={<ChevronUp />} title={t('searchPrev')} disabled={currentPage <= 0} onClick={() => requestScrollTo(Math.max(0, currentPage - step))} />
          <Box component="span" sx={{ color: color.text, minWidth: 34, textAlign: 'center' }} data-testid="page-counter">
            {Math.min(currentPage + 1, pages.length)}/{pages.length}
          </Box>
          <PaneBtn icon={<ChevronDown />} title={t('searchNext')} disabled={currentPage >= pages.length - 1} onClick={() => requestScrollTo(Math.min(pages.length - 1, currentPage + step))} />
          <Box component="span" sx={{ width: 6 }} />
          <PaneBtn icon={<ZoomIn />} title={t('zoomIn')} onClick={() => setZoom(zoom * 1.2)} />
          <Box component="span" sx={{ color: color.text, minWidth: 34, textAlign: 'center' }} data-testid="zoom-value">
            {zoom > 0 ? `${Math.round(zoom * 100)}%` : '—'}
          </Box>
          <PaneBtn icon={<ZoomOut />} title={t('zoomOut')} onClick={() => setZoom(zoom / 1.2)} />
          <PaneBtn icon={<Hand />} title={t('handTool')} on={tool === 'hand'} onClick={() => setTool(tool === 'hand' ? 'select' : 'hand')} />
        </Pane>,
        <Pane key="objects" sx={{ display: { xs: 'none', md: 'flex' } }}>
          {t('statusObjects')} {objectCount}
        </Pane>,
        <Pane key="by" sx={{ display: { xs: 'none', lg: 'flex' } }}>
          {t('statusMadeBy')}
        </Pane>
      ]}
    />
  )
}
