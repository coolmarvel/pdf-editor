/**
 * Rust/wasm PDF 엔진 계약(데스크톱이 쓰는 부분집합) — 모노레포 `packages/editor/src/interfaces/engine.ts` 와 같은 모양.
 * 이름·인자·반환은 `pkg/pdf_engine.d.ts` 의 `#[wasm_bindgen]` 표면과 1:1 (워커 RPC 로 감싼다).
 */

/** 래스터 결과 — RGBA8(비프리멀티플라이), 버퍼는 워커에서 transfer 되어 온다 */
export interface EngineRaster {
  width: number
  height: number
  rgba: ArrayBuffer
}

/** 진행 중 렌더 손잡이 — promise + cancel(결과 폐기). 큐에서 밀려난 요청은 `RenderingCancelledException` 이름의 오류로 거부된다 */
export interface RenderHandle {
  promise: Promise<unknown>
  cancel(): void
}

/** 쓰기 명세(Rust `write::BuildSpec`, serde 필드명). 치수는 표시 공간 pt(왼쪽 위 원점, y 아래) */
export interface EngineImageSpec {
  /** 비트맵 배열 index(PNG/JPEG 바이트) */
  bitmap: number
  x: number
  y: number
  w: number
  h: number
  angle?: number
  opacity?: number
}
export interface EngineLinkSpec {
  x: number
  y: number
  w: number
  h: number
  url?: string
  /** 1 기준 출력 페이지 번호 */
  page?: number
}
export interface EngineNoteSpec {
  x: number
  y: number
  text: string
  color: [number, number, number]
}
export interface EnginePageSpec {
  /** 엔진 문서 id. 없으면 빈 페이지 */
  doc?: number
  page?: number
  /** 사용자 추가 회전 0·90·180·270 */
  rotation?: number
  width: number
  height: number
  /** 전면 오버레이 PNG(비트맵 index) */
  overlay?: number
  under?: EngineImageSpec[]
  over?: EngineImageSpec[]
  links?: EngineLinkSpec[]
  notes?: EngineNoteSpec[]
}
export interface EngineBuildSpec {
  pages: EnginePageSpec[]
}

/** 텍스트 명령 단위 스팬(Rust `textops::Span`, camelCase) — 좌표는 /Rotate 표시 프레임 pt(y 아래). 데스크톱은 상자·글자·서체 메타만 쓴다 */
export interface EngineTextSpan {
  id?: number
  text: string
  rect: [number, number, number, number]
  /** 글자 크기 pt */
  size: number
  /** 화면 기준 시계 방향 각도(도) */
  angle: number
  /** BaseFont(서브셋 접두 포함) */
  pdfName: string
  bold: boolean
  italic: boolean
  serif: boolean
  mono: boolean
}
export interface EnginePageSpans {
  width: number
  height: number
  spans: EngineTextSpan[]
}

/** 워커 RPC 연산 */
export interface EngineOps {
  version: () => string
  open: (bytes: Uint8Array) => number
  close: (doc: number) => void
  pageCount: (doc: number) => number
  pageSize: (doc: number, page: number) => [number, number]
  render: (doc: number, page: number, scale: number, rotation: number) => EngineRaster
  pageTextSpans: (doc: number, page: number) => EnginePageSpans
  setFallbackFont: (bytes: Uint8Array) => void
  /** `EngineBuildSpec` JSON + 비트맵(PNG/JPEG) 배열 → PDF 바이트 */
  buildDocument: (spec: string, bitmaps: Uint8Array[]) => Uint8Array
}

export type EngineOp = keyof EngineOps

export interface EngineRequest<K extends EngineOp = EngineOp> {
  id: number
  op: K
  args: Parameters<EngineOps[K]>
}

export type EngineResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
