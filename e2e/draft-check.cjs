/* 임시 저장(draft) 왕복 + Manage Pages 툴바 한 줄 + 사이드바 넓히기 재-fit 시각 검증 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'))
const { makeTextPdf } = require('./minipdf.cjs')
const OUT = process.env.E2E_OUT ?? __dirname

async function makePdf(n) {
  return makeTextPdf(Array.from({ length: n }, (_, i) => ({ w: 595, h: 842, texts: [{ x: 120, y: 500, size: 40, text: `DRAFT PAGE ${i + 1}` }] })))
}

async function dropPdf(win, pdf) {
  await win.waitForSelector('text=PDF 파일 선택')
  await win.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const file = new File([bytes], 'sample.pdf', { type: 'application/pdf' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const label = [...document.querySelectorAll('p, span, div')].find((el) => el.textContent === '또는 여기로 파일을 끌어다 놓으세요')
    const ev = new DragEvent('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'dataTransfer', { value: dt })
    label.dispatchEvent(ev)
  }, pdf.toString('base64'))
  await win.waitForSelector('[data-page-index]')
  await win.waitForTimeout(1000)
}

/** 페이지 영역 컨테이너의 가로 오버플로/페이지 폭 계측 */
function measure(win) {
  return win.evaluate(() => {
    const page = document.querySelector('[data-page-index]')
    const cont = page.parentElement.parentElement
    const pr = page.getBoundingClientRect()
    const cr = cont.getBoundingClientRect()
    const sb = document.querySelector('[data-sidebar]')?.getBoundingClientRect()
    return {
      sidebarW: sb ? Math.round(sb.width) : 0,
      contW: Math.round(cr.width),
      pageW: Math.round(pr.width),
      pageLeft: Math.round(pr.left - cr.left),
      overflowX: cont.scrollWidth > cont.clientWidth + 1,
      zoom: window.__editor.getState().zoom
    }
  })
}

