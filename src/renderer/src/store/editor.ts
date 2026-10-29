/**
 * 편집기 전역 상태 (zustand).
 *
 * - 문서 = pages(PageRef[]) + objectsByPage(페이지 id → 객체 배열). 이 둘이 undo/redo 스냅샷 단위.
 * - 실제 PDF 바이트/엔진 문서 id 는 pdf/registry.ts 모듈에 격리 (여기는 참조 id만).
 * - 모든 편집 액션은 commit() 을 거쳐 히스토리에 직전 상태를 쌓는다.
 */
import { create } from 'zustand'
import type { PageRef } from '@core/pages'
import {
  insertBlank,
  removePages,
  duplicatePages,
  rotatePages,
  movePagesToIndex,
  nudgePages,
  insertDocument
} from '@core/pages'
import type { PageObject, ObjectId, DashStyle, BlendMode } from '@core/objects'
import { newId, rotateObjectCW, SIGN_PLACE_W } from '@core/objects'
import type { History } from '@core/history'
import { emptyHistory, push, undo as hUndo, redo as hRedo } from '@core/history'
import { registerDoc, getDisplaySize, clearDocs, extractTextSpans, getAllDocBytes } from '@renderer/pdf/docs'
import { imageFilesToPdfBytes, A4 } from '@renderer/pdf/imageToPdf'
import { collectDraftDocs, clampPage } from '@core/draft'
import { findMatches, type SearchMatch } from '@core/search'
import { pruneUntouched, objectsChanged } from '@core/editTextSession'
import { loadSavedSigns, persistSavedSigns } from './signsStorage'

export type { SearchMatch }

export type Tool =
  | 'select'
  | 'hand'
  | 'addText'
  | 'editText'
  | 'whiteout'
  | 'eraseDrawing'
  | 'highlight'
  | 'pencil'
  | 'image'
  | 'stamp'
  | 'rect'
  | 'ellipse'
  | 'cross'
  | 'check'
  | 'sign'
  | 'watermark'
  | 'note'
  | 'link'

export interface TextStyle {
  font: string
  size: number // 페이지 높이 대비 비율
  color: string
  /** 글자 배경색. null = 없음 */
  bgColor: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  opacity: number
}

export interface PenStyle {
  color: string
  width: number // 페이지 폭 대비 비율
  opacity: number
}

/** 펜(연필/형광펜) 공통: 채우기/혼합 모드 포함 (Guru 파리티) */
export interface HighlightStyle extends PenStyle {
  fill: string | null
  blend: BlendMode
}

export interface ShapeStyle {
  stroke: string
  strokeWidth: number
  fill: string | null
  opacity: number
  dash: DashStyle
}

/** X/체크 표시 도구 설정 — 찍기 전에 크기·색을 정한다 (기본 검정) */
export interface MarkStyle {
  color: string
  /** 마크 폭 = 페이지 폭 대비 비율 */
  size: number
}

/** 워터마크 도구 설정 (컨텍스트 바) — 적용 시 WatermarkObj 로 페이지에 박힌다 */
export interface WatermarkStyle {
  mode: 'text' | 'image'
  text: string
  font: string
  color: string
  /** 업로드한 이미지 (image 모드) */
  image: { dataUrl: string; aspect: number } | null
  opacity: number
  /** 시계방향 회전(도) */
  angle: number
  /** 마크 폭 = 페이지 폭 대비 비율 */
  scale: number
  layout: 'single' | 'tile'
  scope: 'all' | 'current'
}

/** 지우개(흰 도형으로 덮기) 설정 — pdfguru 의 Eraser: 도형 기반, 테두리/채우기/스타일 변경 가능 */
export interface EraserStyle {
  kind: 'rect' | 'ellipse'
  stroke: string
  strokeWidth: number
  fill: string
  opacity: number
  dash: DashStyle
}

interface Snapshot {
  pages: PageRef[]
  objectsByPage: Record<string, PageObject[]>
  displaySizes: Record<string, { w: number; h: number }>
}

export type Phase = 'landing' | 'loading' | 'editor'

/**
 * 임시 저장(draft) 직렬화 형식 — 편집 중인 문서를 통째로 담아 나중에 그대로 복원한다.
 * docs 에는 pages 가 참조하는 모든 소스 문서 바이트(원본 docId 유지, 'blank' 제외)를 담는다.
 * 웹 앱과 공유하는 계약이므로 필드 구조를 바꾸면 version 을 올린다.
 */
