/** 저장 서명함의 localStorage 백엔드 — 데스크톱·오프라인 폴백 (온라인 웹은 Platform.signStore 가 우선) */
const SAVED_SIGNS_KEY = 'savedSigns'

export function loadSavedSigns(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_SIGNS_KEY) ?? '[]')
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function persistSavedSigns(signs: string[]): void {
  try {
    localStorage.setItem(SAVED_SIGNS_KEY, JSON.stringify(signs))
  } catch {
    // 용량 초과 등 — 저장 실패해도 세션 내 목록은 유지
  }
}
