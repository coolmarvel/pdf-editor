/* tslint:disable */
/* eslint-disable */

/**
 * JS 로 건네는 래스터 결과 — wasm-bindgen 클래스.
 */
export class RenderedPage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly height: number;
    /**
     * RGBA8(비프리멀티플라이) 사본 — 호출부가 `ImageData` 로 감싼다.
     */
    readonly rgba: Uint8Array;
    readonly width: number;
}

/**
 * 저장 조립(ADR-0003 3단계): `spec_json` = `write::BuildSpec`(페이지마다 원본 문서 id·페이지·회전·크기·오버레이·이미지·링크·노트),
 * `bitmaps` = PNG/JPEG `Uint8Array` 배열(명세가 index 로 가리킨다). 반환 = 새 PDF 바이트.
 *
 * # Errors
 * 명세 파싱 실패, 모르는 문서/비트맵, 범위 밖 페이지, 저장 실패.
 */
export function build_document(spec_json: string, bitmaps: Array<any>): Uint8Array;

/**
 * 문서 닫기 — 바이트·파서·캐시 해제.
 */
export function close(id: number): void;

/**
 * 바이트 서체(TTF/OTF)가 `text` 의 글자마다 글리프를 갖는지(1/0). 쓰기 명세의 글자별 서체 단계를 JS 가 미리 고르는 데 쓴다.
 */
export function font_coverage(bytes: Uint8Array, text: string): Uint8Array;

/**
 * 원본 서체 프로그램 — `{ bytes: Uint8Array(브라우저용 SFNT), codepoints: number[], pdfName, bold, italic, serif, mono, ascent, descent }`.
 * 그 서체를 아직 본 페이지가 없거나(스팬 추출 전) 프로그램이 없는 서체(Type1 PFB·비내장·Type3)면 `null`.
 * 글리프 지도는 스팬을 뽑은 페이지가 늘수록 쌓인다.
 *
 * # Errors
 * 직렬화 실패.
 */
export function font_program(id: number, font_key: string): any;

/**
 * 여러 문서를 이어 붙인다. `ids` 순서대로 전체 페이지.
 *
 * # Errors
 * 모르는 문서 id, lopdf 파싱/저장 실패.
 */
export function merge(ids: Uint32Array): Uint8Array;

/**
 * 문서 열기. JS 가 transfer 한 사본을 wasm 메모리로 한 번 옮겨 엔진이 소유한다. 반환 = 문서 id.
 *
 * # Errors
 * PDF 로 파싱되지 않으면 `invalid pdf`, 사용자 비밀번호가 걸려 있으면 `needs_password`(→ `open_with_password`).
 */
export function open(bytes: Uint8Array): number;

/**
 * 비밀번호로 열기(사용자/소유자 비밀번호 모두). 틀리면 `wrong_password`.
 *
 * # Errors
 * `invalid pdf` · `wrong_password`.
 */
export function open_with_password(bytes: Uint8Array, password: string): number;

/**
 * 페이지 수.
 *
 * # Errors
 * 모르는 문서 id.
 */
export function page_count(id: number): number;

/**
 * 편집본 — `source_ids` 의 텍스트 명령을 `[advance] TJ` 로 바꾼 1쪽 PDF(이미지·경로·서체·주석은 그대로). `open` 으로 열어 렌더하거나
 * 쓰기 명세의 `{doc, page: 0}` 으로 복사한다.
 *
 * # Errors
 * `page_text_spans` 와 같음 + 저장 실패.
 */
export function page_erase_text(id: number, page: number, source_ids: Uint32Array): Uint8Array;

/**
 * 표시 크기(pt) — 페이지 자체 /Rotate 반영, 사용자 추가 회전은 호출부가 교환한다. `[w, h]`.
 *
 * # Errors
 * 모르는 문서 id 또는 범위 밖 페이지.
 */
export function page_size(id: number, page: number): Float32Array;

/**
 * 텍스트 레이어 — 글리프 상자(표시 공간 pt, y 아래)를 읽기 순서로 정렬하고 줄·낱말 경계를 붙인다.
 *
 * # Errors
 * 모르는 문서 id, 범위 밖 페이지, 직렬화 실패.
 */
export function page_text(id: number, page: number): any;

/**
 * 페이지 텍스트 스팬(`textops::PageSpans`): 텍스트 명령마다 번호(`id`)·글자·상자(/Rotate 표시 프레임 pt)·크기·기준선·서체 키·색·획·`advance`.
 * 같은 (문서, 페이지)는 캐시된다. 서체 키는 `font_program` 과 쓰기 명세 `{source:'embedded', doc, key}` 가 받는다.
 *
 * # Errors
 * 모르는 문서 id, 범위 밖 페이지, lopdf 로드 실패.
 */
export function page_text_spans(id: number, page: number): any;

/**
 * 페이지 구성: `order` 의 페이지(0 기준)만 그 순서로 남긴 새 문서. 삭제·재배열·복제·추출을 한 연산으로.
 * `rotations` 는 같은 길이로 각 페이지에 더할 회전(0·90·180·270). 결과 = 새 PDF 바이트.
 *
 * # Errors
 * 모르는 문서 id, 범위 밖 페이지, lopdf 파싱/저장 실패.
 */
export function pages_subset(id: number, order: Uint32Array, rotations: Uint32Array): Uint8Array;

/**
 * 페이지 래스터. `scale` = 디바이스 px / pt, `rotation` = 사용자 추가 회전(0·90·180·270).
 * 반환 `RenderedPage { width, height, rgba }` — 비(非)프리멀티플라이 RGBA8, 흰 배경.
 *
 * # Errors
 * 모르는 문서 id 또는 범위 밖 페이지.
 */
export function render_page(id: number, page: number, scale: number, rotation: number): RenderedPage;

/**
 * 비내장 서체 대체용 TTF/OTF 등록(한 벌). hayro 는 비내장 CID 서체에서만 이것을 쓰고, 없으면 표준 14 근사로 그린다.
 */
export function set_fallback_font(bytes: Uint8Array): void;

/**
 * 엔진 초기화 — 패닉 메시지를 console.error 로 보낸다. 모듈 로드 직후 1회.
 */
export function start(): void;

/**
 * 엔진 버전(패키지 버전) — UI 상태 줄 표시용.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_renderedpage_free: (a: number, b: number) => void;
    readonly build_document: (a: number, b: number, c: any) => [number, number, number, number];
    readonly close: (a: number) => void;
    readonly font_coverage: (a: number, b: number, c: number, d: number) => [number, number];
    readonly font_program: (a: number, b: number, c: number) => [number, number, number];
    readonly merge: (a: number, b: number) => [number, number, number, number];
    readonly open: (a: number, b: number) => [number, number, number];
    readonly open_with_password: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly page_count: (a: number) => [number, number, number];
    readonly page_erase_text: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly page_size: (a: number, b: number) => [number, number, number, number];
    readonly page_text: (a: number, b: number) => [number, number, number];
    readonly page_text_spans: (a: number, b: number) => [number, number, number];
    readonly pages_subset: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly render_page: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly renderedpage_height: (a: number) => number;
    readonly renderedpage_rgba: (a: number) => any;
    readonly renderedpage_width: (a: number) => number;
    readonly set_fallback_font: (a: number, b: number) => void;
    readonly start: () => void;
    readonly version: () => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
