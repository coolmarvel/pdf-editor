import { memo, useCallback, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import Divider from '@mui/material/Divider'
import useMediaQuery from '@mui/material/useMediaQuery'
import { DEFAULT_PAGE_SIZE, type PageRef } from '@core/pages'
import { useEditor, exportFileName } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import { buildPdf } from '@renderer/pdf/save'
import { usePageImport } from '@renderer/hooks/usePageImport'
import { useDragReorder, type DragReorderBind } from '@renderer/hooks/useDragReorder'
import { ArrowDown, ArrowUp, Copy, Download, EllipsisVertical, FilePlus, FileUp, IconImage, LayoutGrid, Plus, RotateCcw, RotateCw, Trash2 } from './icons'
import ThumbCanvas from './ThumbCanvas'
import PanelTitle from './classic/PanelTitle'
import MenuAction from './ui/MenuAction'

const MIN_W = 150
/** 사이드바 최대 폭: 480px 또는 창 폭의 40% 중 작은 쪽 — 페이지 영역이 너무 좁아져 PDF 가 잘려 보이는 것을 막는다 */
function maxSidebarW(): number {
  return Math.min(480, Math.floor(window.innerWidth * 0.4))
}

/** 페이지 사이 실선 + ⊕ (호버 시 진해짐). highlighted = 드롭 삽입점 (초록 바) */
function Gap({ index, highlighted, onAdd }: { index: number; highlighted: boolean; onAdd: (anchor: HTMLElement, index: number) => void }): JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        height: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .gapline': { position: 'absolute', left: 4, right: 4, top: '50%', height: '1px', bgcolor: 'divider' },
        '& .gapbtn': { opacity: 0, transition: 'opacity .12s', zIndex: 1 },
        '&:hover .gapbtn': { opacity: 1 },
        // hover 가 없는 기기에선 항상 보이고, 터치(pointer: coarse)에선 40px 타깃 (마우스 밀도는 그대로)
        '@media (hover: none)': { '& .gapbtn': { opacity: 1 } },
        '@media (pointer: coarse)': { '& .gapbtn': { width: 40, height: 40 } },
        // 드롭 삽입점: gap 한가운데 2px 초록 바 (Manage Pages 그리드의 세로 바와 같은 스타일)
        ...(highlighted ? { '& .gapline': { position: 'absolute', left: 0, right: 0, top: 'calc(50% - 1px)', height: '2px', bgcolor: 'primary.main', borderRadius: 1 }, '& .gapbtn': { opacity: 0 } } : {})
      }}
    >
      <Box className="gapline" data-drop-indicator={highlighted ? 'between' : undefined} />
      <IconButton
        className="gapbtn"
        size="small"
        onClick={(e) => onAdd(e.currentTarget, index)}
        sx={{ width: 18, height: 18, bgcolor: '#fff', border: `1px solid ${ui.gray[300]}`, '&:hover': { bgcolor: ui.gray[100] } }}
      >
        <Plus sx={{ fontSize: 13 }} />
      </IconButton>
    </Box>
  )
}

interface ThumbRowProps {
  page: PageRef
  index: number
  active: boolean
  pageW: number
  pageH: number
  /** 썸네일 백킹 스토어 폭 px */
  thumbW: number
  dragging: boolean
  /** 이 행 아래 gap 이 드롭 삽입점인가 */
  dropAfter: boolean
  drag: DragReorderBind
  onMenu: (anchor: HTMLElement, index: number) => void
  onAdd: (anchor: HTMLElement, index: number) => void
}

/** 썸네일 한 행 + 아래 gap. memo: 객체 드래그/다른 행의 상태 변화에 N행 전체가 재조정되지 않게 (props 전부 원시값/고정 identity) */
const ThumbRow = memo(function ThumbRow({ page, index, active, pageW, pageH, thumbW, dragging, dropAfter, drag, onMenu, onAdd }: ThumbRowProps): JSX.Element {
  return (
    <Box>
      <Box
        data-thumb
        data-pgid={page.id}
        onPointerDown={(e) => drag.onPointerDown(e, index)}
        onPointerMove={drag.onPointerMove}
        onPointerUp={() => drag.onPointerUp(index)}
        sx={{
          position: 'relative',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
          opacity: dragging ? 0.4 : 1,
          '& .thumbmenu': { opacity: 0, transition: 'opacity .12s' },
          '&:hover .thumbmenu': { opacity: 1 }
        }}
      >
        <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: active ? 'primary.main' : ui.classic.color.borderStrong, borderWidth: active ? 2 : 1, borderRadius: 0 }}>
          <ThumbCanvas page={page} width={thumbW} pageW={pageW} pageH={pageH} />
        </Paper>
        {/* 호버 ⋮ 메뉴 버튼 (우측 상단) */}
        <IconButton
          className="thumbmenu"
          size="small"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onMenu(e.currentTarget, index)
          }}
          sx={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, background: ui.classic.surface.bevel, border: `1px solid ${ui.classic.color.buttonBorder}`, '&:hover': { bgcolor: '#fff', borderColor: ui.classic.color.hoverEdge } }}
        >
          <EllipsisVertical sx={{ fontSize: 16 }} />
        </IconButton>
        <Typography variant="caption" display="block" textAlign="center" className="tnum" color={active ? 'primary.main' : 'text.secondary'} fontWeight={active ? 700 : 400}>
          {index + 1}
        </Typography>
      </Box>
      <Gap index={index + 1} highlighted={dropAfter} onAdd={onAdd} />
    </Box>
  )
})

