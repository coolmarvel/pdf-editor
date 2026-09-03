import { useEffect, useLayoutEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import { useEditor } from '@renderer/store/editor'
import { ui } from '@renderer/theme'
import PageCanvas from './PageCanvas'

/** 페이지 영역 좌우 고정 여백(px) — fit 계산과 실제 padding 이 같은 값을 써야 폭 맞춤에서 가로 스크롤이 생기지 않는다 */
const GUTTER_X = 32

/** 컨테이너 크기 기준 fit 배율 계산 (폭 맞춤 = 컨테이너 폭 − 고정 여백). 스토어를 직접 읽어 렌더 클로저에 묶이지 않는다 */
function computeFit(el: HTMLDivElement): number | null {
  const { pages, displaySizes, pageMode, fitMode } = useEditor.getState()
  if (pages.length === 0) return null
  const first = displaySizes[pages[0].id]
  if (!first) return null
  const cols = pageMode === 'double' ? 2 : 1
  const fitW = (el.clientWidth - GUTTER_X * 2 - (cols - 1) * 16) / (first.w * cols)
  if (fitMode === 'width') return fitW
  const fitH = (el.clientHeight - 48) / first.h
  return Math.min(fitH, fitW)
}

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
  /** 마지막으로 fit 계산해서 넣은 zoom — 컨테이너 폭이 바뀌었을 때 "사용자가 직접 줌을 바꾸지 않았다"면 다시 fit 하기 위해 */
  const fitZoomRef = useRef<number | null>(null)
  const lastWidthRef = useRef<number | null>(null)
  /** 복원된 줌(임시본) 검사를 마운트당 한 번만 */
  const restoredCheckedRef = useRef(false)
  /** 두 손가락 핀치: 시작 거리·시작 줌 (터치 전용, 마우스는 관여 없음) */
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  /** 줌이 바뀐 뒤 스크롤을 보정할 기준점 — 핀치 중심(컨테이너 좌표)과 그 지점의 이전 콘텐츠 좌표 */
  const anchorRef = useRef<{ cx: number; cy: number; sx: number; sy: number; zoom: number } | null>(null)

  // 첫 로드/재-fit(zoom=0): 기본은 폭 맞춤(Guru처럼 꽉 차게), "화면에 맞춤"은 페이지 전체
  useEffect(() => {
    if (zoom > 0 || pages.length === 0) return
    const el = containerRef.current
    if (!el) return
    const z = computeFit(el)
    if (z === null) return
    fitZoomRef.current = Math.min(4, Math.max(0.2, z))
    setZoom(z)
  }, [zoom, pages, displaySizes, pageMode, fitMode, setZoom])

  // 임시본 복원(zoom > 0 으로 시작하는 유일한 경로): 좁은 컨테이너(< 900, md 미만)에선 저장 당시의 줌을 버리고 폭 맞춤으로 시작한다.
  // 768 에서 저장한 임시본(zoom 1.18)을 360 에서 열면 페이지 704px 가 뷰포트를 넘어 오른쪽 절반이 안 보였다.
  // fit 으로 시작하면 이후 회전(컨테이너 폭 변화)도 아래 ResizeObserver 경로로 다시 맞춰진다. 데스크톱(≥ 900)은 저장된 줌 그대로.
  useEffect(() => {
    if (restoredCheckedRef.current || pages.length === 0 || zoom <= 0) return
    restoredCheckedRef.current = true
    if (fitZoomRef.current !== null) return // 이 마운트에서 이미 fit 을 계산했다 = 새로 연 문서
    const el = containerRef.current
    if (!el || el.clientWidth >= 900) return
    const z = computeFit(el)
    if (z === null) return
    fitZoomRef.current = Math.min(4, Math.max(0.2, z))
    setZoom(z)
  }, [zoom, pages, displaySizes, pageMode, fitMode, setZoom])

  // 컨테이너 폭 변화(사이드바 드래그·창 크기·검색바 등) → fit 상태였다면 다시 fit (window resize 만으로는 사이드바 폭 변화를 못 잡는다).
  // 마운트당 한 번만 구독한다 (computeFit·setZoom 이 렌더 클로저에 묶이지 않으므로). "마지막으로 본 폭" 은 ref 에
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    if (lastWidthRef.current === null) lastWidthRef.current = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastWidthRef.current) return
      lastWidthRef.current = el.clientWidth
      const s = useEditor.getState()
      // 사용자가 줌을 손댔으면(현재 zoom ≠ 마지막 fit 값) 건드리지 않는다
      if (fitZoomRef.current === null || Math.abs(s.zoom - fitZoomRef.current) > 1e-6) return
      const z = computeFit(el)
      if (z === null) return
      fitZoomRef.current = Math.min(4, Math.max(0.2, z))
      setZoom(z)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [setZoom])

  // 두 손가락 핀치 → 에디터 줌 (브라우저 전체 확대 대신). React 의 onTouch* 는 passive 라 preventDefault 가 안 먹어
  // 네이티브 리스너(passive:false)로 단다. 한 손가락(스크롤·그리기)은 건드리지 않는다. 컨테이너 touch-action 은 pan-x pan-y 라
  // Chrome 은 핀치를 페이지 확대로 넘기지 않고, iOS 는 touchmove preventDefault 로 막는다
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const dist = (t: TouchList): number => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent): void => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      pinchRef.current = { dist: dist(e.touches), zoom: useEditor.getState().zoom }
      panRef.current = null
    }
    const onMove = (e: TouchEvent): void => {
      const p = pinchRef.current
      if (!p || e.touches.length !== 2) return
      e.preventDefault()
      const z = Math.min(4, Math.max(0.2, (p.zoom * dist(e.touches)) / p.dist))
      const cur = useEditor.getState().zoom
      if (Math.abs(z - cur) < 1e-3) return
      const r = el.getBoundingClientRect()
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top
      anchorRef.current = { cx, cy, sx: el.scrollLeft + cx, sy: el.scrollTop + cy, zoom: cur }
      setZoom(z)
    }
    const onEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) pinchRef.current = null
    }
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [setZoom])

  // 핀치로 줌이 바뀐 직후: 손가락 사이 중심점이 같은 문서 위치에 머물도록 스크롤 보정 (레이아웃 반영 뒤 = useLayoutEffect)
  useLayoutEffect(() => {
    const a = anchorRef.current
    const el = containerRef.current
    if (!a || !el || zoom <= 0) return
    anchorRef.current = null
    const k = zoom / a.zoom
    el.scrollLeft = a.sx * k - a.cx
    el.scrollTop = a.sy * k - a.cy
  }, [zoom])

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
        px: `${GUTTER_X}px`,
        display: 'flex',
        flexDirection: 'column',
        // alignItems:center 는 컨테이너보다 넓은 행의 왼쪽을 스크롤로도 못 닿게 잘라낸다 → 행 쪽 margin:auto 로 가운데 정렬
        alignItems: 'stretch',
        gap: 3,
        // 터치: 한 손가락 스크롤만 브라우저에 맡기고 핀치는 위 리스너가 에디터 줌으로 소비한다 (마우스엔 영향 없음)
        touchAction: 'pan-x pan-y',
        cursor: tool === 'hand' ? 'grab' : undefined
      }}
    >
      {zoom > 0 &&
        rows.map((row) => (
          <Box key={row.map((r) => pages[r.pageIdx].id).join('-')} sx={{ display: 'flex', gap: 2, width: 'fit-content', flexShrink: 0, mx: 'auto' }}>
            {row.map(({ pageIdx }) => (
              <PageCanvas key={pages[pageIdx].id} page={pages[pageIdx]} zoom={zoom} />
            ))}
          </Box>
        ))}
    </Box>
  )
}
