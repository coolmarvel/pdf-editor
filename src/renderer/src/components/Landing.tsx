import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import LanguageRounded from '@mui/icons-material/LanguageRounded'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'

function Feature({ icon, label }: { icon: JSX.Element; label: string }): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
      {icon}
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>
    </Stack>
  )
}

export default function Landing(): JSX.Element {
  const t = useT()
  const openDocument = useEditor((s) => s.openDocument)
  const lang = useEditor((s) => s.lang)
  const setLang = useEditor((s) => s.setLang)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openFile = useCallback(async () => {
    const picked = await window.api.openPdf()
    if (!picked) return
    setError(null)
    await openDocument(picked.name, picked.data)
  }, [openDocument])

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = Array.from(e.dataTransfer.files).find((f) => f.name.toLowerCase().endsWith('.pdf'))
      if (!file) {
        setError(t('onlyPdf'))
        return
      }
      setError(null)
      const bytes = new Uint8Array(await file.arrayBuffer())
      await openDocument(file.name, bytes)
    },
    [openDocument]
  )

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3, position: 'relative' }}>
      {/* 언어 선택 (우측 상단) */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ position: 'absolute', top: 16, right: 20 }}>
        <LanguageRounded sx={{ color: 'text.secondary', fontSize: 20 }} />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={lang}
          onChange={(_, v) => v && setLang(v)}
          sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.3, fontSize: 13, textTransform: 'none' } }}
        >
          <ToggleButton value="ko">한국어</ToggleButton>
          <ToggleButton value="en">English</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4 }}>
        <PictureAsPdfRounded color="primary" sx={{ fontSize: 34 }} />
        <Typography variant="h5" fontWeight={800}>
          {t('appName')}
        </Typography>
      </Stack>

      <Typography variant="h4" fontWeight={800} gutterBottom>
        {t('landingTitle')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        {t('landingSubtitle')}
      </Typography>

      <Box
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        sx={{
          width: 560,
          maxWidth: '90vw',
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : '#d0d5dd',
          borderRadius: 4,
          p: 1.5,
          bgcolor: '#fff',
          boxShadow: '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
          transition: 'border-color .15s'
        }}
      >
        <Box
          sx={{
            bgcolor: 'primary.main',
            borderRadius: 3,
            py: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<UploadFileRounded />}
            onClick={openFile}
            sx={{ bgcolor: '#fff', color: 'primary.main', px: 4, py: 1.4, fontSize: 16, '&:hover': { bgcolor: '#fbeaea' } }}
          >
            {t('choosePdf')}
          </Button>
          <Typography sx={{ color: 'rgba(255,255,255,.9)' }} variant="body2">
            {t('orDrop')}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={4} sx={{ mt: 5 }}>
        <Feature icon={<ShieldOutlined fontSize="small" />} label={t('featOffline')} />
        <Feature icon={<EditNoteOutlined fontSize="small" />} label={t('featEasy')} />
        <Feature icon={<BoltOutlined fontSize="small" />} label={t('featFast')} />
      </Stack>
    </Box>
  )
}
