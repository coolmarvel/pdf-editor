import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { Check, Download, FileText, Pencil, Printer, Search } from './icons'

export interface TopBarProps {
  busy: boolean
  onPrint: () => void
  onDownload: () => void
  onDone: () => void
}

export default function TopBar({ busy, onPrint, onDownload, onDone }: TopBarProps): JSX.Element {
  const t = useT()
  const fileName = useEditor((s) => s.fileName)
  const setFileName = useEditor((s) => s.setFileName)
  const openSearch = useEditor((s) => s.openSearch)
  const [renaming, setRenaming] = useState(false)
  const xs = useMediaQuery('(max-width: 599.95px)')

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: { xs: 1, sm: 2 }, py: 1, bgcolor: '#fff', borderBottom: 1, borderColor: 'divider', gap: { xs: 1, sm: 2 }, minWidth: 0 }}>
      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexShrink: 0 }}>
        <FileText color="primary" sx={{ fontSize: 22 }} />
        {/* 폰 폭(xs)에서는 앱명을 숨기고 아이콘만 — 파일명·완료·계정 메뉴가 한 줄에 들어가야 한다 */}
        <Typography fontWeight={800} sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
          {t('appName')}
        </Typography>
      </Stack>

      {/* xs: 파일명이 남은 폭을 다 쓴다(연필은 숨기고 파일명을 탭하면 이름 변경) — 64px 'VPWin…' 으로는 문서 식별이 안 됐다 */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, flexShrink: 1, flex: { xs: 1, sm: '0 1 auto' } }}>
        {renaming ? (
          <TextField
            size="small"
            autoFocus
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)}
            sx={{ width: { xs: '100%', sm: 260 }, maxWidth: 260 }}
          />
        ) : (
          <>
            <Typography color="text.secondary" noWrap title={fileName || t('untitled')} onClick={() => { if (xs) setRenaming(true) }} sx={{ maxWidth: { xs: 'none', sm: 300 }, minWidth: 0, flex: { xs: 1, sm: '0 1 auto' }, cursor: { xs: 'pointer', sm: 'default' } }} data-testid="file-name">
              {fileName || t('untitled')}
            </Typography>
            <Tooltip title={t('rename')}>
              <IconButton size="small" onClick={() => setRenaming(true)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <Pencil fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Box sx={{ flex: { xs: '0 0 0px', sm: 1 }, minWidth: { xs: 0, sm: 4 } }} />

      {busy && <CircularProgress size={20} />}
      <Tooltip title={t('search')}>
        <IconButton onClick={openSearch} data-testid="search-button">
          <Search />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('print')}>
        <span>
          <IconButton disabled={busy} onClick={onPrint}>
            <Printer />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t('saveAsPdf')}>
        <span>
          <IconButton disabled={busy} onClick={onDownload}>
            <Download />
          </IconButton>
        </span>
      </Tooltip>
      <Button variant="contained" startIcon={<Check />} disabled={busy} onClick={onDone} sx={{ px: { xs: 1.5, sm: 3 }, flexShrink: 0, whiteSpace: 'nowrap', '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
        {t('done')}
      </Button>
    </Box>
  )
}