export interface EditorDraft {
  version: 1
  fileName: string
  pages: PageRef[]
  objectsByPage: Record<string, PageObject[]>
  displaySizes: Record<string, { w: number; h: number }>
  /** docId → 소스 바이트 (pages 가 참조하는 docId 전부, 'blank' 제외) */
  docs: Record<string, Uint8Array>
  zoom: number
  currentPage: number
}

export type Lang = 'ko' | 'en'
/** 페이지 모드: 한 쪽씩 / 두 쪽 나란히 */
export type PageMode = 'single' | 'double'
/** 페이지 전환: 이어서 스크롤 / 한 장(쌍)씩 보기 */
export type PageTransition = 'continuous' | 'paged'

/**
 * 텍스트 검색 상태 (pdfguru 의 상단 검색 바).
 * matchesByPage 는 matches 를 페이지별로 미리 묶은 파생값 — PageCanvas 가 "내 페이지 일치만" 을
 * 안정된 참조로 구독하게 해서(매 렌더 filter 로 새 배열을 만들면 memo 가 깨진다) 다른 페이지의 재렌더를 막는다.
 */
export interface SearchState {
  open: boolean
  query: string
  matches: SearchMatch[]
  matchesByPage: Record<string, SearchMatch[]>
  /** 현재 일치 index (matches 가 비면 -1) */
  current: number
}

interface EditorState {
  phase: Phase
  loadingProgress: number
  fileName: string
  /** 다이얼로그/사이드바처럼 자체 토스트가 없는 화면이 Editor 의 스낵바로 알림을 올리는 통로 */
  notice: { msg: string; severity: 'success' | 'error' } | null
  pages: PageRef[]
  objectsByPage: Record<string, PageObject[]>
  /** 페이지 id → 표시 크기(pt) */
  displaySizes: Record<string, { w: number; h: number }>
  history: History<Snapshot>
  tool: Tool
  textStyle: TextStyle
  penStyle: HighlightStyle
  highlightStyle: HighlightStyle
  eraserStyle: EraserStyle
  shapeStyle: ShapeStyle
  markStyle: MarkStyle
  watermarkStyle: WatermarkStyle
  /** 저장해 둔 서명 이미지들 (dataUrl) */
  savedSigns: string[]
  selected: { pageId: string; objectId: ObjectId } | null
  /** 이미지/스탬프/서명 도구로 배치 대기 중인 비트맵 */
  pendingImage: { dataUrl: string; aspect: number; kind: 'image' | 'stamp' | 'sign' } | null
  /** 현재 보이는 페이지 (0-base) */
  currentPage: number
  /** 스크롤 요청 (페이저/썸네일 클릭 → PageView 가 소비) */
  scrollTo: { page: number; nonce: number } | null
  /** px per pt. 0 = 아직 미계산(첫 fit) */
  zoom: number
  /** UI 언어 (localStorage 유지) */
  lang: Lang
  pageMode: PageMode
  pageTransition: PageTransition
  /** zoom=0 일 때 어떻게 fit 할지: width = 폭 맞춤(기본 로드), page = 페이지 전체 */
  fitMode: 'width' | 'page'
  /**
   * 텍스트 수정(Edit Text) 세션 — 도구 활성 동안 변경을 버퍼에 담는다 (pdfguru 동작).
   * 세션 중엔 히스토리가 얼어붙고(undo/redo 비활성), 종료 시 저장(한 단계 커밋)/취소(원복)를 택한다.
   * 값 = 세션 시작 시점의 objectsByPage 스냅샷.
   */
  editTextSnapshot: Record<string, PageObject[]> | null
  /** 세션 종료 확인 대기: 전환하려던 도구 (Editor 가 저장/안 함 다이얼로그 표시) */
  editTextExitPrompt: Tool | null
  /** editText 객체 삭제 확인 대기 (Editor 가 다이얼로그 표시) */
  deletePrompt: { pageId: string; objectId: ObjectId } | null
  search: SearchState

