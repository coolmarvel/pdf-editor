import { createTheme } from '@mui/material/styles'

/**
 * pdfguru 느낌의 라이트 테마: 흰 바탕 + 레드 포인트 + 둥근 모서리.
 * 데스크톱 앱이라 밀도를 살짝 높인다(컴팩트).
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#e0343f', dark: '#c22832', light: '#f8d7d9' },
    secondary: { main: '#5b5bd6' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
    text: { primary: '#1f2430', secondary: '#6b7280' }
  },
  shape: { borderRadius: 10 },
  typography: {
    // Segoe UI 우선: 숫자·영문을 Malgun Gothic 으로 그리면 작은 크기에서 깨져 보인다 (한글은 Malgun 폴백)
    fontFamily: `'Segoe UI', 'Malgun Gothic', '맑은 고딕', -apple-system, Roboto, sans-serif`,
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTooltip: { defaultProps: { arrow: true, enterDelay: 500 } }
  }
})
