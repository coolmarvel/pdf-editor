/**
 * 에디터 MUI 테마 — 클래식 스킨 (pdf-editor-live ADR-0004, 2026-10-12 데스크톱 포팅 — 웹 `packages/editor/src/renderer/theme.ts` 와 동일 유지). 토큰 SSOT 는 `classic/tokens.ts` 이고 이 파일은 MUI 부품을 그 토큰으로 다시 칠한다.
 * 규칙: 반경 0 · 1px 테두리 · 12px 맑은 고딕 · 24px 컨트롤 · 베벨 버튼 면 · 그림자는 팝오버/대화상자만 · 포커스는 안쪽 1px 점선 · 전환 0ms.
 * 터치(pointer: coarse)에서만 아이콘 버튼·메뉴 항목·셀렉트를 36px 로 키운다(브레이크포인트가 아니라 포인터 종류).
 *
 * `ui` 는 예전 TailAdmin 토큰 모양(gray 스케일·brand·accent·surface·shadow)을 **유지한 호환 뷰** — 110곳의 호출부가 그대로 동작하도록
 * 같은 키에 클래식 값을 매핑했다. 새 코드는 `ui.classic`(= classic/tokens) 를 쓴다.
 */
import { createTheme } from '@mui/material/styles'
import { chrome, classic, color, focusRing, font, shadow, size, space, surface } from './classic/tokens'

export const ui = {
  gray: {
    50: color.sunken, // #f5f6f8
    100: color.hover, // #eef0f3
    200: color.border, // #e3e5ea
    300: color.buttonBorder, // #b5b5b5
    400: color.textDisabled, // #a2a8b3
    500: color.textMuted, // #6e7683
    600: color.textSecondary, // #5c6370
    700: color.textSecondary,
    800: color.text,
    900: color.text,
  },
  brand: {
    50: color.accentSubtle,
    100: color.accentSubtleHover,
    500: color.accent,
    600: color.accentPressed,
  },
  /** 캔버스 선택 외곽선·핸들·링크 영역·팔레트 선택 아웃라인 */
  selection: color.selection,
  /** 삽입점 강조 — 도구 활성색과 같은 파랑 계열이지만 연하게 */
  accent: { main: color.accentPressed, soft: color.accentSubtle },
  surface: { canvas: color.stage, sidebar: color.sunken },
  shadow: { xs: 'none', lg: shadow.raised, focusRing: 'none' },
  classic,
} as const