/**
 * 좌측 페이지 사이드바 (Guru 파리티):
 * 폭 조절 핸들 · 호버 시 ⋮ 메뉴(이동/회전/복제/추출/삭제) · 드래그로 순서 변경(보라 삽입선) ·
 * 페이지 사이 실선+⊕(페이지 추가/PDF 업로드)
 */
export default function ThumbnailSidebar({ onManagePages, onClose }: { onManagePages: () => void; onClose?: () => void }): JSX.Element {
  const t = useT()
  // 폰 폭(< 600px)에서는 문서 위에 겹치는 오버레이 — 폭 조절 없음, 바깥 클릭/썸네일 클릭이면 닫힌다
  const overlay = useMediaQuery('(max-width: 599.95px)')
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const currentPage = useEditor((s) => s.currentPage)
  const requestScrollTo = useEditor((s) => s.requestScrollTo)
  const pageNudge = useEditor((s) => s.pageNudge)
  const pageRotate = useEditor((s) => s.pageRotate)
  const pageDuplicate = useEditor((s) => s.pageDuplicate)
  const pageRemove = useEditor((s) => s.pageRemove)
  const pageInsertBlank = useEditor((s) => s.pageInsertBlank)
  const pageMoveToIndex = useEditor((s) => s.pageMoveToIndex)
  const { inputs, openPdf, openImages } = usePageImport()

  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('sidebarW'))
    return saved >= MIN_W && saved <= maxSidebarW() ? saved : 208
  })
  /** ⋮ 메뉴 */
  const [pageMenu, setPageMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null)
  /** ⊕ 메뉴 (삽입 위치) */
  const [addMenu, setAddMenu] = useState<{ anchor: HTMLElement; index: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { dragIdx, dropIdx, bind } = useDragReorder({
    containerRef: listRef,
    itemSelector: '[data-thumb]',
    axis: 'y',
    threshold: 6,
    onDrop: (index, drop) => pageMoveToIndex(new Set([pages[index].id]), drop),
    onClick: (index) => {
      requestScrollTo(index) // 클릭 = 해당 페이지로 이동
      if (overlay) onClose?.()
    }
  })
  const onMenu = useCallback((anchor: HTMLElement, index: number) => setPageMenu({ anchor, index }), [])
  const onAdd = useCallback((anchor: HTMLElement, index: number) => setAddMenu({ anchor, index }), [])

  function startResize(e: React.PointerEvent): void {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const maxW = maxSidebarW()
    const onMove = (ev: PointerEvent): void => {
      setWidth(Math.max(MIN_W, Math.min(maxW, startW + ev.clientX - startX)))
    }
    const onUp = (ev: PointerEvent): void => {
      const w = Math.max(MIN_W, Math.min(maxW, startW + ev.clientX - startX))
      localStorage.setItem('sidebarW', String(w))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  async function extractPage(index: number): Promise<void> {
    // objectsByPage 는 구독하지 않는다 — 드래그마다 바뀌는 값이라 사이드바 전체가 재렌더된다. 필요할 때만 읽는다
    const { objectsByPage } = useEditor.getState()
    const p = pages[index]
    const bytes = await buildPdf({ pages: [p], objectsByPage: { [p.id]: objectsByPage[p.id] ?? [] }, displaySizes })
    await window.api.saveBuffer(exportFileName(`-p${index + 1}`), bytes)
  }

  /** ⋮ 메뉴 항목 실행 후 닫기 */
  const act = (fn: (id: string, index: number) => void) => (): void => {
    if (pageMenu) fn(pages[pageMenu.index].id, pageMenu.index)
    setPageMenu(null)
  }
  /** ⊕ 메뉴 항목 실행 후 닫기 */
  const actAdd = (fn: (index: number) => void) => (): void => {
    if (addMenu) fn(addMenu.index)
    setAddMenu(null)
  }

  // 썸네일 백킹 스토어 = 실제 표시 폭 × dpr (고정 300 은 기본 폭 208 에서 2배 과잉 래스터화였다).
  // 64px 단위로 올림 — 폭 핸들을 끄는 동안 픽셀마다 전 썸네일이 재래스터화되지 않게
  const thumbW = Math.ceil((width * Math.min(window.devicePixelRatio || 1, 2)) / 64) * 64

  const sidebarW = overlay ? 'min(260px, 80vw)' : width
  return (
    <>
    {overlay && <Box data-sidebar-backdrop onClick={onClose} sx={{ position: 'absolute', inset: 0, zIndex: 14, bgcolor: 'rgba(16,24,40,.25)' }} />}
    <Box
      data-sidebar
      sx={{
        position: overlay ? 'absolute' : 'relative',
        ...(overlay ? { left: 0, top: 0, bottom: 0, zIndex: 15, boxShadow: 6 } : {}),
        width: sidebarW, flexShrink: 0, borderRight: `1px solid ${ui.classic.chrome.frame}`, bgcolor: ui.surface.sidebar, display: 'flex', flexDirection: 'column'
      }}
    >
      <PanelTitle testId="pages-panel-title">{t('pages')}</PanelTitle>
      <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: `${ui.classic.space.base}px` }}>
        <Button fullWidth size="small" variant="outlined" color="inherit" startIcon={<LayoutGrid />} onClick={onManagePages} sx={{ mb: `${ui.classic.space.sm}px` }}>
          {t('managePages')}
        </Button>
        <Gap index={0} highlighted={dropIdx === 0 && dragIdx !== null} onAdd={onAdd} />
        {pages.map((p, i) => {
          const size = displaySizes[p.id] ?? DEFAULT_PAGE_SIZE
          return (
            <ThumbRow
              key={p.id}
              page={p}
              index={i}
              active={i === currentPage}
              pageW={size.w}
              pageH={size.h}
              thumbW={thumbW}
              dragging={dragIdx === i}
              dropAfter={dropIdx === i + 1 && dragIdx !== null}
              drag={bind}
              onMenu={onMenu}
              onAdd={onAdd}
            />
          )
        })}
      </Box>

      {/* 폭 조절 핸들 (오버레이 모드에선 없음) */}
      {!overlay && <Box
        onPointerDown={startResize}
        sx={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 7,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 5,
          '&:hover': { bgcolor: 'rgba(59,116,242,.18)' }
        }}
      />}

      {/* ⋮ 페이지 메뉴 */}
      <Menu anchorEl={pageMenu?.anchor ?? null} open={!!pageMenu} onClose={() => setPageMenu(null)}>
        <MenuAction icon={<ArrowUp fontSize="small" />} label={t('moveUp')} disabled={pageMenu?.index === 0} onClick={act((id) => pageNudge(new Set([id]), -1))} />
        <MenuAction icon={<ArrowDown fontSize="small" />} label={t('moveDown')} disabled={pageMenu?.index === pages.length - 1} onClick={act((id) => pageNudge(new Set([id]), 1))} />
        <MenuAction icon={<RotateCcw fontSize="small" />} label={t('rotateLeft')} onClick={act((id) => pageRotate(new Set([id]), -90))} />
        <MenuAction icon={<RotateCw fontSize="small" />} label={t('rotateRight')} onClick={act((id) => pageRotate(new Set([id]), 90))} />
        <MenuAction icon={<Copy fontSize="small" />} label={t('duplicate')} onClick={act((id) => pageDuplicate(new Set([id])))} />
        <MenuAction icon={<Download fontSize="small" />} label={t('extractPage')} onClick={act((_, index) => void extractPage(index))} />
        <Divider />
        <MenuAction icon={<Trash2 fontSize="small" color="primary" />} label={t('delete')} disabled={pages.length <= 1} onClick={act((id) => pageRemove(new Set([id])))} sx={{ color: 'primary.main' }} />
      </Menu>

      {/* ⊕ 삽입 메뉴 */}
      <Menu anchorEl={addMenu?.anchor ?? null} open={!!addMenu} onClose={() => setAddMenu(null)}>
        <MenuAction icon={<FileUp fontSize="small" />} label={t('uploadPdf')} onClick={actAdd(openPdf)} />
        <MenuAction icon={<IconImage fontSize="small" />} label={t('uploadImage')} onClick={actAdd(openImages)} />
        <MenuAction icon={<FilePlus fontSize="small" />} label={t('addPage')} onClick={actAdd(pageInsertBlank)} />
      </Menu>

      {inputs}
    </Box>
    </>
  )
}
