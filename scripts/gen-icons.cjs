/**
 * 앱 아이콘·설치 브랜딩 생성기 — 사진 없이 순수 벡터 드로잉 (어느 크기에서도 안 깨짐).
 *
 * Electron(캔버스)에서 각 사이즈를 직접 렌더 → build/ 에 굽는다:
 *   icon.png(1024) · icon.ico(256~16 멀티사이즈) · installerHeader.bmp(150x57)
 *   installerSidebar.bmp / uninstallerSidebar.bmp(164x314)
 *
 * 실행: npm run build 후  node scripts/gen-icons.cjs
 */
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'))

/** 페이지 컨텍스트에서 실행되는 드로잉 코드 (문자열로 주입) */
const DRAW_SRC = String(function drawSuite() {
  const FONT = `'Segoe UI', 'Noto Sans', 'DejaVu Sans', Arial, sans-serif`

  /** 앱 아이콘: 레드 스쿼클 + 접힌 문서 + PDF 타이포 + 연필 */
  function drawIcon(ctx, s, opaque) {
    const u = s / 1024
    ctx.clearRect(0, 0, s, s)
    if (opaque) {
      // BMP 등 알파 없는 대상: 배경을 캔버스 밖까지 채우지 않고 그대로 투명→흰색 처리됨
    }
    const detail = s >= 64

    // ── 배경 스쿼클 ──
    const m = 52 * u
    const r = 225 * u
    const bg = ctx.createLinearGradient(0, m, 0, s - m)
    bg.addColorStop(0, '#f0515c')
    bg.addColorStop(1, '#b91f2e')
    ctx.beginPath()
    ctx.roundRect(m, m, s - 2 * m, s - 2 * m, r)
    ctx.fillStyle = bg
    ctx.fill()
    // 상단 하이라이트 (은은한 광)
    const hl = ctx.createLinearGradient(0, m, 0, s * 0.5)
    hl.addColorStop(0, 'rgba(255,255,255,.18)')
    hl.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.roundRect(m, m, s - 2 * m, s - 2 * m, r)
    ctx.fillStyle = hl
    ctx.fill()

    // ── 종이 (접힌 귀퉁이) ──
    const px = 268 * u
    const py = 196 * u
    const pw = 488 * u
    const ph = 632 * u
    const pr = 44 * u
    const fold = 132 * u
    ctx.save()
    ctx.shadowColor = 'rgba(90,10,16,.38)'
    ctx.shadowBlur = 56 * u
    ctx.shadowOffsetY = 26 * u
    ctx.beginPath()
    ctx.moveTo(px + pr, py)
    ctx.lineTo(px + pw - fold, py) // 접힘 시작
    ctx.lineTo(px + pw, py + fold)
    ctx.lineTo(px + pw, py + ph - pr)
    ctx.arcTo(px + pw, py + ph, px + pw - pr, py + ph, pr)
    ctx.lineTo(px + pr, py + ph)
    ctx.arcTo(px, py + ph, px, py + ph - pr, pr)
    ctx.lineTo(px, py + pr)
    ctx.arcTo(px, py, px + pr, py, pr)
    ctx.closePath()
    const paper = ctx.createLinearGradient(0, py, 0, py + ph)
    paper.addColorStop(0, '#ffffff')
    paper.addColorStop(1, '#eef1f5')
    ctx.fillStyle = paper
    ctx.fill()
    ctx.restore()
    // 접힌 삼각형
    ctx.beginPath()
    ctx.moveTo(px + pw - fold, py)
    ctx.lineTo(px + pw - fold, py + fold)
    ctx.lineTo(px + pw, py + fold)
    ctx.closePath()
    const foldG = ctx.createLinearGradient(px + pw - fold, py, px + pw, py + fold)
    foldG.addColorStop(0, '#dfe4ea')
    foldG.addColorStop(1, '#c3cad4')
    ctx.fillStyle = foldG
    ctx.fill()

    // ── PDF 타이포 ──
    ctx.fillStyle = '#d1202f'
    ctx.font = `900 ${176 * u}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('PDF', px + pw / 2, py + 300 * u)

    if (detail) {
      // 본문 줄 2개
      ctx.fillStyle = '#dfe4ea'
      ctx.beginPath()
      ctx.roundRect(px + 84 * u, py + 424 * u, 320 * u, 26 * u, 13 * u)
      ctx.roundRect(px + 84 * u, py + 476 * u, 224 * u, 26 * u, 13 * u)
      ctx.fill()
      // 연필이 그은 빨간 선 (살짝 아래로 휨)
      ctx.strokeStyle = '#e0343f'
      ctx.lineWidth = 22 * u
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px + 84 * u, py + 556 * u)
      ctx.quadraticCurveTo(px + 210 * u, py + 588 * u, px + 336 * u, py + 556 * u)
      ctx.stroke()

      // ── 연필 (선 끝에서 45도로) ──
      ctx.save()
      ctx.translate(px + 348 * u, py + 556 * u)
      ctx.rotate(-Math.PI / 4) // 몸통이 오른쪽 위로
      const bw = 92 * u // 두께
      const bl = 360 * u // 몸통 길이
      const tip = 96 * u
      ctx.shadowColor = 'rgba(90,10,16,.3)'
      ctx.shadowBlur = 24 * u
      ctx.shadowOffsetY = 10 * u
      // 나무 (깎인 부분)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(tip, -bw / 2)
      ctx.lineTo(tip, bw / 2)
      ctx.closePath()
      ctx.fillStyle = '#f2c48d'
      ctx.fill()
      ctx.shadowColor = 'transparent'
      // 흑심
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(34 * u, -bw * 0.19)
      ctx.lineTo(34 * u, bw * 0.19)
      ctx.closePath()
      ctx.fillStyle = '#3f4650'
      ctx.fill()
      // 몸통
      const body = ctx.createLinearGradient(0, -bw / 2, 0, bw / 2)
      body.addColorStop(0, '#ffc23d')
      body.addColorStop(0.5, '#f7a921')
      body.addColorStop(1, '#e08c0b')
      ctx.fillStyle = body
      ctx.fillRect(tip, -bw / 2, bl, bw)
      // 금속 밴드 + 지우개
      ctx.fillStyle = '#aab2bd'
      ctx.fillRect(tip + bl, -bw / 2, 44 * u, bw)
      ctx.beginPath()
      ctx.roundRect(tip + bl + 44 * u, -bw / 2, 70 * u, bw, [0, 24 * u, 24 * u, 0])
      ctx.fillStyle = '#f18ba7'
      ctx.fill()
      ctx.restore()
    }
  }

  /** 설치 사이드바 (164x314, 불투명) */
  function drawSidebar(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#d42a38')
    g.addColorStop(1, '#8f1d26')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 은은한 장식 원
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    ctx.beginPath()
    ctx.arc(w * 0.05, h * 0.92, 110, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(w * 0.98, h * 0.12, 80, 0, Math.PI * 2)
    ctx.fill()
    // 앱 아이콘 (미니 렌더)
    const ic = document.createElement('canvas')
    const icS = 384
    ic.width = icS
    ic.height = icS
    drawIcon(ic.getContext('2d'), icS, false)
    const iw = 104
    ctx.drawImage(ic, (w - iw) / 2, 58, iw, iw)
    // 텍스트
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 21px ${FONT}`
    ctx.fillText('PDF 편집기', w / 2, 204)
    ctx.fillStyle = 'rgba(255,255,255,.75)'
    ctx.font = `500 11.5px ${FONT}`
    ctx.fillText('오프라인 PDF 편집', w / 2, 228)
    ctx.fillStyle = 'rgba(255,255,255,.45)'
    ctx.font = `400 10px ${FONT}`
    ctx.fillText('© 2026 이성현', w / 2, h - 16)
  }

  /** 설치 헤더 (150x57, 불투명 흰 배경 + 미니 로고) */
  function drawHeader(ctx, w, h) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    const ic = document.createElement('canvas')
    const icS = 256
    ic.width = icS
    ic.height = icS
    drawIcon(ic.getContext('2d'), icS, false)
    ctx.drawImage(ic, 10, 8, 41, 41)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1f2430'
    ctx.font = `700 15px ${FONT}`
    ctx.fillText('PDF 편집기', 58, 33)
  }

  function b64FromBytes(bytes) {
    let str = ''
    for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)))
    return btoa(str)
  }

  const out = { pngs: {}, bmps: {} }
  for (const size of [1024, 256, 128, 64, 48, 32, 24, 16]) {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    drawIcon(c.getContext('2d'), size, false)
    out.pngs[size] = c.toDataURL('image/png').split(',')[1]
  }
  for (const [name, w, h, fn] of [
    ['sidebar', 164, 314, drawSidebar],
    ['header', 150, 57, drawHeader]
  ]) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    fn(ctx, w, h)
    out.bmps[name] = { w, h, rgba: b64FromBytes(ctx.getImageData(0, 0, w, h).data) }
    out.pngs[name] = c.toDataURL('image/png').split(',')[1]
  }
  return out
})