  openDocument(name: string, bytes: Uint8Array, onProgress?: (p: number) => void): Promise<void>
  closeDocument(): void
  /** 임시 저장용 직렬화. 편집 화면이 아니면 throw */
  serializeDraft(): EditorDraft
  /** 임시 저장 복원 — 소스 문서를 원래 docId 로 다시 등록하고 상태를 통째로 되살린다 (히스토리는 비움) */
  restoreDraft(d: EditorDraft): Promise<void>
  setFileName(n: string): void
  setNotice(n: EditorState['notice']): void
  setTool(t: Tool): void
  setTextStyle(p: Partial<TextStyle>): void
  setPenStyle(p: Partial<HighlightStyle>): void
  setHighlightStyle(p: Partial<HighlightStyle>): void
  setEraserStyle(p: Partial<EraserStyle>): void
  setShapeStyle(p: Partial<ShapeStyle>): void
  setMarkStyle(p: Partial<MarkStyle>): void
  setWatermarkStyle(p: Partial<WatermarkStyle>): void
  /** 워터마크를 scope(전체/현재 페이지)에 한 번의 히스토리 커밋으로 적용 */
  applyWatermark(dataUrl: string, aspect: number): void
  /** 문서 전체의 워터마크 객체 일괄 제거 (한 커밋) */
  removeAllWatermarks(): void
  addSavedSign(dataUrl: string): void
  removeSavedSign(index: number): void
  /** 서명을 현재 페이지에 바로 배치 (Guru: Done 즉시 노출, 클릭 대기 없음). at = 페이지 정규화 좌표(기본 중앙) */
  placeSignOnCurrentPage(dataUrl: string, aspect: number, at?: { x: number; y: number }): void
  setSelected(s: { pageId: string; objectId: ObjectId } | null): void
  setPendingImage(p: { dataUrl: string; aspect: number; kind: 'image' | 'stamp' | 'sign' } | null): void
  /** 데이터 변경 없이 현재 상태를 히스토리에 쌓는다 (드래그 시작 시점) */
  markHistory(): void
  /** 텍스트 수정 세션 종료: save=true 세션 전 상태를 히스토리 한 단계로, false 원복. 그 후 nextTool 로 전환 */
  endEditTextSession(save: boolean, nextTool: Tool): void
  cancelEditTextExit(): void
  /** deletePrompt 확정: 텍스트만 비우고 cover 는 남긴다 (원본이 지워진 상태 유지) */
  confirmDelete(): void
  cancelDelete(): void
  setCurrentPage(i: number): void
  requestScrollTo(page: number): void
  setZoom(z: number): void
  setLang(l: Lang): void
  setPageMode(m: PageMode): void
  setPageTransition(t: PageTransition): void
  /** 페이지가 화면에 통째로 들어오게 재-fit (zoom=0 → PagesView 가 다시 계산) */
  requestFit(): void
  /** 드래그 앤 드롭: 페이지 묶음을 index 위치로 이동 */
  pageMoveToIndex(ids: Set<string>, index: number): void

  openSearch(): void
  /** 닫으면서 질의·일치를 모두 비운다 (페이지 연산 뒤 낡은 하이라이트가 남지 않게) */
  closeSearch(): void
  /**
   * 질의 설정 + 전 페이지 대소문자 무시 검색 (비동기 — 스팬 추출은 페이지별 캐시).
   * 결과가 도착하면 첫 일치로 스크롤. 호출이 겹치면 마지막 호출만 반영(이전 결과 폐기).
   */
  setSearchQuery(q: string): Promise<void>
  searchNext(): void
  searchPrev(): void

  undo(): void
  redo(): void

  addObject(pageId: string, obj: PageObject): void
  /** 히스토리 없이 추가 — 입력 중 임시 객체(확정 시 addObject 로 한 단계만 쌓기 위함) */
  addObjectTransient(pageId: string, obj: PageObject): void
  updateObject(pageId: string, id: ObjectId, patch: Partial<PageObject>): void
  /** 히스토리 없이 갱신 (드래그 중간 상태) */
  updateObjectTransient(pageId: string, id: ObjectId, patch: Partial<PageObject>): void
  removeObject(pageId: string, id: ObjectId): void
  /** 히스토리 없이 제거 — 임시 객체 취소용 */
  removeObjectTransient(pageId: string, id: ObjectId): void
  /** 페이지 객체 배열 통째 교체 — 히스토리 없음, set 1회 (지우개처럼 한 이벤트에 여러 객체가 바뀔 때 일괄 반영) */
  replaceObjects(pageId: string, next: PageObject[]): void

