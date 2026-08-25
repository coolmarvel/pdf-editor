import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import { useEditor } from '@renderer/store/editor'
import { ui } from '@renderer/theme'
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
  // continuous 모드에선 currentPage 를 읽지 않는다 — 스크롤마다 갱신되는 값이라 구독하면
  // 페이지 전부(PageCanvas N개)가 매 스크롤 이벤트에 다시 렌더된다
  const currentPage = useEditor((s) => (s.pageTransition === 'paged' ? s.currentPage : 0))
  const pageMode = useEditor((s) => s.pageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  const fitMode = useEditor((s) => s.fitMode)
  const tool = useEditor((s) => s.tool)
  const containerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  /** 페이지 세로 중심(컨테이너 스크롤 좌표) 캐시 — 스크롤마다 레이아웃을 강제하지 않기 위해 */
  const midsRef = useRef<number[] | null>(null)

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

  // 레이아웃이 바뀌는 입력(줌·페이지 목록·단/2단·전환 모드)이 오면 중심 캐시를 버린다
  useEffect(() => {
    midsRef.current = null
  }, [zoom, pages, displaySizes, pageMode, pageTransition])

  /** 페이지 세로 중심 목록(스크롤 좌표, 오름차순) — 한 번만 레이아웃을 읽고 이후 스크롤은 산술만 */
  function pageMids(el: HTMLDivElement): number[] {
    let mids = midsRef.current
    if (!mids) {
      const top = el.getBoundingClientRect().top - el.scrollTop
      mids = []
      el.querySelectorAll('[data-page-index]').forEach((n) => {
        const r = n.getBoundingClientRect()
        mids!.push((r.top + r.bottom) / 2 - top)
      })
      midsRef.current = mids
    }
    return mids
  }

  // 스크롤 → 현재 페이지 감지 (continuous 전용)
  function onScroll(): void {
    if (pageTransition === 'paged') return
    const el = containerRef.current
    if (!el) return
    const mids = pageMids(el)
    if (mids.length === 0) return
    const mid = el.scrollTop + el.clientHeight / 2
    // 중심 목록은 오름차순 → 이진 탐색으로 mid 이상인 첫 페이지를 찾고 앞 페이지와 거리 비교
    // (2단 모드는 같은 행 두 페이지의 중심이 같아 "첫 번째" 가 이긴다 = 기존 선형 스캔의 '<' 규칙과 동일)
    let lo = 0
    let hi = mids.length
    while (lo < hi) {
      const m = (lo + hi) >> 1
      if (mids[m] < mid) lo = m + 1
      else hi = m
    }
    let best = lo < mids.length ? lo : mids.length - 1
    if (lo > 0 && (lo === mids.length || Math.abs(mids[lo - 1] - mid) <= Math.abs(mids[lo] - mid))) best = lo - 1
    while (best > 0 && mids[best - 1] === mids[best]) best--
    // DOM 순서 = pages 순서 (paged 에선 부분 렌더라 이 함수를 쓰지 않는다)
    if (best !== useEditor.getState().currentPage) setCurrentPage(best)
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
        bgcolor: ui.surface.canvas,
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
              <PageCanvas key={pages[pageIdx].id} page={pages[pageIdx]} zoom={zoom} />
            ))}
          </Box>
        ))}
    </Box>
  )
}
