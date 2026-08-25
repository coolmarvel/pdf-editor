import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'

export interface ConfirmAction {
  label: string
  onClick: () => void | Promise<void>
  /** true → 강조(contained) 버튼. 나머지는 color="inherit" 텍스트 버튼 */
  primary?: boolean
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  title: string
  body: string
  actions: ConfirmAction[]
}

/** 제목 + 본문 한 줄 + 버튼 열 — Editor 의 확인 다이얼로그 3종이 공유 */
export default function ConfirmDialog({ open, onClose, title, body, actions }: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        {actions.map((a) => (
          <Button key={a.label} variant={a.primary ? 'contained' : undefined} color={a.primary ? undefined : 'inherit'} onClick={() => void a.onClick()}>
            {a.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  )
}
