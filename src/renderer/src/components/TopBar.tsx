/**
 * 상단 크롬 — 클래식(pdf-editor-live ADR-0004 포팅): 타이틀 띠(28px: 앱 아이콘·앱명(메인으로 나가기 확인)·파일명·검색·인쇄·저장·완료) +
 * 메뉴 바(22px: 파일·편집·보기·페이지·도구·도움말). 도구 버튼에 흩어진 기능을 메뉴·키보드로도 닿게 한다. 스킨 전환은 보기 메뉴.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEditor, selectCanUndo, selectCanRedo } from '@renderer/store/editor'
import { useT } from '@renderer/i18n'
import { ui } from '@renderer/theme'
import { SKIN_LABELS, type SkinName } from '@renderer/classic/skins'
import { applySkin, loadSkin } from '@renderer/classic/tokens'
import { Check, Download, FileText, Pencil, Printer, Search } from './icons'
import MenuBar, { type MenuDef } from './classic/MenuBar'
import type { ToolbarProps } from './Toolbar'

const { color, chrome, size, space, font, surface, focusRing } = ui.classic

export interface TopBarProps {
  busy: boolean
  onPrint: () => void
  onDownload: () => void
  onDone: () => void
  /** 메뉴 바가 도구·패널을 열 때 쓰는 콜백(툴바와 같은 것) */
  toolbar: ToolbarProps
}

