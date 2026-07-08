import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import UploadFileRounded from '@mui/icons-material/UploadFileRounded'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import BoltOutlined from '@mui/icons-material/BoltOutlined'
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded'
import { useEditor } from '@renderer/store/editor'

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
  const openDocument = useEditor((s) => s.openDocument)
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
        setError('PDF 파일만 열 수 있습니다.')
        return
      }
      setError(null)
      const bytes = new Uint8Array(await file.arrayBuffer())
      await openDocument(file.name, bytes)
    },
    [openDocument]
  )

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4 }}>
        <PictureAsPdfRounded color="primary" sx={{ fontSize: 34 }} />
        <Typography variant="h5" fontWeight={800}>
          PDF 편집기
        </Typography>
      </Stack>

      <Typography variant="h4" fontWeight={800} gutterBottom>
        PDF를 열어 바로 편집하세요
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        페이지 관리 · 텍스트 · 그리기 · 도형 · 스탬프 · 서명 · 주석 · 링크 — 전부 오프라인에서.
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
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 4,
          p: 1.5,
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
            PDF 파일 선택
          </Button>
          <Typography sx={{ color: 'rgba(255,255,255,.9)' }} variant="body2">
            또는 여기로 파일을 끌어다 놓으세요
          </Typography>
        </Box>
      </Box>

      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={4} sx={{ mt: 5 }}>
        <Feature icon={<ShieldOutlined fontSize="small" />} label="오프라인 · 개인정보 안전" />
        <Feature icon={<EditNoteOutlined fontSize="small" />} label="쉬운 사용" />
        <Feature icon={<BoltOutlined fontSize="small" />} label="빠른 속도" />
      </Stack>
    </Box>
  )
}
