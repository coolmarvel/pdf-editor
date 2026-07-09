/* PDF 편집기 E2E 시각 검증 (playwright-core + electron) */
const path = require('path')
const fs = require('fs')

const ROOT = '/home/jace/pdf-editor'
const OUT = process.env.E2E_OUT ?? __dirname
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'))
const { PDFDocument, StandardFonts } = require(path.join(ROOT, 'node_modules', 'pdf-lib'))

async function makePdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 2; i++) {
    const p = doc.addPage([595, 842])
    p.drawText(`Sample page ${i + 1}`, { x: 60, y: 760, size: 24, font })
  }
  return Buffer.from(await doc.save())
}

async function main() {
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
  await win.waitForTimeout(1200) // 렌더 안정화
  await win.screenshot({ path: path.join(OUT, '01-editor.png') })

  // ── 텍스트 추가: 도구 클릭 → 페이지 클릭 → 타이핑 ──
  await win.click('button:has-text("텍스트 추가")')
  const page1 = win.locator('[data-page-index]').first()
  const box = await page1.boundingBox()
  const cx = box.x + box.width * 0.5
  const cy = box.y + box.height * 0.55
  await win.mouse.click(cx, cy)
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '02-empty-input.png') })
  await win.keyboard.type('test')
  await win.waitForTimeout(200)
  await win.screenshot({ path: path.join(OUT, '03-typed.png') })

  // 커밋(빈 곳 클릭) → 선택 해제(한 번 더 빈 곳) → 한 번 클릭 = 선택(핸들)
  // (선택된 상태에서 또 클릭하면 캐럿 편집으로 들어가므로)
  await win.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.15)
  await win.waitForTimeout(250)
  await win.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.15)
  await win.waitForTimeout(250)
  await win.mouse.click(cx + 20, cy + 8)
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '04-selected.png') })
  // 선택 상태 클로즈업
  await win.screenshot({ path: path.join(OUT, '04b-selected-zoom.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 240 } })

  // ── 서브툴바 확인 ──
  await win.screenshot({ path: path.join(OUT, '05-subtoolbar.png'), clip: { x: 0, y: 0, width: 1280, height: 180 } })

  // ── 중앙 정렬 픽셀 측정: 오버레이 캔버스의 잉크 bbox vs 선택 외곽선 rect ──
  const gaps = await win.evaluate(() => {
    const outline = document.querySelector('[data-testid="sel-outline"]')
    if (!outline) return { error: 'no outline' }
    const o = outline.getBoundingClientRect()
    const pageEl = document.querySelectorAll('[data-page-index]')[0]
    const overlay = pageEl.querySelectorAll('canvas')[1]
    const r = overlay.getBoundingClientRect()
    const ctx = overlay.getContext('2d')
    const img = ctx.getImageData(0, 0, overlay.width, overlay.height)
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
    for (let y = 0; y < overlay.height; y++)
      for (let x = 0; x < overlay.width; x++) {
        if (img.data[(y * overlay.width + x) * 4 + 3] > 20) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    if (maxX < 0) return { error: 'no ink' }
    const sx = r.width / overlay.width
    const sy = r.height / overlay.height
    const ink = { left: r.left + minX * sx, right: r.left + (maxX + 1) * sx, top: r.top + minY * sy, bottom: r.top + (maxY + 1) * sy }
    return {
      gapL: +(ink.left - o.left).toFixed(1),
      gapR: +(o.right - ink.right).toFixed(1),
      gapT: +(ink.top - o.top).toFixed(1),
      gapB: +(o.bottom - ink.bottom).toFixed(1)
    }
  })
  console.log('centering gaps(px):', JSON.stringify(gaps))

  // ── Ctrl+Z 언두: 텍스트가 사라져야 함 ──
  await win.keyboard.press('Escape')
  await win.waitForTimeout(150)
  await win.keyboard.press('Control+z')
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, '06-after-undo.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 240 } })
  // 리두 후 되돌리기
  await win.keyboard.press('Control+y')
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, '07-after-redo.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 240 } })
  await win.screenshot({ path: path.join(OUT, '07-full.png') })
  const pagePos = await win.evaluate(() => {
    const r = document.querySelectorAll('[data-page-index]')[0].getBoundingClientRect()
    return { top: +r.top.toFixed(1), left: +r.left.toFixed(1), h: +r.height.toFixed(1) }
  })
  console.log('page rect after redo:', JSON.stringify(pagePos))

  // ── 세로 정렬: s 핸들로 박스를 아래로 60px 늘리고 → 세로 가운데 정렬 ──
  await win.mouse.click(cx + 20, cy + 8) // 텍스트 재선택
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, '07b-reselect.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 280 } })
  const o1 = await win.locator('[data-testid="sel-outline"]').boundingBox()
  const sX = o1.x + o1.width / 2
  const sY = o1.y + o1.height // s 핸들(하단 중앙 점)
  await win.mouse.move(sX, sY)
  await win.mouse.down()
  await win.mouse.move(sX, sY + 60, { steps: 8 })
  await win.mouse.up()
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '08-taller-box.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 280 } })
  await win.click('[data-testid="VerticalAlignCenterRoundedIcon"]')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '09-vcenter.png'), clip: { x: cx - 160, y: cy - 110, width: 340, height: 280 } })
  const gaps2 = await win.evaluate(() => {
    const o = document.querySelector('[data-testid="sel-outline"]').getBoundingClientRect()
    const pageEl = document.querySelectorAll('[data-page-index]')[0]
    const overlay = pageEl.querySelectorAll('canvas')[1]
    const r = overlay.getBoundingClientRect()
    const ctx = overlay.getContext('2d')
    const img = ctx.getImageData(0, 0, overlay.width, overlay.height)
    let minY = Infinity, maxY = -1
    for (let y = 0; y < overlay.height; y++)
      for (let x = 0; x < overlay.width; x++)
        if (img.data[(y * overlay.width + x) * 4 + 3] > 20) {
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
    const sy = r.height / overlay.height
    return { gapT: +(r.top + minY * sy - o.top).toFixed(1), gapB: +(o.bottom - (r.top + (maxY + 1) * sy)).toFixed(1) }
  })
  console.log('valign-middle gaps(px):', JSON.stringify(gaps2))

  // ══ 텍스트 수정 (Guru 흐름: 호버 포인터 → 클릭=캐럿 / 드래그=이동) ══
  const pb = await win.locator('[data-page-index]').first().boundingBox()
  // 샘플 PDF의 "Sample page 1": pt(60,760) size24 → 대략 x 0.17, y 0.086
  const tx = pb.x + pb.width * 0.17
  const ty = pb.y + pb.height * 0.086
  const curAt = async () => win.evaluate(() => getComputedStyle(document.querySelectorAll('[data-page-index]')[0].querySelector('[data-testid="interaction-layer"]')).cursor)

  await win.click('button:has-text("텍스트 수정")')
  await win.waitForTimeout(800) // 스팬 추출 대기
  await win.mouse.move(tx, ty)
  await win.waitForTimeout(150)
  console.log('editText hover cursor:', await curAt()) // pointer 기대
  await win.mouse.click(tx, ty) // 클릭 → 캐럿 편집 진입
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '10-edittext-caret.png'), clip: { x: pb.x, y: pb.y, width: 500, height: 140 } })
  const caretInfo = await win.evaluate(() => {
    const ta = document.querySelector('textarea')
    return ta ? { value: ta.value, caret: ta.selectionStart, focused: document.activeElement === ta } : null
  })
  console.log('caret editing:', JSON.stringify(caretInfo))
  await win.keyboard.press('Escape')
  await win.waitForTimeout(200)

  // 드래그로 위치 이동
  await win.mouse.move(tx, ty)
  await win.waitForTimeout(100)
  console.log('select hover cursor:', await curAt()) // pointer 기대
  await win.mouse.down()
  await win.waitForTimeout(80)
  console.log('mid-drag cursor:', await curAt()) // move 기대
  await win.mouse.move(tx + 120, ty + 60, { steps: 10 })
  await win.mouse.up()
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '11-edittext-moved.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 240 } })

  // 이동한 텍스트를 다시 클릭 → 캐럿 편집 중에도 원본 자리는 계속 가려져 있어야 한다
  await win.mouse.click(tx + 120, ty + 60)
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '12-edit-after-move.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 240 } })
  await win.keyboard.press('Escape')
  await win.waitForTimeout(200)

  // ══ 세션 종료: 변경 있음 → 저장 확인 다이얼로그, "저장 안 함" → 원복 ══
  const dialogOpen = () => win.evaluate(() => !!document.querySelector('.MuiDialog-root'))
  await win.click('button:has-text("텍스트 수정")') // 토글 오프 시도
  await win.waitForTimeout(400)
  console.log('exit dialog shown (dirty):', await dialogOpen())
  await win.screenshot({ path: path.join(OUT, '13-exit-prompt.png') })
  await win.click('button:has-text("저장 안 함")')
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, '14-discarded.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 240 } })

  // ══ 변경 없이 켰다 끄면 다이얼로그 없이 종료 ══
  await win.click('button:has-text("텍스트 수정")')
  await win.waitForTimeout(300)
  await win.click('button:has-text("텍스트 수정")')
  await win.waitForTimeout(300)
  console.log('exit dialog shown (clean):', await dialogOpen())

  // ══ 삭제 확인 흐름: 스팬 클릭 → Delete → 확인 → 글자 지워짐 ══
  await win.click('button:has-text("텍스트 수정")')
  await win.waitForTimeout(800)
  await win.mouse.click(tx, ty)
  await win.waitForTimeout(300)
  await win.keyboard.press('Escape')
  await win.waitForTimeout(150)
  await win.keyboard.press('Delete')
  await win.waitForTimeout(300)
  console.log('delete dialog shown:', await dialogOpen())
  await win.screenshot({ path: path.join(OUT, '15-delete-prompt.png') })
  await win.click('button:has-text("지우기")')
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '16-deleted.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 240 } })
  // 저장하고 종료 → 히스토리 한 단계 → Ctrl+Z 로 복원 가능해야 한다
  await win.click('button:has-text("텍스트 수정")')
  await win.waitForTimeout(300)
  await win.click('button:has-text("저장")')
  await win.waitForTimeout(300)
  await win.keyboard.press('Control+z')
  await win.waitForTimeout(400)
  await win.screenshot({ path: path.join(OUT, '17-undo-after-save.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 240 } })

  // ══ 지우개(도형 덮기) + 그리기 지우개 커서 ══
  // 연필로 낙서 → eraseDrawing 커서가 빈 원으로 바뀌는지
  await win.click('button:has-text("연필")')
  await win.waitForTimeout(200)
  await win.mouse.move(pb.x + pb.width * 0.4, pb.y + pb.height * 0.3)
  await win.mouse.down()
  await win.mouse.move(pb.x + pb.width * 0.55, pb.y + pb.height * 0.35, { steps: 8 })
  await win.mouse.up()
  await win.waitForTimeout(200)
  await win.click('button:has-text("지우개")')
  await win.waitForTimeout(300)
  await win.click('li:has-text("그리기 지우개")')
  await win.waitForTimeout(500) // MUI 메뉴 백드롭이 닫힐 때까지 (포인터 삼킴 방지)
  const eraseCur = await curAt()
  console.log('eraseDrawing cursor has circle svg:', eraseCur.includes('image-set') || eraseCur.includes('svg'))
  // ① 가운데만 문지르기 → 선이 두 토막으로 쪼개지고(부분 지우기) 커서는 여전히 원
  await win.mouse.move(pb.x + pb.width * 0.47, pb.y + pb.height * 0.322)
  await win.waitForTimeout(100)
  await win.mouse.down()
  await win.mouse.move(pb.x + pb.width * 0.485, pb.y + pb.height * 0.328, { steps: 4 })
  await win.mouse.up()
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '20-partial-erase.png'), clip: { x: pb.x + pb.width * 0.3, y: pb.y + pb.height * 0.22, width: 320, height: 150 } })
  console.log('cursor after partial erase still circle:', (await curAt()).includes('image-set'))
  // ② 전체 문지르기 → 남은 조각까지 다 지우면 기본 커서
  await win.mouse.move(pb.x + pb.width * 0.39, pb.y + pb.height * 0.295)
  await win.mouse.down()
  await win.mouse.move(pb.x + pb.width * 0.57, pb.y + pb.height * 0.365, { steps: 25 })
  await win.mouse.up()
  await win.waitForTimeout(300)
  const curAfter = await curAt()
  console.log('cursor after erase-all is default:', curAfter === 'default')

  // 지우개(도형 덮기): "Sample page 1" 위를 드래그 → 흰 사각형으로 덮임
  await win.mouse.click(pb.x + pb.width * 0.8, pb.y + pb.height * 0.8) // 잔여 상태 정리
  await win.waitForTimeout(200)
  await win.click('button:has-text("지우개")')
  await win.waitForTimeout(300)
  await win.click('li:has-text("지우개")') // 첫 항목 = 도형 덮기 지우개
  await win.waitForTimeout(500)
  await win.mouse.move(pb.x + pb.width * 0.08, pb.y + pb.height * 0.06)
  await win.waitForTimeout(100)
  await win.mouse.down()
  await win.waitForTimeout(80)
  await win.mouse.move(pb.x + pb.width * 0.45, pb.y + pb.height * 0.12, { steps: 15 })
  await win.waitForTimeout(80)
  await win.mouse.up()
  await win.waitForTimeout(300)
  await win.screenshot({ path: path.join(OUT, '18-eraser-covered.png'), clip: { x: pb.x, y: pb.y, width: 600, height: 200 } })
  await win.screenshot({ path: path.join(OUT, '19-eraser-subtoolbar.png'), clip: { x: 0, y: 100, width: 1100, height: 70 } })

  await app.close()
  console.log('E2E done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