/** 24bit BMP (BGR, bottom-up, 4바이트 행 정렬) — NSIS 요구 포맷 */
function writeBmp(file, w, h, rgba) {
  const rowSize = Math.ceil((w * 3) / 4) * 4
  const dataSize = rowSize * h
  const buf = Buffer.alloc(54 + dataSize)
  buf.write('BM', 0)
  buf.writeUInt32LE(54 + dataSize, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(w, 18)
  buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(dataSize, 34)
  buf.writeInt32LE(2835, 38)
  buf.writeInt32LE(2835, 42)
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4
    const dst = 54 + y * rowSize
    for (let x = 0; x < w; x++) {
      buf[dst + x * 3] = rgba[src + x * 4 + 2]
      buf[dst + x * 3 + 1] = rgba[src + x * 4 + 1]
      buf[dst + x * 3 + 2] = rgba[src + x * 4]
    }
  }
  fs.writeFileSync(file, buf)
}

/** PNG 엔트리 방식 ICO (Vista+) */
function writeIco(file, entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  const dirs = []
  let offset = 6 + 16 * entries.length
  for (const e of entries) {
    const d = Buffer.alloc(16)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 0)
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 1)
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(e.png.length, 8)
    d.writeUInt32LE(offset, 12)
    offset += e.png.length
    dirs.push(d)
  }
  fs.writeFileSync(file, Buffer.concat([header, ...dirs, ...entries.map((e) => e.png)]))
}

