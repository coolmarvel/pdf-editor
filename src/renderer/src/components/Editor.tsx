import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { useEditor } from '@renderer/store/editor'
import { useT, type I18nKey } from '@renderer/i18n'
import { buildPdf } from '@renderer/pdf/save'
import { fileToDataUrl } from '@renderer/editor/stamp'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import SubToolbar from './SubToolbar'
import ThumbnailSidebar from './ThumbnailSidebar'
import PagesView from './PagesView'
import FloatingPager from './FloatingPager'
import ManagePagesDialog from './ManagePagesDialog'
import StampDialog from './StampDialog'
import SignDialog from './SignDialog'
import ConfirmDialog from './ui/ConfirmDialog'

export default function Editor(): JSX.Element {
  const t = useT()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const editTextExitPrompt = useEditor((s) => s.editTextExitPrompt)
  const endEditTextSession = useEditor((s) => s.endEditTextSession)
  const cancelEditTextExit = useEditor((s) => s.cancelEditTextExit)
  const deletePrompt = useEditor((s) => s.deletePrompt)
  const confirmDelete = useEditor((s) => s.confirmDelete)
  const cancelDelete = useEditor((s) => s.cancelDelete)
  const [managePagesOpen, setManagePagesOpen] = useState(false)
  const [stampOpen, setStampOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error'; path?: string } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  // 다이얼로그/사이드바가 올린 알림을 이 화면의 스낵바로 흘려보낸다
  const notice = useEditor((s) => s.notice)
  useEffect(() => {
    if (!notice) return
    setToast(notice)
    useEditor.getState().setNotice(null)
  }, [notice])

  // 키보드: Ctrl+Z/Y, Delete
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const s = useEditor.getState()
      const inEditable = (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT'
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inEditable) {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inEditable) {
        e.preventDefault()
        s.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !inEditable && s.selected) {
        e.preventDefault()
        s.removeObject(s.selected.pageId, s.selected.objectId)
      } else if (e.key === 'Escape' && !inEditable) {
        // 활성 도구 비활성화 (2026-07-10 피드백). editText 세션은 setTool 이 저장 확인을 처리
        if (s.tool !== 'select') s.setTool('select')
        else if (s.selected) s.setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function makePdf(): Promise<Uint8Array> {
    const s = useEditor.getState()
    return buildPdf({ pages: s.pages, objectsByPage: s.objectsByPage, displaySizes: s.displaySizes })
  }

  /** 진행 표시(busy) + 실패 토스트 공통 래퍼 — 저장/인쇄 */
  async function withBusy(fn: () => Promise<void>, errKey: I18nKey): Promise<void> {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setToast({ msg: `${t(errKey)}: ${err instanceof Error ? err.message : String(err)}`, severity: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const onDownload = (): Promise<void> =>
    withBusy(async () => {
      const bytes = await makePdf()
      const s = useEditor.getState()
      const path = await window.api.saveBuffer(`${s.fileName || 'document'}.pdf`, bytes)
      if (path) setToast({ msg: t('savedToast'), severity: 'success', path })
    }, 'saveFailed')

  const onPrint = (): Promise<void> =>
    withBusy(async () => {
      const bytes = await makePdf()
      await window.api.printPdf(bytes)
    }, 'printFailed')

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const { dataUrl, aspect } = await fileToDataUrl(f)
    useEditor.getState().setPendingImage({ dataUrl, aspect, kind: 'image' })
    useEditor.getState().setTool('image')
    setToast({ msg: t('imagePlaceToast'), severity: 'success' })
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar busy={busy} onPrint={() => void onPrint()} onDownload={() => void onDownload()} onDone={() => setDoneOpen(true)} />
      <Toolbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onManagePages={() => setManagePagesOpen(true)}
        onOpenImage={() => imageInputRef.current?.click()}
        onOpenStamp={() => setStampOpen(true)}
        onOpenSign={() => setSignOpen(true)}
      />
      <SubToolbar />

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {sidebarOpen && <ThumbnailSidebar onManagePages={() => setManagePagesOpen(true)} />}
        <PagesView />
        <FloatingPager />
      </Box>

      <input ref={imageInputRef} type="file" hidden accept="image/*" onChange={(e) => void onImagePicked(e)} />

      <ManagePagesDialog open={managePagesOpen} onClose={() => setManagePagesOpen(false)} />
      <StampDialog open={stampOpen} onClose={() => setStampOpen(false)} />
      <SignDialog open={signOpen} onClose={() => setSignOpen(false)} />

      {/* 완료 확인 */}
      <ConfirmDialog
        open={doneOpen}
        onClose={() => setDoneOpen(false)}
        title={t('finishTitle')}
        body={t('finishBody')}
        actions={[
          { label: t('keepEditing'), onClick: () => setDoneOpen(false) },
          {
            label: t('dontSave'),
            onClick: () => {
              setDoneOpen(false)
              useEditor.getState().closeDocument()
            }
          },
          {
            label: t('saveAndClose'),
            primary: true,
            onClick: async () => {
              setDoneOpen(false)
              await onDownload()
              useEditor.getState().closeDocument()
            }
          }
        ]}
      />

      {/* 텍스트 수정 세션 종료: 변경 저장 확인 (Guru: Save changes before exiting?) */}
      <ConfirmDialog
        open={editTextExitPrompt !== null}
        onClose={cancelEditTextExit}
        title={t('editTextExitTitle')}
        body={t('editTextExitBody')}
        actions={[
          { label: t('keepEditing'), onClick: cancelEditTextExit },
          { label: t('dontSave'), onClick: () => endEditTextSession(false, editTextExitPrompt ?? 'select') },
          { label: t('save'), primary: true, onClick: () => endEditTextSession(true, editTextExitPrompt ?? 'select') }
        ]}
      />

      {/* 텍스트 수정: 텍스트 상자 삭제 확인 (Guru: Are you sure you want to delete this text box?) */}
      <ConfirmDialog
        open={!!deletePrompt}
        onClose={cancelDelete}
        title={t('deleteTextTitle')}
        body={t('deleteTextBody')}
        actions={[
          { label: t('cancel'), onClick: cancelDelete },
          { label: t('erase'), primary: true, onClick: confirmDelete }
        ]}
      />

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert
          severity={toast?.severity ?? 'success'}
          onClose={() => setToast(null)}
          action={
            toast?.path ? (
              <Button size="small" onClick={() => void window.api.showItem(toast.path!)}>
                {t('openFolder')}
              </Button>
            ) : undefined
          }
        >
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
