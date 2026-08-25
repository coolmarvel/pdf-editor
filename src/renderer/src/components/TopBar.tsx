import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { Check, Download, FileText, Pencil, Printer } from './icons'

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
  const [renaming, setRenaming] = useState(false)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, bgcolor: '#fff', borderBottom: 1, borderColor: 'divider', gap: 2 }}>
      <Stack direction="row" spacing={0.8} alignItems="center">
        <FileText color="primary" sx={{ fontSize: 26 }} />
        <Typography fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
          {t('appName')}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
        {renaming ? (
          <TextField
            size="small"
            autoFocus
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => e.key === 'Enter' && setRenaming(false)}
            sx={{ width: 260 }}
          />
        ) : (
          <>
            <Typography color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
              {fileName || t('untitled')}
            </Typography>
            <Tooltip title={t('rename')}>
              <IconButton size="small" onClick={() => setRenaming(true)}>
                <Pencil fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Stack>

      <Box sx={{ flex: 1 }} />

      {busy && <CircularProgress size={20} />}
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
      <Button variant="contained" startIcon={<Check />} disabled={busy} onClick={onDone} sx={{ borderRadius: 99, px: 3 }}>
        {t('done')}
      </Button>
    </Box>
  )
}
