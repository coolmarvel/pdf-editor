import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import { useEditor } from '@renderer/store/editor'
import PageCanvas from './PageCanvas'

/**
 * 페이지 표시 영역.
 * - pageMode: 'single'(1단) | 'double'(두 쪽 나란히)
 * - pageTransition: 'continuous'(이어서 스크롤) | 'paged'(현재 장만 표시, 페이저로 이동)
 */
export default function PagesView(): JSX.Element {
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const scrollTo = useEditor((s) => s.scrollTo)
  const setCurrentPage = useEditor((s) => s.setCurrentPage)
  const currentPage = useEditor((s) => s.currentPage)
  const pageMode = useEditor((s) => s.pageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  const fitMode = useEditor((s) => s.fitMode)
  const tool = useEditor((s) => s.tool)
  const containerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  // 첫 로드/재-fit(zoom=0): 기본은 폭 맞춤(Guru처럼 꽉 차게), "화면에 맞춤"은 페이지 전체
  useEffect(() => {
    if (zoom > 0 || pages.length === 0) return
    const el = containerRef.current
    if (!el) return
    const first = displaySizes[pages[0].id]
    if (!first) return
    const cols = pageMode === 'double' ? 2 : 1
    const fitW = (el.clientWidth - 64 - (cols - 1) * 16) / (first.w * cols)
    if (fitMode === 'width') {
      setZoom(fitW)
    } else {
      const fitH = (el.clientHeight - 48) / first.h
      setZoom(Math.min(fitH, fitW))
    }
  }, [zoom, pages, displaySizes, setZoom, pageMode, fitMode])

  // 페이저/썸네일 → 스크롤 요청 소비 (continuous 전용 — paged 는 currentPage 렌더로 충분)
  useEffect(() => {
    if (!scrollTo || pageTransition === 'paged') return
    const el = containerRef.current
    if (!el) return
    const target = el.querySelectorAll('[data-page-index]')[scrollTo.page]
    target?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [scrollTo, pageTransition])

  // 스크롤 → 현재 페이지 감지 (continuous 전용)
  function onScroll(): void {
    if (pageTransition === 'paged') return
    const el = containerRef.current
    if (!el) return
    const mid = el.getBoundingClientRect().top + el.clientHeight / 2
    const nodes = el.querySelectorAll('[data-page-index]')
    let best = 0
    let bestDist = Infinity
    nodes.forEach((n, i) => {
      const r = n.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - mid)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    // DOM 순서 = pages 순서 (paged 에선 부분 렌더라 이 함수를 쓰지 않는다)
    setCurrentPage(best)
  }

  /** 렌더할 페이지 (전역 index 포함) */
  let items: { pageIdx: number }[] = pages.map((_, i) => ({ pageIdx: i }))
  if (pageTransition === 'paged') {
    const start = pageMode === 'double' ? currentPage - (currentPage % 2) : currentPage
    items = pages.slice(start, start + (pageMode === 'double' ? 2 : 1)).map((_, k) => ({ pageIdx: start + k }))
  }
  /** double 모드: 2개씩 행으로 묶기 */
  const rows: { pageIdx: number }[][] = []
  if (pageMode === 'double') {
    for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2))
  } else {
    for (const it of items) rows.push([it])
  }

  return (
    <Box
      ref={containerRef}
      onScroll={onScroll}
      onPointerDown={(e) => {
        if (tool !== 'hand') return
        const el = containerRef.current!
        panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
        el.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const p = panRef.current
        if (!p) return
        const el = containerRef.current!
        el.scrollLeft = p.left - (e.clientX - p.x)
        el.scrollTop = p.top - (e.clientY - p.y)
      }}
      onPointerUp={() => {
        panRef.current = null
      }}
      sx={{
        flex: 1,
        overflow: 'auto',
        bgcolor: '#eceef1',
        py: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        cursor: tool === 'hand' ? 'grab' : undefined
      }}
    >
      {zoom > 0 &&
        rows.map((row) => (
          <Box key={row.map((r) => pages[r.pageIdx].id).join('-')} sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {row.map(({ pageIdx }) => (
              <PageCanvas key={pages[pageIdx].id} page={pages[pageIdx]} index={pageIdx} zoom={zoom} />
            ))}
          </Box>
        ))}
    </Box>
  )
}
