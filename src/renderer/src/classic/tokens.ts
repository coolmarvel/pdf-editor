/**
 * 클래식 디자인 토큰 — `~/pdf-editor-live/packages/editor/src/renderer/classic/tokens.ts` 와 **값 동일(공유 SSOT, 수동 동기화)** (ADR-0004, 2026-10-12). 루트 `DESIGN.md` 는 이 값의 문서 투영이다.
 *
 * 형태 언어는 자매 프로젝트 `~/sh-compositor`·`~/sh-web-editor`·`~/sh-econsent` 와 같다:
 * DEXT5 계열 크롬(실측 팔레트, 스킨 13종) + Money Forward 베벨 버튼(흰→회색 세로 그라데이션) + Palantir 데스크톱 밀도.
 * 반경 0 · 1px 테두리 · 12px 맑은 고딕/돋움 · 24px 컨트롤 · 안쪽 1px 점선 포커스 · 그림자는 팝오버/대화상자에만 짧고 옅게.
 *
 * 값은 두 경로로 쓰인다:
 *  1) `applyTokens()` 가 `:root` 의 CSS 변수로 주입 → `base.css` 와 sx 의 var() 참조
 *  2) `theme.ts`(MUI)가 같은 객체를 직접 참조
 * 그래서 색·간격 리터럴을 컴포넌트에 직접 쓰지 않는다. 데스크톱(`~/pdf-editor`)과 이 파일을 그대로 공유한다.
 */
import { SKINS, type ChromeSkin, type SkinName } from './skins'

export const color = {
  // 강조 — 주 버튼·선택·링크·포커스에만. 배지·성공에 재사용하지 않는다 (sh-compositor 브랜드 파랑)
  accent: '#3b74f2',
  accentHover: '#2c5cd9',
  accentPressed: '#2149b3',
  accentSubtle: '#eef3fe',
  accentSubtleHover: '#dbe6fc',
  // 표면
  canvas: '#ffffff',
  sunken: '#f5f6f8',
  hover: '#eef0f3',
  input: '#ffffff',
  /** 문서 스테이지(페이지 뒤 바탕) — sh-form-designer 디자인 뷰 회색. 종이가 유일하게 밝은 것이 되게 */
  stage: '#8a8f98',
  // 선
  border: '#e3e5ea',
  borderStrong: '#8a919e',
  /** 표·격자 선 (sh-econsent Classic.axaml) */
  grid: '#d4d4d4',
  // 글자
  text: '#1f2329',
  textSecondary: '#5c6370',
  textMuted: '#6e7683',
  textOnAccent: '#ffffff',
  textDisabled: '#a2a8b3',
  // 의미 — 삭제류 버튼은 빨강(.omd/preferences 2026-08-31)
  danger: '#d42f37',
  dangerSubtle: '#fdecec',
  dangerBorder: '#f1a9ad',
  success: '#15803d',
  successSubtle: '#e7f5ec',
  warning: '#8a5a00',
  warningSubtle: '#fff4d6',
  // 베벨 버튼 면 (Money Forward·DEXT5 계열 흰→회색) — sh-web-editor --shwe-button-* 실측
  controlTop: '#ffffff',
  controlBottom: '#e6e6e6',
  controlPressed: '#d6d9df',
  buttonBorder: '#b5b5b5',
  /** 도구 버튼 호버 테두리 — 크롬에서 유일한 채도 있는 강조 (sh-web-editor --shwe-hover) */
  hoverEdge: '#2a8dd4',
  /** 캔버스 선택 외곽선·핸들·링크 영역 (문서 위에서만) */
  selection: '#3b82f6',
  /** 대화상자 덮개 — 15% 검정 (sh-web-editor --shwe-cover) */
  scrim: 'rgba(0, 0, 0, 0.15)',
} as const

export const shadow = {
  raised: '2px 2px 4px rgba(0, 0, 0, 0.18)',
  dialog: '3px 3px 6px rgba(0, 0, 0, 0.22)',
  /** 스테이지 위 종이 — 짧고 진한 오프셋 그림자(클래식 뷰어) */
  page: '2px 2px 0 rgba(0, 0, 0, 0.35)',
} as const

export const font = {
  /** Windows 맑은 고딕 우선(sh-form-designer: 돋움은 11.5px·합성 굵게에서 깨졌다), 그다음 돋움·Apple SD·Noto */
  sans: `'Malgun Gothic', '맑은 고딕', Dotum, '돋움', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', Arial, sans-serif`,
  mono: `'Cascadia Mono', Consolas, 'D2Coding', ui-monospace, monospace`,
  /** 타임스탬프·배지·보조 */
  xs: 11,
  /** 본문·라벨·버튼 — 기본 */
  md: 12,
  /** 섹션 제목·강조 */
  lg: 13,
  /** 대화상자 제목 */
  xl: 14,
  /** 화면 제목 */
  xxl: 16,
  /** 랜딩 머리글 */
  hero: 20,
  regular: 400,
  semibold: 600,
  bold: 700,
  lhTight: 1.2,
  lhDense: 1.3,
  lhNormal: 1.45,
} as const

