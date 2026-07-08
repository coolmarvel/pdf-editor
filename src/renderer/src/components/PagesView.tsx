import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import { useEditor } from '@renderer/store/editor'
import PageCanvas from './PageCanvas'

/** 페이지 세로 스크롤 영역: 첫 로드 시 화면에 맞춰 줌 계산, 스크롤로 현재 페이지 추적 */
export default function PagesView(): JSX.Element {
  const pages = useEditor((s) => s.pages)
  const displaySizes = useEditor((s) => s.displaySizes)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const scrollTo = useEditor((s) => s.scrollTo)
  const setCurrentPage = useEditor((s) => s.setCurrentPage)
  const tool = useEditor((s) => s.tool)
  const containerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  // 첫 로드: 페이지 전체가 한 화면에 들어오도록 fit (사용자 요구: 기본 크기 축소)
  useEffect(() => {
    if (zoom > 0 || pages.length === 0) return
    const el = containerRef.current
    if (!el) return
    const first = displaySizes[pages[0].id]
    if (!first) return
    const fitH = (el.clientHeight - 48) / first.h
    const fitW = (el.clientWidth - 64) / first.w
    setZoom(Math.min(fitH, fitW))
  }, [zoom, pages, displaySizes, setZoom])

  // 페이저/썸네일 → 스크롤 요청 소비
  useEffect(() => {
    if (!scrollTo) return
    const el = containerRef.current
    if (!el) return
    const target = el.querySelectorAll('[data-page-index]')[scrollTo.page]
    target?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [scrollTo])

  // 스크롤 → 현재 페이지 감지 (뷰포트 중앙에 걸린 페이지)
  function onScroll(): void {
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
    setCurrentPage(best)
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
        gap: 3,
        cursor: tool === 'hand' ? 'grab' : undefined
      }}
    >
      {zoom > 0 && pages.map((p, i) => <PageCanvas key={p.id} page={p} index={i} zoom={zoom} />)}
    </Box>
  )
}
