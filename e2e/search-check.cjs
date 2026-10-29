/* PDF 편집기 E2E — 문서 텍스트 검색 (playwright-core + electron) */
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const OUT = process.env.E2E_OUT ?? __dirname
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'))
const { makeTextPdf } = require('./minipdf.cjs')

const WORD = 'orange'

/** 2페이지: "Sample page N" + 반복 단어 줄(한 스팬 안에 3회) */
async function makePdf() {
  return makeTextPdf(
    [1, 2].map((n) => ({
      w: 595,
      h: 842,
      texts: [
        { x: 60, y: 760, size: 24, text: `Sample page ${n}` },
        { x: 60, y: 700, size: 18, text: `An ${WORD} tree, an ${WORD} fruit and Orange juice.` },
        { x: 60, y: 660, size: 14, text: `Nothing to see here on page ${n}.` }
      ]
    }))
  )
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT: ' + msg)
  console.log('ok -', msg)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const pdf = await makePdf()
  const app = await _electron.launch({
    executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
    args: [path.join(ROOT, 'out', 'main', 'index.js'), '--no-sandbox'],
    env: { ...process.env, DISPLAY: ':0' }
  })
  const win = await app.firstWindow()
  win.setDefaultTimeout(15000)
  await win.setViewportSize?.({ width: 1600, height: 900 }).catch(() => {})

  // ── PDF 드롭으로 열기 ──
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

  const counter = () => win.locator('[data-testid="search-counter"]').textContent()
  const pagerText = () => win.evaluate(() => document.querySelector('[data-testid="page-counter"]')?.textContent?.trim())
  /** 현재 페이지(0-base) — 상태 줄 페이지 칸(page-counter) "N/M" 텍스트로 읽는다 (store 는 window 에 노출되지 않음) */
  const curPage = async () => Number((await pagerText()).split('/')[0]) - 1

  // ── 검색 버튼 → 바 열림 + 입력 포커스 ──
  await win.click('[data-testid="search-button"]')
  await win.waitForSelector('[data-testid="search-bar"]')
  assert(await win.evaluate(() => document.activeElement?.dataset.testid === 'search-input'), 'search input autofocused')
  assert((await counter()).trim() === '0 / 0', 'counter starts at 0 / 0')

  // ── 타이핑 → 디바운스 뒤 결과 ──
  await win.keyboard.type(WORD)
  await win.waitForFunction(() => document.querySelectorAll('[data-testid="search-hit"], [data-testid="search-hit-current"]').length > 0)
  await win.waitForTimeout(300)
  const c1 = (await counter()).trim()
  console.log('counter:', c1)
  const m = c1.match(/^1 \/ (\d+)$/)
  assert(m && Number(m[1]) === 6, 'counter "1 / 6" (3 per page x 2 pages, case-insensitive)')
  const hits = await win.evaluate(() => document.querySelectorAll('[data-testid="search-hit"], [data-testid="search-hit-current"]').length)
  console.log('hit boxes in DOM:', hits)
  assert(hits === 6, 'six highlight boxes drawn')
  assert((await pagerText()) === '1/2', 'starts on page 1')
  await win.screenshot({ path: path.join(OUT, 'S1-search-results.png') })
  const pb = await win.locator('[data-page-index]').first().boundingBox()
  await win.screenshot({ path: path.join(OUT, 'S1b-page1-zoom.png'), clip: { x: pb.x, y: pb.y, width: 950, height: 360 } })

  // ── 다음 반복 → 페이지 2 로 이동 ──
  let moved = false
  for (let i = 0; i < 6; i++) {
    await win.click('[data-testid="search-next"]')
    await win.waitForTimeout(250)
    const c = (await counter()).trim()
    const cur = await curPage()
    console.log('after next:', c, 'currentPage=', cur, 'pager=', await pagerText())
    if (cur === 1) {
      moved = true
      assert(c === '4 / 6', 'first match on page 2 is #4')
      break
    }
  }
  assert(moved, 'current page moved to page 2 via next')
  assert((await pagerText()) === '2/2', 'pager shows 2/2')
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, 'S2-page2-current.png') })
  const pb2 = await win.locator('[data-page-index]').nth(1).boundingBox()
  await win.screenshot({ path: path.join(OUT, 'S2b-page2-zoom.png'), clip: { x: pb2.x, y: Math.max(0, pb2.y), width: 950, height: 360 } })

  // ── 감김: 끝에서 next → 1 / 6, 페이지 1 ──
  await win.click('[data-testid="search-next"]')
  await win.click('[data-testid="search-next"]')
  await win.click('[data-testid="search-next"]')
  await win.waitForTimeout(300)
  assert((await counter()).trim() === '1 / 6', 'wraps to 1 / 6')
  assert((await curPage()) === 0, 'wrap returns to page 1')

  // ── 결과 없음 ──
  await win.fill('[data-testid="search-input"]', 'zzzqqq')
  await win.waitForTimeout(500)
  assert((await counter()).trim() === '결과 없음', 'no-results label')

  // ── Esc → 닫힘 + 하이라이트 제거 ──
  await win.keyboard.press('Escape')
  await win.waitForTimeout(200)
  assert((await win.locator('[data-testid="search-bar"]').count()) === 0, 'Esc closes search bar')
  assert((await win.evaluate(() => document.querySelectorAll('[data-testid="search-hit"]').length)) === 0, 'highlights cleared on close')

  // ── Ctrl+F 로 다시 열기 ──
  await win.keyboard.press('Control+f')
  await win.waitForSelector('[data-testid="search-bar"]')
  assert(await win.evaluate(() => document.activeElement?.dataset.testid === 'search-input'), 'Ctrl+F opens and focuses')
  await win.screenshot({ path: path.join(OUT, 'S3-ctrl-f.png'), clip: { x: 900, y: 80, width: 700, height: 120 } })

  await app.close()
  console.log('SEARCH E2E done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