async function main() {
  let failed = false
  const check = (ok, msg) => { console.log(ok ? 'PASS' : 'FAIL', msg); if (!ok) failed = true }
  const pdf = await makePdf(2)
  const app = await _electron.launch({
    executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
    args: [path.join(ROOT, 'out', 'main', 'index.js'), '--no-sandbox'],
    env: { ...process.env, DISPLAY: ':0' }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(15000)
  const setSize = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h])
    await win.waitForTimeout(600)
  }
  await setSize(1280, 800)
  await dropPdf(win, pdf)

  // ── 1. Manage Pages 툴바 한 줄 (1280×800, 1600×900) ──
  for (const [w, h] of [[1280, 800], [1600, 900]]) {
    await setSize(w, h)
    await win.click('button:has-text("페이지 관리")')
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(OUT, `d1-manage-${w}.png`) })
    const info = await win.evaluate(() => {
      const dlg = document.querySelector('.MuiDialog-paper')
      const bar = dlg.firstElementChild
      // 줄 수 = 버튼 세로 중심을 8px 이상 벌어질 때마다 새 줄로 센다 (클래식 UI 는 22px 아이콘 버튼과 24px 버튼이 섞여 top 이 1px 어긋난다)
      const mids = [...bar.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return r.top + r.height / 2 }).sort((a, b) => a - b)
      const rows = mids.reduce((n, m, i) => (i > 0 && m - mids[i - 1] > 8 ? n + 1 : n), mids.length ? 1 : 0)
      return { dlgW: Math.round(dlg.getBoundingClientRect().width), rows, barScroll: bar.scrollWidth > bar.clientWidth + 1 }
    })
    check(info.rows === 1, `manage toolbar single row @${w}: ${JSON.stringify(info)}`)
    await win.keyboard.press('Escape')
    await win.waitForTimeout(400)
  }

  // ── 2. 사이드바 넓히기 → 페이지 재-fit, 가로 오버플로 없음 ──
  await setSize(1280, 800)
  const before = await measure(win)
  const sb = await win.locator('[data-sidebar]').boundingBox()
  await win.mouse.move(sb.x + sb.width - 1, sb.y + 300)
  await win.mouse.down()
  await win.mouse.move(sb.x + sb.width + 700, sb.y + 300, { steps: 15 }) // 캡 이상으로 끌어 MAX 확인
  await win.mouse.up()
  await win.waitForTimeout(700)
  const after = await measure(win)
  await win.screenshot({ path: path.join(OUT, 'd2-sidebar-wide.png') })
  console.log('sidebar before/after:', JSON.stringify(before), JSON.stringify(after))
  check(after.sidebarW <= Math.min(480, Math.floor(1280 * 0.4)) && after.sidebarW > before.sidebarW, 'sidebar capped at min(480, 40%)')
  check(after.pageW < before.pageW && after.zoom < before.zoom, 'page re-fit narrower after sidebar drag')
  check(!after.overflowX, 'no horizontal overflow at fit-width')
  check(after.pageLeft >= 30 && after.contW - after.pageLeft - after.pageW >= 30, `gutters kept (left ${after.pageLeft}, right ${after.contW - after.pageLeft - after.pageW})`)
  // 되돌리기
  const sb2 = await win.locator('[data-sidebar]').boundingBox()
  await win.mouse.move(sb2.x + sb2.width - 1, sb2.y + 300)
  await win.mouse.down()
  await win.mouse.move(sb2.x + 208, sb2.y + 300, { steps: 10 })
  await win.mouse.up()
  await win.waitForTimeout(600)
  const restored = await measure(win)
  check(Math.abs(restored.pageW - before.pageW) <= 2 && !restored.overflowX, `page width restored after narrowing (${restored.pageW} vs ${before.pageW})`)
  await win.screenshot({ path: path.join(OUT, 'd3-sidebar-restored.png') })

  // ── 3. draft 왕복: 텍스트 추가 → serialize → close → restore ──
  await win.click('button:has-text("텍스트 추가")')
  const box = await win.locator('[data-page-index]').first().boundingBox()
  await win.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3)
  await win.waitForTimeout(300)
  await win.keyboard.type('draft text')
  await win.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1)
  await win.waitForTimeout(300)
  const r = await win.evaluate(async () => {
    const st = window.__editor
    const d = st.getState().serializeDraft()
    const count = (o) => Object.values(o).reduce((n, l) => n + l.length, 0)
    const before = { pages: d.pages.length, objects: count(d.objectsByPage), docs: Object.keys(d.docs), zoom: d.zoom, fileName: d.fileName }
    st.getState().closeDocument()
    const closed = st.getState().phase
    await st.getState().restoreDraft(d)
    const s = st.getState()
    const after = { pages: s.pages.length, objects: count(s.objectsByPage), docIds: [...new Set(s.pages.map((p) => p.docId))], zoom: s.zoom, fileName: s.fileName, phase: s.phase, hist: s.history.past.length }
    return { before, closed, after }
  })
  console.log('draft:', JSON.stringify(r))
  check(r.closed === 'landing', 'closeDocument → landing')
  check(r.after.phase === 'editor' && r.after.pages === 2 && r.before.pages === 2, 'restore: 2 pages')
  check(r.after.objects === 1 && r.before.objects === 1, 'restore: 1 text object')
  check(r.after.docIds.length === 1 && r.before.docs[0] === r.after.docIds[0], 'restore: original docId kept')
  check(r.after.hist === 0, 'restore: empty history')
  await win.waitForSelector('[data-page-index]')
  await win.waitForTimeout(1200)
  const thumbs = await win.evaluate(() => [...document.querySelectorAll('[data-thumb] canvas:not([data-testid="thumb-overlay"])')].map((c) => c.width > 0 && c.height > 0))
  check(thumbs.length === 2 && thumbs.every(Boolean), `thumbnails rendered after restore (${thumbs.length})`)
  await win.screenshot({ path: path.join(OUT, 'd4-after-restore.png') })

  // 복원 뒤 새 문서 가져오기가 docId 충돌 없이 되는지
  const imp = await win.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    await window.__editor.getState().pageImport(bytes)
    return [...new Set(window.__editor.getState().pages.map((p) => p.docId))]
  }, (await makePdf(1)).toString('base64'))
  check(imp.length === 2, `import after restore gets fresh docId: ${JSON.stringify(imp)}`)

  await app.close()
  console.log(failed ? 'draft-check FAILED' : 'draft-check done')
  if (failed) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