  pageInsertBlank(index: number): void
  pageRemove(ids: Set<string>): void
  pageDuplicate(ids: Set<string>): void
  pageRotate(ids: Set<string>, delta: 90 | -90): void
  pageNudge(ids: Set<string>, dir: -1 | 1): void
  /** PDF 가져오기. index 지정 시 그 위치 앞에 삽입, 없으면 끝에 */
  pageImport(bytes: Uint8Array, index?: number): Promise<void>
  /**
   * 이미지(jpg/png/webp/…)를 페이지로 가져오기. 각 이미지가 1페이지가 된다.
   * 페이지 크기는 삽입 위치 기준 페이지를 따르고(문서 없으면 A4), 이미지는 비율 유지로 fit.
   */
  pageImportImages(files: Blob[], index?: number): Promise<void>
}

const DEFAULT_TEXT: TextStyle = {
  font: 'Helvetica',
  size: 0.022,
  color: '#111111',
  bgColor: null,
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
  valign: 'top',
  opacity: 1
}

const EMPTY_SEARCH: SearchState = { open: false, query: '', matches: [], matchesByPage: {}, current: -1 }
/** setSearchQuery 호출 일련번호 — 비동기 스팬 추출 뒤 낡은 결과를 버리기 위해 */
let searchSeq = 0

function snap(s: EditorState): Snapshot {
  return { pages: s.pages, objectsByPage: s.objectsByPage, displaySizes: s.displaySizes }
}

/** 배열에서 id 가 일치하는 객체 하나에 patch 를 덮어쓴 새 배열 */
function patchIn(list: PageObject[], id: ObjectId, patch: Partial<PageObject>): PageObject[] {
  return list.map((o) => (o.id === id ? ({ ...o, ...patch } as PageObject) : o))
}

/** 내보내기 파일명 — 열린 문서 이름(없으면 'document') + 접미사 + .pdf. 저장/인쇄/페이지 추출 공용 */
export const exportFileName = (suffix = ''): string => `${useEditor.getState().fileName || 'document'}${suffix}.pdf`

/** undo/redo 가능 여부 셀렉터 — 텍스트 수정 세션 중엔 히스토리가 얼어 둘 다 false (Toolbar·ManagePagesDialog 공용) */
export const selectCanUndo = (s: EditorState): boolean => s.history.past.length > 0 && !s.editTextSnapshot
export const selectCanRedo = (s: EditorState): boolean => s.history.future.length > 0 && !s.editTextSnapshot