export default function TopBar({ busy, onPrint, onDownload, onDone, toolbar }: TopBarProps): JSX.Element {
  const t = useT()
  const lang = useEditor((s) => s.lang)
  const fileName = useEditor((s) => s.fileName)
  const setFileName = useEditor((s) => s.setFileName)
  const openSearch = useEditor((s) => s.openSearch)
  const closeDocument = useEditor((s) => s.closeDocument)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor(selectCanUndo)
  const canRedo = useEditor(selectCanRedo)
  const selected = useEditor((s) => s.selected)
  const removeObject = useEditor((s) => s.removeObject)
  const setTool = useEditor((s) => s.setTool)
  const zoom = useEditor((s) => s.zoom)
  const setZoom = useEditor((s) => s.setZoom)
  const requestFit = useEditor((s) => s.requestFit)
  const pageMode = useEditor((s) => s.pageMode)
  const setPageMode = useEditor((s) => s.setPageMode)
  const pageTransition = useEditor((s) => s.pageTransition)
  const setPageTransition = useEditor((s) => s.setPageTransition)
  const pageRotate = useEditor((s) => s.pageRotate)
  const [renaming, setRenaming] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState<'shortcuts' | 'about' | null>(null)
  const [skin, setSkin] = useState<SkinName>(loadSkin)
  const xs = useMediaQuery('(max-width: 599.95px)')

  const pickSkin = (name: SkinName): void => {
    applySkin(name)
    setSkin(name)
  }
  /** 현재 페이지 회전 — pages·currentPage 는 클릭 시점에 읽는다(구독하면 스크롤마다 상단 크롬이 리렌더) */
  const rotateCurrentPage = (deg: -90 | 90): void => {
    const { pages, currentPage } = useEditor.getState()
    const pg = pages[currentPage]
    if (pg) pageRotate(new Set([pg.id]), deg)
  }

  const menus: MenuDef[] = [
    {
      label: t('menuFile'),
      testId: 'menu-file',
      items: [
        { label: t('menuFinish'), onClick: onDone, disabled: busy, testId: 'menu-finish' },
        { label: t('saveAsPdf'), shortcut: 'Ctrl+S', onClick: onDownload, disabled: busy },
        { label: t('print'), shortcut: 'Ctrl+P', onClick: onPrint, disabled: busy },
        'sep',
        { label: t('menuClose'), onClick: () => setExitOpen(true), testId: 'menu-close' }
      ]
    },
    {
      label: t('menuEdit'),
      testId: 'menu-edit',
      items: [
        { label: t('undo'), shortcut: 'Ctrl+Z', onClick: () => undo(), disabled: !canUndo },
        { label: t('redo'), shortcut: 'Ctrl+Y', onClick: () => redo(), disabled: !canRedo },
        'sep',
        { label: t('menuDeleteSelected'), shortcut: 'Del', onClick: () => selected && removeObject(selected.pageId, selected.objectId), disabled: !selected },
        'sep',
        { label: t('menuFind'), shortcut: 'Ctrl+F', onClick: openSearch, testId: 'menu-find' }
      ]
    },
    {
      label: t('menuView'),
      testId: 'menu-view',
      items: [
        { label: t('menuSidebar'), onClick: toolbar.onToggleSidebar, checked: toolbar.sidebarOpen, testId: 'menu-sidebar' },
        'sep',
        { label: t('pageModeSingle'), onClick: () => setPageMode('single'), checked: pageMode === 'single' },
        { label: t('pageModeDouble'), onClick: () => setPageMode('double'), checked: pageMode === 'double' },
        { label: t('transitionContinuous'), onClick: () => setPageTransition('continuous'), checked: pageTransition === 'continuous' },
        { label: t('transitionPaged'), onClick: () => setPageTransition('paged'), checked: pageTransition === 'paged' },
        'sep',
        { label: t('menuZoomIn'), shortcut: 'Ctrl++', onClick: () => setZoom(zoom * 1.2) },
        { label: t('menuZoomOut'), shortcut: 'Ctrl+-', onClick: () => setZoom(zoom / 1.2) },
        { label: t('menuZoom100'), onClick: () => setZoom(1) },
        { label: t('menuZoomFit'), onClick: () => requestFit() },
        'sep',
        {
          label: t('menuSkin'),
          onClick: () => undefined,
          submenu: (Object.keys(SKIN_LABELS) as SkinName[]).map((k) => ({ label: SKIN_LABELS[k][lang], onClick: () => pickSkin(k), checked: skin === k, testId: `skin-${k}` }))
        }
      ]
    },
    {
      label: t('menuPage'),
      testId: 'menu-page',
      items: [
        { label: t('managePages'), onClick: toolbar.onManagePages, testId: 'menu-manage-pages' },
        'sep',
        { label: t('menuRotateCurrentLeft'), onClick: () => rotateCurrentPage(-90) },
        { label: t('menuRotateCurrentRight'), onClick: () => rotateCurrentPage(90) }
      ]
    },
    {
      label: t('menuTools'),
      testId: 'menu-tools',
      items: [
        { label: t('select'), onClick: () => setTool('select') },
        'sep',
        { label: t('addText'), onClick: () => setTool('addText') },
        { label: t('editText'), onClick: () => setTool('editText') },
        { label: t('highlight'), onClick: () => setTool('highlight') },
        { label: t('pencil'), onClick: () => setTool('pencil') },
        { label: t('eraser'), onClick: () => setTool('whiteout') },
        { label: t('rectangle'), onClick: () => setTool('rect') },
        { label: t('ellipse'), onClick: () => setTool('ellipse') },
        { label: t('cross'), onClick: () => setTool('cross') },
        { label: t('check'), onClick: () => setTool('check') },
        'sep',
        { label: t('image'), onClick: toolbar.onOpenImage },
        { label: t('stamp'), onClick: toolbar.onOpenStamp },
        { label: t('sign'), onClick: toolbar.onOpenSign },
        { label: t('note'), onClick: () => setTool('note') },
        { label: t('link'), onClick: () => setTool('link') },
        { label: t('watermark'), onClick: () => setTool('watermark') }
      ]
    },
    {
      label: t('menuHelp'),
      testId: 'menu-help',
      items: [
        { label: t('menuShortcuts'), onClick: () => setHelpOpen('shortcuts') },
        { label: t('menuAbout'), onClick: () => setHelpOpen('about') }
      ]
    }
  ]

  return (
    <>
      {/* 타이틀 띠 */}
      <Box
        data-testid="titlebar"
        sx={{
          height: size.titleBar,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: `${space.sm}px`,
          px: `${space.sm}px`,
          background: surface.chrome,
          borderBottom: `1px solid ${chrome.frame}`,
          minWidth: 0,
          '@media (pointer: coarse)': { height: size.touch + 4 }
        }}
      >
        {/* 앱명 = 메인으로 나가기 (확인 모달을 거친다) */}
        <Box
          component="button"
          type="button"
          onClick={() => setExitOpen(true)}
          data-testid="brand-exit"
          sx={{
            all: 'unset',
            display: 'flex',
            alignItems: 'center',
            gap: `${space.sm}px`,
            px: `${space.sm}px`,
            height: 22,
            flexShrink: 0,
            border: '1px solid transparent',
            '&:hover': { bgcolor: color.canvas, borderColor: color.hoverEdge },
            '&:focus-visible': focusRing
          }}
        >
          <FileText sx={{ fontSize: size.icon, color: color.accentPressed }} />
          <Box component="span" sx={{ fontSize: font.md, fontWeight: font.bold, whiteSpace: 'nowrap', color: color.text, display: { xs: 'none', sm: 'inline' } }}>
            {t('appName')}
          </Box>
        </Box>
        <Box component="span" sx={{ color: color.textMuted, display: { xs: 'none', sm: 'inline' } }}>
          -
        </Box>
        {/* xs: 파일명이 남은 폭을 다 쓴다(연필은 숨기고 파일명을 탭하면 이름 변경) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: `${space.xs}px`, minWidth: 0, flex: { xs: 1, sm: '0 1 auto' } }}>
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
              <Box
                component="span"
                title={fileName || t('untitled')}
                onClick={() => {
                  if (xs) setRenaming(true)
                }}
                data-testid="file-name"
                sx={{ fontSize: font.md, color: color.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: { xs: 'none', sm: 300 }, minWidth: 0, flex: { xs: 1, sm: '0 1 auto' } }}
              >
                {fileName || t('untitled')}
              </Box>
              <Tooltip title={t('rename')}>
                <IconButton size="small" onClick={() => setRenaming(true)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                  <Pencil />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
        <Box sx={{ flex: { xs: '0 0 0px', sm: 1 }, minWidth: { xs: 0, sm: 4 } }} />
        {busy && <CircularProgress size={14} />}
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
        <Button variant="contained" startIcon={<Check />} disabled={busy} onClick={onDone} sx={{ height: 22, px: { xs: `${space.base}px`, sm: `${space.lg}px` }, flexShrink: 0, '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
          {t('done')}
        </Button>
      </Box>
      <MenuBar menus={menus} />

      <Dialog open={exitOpen} onClose={() => setExitOpen(false)} data-testid="exit-dialog" maxWidth="sm">
        <DialogTitle>{t('exitTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'nowrap' }}>{t('exitBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitOpen(false)} data-testid="exit-stay">
            {t('exitStay')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setExitOpen(false)
              closeDocument()
            }}
            data-testid="exit-leave"
          >
            {t('exitLeave')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!helpOpen} onClose={() => setHelpOpen(null)} maxWidth="sm">
        <DialogTitle>{helpOpen === 'about' ? t('menuAbout') : t('shortcutsTitle')}</DialogTitle>
        <DialogContent>
          {helpOpen === 'about' ? (
            <DialogContentText>{t('aboutBody')}</DialogContentText>
          ) : (
            <Box component="table" className="tnum" sx={{ borderCollapse: 'collapse', '& td': { px: `${space.base}px`, py: `${space.xs}px`, fontSize: font.md, whiteSpace: 'nowrap' }, '& td:first-of-type': { color: color.textSecondary } }}>
              <tbody>
                {[
                  ['Ctrl+Z / Ctrl+Y', `${t('undo')} / ${t('redo')}`],
                  ['Del', t('menuDeleteSelected')],
                  ['Ctrl+F', t('menuFind')],
                  ['Esc', t('select')],
                  ['Alt', t('menuFile')]
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setHelpOpen(null)}>
            {t('ok')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
