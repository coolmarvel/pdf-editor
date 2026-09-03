import { useState } from 'react'
import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'
import type { LinkObj, NoteObj } from '@core/objects'
import { useT } from '@renderer/i18n'
import { Trash2 } from './icons'

/** 팝업 앵커 = 클릭한 화면 좌표 */
export type PopAt = { x: number; y: number }

interface NoteProps {
  /** 닫히는 동안(페이드) obj 가 먼저 사라질 수 있다 */
  obj?: NoteObj
  at: PopAt | null
  onClose: () => void
  onRemove: () => void
  onChange: (text: string) => void
}

/** 노트 편집 팝업: 노트 색 배경 + 여러 줄 입력(blur 때 반영) + 삭제 */
export function NotePopover({ obj, at, onClose, onRemove, onChange }: NoteProps): JSX.Element {
  const t = useT()
  return (
    <Popover open={!!at && !!obj} anchorReference="anchorPosition" anchorPosition={at ? { left: at.x, top: at.y } : undefined} onClose={onClose}>
      <Box sx={{ p: 1.5, width: 260, bgcolor: obj?.color ?? '#facc15' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <strong style={{ fontSize: 13 }}>{t('noteTitle')}</strong>
          <IconButton size="small" onClick={onRemove}>
            <Trash2 fontSize="small" />
          </IconButton>
        </Stack>
        <TextField
          multiline
          minRows={4}
          fullWidth
          autoFocus
          variant="standard"
          placeholder={t('notePlaceholder')}
          defaultValue={obj?.text ?? ''}
          onBlur={(e) => onChange(e.target.value)}
          sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
        />
      </Box>
    </Popover>
  )
}

interface LinkProps {
  obj?: LinkObj
  at: PopAt | null
  onClose: () => void
  /** 취소: 대상이 아직 비어 있는(방금 그린) 링크는 호출부가 지운다 */
  onCancel: () => void
  onApply: (target: LinkObj['target']) => void
}

/** 링크 설정 팝업: 웹사이트 / 페이지 번호. 폼 상태는 열릴 때마다 객체의 현재 대상으로 초기화된다 (Popover 가 닫히면 내용이 언마운트) */
export function LinkPopover({ obj, at, onClose, onCancel, onApply }: LinkProps): JSX.Element {
  return (
    <Popover open={!!at && !!obj} anchorReference="anchorPosition" anchorPosition={at ? { left: at.x, top: at.y } : undefined} onClose={onClose}>
      <LinkForm target={obj?.target ?? { kind: 'url', url: '' }} onCancel={onCancel} onApply={onApply} />
    </Popover>
  )
}

function LinkForm({ target, onCancel, onApply }: { target: LinkObj['target']; onCancel: () => void; onApply: LinkProps['onApply'] }): JSX.Element {
  const t = useT()
  const [kind, setKind] = useState<'url' | 'page'>(target.kind)
  const [value, setValue] = useState(target.kind === 'url' ? target.url : String(target.page))
  return (
    <Box sx={{ p: 2, width: 300 }}>
      <Stack spacing={1.5}>
        <strong style={{ fontSize: 13 }}>{t('linkSettings')}</strong>
        <ToggleButtonGroup size="small" exclusive value={kind} onChange={(_, v) => v && setKind(v)} fullWidth>
          <ToggleButton value="url">{t('website')}</ToggleButton>
          <ToggleButton value="page">{t('pages')}</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          autoFocus
          fullWidth
          placeholder={kind === 'url' ? 'www.example.com' : t('pageNo')}
          type={kind === 'page' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" color="inherit" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!value.trim()}
            onClick={() => onApply(kind === 'url' ? { kind: 'url', url: value.trim() } : { kind: 'page', page: Number(value) || 1 })}
          >
            {t('apply')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}
