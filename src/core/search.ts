/**
 * 문서 텍스트 검색 — 스팬 목록에서 needle(소문자) 의 모든 일치를 페이지 정규화 rect 로 돌려준다 (순수).
 * 글자 폭이 균일하다고 가정하고 스팬 rect 를 오프셋 비율로 자른다 (근사).
 */
export interface SearchMatch {
  pageId: string
  pageIndex: number
  rect: { x: number; y: number; w: number; h: number }
}

export interface SearchableSpan {
  rect: { x: number; y: number; w: number; h: number }
  text: string
}

export function findMatches(pageId: string, pageIndex: number, spans: SearchableSpan[], needle: string): SearchMatch[] {
  const out: SearchMatch[] = []
  if (!needle) return out
  for (const sp of spans) {
    const hay = sp.text.toLowerCase()
    const len = hay.length
    let from = 0
    while (from <= len - needle.length) {
      const at = hay.indexOf(needle, from)
      if (at < 0) break
      const rect = { x: sp.rect.x + (sp.rect.w * at) / len, y: sp.rect.y, w: (sp.rect.w * needle.length) / len, h: sp.rect.h }
      out.push({ pageId, pageIndex, rect })
      from = at + needle.length
    }
  }
  return out
}
