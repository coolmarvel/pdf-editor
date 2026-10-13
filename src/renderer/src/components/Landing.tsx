/** 데스크톱 랜딩 — 클래식(pdf-editor-live ADR-0004): 타이틀 띠 + 가운데 "PDF 열기" 패널(점선 드롭 영역, 주 버튼 하나) + 기능 목록. 파일 선택/드롭으로 문서 열기 + 언어 선택 */
import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useEditor } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import { FilePen, FileText, FileUp, Languages, Shield, Zap } from './icons'
import PanelTitle from './classic/PanelTitle'

const { color, chrome, size, space, font, surface, shadow } = ui.classic

function Feature({ icon, label }: { icon: JSX.Element; label: string }): JSX.Element {
  return (
    <Stack direction="row" spacing={`${space.base}px`} alignItems="center" sx={{ color: color.text, height: size.row, '& svg': { fontSize: size.icon, color: color.textSecondary } }}>
      {icon}
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
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
    <Box className="classic-app" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* 타이틀 띠 */}
      <Box sx={{ height: size.titleBar, flexShrink: 0, display: 'flex', alignItems: 'center', gap: `${space.sm}px`, px: `${space.base}px`, background: surface.chrome, borderBottom: `1px solid ${chrome.frame}` }}>
        <FileText sx={{ fontSize: size.icon, color: color.accentPressed }} />
        <Typography sx={{ fontSize: font.md, fontWeight: font.bold, whiteSpace: 'nowrap' }}>{t('appName')}</Typography>
        <Box sx={{ flex: 1 }} />
        {/* 언어 선택 */}
        <Languages sx={{ color: color.textSecondary, fontSize: size.icon }} />
        <ToggleButtonGroup size="small" exclusive value={lang} onChange={(_, v) => v && setLang(v)} sx={{ '& .MuiToggleButton-root': { height: 20, px: `${space.base}px`, fontSize: font.xs } }}>
          <ToggleButton value="ko">한국어</ToggleButton>
          <ToggleButton value="en">English</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: `${space.xl}px`, gap: `${space.lg}px` }}>
        <Typography sx={{ fontSize: font.hero, fontWeight: font.bold, lineHeight: font.lhTight, whiteSpace: 'nowrap' }}>{t('landingTitle')}</Typography>
        <Typography sx={{ color: color.textSecondary, textAlign: 'center', maxWidth: 560 }}>{t('landingSubtitle')}</Typography>

        {/* "PDF 열기" 패널 */}
        <Box sx={{ width: 520, maxWidth: '90vw', bgcolor: color.canvas, border: `1px solid ${chrome.frame}`, boxShadow: shadow.raised }}>
          <PanelTitle>{t('choosePdf')}</PanelTitle>
          <Box
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            sx={{
              m: `${space.lg}px`,
              py: `${space.xl * 2}px`,
              border: `1px dashed ${dragOver ? color.accent : color.borderStrong}`,
              bgcolor: dragOver ? color.accentSubtle : color.sunken,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: `${space.lg}px`
            }}
          >
            <FileUp sx={{ fontSize: 32, color: color.textSecondary }} />
            <Button variant="contained" startIcon={<FileUp />} onClick={openFile}>
              {t('choosePdf')}
            </Button>
            <Typography variant="body2" sx={{ color: color.textSecondary, whiteSpace: 'nowrap' }}>
              {t('orDrop')}
            </Typography>
          </Box>
          {error && (
            <Typography color="error" variant="body2" sx={{ px: `${space.lg}px`, pb: `${space.lg}px` }}>
              {error}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={`${space.xl}px`}>
          <Feature icon={<Shield />} label={t('featOffline')} />
          <Feature icon={<FilePen />} label={t('featEasy')} />
          <Feature icon={<Zap />} label={t('featFast')} />
        </Stack>
      </Box>
    </Box>
  )
}