/** 터치 타깃 — 마우스 밀도는 그대로 두고 pointer: coarse 에서만 키운다 */
const TOUCH = '@media (pointer: coarse)'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: color.accent, dark: color.accentPressed, light: color.accentSubtle, contrastText: color.textOnAccent },
    secondary: { main: color.accentPressed, light: color.accentSubtle },
    error: { main: color.danger, light: color.dangerSubtle },
    success: { main: color.success, light: color.successSubtle },
    warning: { main: color.warning, light: color.warningSubtle },
    background: { default: color.sunken, paper: color.canvas },
    text: { primary: color.text, secondary: color.textSecondary, disabled: color.textDisabled },
    divider: color.border,
  },
  shape: { borderRadius: 0 },
  transitions: { duration: { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 } },
  typography: {
    fontFamily: font.sans,
    fontSize: font.md,
    htmlFontSize: 16,
    h4: { fontSize: font.hero, fontWeight: font.bold, lineHeight: font.lhTight },
    h5: { fontSize: font.xxl, fontWeight: font.bold, lineHeight: font.lhTight },
    h6: { fontSize: font.xl, fontWeight: font.bold, lineHeight: font.lhTight },
    body1: { fontSize: font.md, lineHeight: font.lhNormal },
    body2: { fontSize: font.md, lineHeight: font.lhDense },
    caption: { fontSize: font.xs, lineHeight: font.lhDense },
    overline: { fontSize: font.xs, fontWeight: font.bold, lineHeight: font.lhDense, letterSpacing: 0, textTransform: 'none' },
    subtitle1: { fontSize: font.lg, fontWeight: font.bold, lineHeight: font.lhDense },
    subtitle2: { fontSize: font.md, fontWeight: font.semibold, lineHeight: font.lhDense },
    button: { textTransform: 'none', fontWeight: font.semibold, fontSize: font.md, lineHeight: font.lhTight },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontFamily: font.sans, backgroundColor: color.sunken } } },
    MuiButtonBase: { defaultProps: { disableRipple: true, disableTouchRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          borderRadius: 0,
          minWidth: 0,
          height: size.ctlMd,
          padding: `0 ${space.lg}px`,
          gap: space.sm,
          whiteSpace: 'nowrap',
          boxShadow: 'none',
          '&.Mui-focusVisible': focusRing,
          '& .MuiButton-startIcon': { marginRight: space.sm, marginLeft: 0 },
          '& .MuiButton-endIcon': { marginLeft: space.sm, marginRight: 0 },
          '& .MuiButton-startIcon > *:first-of-type, & .MuiButton-endIcon > *:first-of-type': { fontSize: size.icon },
          '&.Mui-disabled': { color: color.textDisabled, borderColor: color.border },
          [TOUCH]: { minHeight: size.touch },
        },
        sizeSmall: { height: size.ctlMd, padding: `0 ${space.base}px`, [TOUCH]: { minHeight: size.touch } },
        sizeMedium: { height: size.ctlMd, [TOUCH]: { minHeight: size.touch } },
        sizeLarge: { height: 28, padding: `0 ${space.xl}px`, fontSize: font.lg, [TOUCH]: { minHeight: 40 } },
        // 주 버튼: accent 채움 + 진한 테두리. 한 화면에 하나
        contained: {
          border: `1px solid ${color.accentPressed}`,
          '&:hover': { backgroundColor: color.accentHover, boxShadow: 'none' },
          '&:active': { backgroundColor: color.accentPressed },
          '&.Mui-disabled': { backgroundColor: color.controlBottom, color: color.textDisabled, borderColor: color.border },
        },
        containedError: { border: `1px solid ${color.danger}`, '&:hover': { backgroundColor: '#b8262e' } },
        // 기본 버튼: 흰→회색 베벨 면 + 1px 진한 테두리
        outlined: {
          background: surface.bevel,
          border: `1px solid ${color.buttonBorder}`,
          color: color.text,
          '&:hover': { background: surface.bevelHover, borderColor: color.hoverEdge },
          '&:active': { background: surface.bevelPressed },
          '&.Mui-disabled': { background: color.sunken },
        },
        outlinedInherit: { background: surface.bevel, border: `1px solid ${color.buttonBorder}`, color: color.text, '&:hover': { background: surface.bevelHover, borderColor: color.hoverEdge } },
        outlinedPrimary: { background: surface.bevel, border: `1px solid ${color.buttonBorder}`, color: color.accentPressed, '&:hover': { background: surface.bevelHover, borderColor: color.hoverEdge } },
        // 삭제류는 빨갛게 (.omd/preferences 2026-08-31) — 베벨 면은 유지하고 글자·테두리만 빨강
        outlinedError: { background: surface.bevel, color: color.danger, borderColor: color.dangerBorder, '&:hover': { background: color.dangerSubtle, borderColor: color.danger } },
        text: { '&:hover': { backgroundColor: color.hover } },
        textInherit: { color: color.text, '&:hover': { backgroundColor: color.hover } },
        textPrimary: { color: color.accentPressed, '&:hover': { backgroundColor: color.accentSubtle } },
        textError: { color: color.danger, '&:hover': { backgroundColor: color.dangerSubtle } },
      },
    },
    MuiIconButton: {
      defaultProps: { size: 'small', disableRipple: true },
      styleOverrides: {
        root: {
          borderRadius: 0,
          width: size.ctlSm,
          height: size.ctlSm,
          padding: 0,
          color: color.textSecondary,
          border: '1px solid transparent',
          '& svg': { fontSize: size.icon },
          '&:hover': { backgroundColor: color.canvas, borderColor: color.hoverEdge, color: color.text },
          '&:active': { background: surface.pressed, borderColor: chrome.toolbarEdge },
          '&.Mui-focusVisible': focusRing,
          '&.Mui-disabled': { color: color.textDisabled },
        },
        // 썸네일 사이 ⊕(.gapbtn) 은 14px 틈 안에 살아야 하므로 터치 확대에서 제외
        sizeSmall: { width: size.ctlSm, height: size.ctlSm, [TOUCH]: { '&:not(.gapbtn)': { minWidth: size.touch, minHeight: size.touch } } },
        sizeMedium: { width: size.ctlMd, height: size.ctlMd },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: font.md, backgroundColor: color.input },
        input: { padding: `0 ${space.sm}px`, height: size.ctlMd, boxSizing: 'border-box', '&::placeholder': { color: color.textMuted, opacity: 1 } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: color.input,
          boxShadow: 'none',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: color.borderStrong, borderWidth: 1 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: color.borderStrong },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: color.accent, borderWidth: 1 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: color.danger },
        },
        input: { padding: `0 ${space.sm}px`, height: size.ctlMd },
        inputSizeSmall: { height: size.ctlMd, padding: `0 ${space.sm}px` },
        multiline: { padding: `${space.sm}px`, '& textarea': { height: 'auto' } },
        inputMultiline: { height: 'auto', padding: 0 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: font.md, color: color.textSecondary, transform: 'none', position: 'static', marginBottom: space.xs }, shrink: { transform: 'none' } } },
    MuiFormHelperText: { styleOverrides: { root: { fontSize: font.xs, marginLeft: 0, marginTop: space.xs } } },
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        select: { fontSize: font.md, paddingTop: 0, paddingBottom: 0, minHeight: 0, height: size.ctlMd, display: 'flex', alignItems: 'center', [TOUCH]: { minHeight: `${size.touch}px !important`, boxSizing: 'border-box' } },
        icon: { fontSize: size.icon, right: 2, color: color.textSecondary },
      },
    },
    MuiMenu: {
      defaultProps: { elevation: 0, transitionDuration: 0, disableScrollLock: true },
      styleOverrides: {
        paper: { borderRadius: 0, border: `1px solid ${color.borderStrong}`, boxShadow: shadow.raised, marginTop: 1 },
        list: { padding: space.xs },
      },
    },
    MuiPopover: {
      defaultProps: { elevation: 0, transitionDuration: 0, disableScrollLock: true },
      styleOverrides: { paper: { borderRadius: 0, border: `1px solid ${color.borderStrong}`, boxShadow: shadow.raised } },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          minHeight: size.row,
          '@media (min-width: 600px)': { minHeight: size.row },
          fontSize: font.md,
          fontWeight: font.regular,
          padding: `0 ${space.base}px`,
          margin: 0,
          color: color.text,
          whiteSpace: 'nowrap',
          '&:hover': { backgroundColor: chrome.toolbarFace },
          '&.Mui-selected': { backgroundColor: color.accent, color: color.textOnAccent },
          '&.Mui-selected:hover': { backgroundColor: color.accentHover },
          '&.Mui-selected .MuiListItemIcon-root, &.Mui-selected .MuiTypography-root': { color: color.textOnAccent },
          '&.Mui-focusVisible': focusRing,
          [TOUCH]: { minHeight: size.touch },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 24, color: color.textSecondary, '& svg': { fontSize: size.icon } } } },
    MuiListItemText: { styleOverrides: { primary: { fontSize: font.md, whiteSpace: 'nowrap' }, secondary: { fontSize: font.xs } } },
    MuiDivider: { styleOverrides: { root: { borderColor: color.border } } },
    MuiDialog: {
      defaultProps: { transitionDuration: 0, disableScrollLock: true },
      styleOverrides: { paper: { borderRadius: 0, border: `1px solid ${chrome.frame}`, boxShadow: shadow.dialog, backgroundImage: 'none' } },
    },
    // 덮개는 대화상자에만 — 메뉴·팝오버의 투명 백드롭까지 어두워지지 않게
    MuiBackdrop: { styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { backgroundColor: color.scrim } } } },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: font.xl,
          fontWeight: font.bold,
          padding: `${space.base}px ${space.lg}px`,
          background: surface.chrome,
          borderBottom: `1px solid ${chrome.frame}`,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          color: color.text,
        },
      },
    },
    // 본문은 제목 띠·버튼 줄과 같은 12px 여백(MUI 기본은 제목 다음 본문의 윗여백을 0 으로 지워 글이 띠에 붙는다 — 피드백 2026-10-13) + 짧은 본문은 세로 가운데(긴 본문은 safe center 로 스크롤 유지)
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: `${space.lg}px !important`, fontSize: font.md, display: 'flex', flexDirection: 'column', justifyContent: 'safe center', gap: space.base, minHeight: 56, '& .MuiDialogContentText-root': { margin: 0 } }
      }
    },
    MuiDialogContentText: { styleOverrides: { root: { fontSize: font.md, color: color.text } } },
    MuiDialogActions: { styleOverrides: { root: { padding: space.base, gap: space.base, borderTop: `1px solid ${color.border}`, background: surface.status, '& > :not(:first-of-type)': { marginLeft: 0 } } } },
    MuiTooltip: {
      defaultProps: { arrow: false, enterDelay: 400, disableInteractive: true, disableTouchListener: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: color.warningSubtle,
          color: color.text,
          border: `1px solid ${color.borderStrong}`,
          borderRadius: 0,
          boxShadow: shadow.raised,
          fontSize: font.xs,
          fontWeight: font.regular,
          padding: `${space.xs}px ${space.md}px`,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiSlider: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { height: 4, padding: '10px 0', color: color.accent },
        rail: { backgroundColor: color.controlBottom, opacity: 1, borderRadius: 0, border: `1px solid ${color.borderStrong}` },
        track: { borderRadius: 0, border: 'none' },
        thumb: {
          width: 10,
          height: 16,
          borderRadius: 0,
          background: surface.bevel,
          border: `1px solid ${color.borderStrong}`,
          '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none', borderColor: color.accent },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none', borderRadius: 0 }, outlined: { borderColor: chrome.frame } },
    },
    MuiCard: { styleOverrides: { root: { borderRadius: 0, border: `1px solid ${chrome.frame}` } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 0, border: `1px solid ${color.borderStrong}`, fontSize: font.md, padding: `${space.xs}px ${space.base}px`, alignItems: 'center' },
        icon: { padding: 0, marginRight: space.md, '& svg': { fontSize: size.icon } },
        message: { padding: 0, whiteSpace: 'nowrap', overflow: 'visible', '@media (max-width: 599.95px)': { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } },
        action: { padding: 0, marginRight: 0 },
      },
    },
    MuiSnackbar: { defaultProps: { transitionDuration: 0 } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 10, borderRadius: 0, border: `1px solid ${color.borderStrong}`, backgroundColor: color.canvas },
        bar: { borderRadius: 0, backgroundColor: color.accent },
      },
    },
    MuiCircularProgress: { defaultProps: { size: 14, thickness: 5 } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 0, height: 18, fontSize: font.xs, fontWeight: font.regular, backgroundColor: color.sunken, border: `1px solid ${color.borderStrong}`, color: color.text },
        label: { padding: `0 ${space.md}px`, whiteSpace: 'nowrap' },
        sizeSmall: { height: 18 },
        colorPrimary: { backgroundColor: color.accentSubtle, color: color.accentPressed, borderColor: color.accentPressed },
        colorError: { backgroundColor: color.dangerSubtle, color: color.danger, borderColor: color.dangerBorder },
        colorSuccess: { backgroundColor: color.successSubtle, color: color.success, borderColor: color.success },
      },
    },
    MuiToggleButtonGroup: { styleOverrides: { root: { backgroundColor: 'transparent', borderRadius: 0, padding: 0, gap: 0 } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: '0 !important',
          border: `1px solid ${color.buttonBorder}`,
          marginLeft: '-1px',
          height: size.ctlMd,
          padding: `0 ${space.base}px`,
          background: surface.bevel,
          color: color.text,
          fontSize: font.md,
          fontWeight: font.regular,
          textTransform: 'none',
          '& svg': { fontSize: size.icon },
          '&:hover': { background: surface.bevelHover, borderColor: color.hoverEdge, zIndex: 1 },
          '&.Mui-selected': { background: surface.pressed, color: color.text, boxShadow: `inset 1px 1px 0 ${chrome.pressed}`, borderColor: chrome.toolbarEdge },
          '&.Mui-selected:hover': { background: surface.pressed },
          [TOUCH]: { minHeight: size.touch },
        },
      },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontSize: font.md, fontWeight: font.regular, minHeight: size.ctlMd, padding: `0 ${space.lg}px`, whiteSpace: 'nowrap', '&.Mui-selected': { fontWeight: font.bold, color: color.text } } } },
    MuiTabs: { styleOverrides: { root: { minHeight: size.ctlMd }, indicator: { height: 2, backgroundColor: color.accent } } },
    MuiCheckbox: { defaultProps: { size: 'small', disableRipple: true }, styleOverrides: { root: { padding: space.sm, color: color.borderStrong, '& svg': { fontSize: size.icon }, '&.Mui-checked': { color: color.accent } } } },
    MuiRadio: { defaultProps: { size: 'small', disableRipple: true }, styleOverrides: { root: { padding: space.sm, '& svg': { fontSize: size.icon }, '&.Mui-checked': { color: color.accent } } } },
    MuiSwitch: { styleOverrides: { root: { '& .Mui-checked': { color: color.accent }, '& .Mui-checked + .MuiSwitch-track': { backgroundColor: `${color.accent} !important` } } } },
    MuiFormControlLabel: { styleOverrides: { label: { fontSize: font.md } } },
    MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { color: color.accentPressed, textDecorationColor: 'currentColor' } } },
    MuiDrawer: { styleOverrides: { paper: { borderLeft: `1px solid ${chrome.frame}`, boxShadow: shadow.dialog, backgroundImage: 'none' } } },
    MuiPaginationItem: { styleOverrides: { root: { borderRadius: 0, fontSize: font.md, minWidth: size.ctlMd, height: size.ctlMd, [TOUCH]: { minWidth: size.touch, height: size.touch } } } },
    MuiTableCell: { styleOverrides: { root: { fontSize: font.md, padding: `0 ${space.base}px`, height: size.row, borderBottom: `1px solid ${color.grid}`, whiteSpace: 'nowrap' }, head: { background: surface.bevel, fontWeight: font.regular, height: size.ctlMd } } },
  },
})
