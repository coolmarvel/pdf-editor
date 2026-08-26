/**
 * 임시 저장(draft) 의 순수 로직 — store/docs 모듈에서 떼어내 단위 테스트가 가능하게 했다.
 */
import type { PageRef } from './pages'

/** pages 가 실제로 참조하는 소스 문서만 골라낸다 ('blank' 제외, 중복 제거). 없는 docId 는 throw */
export function collectDraftDocs(pages: PageRef[], all: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const docs: Record<string, Uint8Array> = {}
  for (const p of pages) {
    if (p.docId === 'blank' || docs[p.docId]) continue
    const b = all[p.docId]
    if (!b) throw new Error(`serializeDraft: unknown doc ${p.docId}`)
    docs[p.docId] = b
  }
  return docs
}

/**
 * 복원 시 원래 docId(`doc-N`)를 그대로 등록하면, 이후 새 문서 id 가 그 N 과 겹칠 수 있다.
 * 내부 시퀀스를 본 숫자 이상으로 끌어올린 값을 돌려준다 (형식이 다르면 그대로).
 */
export function bumpDocSeq(seq: number, id: string): number {
  const m = /^doc-(\d+)$/.exec(id)
  return m ? Math.max(seq, Number(m[1])) : seq
}

/** 복원 시 currentPage 를 페이지 범위 안으로 */
export function clampPage(index: number, count: number): number {
  return Math.min(Math.max(0, index), Math.max(0, count - 1))
}
