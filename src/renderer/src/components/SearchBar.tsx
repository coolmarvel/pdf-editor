import { useEffect, useRef, useState } from 'react'
import { ui } from '@renderer/theme'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ChevronLeft, ChevronRight, X } from './icons'

/** 입력 → 검색 실행 지연(ms). 타이핑마다 전 페이지 스팬을 훑지 않도록 */
const DEBOUNCE_MS = 150

/**
 * 문서 텍스트 검색 바 (pdfguru 파리티) — 페이지 영역 우상단(서브툴바 아래)에 떠 있다.
 * 입력(자동 포커스) · "n / m" 카운터 · 이전/다음 · 닫기. Enter=다음, Shift+Enter=이전, Esc=닫기.
 * 질의 실행·이동은 store(setSearchQuery/searchNext/Prev)가 담당하고 여기는 디바운스와 키만 다룬다.
 */
export default function SearchBar(): JSX.Element | null {
  const t = useT()
  const open = useEditor((s) => s.search.open)
  const total = useEditor((s) => s.search.matches.length)
  const current = useEditor((s) => s.search.current)
  const pages = useEditor((s) => s.pages)
  const closeSearch = useEditor((s) => s.closeSearch)
  const setSearchQuery = useEditor((s) => s.setSearchQuery)
  const searchNext = useEditor((s) => s.searchNext)
  const searchPrev = useEditor((s) => s.searchPrev)
  // 로컬 입력값 — store.query 는 디바운스 뒤에만 갱신된다
  const [value, setValue] = useState('')
  const timerRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 열릴 때 입력 초기화 + 포커스
  useEffect(() => {
    if (!open) return
    setValue('')
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => void setSearchQuery(value), DEBOUNCE_MS)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
    // pages 가 바뀌면(페이지 삭제/회전/가져오기) 같은 질의를 다시 돌려 낡은 rect 를 버린다
  }, [open, value, pages, setSearchQuery])

  if (!open) return null
  const hasQuery = value.trim().length > 0
  return (
    <Box
      data-testid="search-bar"
      sx={{
        position: 'absolute',
        top: 12,
        // 폰 폭(xs)에서는 좌우 8px 을 두고 가로를 꽉 채운다 — 우측 고정 폭이면 입력이 화면 왼쪽 밖으로 나간다
        right: { xs: 8, sm: 24 },
        left: { xs: 8, sm: 'auto' },
        maxWidth: 'calc(100% - 16px)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.4,
        bgcolor: '#fff',
        borderRadius: 1.5,
        border: `1px solid ${ui.gray[200]}`,
        boxShadow: ui.shadow.lg // floating 층 규격(DESIGN.md)
      }}
    >
      <InputBase
        inputRef={inputRef}
        autoFocus
        value={value}
        placeholder={t('searchPlaceholder')}
        inputProps={{ 'aria-label': t('search'), 'data-testid': 'search-input' }}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            closeSearch()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) searchPrev()
            else searchNext()
          }
        }}
        sx={{ width: { xs: 'auto', sm: 200 }, flex: { xs: 1, sm: 'none' }, minWidth: 0, fontSize: 14, px: 0.5 }}
      />
      <Typography
        data-testid="search-counter"
        sx={{ fontSize: 13, color: hasQuery && total === 0 ? 'error.main' : 'text.secondary', minWidth: 52, textAlign: 'center', whiteSpace: 'nowrap' }}
      >
        {hasQuery && total === 0 ? t('searchNoResults') : `${total ? current + 1 : 0} / ${total}`}
      </Typography>
      <Tooltip title={t('searchPrev')}>
        <span>
          <IconButton size="small" disabled={total === 0} onClick={searchPrev} data-testid="search-prev">
            <ChevronLeft fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('searchNext')}>
        <span>
          <IconButton size="small" disabled={total === 0} onClick={searchNext} data-testid="search-next">
            <ChevronRight fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('close')}>
        <IconButton size="small" onClick={closeSearch} data-testid="search-close">
          <X fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
