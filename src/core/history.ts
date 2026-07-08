/**
 * 실행취소/다시실행 히스토리 (스냅샷 방식).
 *
 * 스냅샷은 불변 취급 — 편집 시 항상 새 배열/객체를 만들기 때문에 얕은 보관으로 충분하다.
 * 큰 비트맵(dataUrl 문자열)은 참조 공유되므로 메모리 부담 없음.
 */

export interface History<S> {
  past: S[]
  future: S[]
}

export const MAX_HISTORY = 100

export function emptyHistory<S>(): History<S> {
  return { past: [], future: [] }
}

/** 변경 직전 상태를 기록. future는 버려진다. */
export function push<S>(h: History<S>, snapshot: S): History<S> {
  const past = h.past.length >= MAX_HISTORY ? h.past.slice(1) : h.past
  return { past: [...past, snapshot], future: [] }
}

export function canUndo<S>(h: History<S>): boolean {
  return h.past.length > 0
}

export function canRedo<S>(h: History<S>): boolean {
  return h.future.length > 0
}

/** 현재 상태를 넘기면 [되돌린 상태, 새 히스토리]를 반환. 불가면 null */
export function undo<S>(h: History<S>, current: S): [S, History<S>] | null {
  if (h.past.length === 0) return null
  const prev = h.past[h.past.length - 1]
  return [prev, { past: h.past.slice(0, -1), future: [current, ...h.future] }]
}

export function redo<S>(h: History<S>, current: S): [S, History<S>] | null {
  if (h.future.length === 0) return null
  const next = h.future[0]
  return [next, { past: [...h.past, current], future: h.future.slice(1) }]
}
