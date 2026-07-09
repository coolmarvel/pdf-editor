const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.join(__dirname, '..')
const releaseDir = path.join(root, 'release')
const pkg = require(path.join(root, 'package.json'))
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const appOutDir = path.join(releaseDir, arch === 'arm64' ? 'mac-arm64' : 'mac')
const asciiApp = path.join(appOutDir, 'PDFEditor.app')
const koreanApp = path.join(appOutDir, 'PDF 편집기.app')
const stagingDir = path.join(releaseDir, 'mac-dmg-staging')
const dmgPath = path.join(releaseDir, `PDF편집기-${pkg.version}-${arch}.dmg`)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

fs.rmSync(appOutDir, { recursive: true, force: true })
fs.rmSync(stagingDir, { recursive: true, force: true })
fs.rmSync(dmgPath, { force: true })

run(process.execPath, [
  path.join(root, 'node_modules', 'electron-builder', 'cli.js'),
  '--mac',
  '--dir',
  '-c.productName=PDFEditor',
  '-c.mac.extendInfo.CFBundleDisplayName=PDF 편집기'
])

if (!fs.existsSync(asciiApp)) {
  throw new Error(`macOS app bundle was not created: ${asciiApp}`)
}

fs.rmSync(koreanApp, { recursive: true, force: true })
fs.renameSync(asciiApp, koreanApp)

// Developer ID가 아직 없으므로 로컬 배포용 ad-hoc 서명으로 깨진 내부 프레임워크 서명을 정리한다.
run('codesign', ['--force', '--deep', '--sign', '-', koreanApp])
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', koreanApp])

fs.mkdirSync(stagingDir, { recursive: true })
run('/usr/bin/ditto', [koreanApp, path.join(stagingDir, 'PDF 편집기.app')])
fs.symlinkSync('/Applications', path.join(stagingDir, 'Applications'))

run('hdiutil', [
  'create',
  '-volname',
  `PDF 편집기 ${pkg.version}`,
  '-srcfolder',
  stagingDir,
  '-ov',
  '-format',
  'UDZO',
  dmgPath
])

fs.rmSync(stagingDir, { recursive: true, force: true })
console.log(`created ${path.relative(root, dmgPath)}`)
