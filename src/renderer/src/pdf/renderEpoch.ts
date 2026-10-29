/**
 * 렌더 세대(epoch) — 엔진 워커가 죽어 문서를 다시 연 뒤(`registry.onDocsReopened`) 모든 페이지 캔버스가 다시 그려지게 하는 작은 외부 스토어.
 * `usePageRender` 가 의존성에 넣는다. 스토어(zustand) 액션 계약을 건드리지 않고 화면만 다시 그린다.
 */
import { useSyncExternalStore } from 'react'

let epoch = 0
const listeners = new Set<() => void>()

export function bumpRenderEpoch(): void {
  epoch++
  for (const fn of listeners) fn()
}

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = (): number => epoch

export const useRenderEpoch = (): number => useSyncExternalStore(subscribe, snapshot, snapshot)
