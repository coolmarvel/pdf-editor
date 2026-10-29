/**
 * e2e 픽스처용 최소 PDF 작성기(Node, 의존성 없음) — 페이지마다 Helvetica(표준 14, 비내장) 텍스트 줄을 적는다.
 * 앱이 Rust 엔진만 쓰게 된 v1.8.0 에서 JS PDF 라이브러리 의존을 지우면서 직접 바이트를 쓰는 것으로 바꿨다.
 *
 * makeTextPdf([{ w, h, texts: [{ x, y, size, text }] }]) → Buffer. 좌표는 PDF 공간(pt, 왼쪽 아래 원점, y 는 기준선).
 */
function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function makeTextPdf(pages) {
  const objs = [] // index = 객체 번호 - 1
  const add = (body) => {
    objs.push(body)
    return objs.length
  }
  const catalog = add(null)
  const pagesObj = add(null)
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const kids = []
  for (const p of pages) {
    const ops = (p.texts ?? []).map((t) => `BT /F1 ${t.size} Tf ${t.x} ${t.y} Td (${esc(t.text)}) Tj ET`).join('\n')
    const content = add(`<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`)
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${p.w ?? 595} ${p.h ?? 842}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`))
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

module.exports = { makeTextPdf }
