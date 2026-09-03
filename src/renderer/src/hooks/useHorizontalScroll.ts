import { useCallback, type WheelEvent } from 'react'

/**
 * 한 줄 고정(nowrap) 툴바의 가로 스크롤을 마우스에서도 쓸 수 있게 — 세로 휠을 가로 스크롤로 돌린다.
 * 터치/트랙패드는 원래 되므로 영향 없음. 컨테이너가 넘치지 않으면 아무것도 하지 않는다(페이지 스크롤 그대로).
 */
export function useHorizontalWheel(): (e: WheelEvent<HTMLElement>) => void {
  return useCallback((e: WheelEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (el.scrollWidth <= el.clientWidth + 1) return
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return   // 이미 가로 제스처
    el.scrollLeft += e.deltaY
    e.preventDefault()
  }, [])
}

/** 가로 스크롤 컨테이너 공통 sx — 얇지만 항상 보이는 스크롤바(마우스 환경에서 "스크롤된다"는 신호) */
export const H_SCROLL_SX = {
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': { height: 6 },
  '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,.22)', borderRadius: 3 }
} as const

/** 오른쪽 끝 페이드(“더 있음” 힌트) — position: relative 인 래퍼의 자식으로 둔다. 컨테이너에는 fade 폭만큼 pr 을 줘 마지막 버튼이 가려지지 않게 */
export const FADE_W = 28
export const fadeSx = {
  position: 'absolute', top: 0, bottom: 0, right: 0, width: FADE_W, pointerEvents: 'none',
  background: 'linear-gradient(to right, rgba(255,255,255,0), #fff 80%)'
} as const
