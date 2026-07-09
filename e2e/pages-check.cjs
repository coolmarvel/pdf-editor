/* 1.3.0 페이지 기능 시각 검증: 사이드바 메뉴/드래그/⊕, 레이아웃 모드, 언어 전환 */
const path = require('path')
const ROOT = '/home/jace/pdf-editor'
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'))
const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'))
const OUT = process.env.E2E_OUT ?? __dirname

async function main() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 4; i++) {
    const p = doc.addPage([595, 842])
    p.drawText(`PAGE ${i + 1}`, { x: 200, y: 500, size: 60, font })
  }
  const pdf = Buffer.from(await doc.save())

  const app = await _electron.launch({
    executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
    args: [path.join(ROOT, 'out', 'main', 'index.js'), '--no-sandbox'],
    env: { ...process.env, DISPLAY: ':0' }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(15000)

  // ── 랜딩: 영어 전환 ──
  await win.waitForSelector('text=PDF 파일 선택')
  await win.screenshot({ path: path.join(OUT, 'l1-landing-ko.png') })
  await win.click('button:has-text("English")')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l2-landing-en.png') })
  await win.click('button:has-text("한국어")')
  await win.waitForTimeout(300)

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
  await win.waitForTimeout(1200)

  // ── 드래그로 페이지 1 → 3 뒤로 ──
  const thumbs = await win.locator('[data-thumb]').all()
  const t1 = await thumbs[0].boundingBox()
  const t2 = await thumbs[1].boundingBox()
  const orderBefore = await win.evaluate(() => [...document.querySelectorAll('[data-thumb]')].map((n) => n.getAttribute('data-pgid')))
  await win.mouse.move(t1.x + t1.width / 2, t1.y + t1.height / 2)
  await win.mouse.down()
  await win.mouse.move(t2.x + t2.width / 2, t2.y + t2.height - 6, { steps: 12 }) // 뷰포트 안: 2번째 썸네일 하단
  await win.waitForTimeout(150)
  await win.screenshot({ path: path.join(OUT, 'l6b-drag-indicator.png'), clip: { x: 0, y: 150, width: 260, height: 700 } })
  await win.mouse.up()
  await win.waitForTimeout(400)
  const orderAfter = await win.evaluate(() => [...document.querySelectorAll('[data-thumb]')].map((n) => n.getAttribute('data-pgid')))
  console.log('reordered:', JSON.stringify(orderBefore) !== JSON.stringify(orderAfter), '| moved first→2nd:', orderAfter[1] === orderBefore[0])
  await win.screenshot({ path: path.join(OUT, 'l7-after-drag.png'), clip: { x: 0, y: 150, width: 260, height: 700 } })

  // ── 사이드바: 썸네일 호버 → ⋮ 메뉴 ──
  const thumb = win.locator('[data-thumb]').first()
  const tb = await thumb.boundingBox()
  await win.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2)
  await win.waitForTimeout(250)
  await win.screenshot({ path: path.join(OUT, 'l3-thumb-hover.png'), clip: { x: 0, y: 150, width: 260, height: 400 } })
  await win.mouse.click(tb.x + tb.width - 18, tb.y + 18) // ⋮
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l4-thumb-menu.png') })
  await win.keyboard.press('Escape')
  await win.waitForTimeout(200)

  // ── gap ⊕ 메뉴 ──
  const gapY = tb.y + tb.height + 26 // 페이지1 아래 gap 근처
  await win.mouse.move(tb.x + tb.width / 2, gapY)
  await win.waitForTimeout(250)
  await win.screenshot({ path: path.join(OUT, 'l5-gap-hover.png'), clip: { x: 0, y: gapY - 30, width: 260, height: 60 } })
  await win.mouse.click(tb.x + tb.width / 2, gapY)
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l6-gap-menu.png') })
  await win.keyboard.press('Escape')
  await win.waitForTimeout(600) // 메뉴 백드롭 완전 종료 대기

  // ── 레이아웃 패널 ──
  await win.click('button:has-text("레이아웃")')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l8-layout-panel.png') })
  // 두 쪽 보기
  await win.click('[data-testid="AutoStoriesOutlinedIcon"]')
  await win.waitForTimeout(600)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l9-double-mode.png') })
  // 한 장씩 보기
  await win.click('button:has-text("레이아웃")')
  await win.waitForTimeout(300)
  await win.click('[data-testid="CropDinRoundedIcon"]')
  await win.waitForTimeout(400)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, 'l10-paged-double.png') })

  await app.close()
  console.log('pages-check done')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