export const size = {
  /** 작은 버튼·아이콘 버튼 */
  ctlSm: 22,
  /** 기본 버튼·입력·선택 */
  ctlMd: 24,
  titleBar: 28,
  menuBar: 22,
  toolBar: 30,
  optionBar: 30,
  statusBar: 22,
  /** 패널 제목 띠 */
  panelTitle: 22,
  /** 목록 행 */
  row: 22,
  sidebar: 220,
  icon: 16,
  /** 터치(pointer: coarse) 최소 타깃 — 웹 e2e 가 40px 을 단언한다(공유 값) */
  touch: 40,
} as const

/** 간격 — 2·4·6·8·12·16 만 쓴다 */
export const space = {
  xs: 2,
  sm: 4,
  md: 6,
  base: 8,
  lg: 12,
  xl: 16,
} as const

/** 스킨이 바꾸는 크롬 색 — CSS 변수 참조 (값은 applySkin 이 :root 에 쓴다) */
const v = (k: keyof ChromeSkin): string => `var(--k-${kebab(k)})`
export const chrome = {
  frame: v('frame'),
  menubarTop: v('menubarTop'),
  menubarBottom: v('menubarBottom'),
  toolbarLight: v('toolbarLight'),
  toolbarFace: v('toolbarFace'),
  toolbarRow2Bottom: v('toolbarRow2Bottom'),
  toolbarEdge: v('toolbarEdge'),
  pressed: v('pressed'),
  pressedLight: v('pressedLight'),
  separator: v('separator'),
  statusTop: v('statusTop'),
  statusLight: v('statusLight'),
  statusFace: v('statusFace'),
  tabActive: v('tabActive'),
} as const

/** 컴포넌트에서 쓰는 합성 값 — 베벨 면·띠는 여기서만 만든다 */
export const surface = {
  /** 버튼 면 (기본 상태) */
  bevel: `linear-gradient(${color.controlTop}, ${color.controlBottom})`,
  bevelHover: `linear-gradient(${color.controlTop}, ${color.controlTop})`,
  bevelPressed: color.controlPressed,
  /** 타이틀 띠·메뉴 바 (위→아래로 살짝 어두워짐) */
  chrome: `linear-gradient(${chrome.menubarTop}, ${chrome.menubarBottom})`,
  /** 툴바 1줄 */
  toolbar: `linear-gradient(${chrome.toolbarLight}, ${chrome.toolbarFace})`,
  /** 툴바 2줄(옵션 바) */
  toolbar2: `linear-gradient(${color.canvas}, ${chrome.toolbarRow2Bottom})`,
  /** 상태 줄 — 파란 스킨에서도 회색 (DEXT5 ue_gbg) */
  status: `linear-gradient(${chrome.statusLight}, ${chrome.statusFace})`,
  /** 켜진 토글·열린 드롭다운 */
  pressed: `linear-gradient(${chrome.pressedLight}, ${chrome.pressed})`,
} as const

/** 포커스 — 클래식 포커스 사각형(안쪽 1px 점선). outline:none 단독 사용 금지 */
export const focusRing = { outline: `1px dotted ${color.text}`, outlineOffset: '-3px' } as const

export const classic = { color, chrome, shadow, font, size, space, surface, focusRing } as const

const SKIN_KEY = 'pdf.skin'
export const DEFAULT_SKIN: SkinName = 'gray'

/** 토큰을 `:root` CSS 변수로 주입 (base.css 가 var() 로 참조). 앱 시작 시 1회. */
export function applyTokens(root: HTMLElement = document.documentElement): void {
  const set = (name: string, value: string | number): void => root.style.setProperty(name, typeof value === 'number' ? `${value}px` : value)
  for (const [k, val] of Object.entries(color)) set(`--c-${kebab(k)}`, val)
  for (const [k, val] of Object.entries(shadow)) set(`--shadow-${kebab(k)}`, val)
  for (const [k, val] of Object.entries(size)) set(`--size-${kebab(k)}`, val)
  for (const [k, val] of Object.entries(space)) set(`--space-${kebab(k)}`, val)
  set('--font-sans', font.sans)
  set('--font-mono', font.mono)
  set('--font-xs', font.xs)
  set('--font-md', font.md)
  set('--font-lg', font.lg)
  set('--font-xl', font.xl)
  set('--font-xxl', font.xxl)
  set('--surface-chrome', surface.chrome)
  set('--surface-bevel', surface.bevel)
  set('--surface-status', surface.status)
  applySkin(loadSkin(), root)
}

/** 저장해 둔 스킨 (없거나 읽을 수 없으면 기본 회색) — 보기 편의 설정이라 localStorage */
export function loadSkin(): SkinName {
  try {
    const s = localStorage.getItem(SKIN_KEY)
    if (s && s in SKINS) return s as SkinName
  } catch {
    /* 저장소를 못 쓰면 기본값 */
  }
  return DEFAULT_SKIN
}

/** 크롬 스킨 적용 + 기억 */
export function applySkin(name: SkinName, root: HTMLElement = document.documentElement): void {
  const skin = SKINS[name] ?? SKINS[DEFAULT_SKIN]
  for (const [k, val] of Object.entries(skin)) root.style.setProperty(`--k-${kebab(k)}`, val)
  try {
    localStorage.setItem(SKIN_KEY, name)
  } catch {
    /* 무시 */
  }
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}
