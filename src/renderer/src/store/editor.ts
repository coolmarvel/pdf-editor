/**
 * 편집기 전역 상태 (zustand).
 *
 * - 문서 = pages(PageRef[]) + objectsByPage(페이지 id → 객체 배열). 이 둘이 undo/redo 스냅샷 단위.
 * - 실제 PDF 바이트/pdf.js 프록시는 pdf/docs.ts 모듈에 격리 (여기는 참조 id만).
 * - 모든 편집 액션은 commit() 을 거쳐 히스토리에 직전 상태를 쌓는다.
 */
import { create } from 'zustand'
import type { PageRef } from '@core/pages'
import {
  insertBlank,
  removePages,
  duplicatePages,
  rotatePages,
  movePages,
  movePagesToIndex,
  nudgePages,
  insertDocument
} from '@core/pages'
import type { PageObject, ObjectId, DashStyle, BlendMode } from '@core/objects'
import { newId, rotateObjectCW } from '@core/objects'
import type { History } from '@core/history'
import { emptyHistory, push, undo as hUndo, redo as hRedo } from '@core/history'
import { registerDoc, getDisplaySize, clearDocs } from '@renderer/pdf/docs'

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

export type Lang = 'ko' | 'en'
/** 페이지 모드: 한 쪽씩 / 두 쪽 나란히 */
export type PageMode = 'single' | 'double'
/** 페이지 전환: 이어서 스크롤 / 한 장(쌍)씩 보기 */
export type PageTransition = 'continuous' | 'paged'

interface EditorState {
  phase: Phase
  loadingProgress: number
  fileName: string
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

  openDocument(name: string, bytes: Uint8Array, onProgress?: (p: number) => void): Promise<void>
  closeDocument(): void
  setPhase(p: Phase): void
  setFileName(n: string): void
  setTool(t: Tool): void
  setTextStyle(p: Partial<TextStyle>): void
  setPenStyle(p: Partial<HighlightStyle>): void
  setHighlightStyle(p: Partial<HighlightStyle>): void
  setEraserStyle(p: Partial<EraserStyle>): void
  setShapeStyle(p: Partial<ShapeStyle>): void
  addSavedSign(dataUrl: string): void
  removeSavedSign(index: number): void
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

  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean

  addObject(pageId: string, obj: PageObject): void
  /** 히스토리 없이 추가 — 입력 중 임시 객체(확정 시 addObject 로 한 단계만 쌓기 위함) */
  addObjectTransient(pageId: string, obj: PageObject): void
  updateObject(pageId: string, id: ObjectId, patch: Partial<PageObject>): void
  /** 히스토리 없이 갱신 (드래그 중간 상태) */
  updateObjectTransient(pageId: string, id: ObjectId, patch: Partial<PageObject>): void
  removeObject(pageId: string, id: ObjectId): void
  /** 히스토리 없이 제거 — 임시 객체 취소용 */
  removeObjectTransient(pageId: string, id: ObjectId): void

