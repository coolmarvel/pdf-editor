import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// 클래식 전역 CSS(포커스 사각형·직각 스크롤바·12px 맑은 고딕) + 토큰을 :root CSS 변수로 (pdf-editor-live ADR-0004)
import './classic/base.css'
import { applyTokens } from './classic/tokens'
import { theme } from './theme'
import App from './App'

applyTokens()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
