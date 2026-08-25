import { useMemo, useRef, useState } from 'react'

interface CachedRect {
  top: number
  bottom: number
  left: number
  width: number
  height: number
}

interface DragState {
  index: number
  startX: number
  startY: number
  active: boolean
  drop: number | null
  /** 드래그 시작 시점의 아이템 rect 스냅샷 + 그때의 컨테이너 스크롤 (이동 중엔 스크롤 델타만 보정) */
  rects: CachedRect[]
  scrollTop: number
  scrollLeft: number
}

export interface DragReorderOptions {
  /** 아이템들을 담은 스크롤 컨테이너 */
  containerRef: React.RefObject<HTMLElement>
  /** 아이템 셀렉터 (예: '[data-thumb]') — DOM 순서 = index */
  itemSelector: string
  /** 'y' = 세로 목록(썸네일 중앙 기준 위/아래), 'grid' = 그리드(행 안에서 좌/우 절반) */
  axis: 'y' | 'grid'
  /** 드래그로 인정할 최소 이동 px */
  threshold: number
  onDrop: (index: number, drop: number) => void
  /** 드래그 없이 뗐을 때 (클릭) */
  onClick: (index: number) => void
}

export interface DragReorderBind {
  onPointerDown: (e: React.PointerEvent, index: number) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (index: number) => void
}

/**
 * 포인터 기반 드래그 순서 변경 (HTML5 dnd 는 Electron 에서 불안정). 사이드바 목록과 Manage Pages 그리드가 공유.
 * bind 는 identity 가 고정이라 React.memo 아이템에 그대로 넘겨도 된다 (콜백은 ref 로 최신 것을 본다).
 */
export function useDragReorder(opts: DragReorderOptions): { dragIdx: number | null; dropIdx: number | null; bind: DragReorderBind } {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const bind = useMemo<DragReorderBind>(() => {
    function snapshotRects(): Pick<DragState, 'rects' | 'scrollTop' | 'scrollLeft'> {
      const c = optsRef.current.containerRef.current
      const nodes = c?.querySelectorAll(optsRef.current.itemSelector)
      const rects: CachedRect[] = []
      nodes?.forEach((n) => {
        const r = n.getBoundingClientRect()
        rects.push({ top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height })
      })
      return { rects, scrollTop: c?.scrollTop ?? 0, scrollLeft: c?.scrollLeft ?? 0 }
    }

    /** 포인터 위치 → 삽입점. 캐시된 rect 를 현재 스크롤 델타만큼 옮겨서 판정 */
    function calcDrop(d: DragState, clientX: number, clientY: number): number {
      const c = optsRef.current.containerRef.current
      const dy = (c?.scrollTop ?? 0) - d.scrollTop
      const dx = (c?.scrollLeft ?? 0) - d.scrollLeft
      const y = clientY + dy
      const x = clientX + dx
      const rects = d.rects
      if (rects.length === 0) return 0
      let idx = rects.length
      if (optsRef.current.axis === 'y') {
        for (let i = 0; i < rects.length; i++) {
          if (y < rects[i].top + rects[i].height / 2) {
            idx = i
            break
          }
        }
        return idx
      }
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (y < r.top) {
          idx = i
          break
        }
        if (y <= r.bottom) {
          if (x < r.left + r.width / 2) {
            idx = i
            break
          }
          idx = i + 1
        }
      }
      return idx
    }

    return {
      onPointerDown(e, index) {
        if (e.button !== 0) return
        e.preventDefault() // 드래그 중 텍스트 선택·브라우저 자동 스크롤 방지
        dragRef.current = { index, startX: e.clientX, startY: e.clientY, active: false, drop: null, rects: [], scrollTop: 0, scrollLeft: 0 }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      },
      onPointerMove(e) {
        const d = dragRef.current
        if (!d) return
        if (!d.active) {
          const moved = optsRef.current.axis === 'y' ? Math.abs(e.clientY - d.startY) : Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
          if (moved > optsRef.current.threshold) {
            d.active = true
            Object.assign(d, snapshotRects())
            setDragIdx(d.index)
          }
        }
        if (d.active) {
          d.drop = calcDrop(d, e.clientX, e.clientY)
          setDropIdx(d.drop)
        }
      },
      onPointerUp(index) {
        const d = dragRef.current
        dragRef.current = null
        if (d?.active) {
          if (d.drop !== null) optsRef.current.onDrop(d.index, d.drop)
          setDragIdx(null)
          setDropIdx(null)
        } else {
          optsRef.current.onClick(index)
        }
      }
    }
  }, [])

  return { dragIdx, dropIdx, bind }
}