  pageInsertBlank(index: number): void
  pageRemove(ids: Set<string>): void
  pageDuplicate(ids: Set<string>): void
  pageRotate(ids: Set<string>, delta: 90 | -90): void
  pageMove(ids: Set<string>, targetId: string, where: 'before' | 'after'): void
  pageNudge(ids: Set<string>, dir: -1 | 1): void
  /** PDF 가져오기. index 지정 시 그 위치 앞에 삽입, 없으면 끝에 */
  pageImport(bytes: Uint8Array, index?: number): Promise<void>
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

function snap(s: EditorState): Snapshot {
  return { pages: s.pages, objectsByPage: s.objectsByPage, displaySizes: s.displaySizes }
}

const rectEq = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/** 세션 중 "손대지 않은" editText(원문 그대로·제자리) 제거 — 스팬 클릭만 하고 만 경우 */
function pruneUntouched(objectsByPage: Record<string, PageObject[]>): Record<string, PageObject[]> {
  const out: Record<string, PageObject[]> = {}
  for (const [k, list] of Object.entries(objectsByPage)) {
    out[k] = list.filter((o) => !(o.type === 'editText' && o.text === o.origText && rectEq(o.box, o.cover)))
  }
  return out
}

/** 두 objectsByPage 가 실질적으로 다른가 (페이지 배열 원소 identity 비교) */
function objectsChanged(a: Record<string, PageObject[]>, b: Record<string, PageObject[]>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const la = a[k] ?? []
    const lb = b[k] ?? []
    if (la.length !== lb.length) return true
    for (let i = 0; i < la.length; i++) if (la[i] !== lb[i]) return true
  }
  return false
}

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

  return {
    phase: 'landing',
    loadingProgress: 0,
    fileName: '',
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
    savedSigns: [],
    selected: null,
    pendingImage: null,
    currentPage: 0,
    scrollTo: null,
    zoom: 0,
    lang: (localStorage.getItem('lang') as Lang) === 'en' ? 'en' : 'ko',
    pageMode: 'single',
    pageTransition: 'continuous',
    fitMode: 'width',
    editTextSnapshot: null,
    editTextExitPrompt: null,
    deletePrompt: null,

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
        zoom: 0
      })
    },

    setPhase: (phase) => set({ phase }),
    setFileName: (fileName) => set({ fileName }),
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
          history: push(s.history, { pages: s.pages, objectsByPage: snap0, displaySizes: s.displaySizes }),
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
          [p.pageId]: list.map((o) => (o.id === p.objectId ? ({ ...o, text: '' } as PageObject) : o))
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
    addSavedSign: (dataUrl) => set((s) => ({ savedSigns: [...s.savedSigns, dataUrl] })),
    removeSavedSign: (index) => set((s) => ({ savedSigns: s.savedSigns.filter((_, i) => i !== index) })),
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
    pageMoveToIndex(ids, index) {
      const s = get()
      commit({ pages: movePagesToIndex(s.pages, ids, index) })
    },

    undo() {
      const s = get()
      if (s.editTextSnapshot) return // 세션 중엔 비활성 (Guru 동작 — 종료 시 저장/취소로 처리)
      const r = hUndo(s.history, snap(s))
      if (r) set({ ...r[0], history: r[1], selected: null })
    },
    redo() {
      const s = get()
      if (s.editTextSnapshot) return
      const r = hRedo(s.history, snap(s))
      if (r) set({ ...r[0], history: r[1], selected: null })
    },
    canUndo: () => get().history.past.length > 0 && !get().editTextSnapshot,
    canRedo: () => get().history.future.length > 0 && !get().editTextSnapshot,

    addObject(pageId, obj) {
      const s = get()
      commit({
        objectsByPage: { ...s.objectsByPage, [pageId]: [...(s.objectsByPage[pageId] ?? []), obj] }
      })
    },

    addObjectTransient(pageId, obj) {
      const s = get()
      set({
        objectsByPage: { ...s.objectsByPage, [pageId]: [...(s.objectsByPage[pageId] ?? []), obj] }
      })
    },

    updateObject(pageId, id, patch) {
      const s = get()
      const list = s.objectsByPage[pageId] ?? []
      commit({
        objectsByPage: {
          ...s.objectsByPage,
          [pageId]: list.map((o) => (o.id === id ? ({ ...o, ...patch } as PageObject) : o))
        }
      })
    },

    updateObjectTransient(pageId, id, patch) {
      const s = get()
      const list = s.objectsByPage[pageId] ?? []
      set({
        objectsByPage: {
          ...s.objectsByPage,
          [pageId]: list.map((o) => (o.id === id ? ({ ...o, ...patch } as PageObject) : o))
        }
      })
    },

    removeObject(pageId, id) {
      const s = get()
      const list = s.objectsByPage[pageId] ?? []
      // 세션 중 editText 삭제는 확인 후 "지우기"(cover 만 남김) — Guru 동작
      if (s.editTextSnapshot && list.find((o) => o.id === id)?.type === 'editText') {
        set({ deletePrompt: { pageId, objectId: id } })
        return
      }
      commit({
        objectsByPage: { ...s.objectsByPage, [pageId]: list.filter((o) => o.id !== id) },
        selected: null
      })
    },

    removeObjectTransient(pageId, id) {
      const s = get()
      const list = s.objectsByPage[pageId] ?? []
      set({
        objectsByPage: { ...s.objectsByPage, [pageId]: list.filter((o) => o.id !== id) },
        selected: null
      })
    },

    pageInsertBlank(index) {
      const s = get()
      const pages = insertBlank(s.pages, index)
      const added = pages.find((p) => !s.pages.includes(p))!
      commit({
        pages,
        displaySizes: { ...s.displaySizes, [added.id]: added.blankSize! }
      })
    },

    pageRemove(ids) {
      const s = get()
      commit({ pages: removePages(s.pages, ids) })
    },

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

    pageMove(ids, targetId, where) {
      const s = get()
      commit({ pages: movePages(s.pages, ids, targetId, where) })
    },

    pageNudge(ids, dir) {
      const s = get()
      commit({ pages: nudgePages(s.pages, ids, dir) })
    },

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
    }
  }
})
