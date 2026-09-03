/**
 * 텍스트 수정(editText) 세션의 순수 헬퍼 — 세션 종료 시 "손대지 않은" 객체 정리와 변경 여부 판정.
 */
import type { PageObject, Rect } from './objects'

const rectEq = (a: Rect, b: Rect): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/** 세션 중 "손대지 않은" editText(원문 그대로·제자리) 제거 — 스팬 클릭만 하고 만 경우 */
export function pruneUntouched(objectsByPage: Record<string, PageObject[]>): Record<string, PageObject[]> {
  const out: Record<string, PageObject[]> = {}
  for (const [k, list] of Object.entries(objectsByPage)) {
    out[k] = list.filter((o) => !(o.type === 'editText' && o.text === o.origText && rectEq(o.box, o.cover)))
  }
  return out
}

/** 두 objectsByPage 가 실질적으로 다른가 (페이지 배열 원소 identity 비교) */
export function objectsChanged(a: Record<string, PageObject[]>, b: Record<string, PageObject[]>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const la = a[k] ?? []
    const lb = b[k] ?? []
    if (la.length !== lb.length) return true
    for (let i = 0; i < la.length; i++) if (la[i] !== lb[i]) return true
  }
  return false
}