export const useEditor = create<EditorState>()((set, get) => {
  /** 변경 전 스냅샷을 히스토리에 쌓고 패치 적용. 텍스트 수정 세션 중엔 히스토리 없이(버퍼) 적용 */
  function commit(patch: Partial<EditorState>): void {
    const s = get()
    if (s.editTextSnapshot) {
      set(patch)
      return
    }
    set({ history: push(s.history, snap(s)), ...patch })
  }

  /** 한 페이지의 객체 배열만 fn 으로 바꿔 반영. history=false 면 히스토리 없이(드래그 중간·임시 객체) */
  function editPage(
    pageId: string,
    fn: (list: PageObject[]) => PageObject[],
    opts: { history: boolean; clearSelection?: boolean }
  ): void {
    const s = get()
    const patch: Partial<EditorState> = { objectsByPage: { ...s.objectsByPage, [pageId]: fn(s.objectsByPage[pageId] ?? []) } }
    if (opts.clearSelection) patch.selected = null
    if (opts.history) commit(patch)
    else set(patch)
  }

  /** 페이지 배열만 바꾸는 연산(삭제·이동 등)을 한 커밋으로 */
  function pageOp(fn: (pages: PageRef[]) => PageRef[]): void {
    commit({ pages: fn(get().pages) })
  }

  /** 검색 일치 이동 (양끝에서 감김). 페이지가 바뀌면 그 페이지로 스크롤 */
  function stepSearch(dir: 1 | -1): void {
    const { search } = get()
    const n = search.matches.length
    if (n === 0) return
    const current = (search.current + dir + n) % n
    set({ search: { ...search, current } })
    const m = search.matches[current]
    if (m.pageIndex !== get().currentPage) get().requestScrollTo(m.pageIndex)
  }

  /** undo/redo 공통: 텍스트 수정 세션 중엔 비활성 (Guru 동작 — 종료 시 저장/취소로 처리) */
  function step(apply: typeof hUndo): void {
    const s = get()
    if (s.editTextSnapshot) return
    const r = apply(s.history, snap(s))
    if (r) set({ ...r[0], history: r[1], selected: null })
  }

  return {
    phase: 'landing',
    loadingProgress: 0,
    fileName: '',
    notice: null,
    pages: [],
    objectsByPage: {},
    displaySizes: {},
    history: emptyHistory<Snapshot>(),
    tool: 'select',
    textStyle: DEFAULT_TEXT,
    penStyle: { color: '#2563eb', width: 5 / 595, opacity: 1, fill: null, blend: 'normal' }, // 5pt (Guru 기본)
    highlightStyle: { color: '#facc15', width: 0.025, opacity: 0.45, fill: null, blend: 'multiply' },
    eraserStyle: { kind: 'rect', stroke: '#ffffff', strokeWidth: 5 / 595, fill: '#ffffff', opacity: 1, dash: 'solid' }, // 5pt (Guru 기본)
    shapeStyle: { stroke: '#2563eb', strokeWidth: 0.004, fill: null, opacity: 1, dash: 'solid' },
    markStyle: { color: '#111111', size: 16 / 595 }, // 기본 16pt·검정
    watermarkStyle: {
      mode: 'text',
      text: '',
      font: 'Helvetica',
      color: '#9ca3af',
      image: null,
      opacity: 0.35,
      angle: -30,
      scale: 0.5,
      layout: 'single',
      scope: 'all'
    },
    savedSigns: loadSavedSigns(),
    selected: null,
    pendingImage: null,
    currentPage: 0,
    scrollTo: null,
    zoom: 0,
    // 데스크톱 기본 한국어: localStorage('lang') 에 'en' 이 저장돼 있을 때만 영어
    lang: (localStorage.getItem('lang') as Lang) === 'en' ? 'en' : 'ko',
    pageMode: 'single',
    pageTransition: 'continuous',
    fitMode: 'width',
    editTextSnapshot: null,
    editTextExitPrompt: null,
    deletePrompt: null,
    search: EMPTY_SEARCH,

    async openDocument(name, bytes, onProgress) {
      set({ phase: 'loading', loadingProgress: 5, fileName: name.replace(/\.pdf$/i, '') })
      const { docId, pageCount } = await registerDoc(bytes)
      onProgress?.(30)
      set({ loadingProgress: 30 })
      const pages = insertDocument([], docId, pageCount, 0)
      const displaySizes: Record<string, { w: number; h: number }> = {}
      for (let i = 0; i < pages.length; i++) {
        displaySizes[pages[i].id] = await getDisplaySize(pages[i])
        const p = 30 + Math.round((i / pages.length) * 65)
        onProgress?.(p)
        if (i % 5 === 0) set({ loadingProgress: p })
      }
      set({
        pages,
        objectsByPage: {},
        displaySizes,
        history: emptyHistory<Snapshot>(),
        selected: null,
        pendingImage: null,
        currentPage: 0,
        zoom: 0,
        loadingProgress: 100,
        phase: 'editor',
        tool: 'select'
      })
    },

    closeDocument() {
      clearDocs()
      set({
        phase: 'landing',
        fileName: '',
        pages: [],
        objectsByPage: {},
        displaySizes: {},
        history: emptyHistory<Snapshot>(),
        selected: null,
        pendingImage: null,
        currentPage: 0,
        zoom: 0,
        search: EMPTY_SEARCH
      })
    },

    serializeDraft() {
      const s = get()
      if (s.phase !== 'editor') throw new Error('serializeDraft: not in editor phase')
      // pages 가 실제로 참조하는 문서만 담는다 (삭제된 가져오기 문서는 버린다)
      const docs = collectDraftDocs(s.pages, getAllDocBytes())
      return {
        version: 1,
        fileName: s.fileName,
        pages: s.pages,
        objectsByPage: s.objectsByPage,
        displaySizes: s.displaySizes,
        docs,
        zoom: s.zoom,
        currentPage: s.currentPage
      }
    },

    async restoreDraft(d) {
      set({ phase: 'loading', loadingProgress: 5, fileName: d.fileName })
      clearDocs()
      const ids = Object.keys(d.docs)
      for (let i = 0; i < ids.length; i++) {
        await registerDoc(d.docs[ids[i]], ids[i])
        set({ loadingProgress: 10 + Math.round(((i + 1) / ids.length) * 80) })
      }
      // displaySizes 는 draft 값을 신뢰하되, 빠진 페이지만 다시 계산 (구버전 draft 방어)
      const displaySizes = { ...d.displaySizes }
      for (const p of d.pages) if (!displaySizes[p.id]) displaySizes[p.id] = await getDisplaySize(p)
      set({
        pages: d.pages,
        objectsByPage: d.objectsByPage,
        displaySizes,
        history: emptyHistory<Snapshot>(),
        selected: null,
        pendingImage: null,
        currentPage: clampPage(d.currentPage, d.pages.length),
        zoom: d.zoom,
        loadingProgress: 100,
        phase: 'editor',
        tool: 'select',
        search: EMPTY_SEARCH,
        editTextSnapshot: null,
        editTextExitPrompt: null,
        deletePrompt: null
      })
    },

    setFileName: (fileName) => set({ fileName }),
    setNotice: (notice) => set({ notice }),
    setTool(tool) {
      const s = get()
      // 텍스트 수정 세션 종료 시도: 변경 있으면 저장/안 함 확인 (Editor 다이얼로그), 없으면 조용히 종료
      if (s.tool === 'editText' && tool !== 'editText' && s.editTextSnapshot) {
        const pruned = pruneUntouched(s.objectsByPage)
        if (objectsChanged(pruned, s.editTextSnapshot)) {
          set({ editTextExitPrompt: tool })
          return
        }
        set({ tool, selected: null, editTextSnapshot: null, objectsByPage: s.editTextSnapshot })
        return
      }
      // 세션 시작: 현재 객체 상태 스냅샷
      if (tool === 'editText' && s.tool !== 'editText') {
        set({ tool, selected: null, editTextSnapshot: s.objectsByPage })
        return
      }
      set({ tool, selected: null })
    },
    endEditTextSession(save, nextTool) {
      const s = get()
      const snap0 = s.editTextSnapshot
      if (!snap0) {
        set({ tool: nextTool, selected: null, editTextExitPrompt: null })
        return
      }
      if (save) {
        set({
          history: push(s.history, { ...snap(s), objectsByPage: snap0 }),
          objectsByPage: pruneUntouched(s.objectsByPage),
          tool: nextTool,
          selected: null,
          editTextSnapshot: null,
          editTextExitPrompt: null
        })
      } else {
        set({ objectsByPage: snap0, tool: nextTool, selected: null, editTextSnapshot: null, editTextExitPrompt: null })
      }
    },
    cancelEditTextExit: () => set({ editTextExitPrompt: null }),
    confirmDelete() {
      const s = get()
      const p = s.deletePrompt
      if (!p) return
      const list = s.objectsByPage[p.pageId] ?? []
      set({
        objectsByPage: {
          ...s.objectsByPage,
          [p.pageId]: patchIn(list, p.objectId, { text: '' } as Partial<PageObject>)
        },
        selected: null,
        deletePrompt: null
      })
    },
    cancelDelete: () => set({ deletePrompt: null }),
    setTextStyle: (p) => set((s) => ({ textStyle: { ...s.textStyle, ...p } })),
    setPenStyle: (p) => set((s) => ({ penStyle: { ...s.penStyle, ...p } })),
    setHighlightStyle: (p) => set((s) => ({ highlightStyle: { ...s.highlightStyle, ...p } })),
    setEraserStyle: (p) => set((s) => ({ eraserStyle: { ...s.eraserStyle, ...p } })),
    setShapeStyle: (p) => set((s) => ({ shapeStyle: { ...s.shapeStyle, ...p } })),
    setMarkStyle: (p) => set((s) => ({ markStyle: { ...s.markStyle, ...p } })),
    setWatermarkStyle: (p) => set((s) => ({ watermarkStyle: { ...s.watermarkStyle, ...p } })),
    applyWatermark(dataUrl, aspect) {
      const s = get()
      const ws = s.watermarkStyle
      const targets = ws.scope === 'all' ? s.pages : [s.pages[s.currentPage]].filter(Boolean)
      if (targets.length === 0) return
      const objectsByPage = { ...s.objectsByPage }
      for (const pg of targets) {
        const size = s.displaySizes[pg.id]
        if (!size) continue
        const wN = ws.scale
        const hN = (wN * size.w) / aspect / size.h
        const obj: PageObject = {
          id: newId(),
          type: 'watermark',
          rect: { x: 0.5 - wN / 2, y: 0.5 - hN / 2, w: wN, h: hN },
          dataUrl,
          angle: ws.angle,
          layout: ws.layout,
          opacity: ws.opacity
        }
        objectsByPage[pg.id] = [...(objectsByPage[pg.id] ?? []), obj]
      }
      commit({ objectsByPage, selected: null })
    },
    removeAllWatermarks() {
      const s = get()
      const hasAny = Object.values(s.objectsByPage).some((list) => list.some((o) => o.type === 'watermark'))
      if (!hasAny) return
      const objectsByPage = Object.fromEntries(
        Object.entries(s.objectsByPage).map(([k, list]) => [k, list.filter((o) => o.type !== 'watermark')])
      )
      commit({ objectsByPage, selected: null })
    },
    addSavedSign(dataUrl) {
      const savedSigns = [...get().savedSigns, dataUrl]
      persistSavedSigns(savedSigns)
      set({ savedSigns })
    },
    removeSavedSign(index) {
      const savedSigns = get().savedSigns.filter((_, i) => i !== index)
      persistSavedSigns(savedSigns)
      set({ savedSigns })
    },
    placeSignOnCurrentPage(dataUrl, aspect, at) {
      const s = get()
      const page = s.pages[s.currentPage]
      const size = page ? s.displaySizes[page.id] : undefined
      if (!page || !size) return
      const wN = SIGN_PLACE_W // PageCanvas 클릭 배치와 동일한 기본 폭
      const hN = (wN * size.w) / aspect / size.h
      // 페이지 밖으로 나가지 않게 중심 클램프
      const cx = Math.min(1 - wN / 2, Math.max(wN / 2, at?.x ?? 0.5))
      const cy = Math.min(Math.max(0, 1 - hN / 2), Math.max(hN / 2, at?.y ?? 0.5))
      const obj: PageObject = {
        id: newId(),
        type: 'image',
        kind: 'sign',
        rect: { x: cx - wN / 2, y: cy - hN / 2, w: wN, h: hN },
        dataUrl,
        opacity: 1
      }
      commit({
        objectsByPage: { ...s.objectsByPage, [page.id]: [...(s.objectsByPage[page.id] ?? []), obj] },
        tool: 'select',
        selected: { pageId: page.id, objectId: obj.id },
        pendingImage: null
      })
    },
    setSelected: (selected) => set({ selected }),
    setPendingImage: (pendingImage) => set({ pendingImage }),
    markHistory() {
      const s = get()
      if (s.editTextSnapshot) return // 세션 중엔 히스토리 동결
      set({ history: push(s.history, snap(s)) })
    },
    setCurrentPage: (currentPage) => set({ currentPage }),
    requestScrollTo: (page) => set({ scrollTo: { page, nonce: Date.now() }, currentPage: page }),
    setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.2, zoom)) }),
    setLang(lang) {
      localStorage.setItem('lang', lang)
      set({ lang })
    },
    setPageMode: (pageMode) => set({ pageMode, zoom: 0, fitMode: 'width' }), // 모드 바뀌면 폭 기준 재-fit
    setPageTransition: (pageTransition) => set({ pageTransition }),
    requestFit: () => set({ zoom: 0, fitMode: 'page' }), // "화면에 맞춤" = 페이지 전체가 보이게
    pageMoveToIndex: (ids, index) => pageOp((p) => movePagesToIndex(p, ids, index)),

    openSearch: () => set((s) => ({ search: { ...s.search, open: true } })),
    closeSearch: () => {
      searchSeq++ // 진행 중인 검색 결과 폐기
      set({ search: EMPTY_SEARCH })
    },
    async setSearchQuery(query) {
      const seq = ++searchSeq
      const s = get()
      set({ search: { ...s.search, query } })
      const needle = query.trim().toLowerCase()
      if (!needle) {
        set((st) => ({ search: { ...st.search, matches: [], matchesByPage: {}, current: -1 } }))
        return
      }
      const matches: SearchMatch[] = []
      const matchesByPage: Record<string, SearchMatch[]> = {}
      for (let pageIndex = 0; pageIndex < s.pages.length; pageIndex++) {
        const page = s.pages[pageIndex]
        let spans
        try {
          spans = await extractTextSpans(page)
        } catch {
          continue
        }
        if (seq !== searchSeq) return // 더 새 질의가 들어옴
        const found = findMatches(page.id, pageIndex, spans, needle)
        if (found.length) {
          matches.push(...found)
          matchesByPage[page.id] = found
        }
      }
      if (seq !== searchSeq) return
      set((st) => ({ search: { ...st.search, matches, matchesByPage, current: matches.length ? 0 : -1 } }))
      if (matches.length && matches[0].pageIndex !== get().currentPage) get().requestScrollTo(matches[0].pageIndex)
    },
    searchNext: () => stepSearch(1),
    searchPrev: () => stepSearch(-1),

    undo: () => step(hUndo),
    redo: () => step(hRedo),

    addObject: (pageId, obj) => editPage(pageId, (l) => [...l, obj], { history: true }),
    addObjectTransient: (pageId, obj) => editPage(pageId, (l) => [...l, obj], { history: false }),
    updateObject: (pageId, id, patch) => editPage(pageId, (l) => patchIn(l, id, patch), { history: true }),
    updateObjectTransient: (pageId, id, patch) => editPage(pageId, (l) => patchIn(l, id, patch), { history: false }),
    removeObject(pageId, id) {
      const s = get()
      // 세션 중 editText 삭제는 확인 후 "지우기"(cover 만 남김) — Guru 동작
      if (s.editTextSnapshot && (s.objectsByPage[pageId] ?? []).find((o) => o.id === id)?.type === 'editText') {
        set({ deletePrompt: { pageId, objectId: id } })
        return
      }
      editPage(pageId, (l) => l.filter((o) => o.id !== id), { history: true, clearSelection: true })
    },
    removeObjectTransient: (pageId, id) =>
      editPage(pageId, (l) => l.filter((o) => o.id !== id), { history: false, clearSelection: true }),
    replaceObjects: (pageId, next) => editPage(pageId, () => next, { history: false }),

    pageInsertBlank(index) {
      const s = get()
      const pages = insertBlank(s.pages, index)
      const added = pages.find((p) => !s.pages.includes(p))!
      commit({
        pages,
        displaySizes: { ...s.displaySizes, [added.id]: added.blankSize! }
      })
    },

    pageRemove: (ids) => pageOp((p) => removePages(p, ids)),

    pageDuplicate(ids) {
      const s = get()
      const { pages, cloneOf } = duplicatePages(s.pages, ids)
      const objectsByPage = { ...s.objectsByPage }
      const displaySizes = { ...s.displaySizes }
      for (const [cloneId, origId] of Object.entries(cloneOf)) {
        objectsByPage[cloneId] = (s.objectsByPage[origId] ?? []).map((o) => ({ ...o, id: newId() }))
        displaySizes[cloneId] = s.displaySizes[origId]
      }
      commit({ pages, objectsByPage, displaySizes })
    },

    pageRotate(ids, delta) {
      const s = get()
      const pages = rotatePages(s.pages, ids, delta)
      const objectsByPage = { ...s.objectsByPage }
      const displaySizes = { ...s.displaySizes }
      for (const id of ids) {
        const sz = s.displaySizes[id]
        if (sz) displaySizes[id] = { w: sz.h, h: sz.w }
        const objs = s.objectsByPage[id]
        if (objs && objs.length > 0) {
          // 시계방향(90)이면 1회, 반시계(-90)면 3회 회전
          const times = delta === 90 ? 1 : 3
          objectsByPage[id] = objs.map((o) => {
            let r = o
            for (let i = 0; i < times; i++) r = rotateObjectCW(r)
            return r
          })
        }
      }
      commit({ pages, objectsByPage, displaySizes })
    },

    pageNudge: (ids, dir) => pageOp((p) => nudgePages(p, ids, dir)),

    async pageImport(bytes, index) {
      const { docId, pageCount } = await registerDoc(bytes)
      const s = get()
      const at = index ?? s.pages.length
      const pages = insertDocument(s.pages, docId, pageCount, at)
      const displaySizes = { ...s.displaySizes }
      for (const p of pages.slice(at, at + pageCount)) {
        displaySizes[p.id] = await getDisplaySize(p)
      }
      commit({ pages, displaySizes })
    },

    async pageImportImages(files, index) {
      if (files.length === 0) return
      const s = get()
      const at = index ?? s.pages.length
      // 삽입 위치 바로 앞 페이지의 크기를 따라간다 (맨 앞이면 첫 페이지) — 레이아웃이 튀지 않게
      const ref = s.pages[Math.max(0, at - 1)] ?? s.pages[0]
      const size = ref ? s.displaySizes[ref.id] : undefined
      const bytes = await imageFilesToPdfBytes(files, size ? { pageW: size.w, pageH: size.h } : A4)
      await get().pageImport(bytes, at)
    }
  }
})

// E2E/디버깅용 전역 노출 — 렌더러 밖(Playwright evaluate)에서 store 에 접근할 유일한 통로. 부작용 없음
declare global {
  interface Window {
    __editor?: typeof useEditor
  }
}
if (typeof window !== 'undefined') window.__editor = useEditor
