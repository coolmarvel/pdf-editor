/**
 * 페이지 목록 연산 (Manage Pages 기능의 순수 로직).
 *
 * 문서는 "소스 문서(docId)의 페이지를 참조하는 배열"로 표현한다.
 * 삭제/복제/이동/회전/가져오기는 전부 이 배열 조작 — 실제 PDF 바이트는 저장 시점에 조립.
 */

export type Rotation = 0 | 90 | 180 | 270

export interface PageRef {
  /** 이 항목의 고유 id (React key + 객체 맵 키) */
  id: string
  /** 소스 문서 id. 빈 페이지는 'blank' */
  docId: string
  /** 소스 문서에서의 0-base 페이지 번호 (blank면 무시) */
  pageIndex: number
  /** 사용자가 추가로 돌린 회전 (소스 자체 회전 위에 더해짐) */
  extraRotation: Rotation
  /** 빈 페이지 크기 (PDF pt). blank 페이지만 사용 */
  blankSize?: { w: number; h: number }
}

let pseq = 0
export function newPageId(): string {
  return `pg-${++pseq}-${Math.random().toString(36).slice(2, 8)}`
}

export function addRotation(base: Rotation, delta: 90 | -90): Rotation {
  return (((base + delta) % 360) + 360) % 360 as Rotation
}

/** 빈 페이지 삽입 (index 위치 앞에) */
export function insertBlank(pages: PageRef[], index: number, size = { w: 595, h: 842 }): PageRef[] {
  const blank: PageRef = { id: newPageId(), docId: 'blank', pageIndex: -1, extraRotation: 0, blankSize: size }
  return [...pages.slice(0, index), blank, ...pages.slice(index)]
}

export function removePages(pages: PageRef[], ids: Set<string>): PageRef[] {
  const next = pages.filter((p) => !ids.has(p.id))
  // 전부 지우는 것은 금지 — 마지막 1장은 남긴다
  return next.length > 0 ? next : pages.slice(0, 1)
}

/** 선택 페이지들을 각자 바로 뒤에 복제. 복제본 id 매핑을 함께 반환(객체 복사용) */
export function duplicatePages(pages: PageRef[], ids: Set<string>): { pages: PageRef[]; cloneOf: Record<string, string> } {
  const out: PageRef[] = []
  const cloneOf: Record<string, string> = {}
  for (const p of pages) {
    out.push(p)
    if (ids.has(p.id)) {
      const clone = { ...p, id: newPageId() }
      cloneOf[clone.id] = p.id
      out.push(clone)
    }
  }
  return { pages: out, cloneOf }
}

export function rotatePages(pages: PageRef[], ids: Set<string>, delta: 90 | -90): PageRef[] {
  return pages.map((p) => (ids.has(p.id) ? { ...p, extraRotation: addRotation(p.extraRotation, delta) } : p))
}

/** 선택 페이지 묶음을 순서 유지한 채 target 페이지 앞(before) 또는 뒤(after)로 이동 */
export function movePages(pages: PageRef[], ids: Set<string>, targetId: string, where: 'before' | 'after'): PageRef[] {
  if (ids.has(targetId)) return pages
  const moving = pages.filter((p) => ids.has(p.id))
  const rest = pages.filter((p) => !ids.has(p.id))
  const ti = rest.findIndex((p) => p.id === targetId)
  if (ti < 0) return pages
  const at = where === 'before' ? ti : ti + 1
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)]
}

/** 선택 페이지들을 한 칸 앞/뒤로 (Move Before/After 버튼) */
export function nudgePages(pages: PageRef[], ids: Set<string>, dir: -1 | 1): PageRef[] {
  const arr = [...pages]
  const idxs = arr.map((p, i) => (ids.has(p.id) ? i : -1)).filter((i) => i >= 0)
  if (idxs.length === 0) return pages
  if (dir === -1) {
    for (const i of idxs) {
      if (i === 0 || ids.has(arr[i - 1].id)) continue
      ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    }
  } else {
    for (const i of [...idxs].reverse()) {
      if (i === arr.length - 1 || ids.has(arr[i + 1].id)) continue
      ;[arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]
    }
  }
  return arr
}

/** 다른 문서의 페이지들을 끝에 추가 (Import Document) */
export function appendDocument(pages: PageRef[], docId: string, pageCount: number): PageRef[] {
  return insertDocument(pages, docId, pageCount, pages.length)
}

/** 다른 문서의 페이지들을 index 위치 앞에 삽입 (사이드바 + 버튼의 "PDF 업로드") */
export function insertDocument(pages: PageRef[], docId: string, pageCount: number, index: number): PageRef[] {
  const added: PageRef[] = Array.from({ length: pageCount }, (_, i) => ({
    id: newPageId(),
    docId,
    pageIndex: i,
    extraRotation: 0 as Rotation
  }))
  const at = Math.max(0, Math.min(index, pages.length))
  return [...pages.slice(0, at), ...added, ...pages.slice(at)]
}

/** 페이지 묶음을 목록의 index 위치로 이동 (드래그 앤 드롭). index = 이동 전 배열 기준 삽입점 */
export function movePagesToIndex(pages: PageRef[], ids: Set<string>, index: number): PageRef[] {
  const moving = pages.filter((p) => ids.has(p.id))
  if (moving.length === 0) return pages
  // 삽입점 앞에 있던 "이동 대상이 아닌" 페이지 수 = 남은 배열에서의 삽입 위치
  const before = pages.slice(0, Math.max(0, Math.min(index, pages.length))).filter((p) => !ids.has(p.id)).length
  const rest = pages.filter((p) => !ids.has(p.id))
  return [...rest.slice(0, before), ...moving, ...rest.slice(before)]
}