async function main() {
  const app = await _electron.launch({
    executablePath: require(path.join(ROOT, 'node_modules', 'electron')),
    args: [path.join(ROOT, 'out', 'main', 'index.js'), '--no-sandbox'],
    env: { ...process.env, DISPLAY: ':0' }
  })
  const win = await app.firstWindow()
  await win.waitForSelector('text=PDF 파일 선택')
  const out = await win.evaluate(`(${DRAW_SRC})()`)
  await app.close()

  const buildDir = path.join(ROOT, 'build')
  fs.writeFileSync(path.join(buildDir, 'icon.png'), Buffer.from(out.pngs[1024], 'base64'))
  writeIco(
    path.join(buildDir, 'icon.ico'),
    [256, 128, 64, 48, 32, 24, 16].map((size) => ({ size, png: Buffer.from(out.pngs[size], 'base64') }))
  )
  const sb = out.bmps.sidebar
  writeBmp(path.join(buildDir, 'installerSidebar.bmp'), sb.w, sb.h, Buffer.from(sb.rgba, 'base64'))
  writeBmp(path.join(buildDir, 'uninstallerSidebar.bmp'), sb.w, sb.h, Buffer.from(sb.rgba, 'base64'))
  const hd = out.bmps.header
  writeBmp(path.join(buildDir, 'installerHeader.bmp'), hd.w, hd.h, Buffer.from(hd.rgba, 'base64'))
  // 미리보기용 PNG (검수 후 지워도 됨)
  fs.writeFileSync(path.join(buildDir, 'preview-256.png'), Buffer.from(out.pngs[256], 'base64'))
  fs.writeFileSync(path.join(buildDir, 'preview-sidebar.png'), Buffer.from(out.pngs.sidebar, 'base64'))
  fs.writeFileSync(path.join(buildDir, 'preview-header.png'), Buffer.from(out.pngs.header, 'base64'))
  fs.writeFileSync(path.join(buildDir, 'preview-32.png'), Buffer.from(out.pngs[32], 'base64'))
  console.log('generated: icon.png, icon.ico(7 sizes), installerHeader.bmp, installerSidebar.bmp, uninstallerSidebar.bmp')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
