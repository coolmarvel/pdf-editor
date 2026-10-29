/* v1.8.0 Rust/wasm 엔진 스모크 (playwright-core + electron, `npm run build` 뒤 `xvfb-run -a node e2e/engine-smoke.cjs`)
 *
 * 문서마다: 드롭으로 열기 → 첫 페이지 캔버스에 잉크(워커·wasm 이 file:// 아래서 돈다) → 텍스트 스팬(검색) → 텍스트 추가(UI) →
 * 저장 버튼(메인 프로세스의 저장 대화상자를 경로 반환으로 바꿔 끼운다) → 저장본을 poppler 로 검사(쪽수·서체·pdftoppm 오류 없음).
 * 생성 문서에는 노트·링크·이미지→페이지(가져오기)·텍스트 수정(흰 덮기)도 얹어 엔진 쓰기 명세 전 경로를 지난다.
 * 외부 픽스처(악보·한글 매뉴얼)는 있을 때만 돈다. 결과 PDF·스크린샷은 E2E_OUT(기본 e2e/.engine/).
 */
const path = require("path");
const fs = require("fs");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = process.env.E2E_OUT ?? path.join(__dirname, ".engine");
const { _electron } = require(
  path.join(ROOT, "node_modules", "playwright-core"),
);
const { makeTextPdf } = require("./minipdf.cjs");

const SCORE =
  "/home/seonghyunlee/pdf-editor-live/docs/feedback-archive/2026-10-28-watermark-notes-lost/Goepel Feel #7 - Full Score.pdf";
const KOREAN = path.join(process.env.HOME ?? "", "VPWinGate_Manual.pdf");

let failed = false;
function check(cond, msg) {
  console.log(`${cond ? "ok  " : "FAIL"} - ${msg}`);
  if (!cond) failed = true;
}

/** 원시 바이트 + Flate 스트림(객체 스트림 포함)을 풀어 이은 latin1 문자열 — 주석 사전 검색용 */
function inflateAll(file) {
  const zlib = require("zlib");
  const buf = fs.readFileSync(file);
  const src = buf.toString("latin1");
  let out = src;
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf("endstream", start);
    if (end < 0) break;
    try {
      out += "\n" + zlib.inflateSync(buf.subarray(start, end)).toString("latin1");
    } catch {
      /* 압축이 아니거나 다른 필터 */
    }
    re.lastIndex = end;
  }
  return out;
}

function pdfInfo(file) {
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
  const fonts = execFileSync("pdffonts", [file], { encoding: "utf8" })
    .trim()
    .split("\n")
    .slice(2).length;
  const r = spawnSync(
    "pdftoppm",
    ["-r", "30", "-png", file, path.join(OUT, ".ppm-tmp")],
    { encoding: "utf8" },
  );
  for (const f of fs.readdirSync(OUT))
    if (f.startsWith(".ppm-tmp")) fs.rmSync(path.join(OUT, f));
  return { pages, fonts, ppmErr: (r.stderr ?? "").trim(), ppmStatus: r.status };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [];
  const app = await _electron.launch({
    executablePath: require(path.join(ROOT, "node_modules", "electron")),
    args: [path.join(ROOT, "out", "main", "index.js"), "--no-sandbox"],
    env: { ...process.env },
  });
  const win = await app.firstWindow();
  win.setDefaultTimeout(30000);
  win.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  win.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));

  async function setSavePath(p) {
    await app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: target,
      });
    }, p);
  }

  async function open(name, bytes) {
    await win.evaluate(() => {
      const s = window.__editor.getState();
      if (s.phase !== "landing") s.closeDocument();
    });
    await win.waitForSelector("text=PDF 파일 선택");
    await win.evaluate(
      async ([b64, fileName]) => {
        const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = new File([data], fileName, { type: "application/pdf" });
        const dt = new DataTransfer();
        dt.items.add(file);
        const label = [...document.querySelectorAll("p, span, div")].find(
          (el) => el.textContent === "또는 여기로 파일을 끌어다 놓으세요",
        );
        const ev = new DragEvent("drop", { bubbles: true, cancelable: true });
        Object.defineProperty(ev, "dataTransfer", { value: dt });
        label.dispatchEvent(ev);
      },
      [bytes.toString("base64"), name],
    );
    await win.waitForSelector("[data-page-index]");
    // 첫 페이지 래스터가 올 때까지
    await win.waitForFunction(() => {
      const c = document.querySelector("[data-page-index] > canvas");
      return c && c.width > 0;
    });
    await win.waitForTimeout(800);
  }

  const ink = () =>
    win.evaluate(() => {
      const c = document.querySelector("[data-page-index] > canvas");
      if (!c || !c.width) return -1;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++;
      return n / (c.width * c.height);
    });

  const searchCount = (q) =>
    win.evaluate(async (query) => {
      const s = window.__editor.getState();
      await s.setSearchQuery(query);
      const n = window.__editor.getState().search.matches.length;
      await window.__editor.getState().setSearchQuery("");
      return n;
    }, q);

  async function addTextViaUi(text) {
    await win.click('button:has-text("텍스트 추가")');
    const box = await win.locator("[data-page-index]").first().boundingBox();
    await win.mouse.click(
      box.x + box.width * 0.5,
      box.y + Math.min(box.height * 0.5, 300),
    );
    await win.waitForTimeout(300);
    await win.keyboard.type(text);
    await win.mouse.click(box.x + box.width * 0.05, box.y + 10);
    await win.waitForTimeout(300);
    await win.keyboard.press("Escape");
  }

  const objectCount = () =>
    win.evaluate(() =>
      Object.values(window.__editor.getState().objectsByPage).reduce(
        (n, l) => n + l.length,
        0,
      ),
    );
  const pageCount = () =>
    win.evaluate(() => window.__editor.getState().pages.length);

  async function save(file) {
    if (fs.existsSync(file)) fs.rmSync(file);
    await setSavePath(file);
    await win.click('[aria-label="PDF로 저장"] button');
    const t0 = Date.now();
    while (!fs.existsSync(file) && Date.now() - t0 < 60000)
      await new Promise((r) => setTimeout(r, 200));
    await new Promise((r) => setTimeout(r, 500));
    return fs.existsSync(file);
  }

  // ── 1) 생성 문서(Helvetica 비내장 3쪽) ──
  const sample = makeTextPdf(
    [1, 2, 3].map((n) => ({
      w: 595,
      h: 842,
      texts: [
        { x: 60, y: 760, size: 24, text: `Sample page ${n}` },
        {
          x: 60,
          y: 700,
          size: 18,
          text: "An orange tree and an orange fruit.",
        },
      ],
    })),
  );
  await open("sample.pdf", sample);
  // 렌더러는 엔진 하나뿐이라(워커 리소스는 창의 performance 항목에 안 잡힌다) 첫 페이지 잉크가 곧 "wasm 이 file:// 아래서 돈다" 의 증거
  check((await pageCount()) === 3, "sample: 3 pages");
  const ink1 = await ink();
  check(ink1 > 0.001, `sample: page 1 canvas has ink (${ink1.toFixed(4)})`);
  check(
    (await searchCount("orange")) === 6,
    'sample: engine text spans → search "orange" finds 6',
  );
  await addTextViaUi("engine smoke");
  // 노트·링크·텍스트 수정(흰 덮기 + 새 글자) — 엔진 links/notes/overlay 경로
  await win.evaluate(() => {
    const s = window.__editor.getState();
    const p0 = s.pages[0].id;
    s.addObject(p0, {
      id: "n1",
      type: "note",
      x: 0.8,
      y: 0.1,
      color: "#ffd400",
      text: "메모 한글 note",
    });
    s.addObject(p0, {
      id: "l1",
      type: "link",
      rect: { x: 0.1, y: 0.05, w: 0.3, h: 0.04 },
      target: { kind: "url", url: "example.com" },
    });
    s.addObject(p0, {
      id: "e1",
      type: "editText",
      cover: { x: 0.09, y: 0.06, w: 0.36, h: 0.045 },
      box: { x: 0.09, y: 0.06, w: 0.36, h: 0.045 },
      text: "Edited page 1",
      origText: "Sample page 1",
      size: 24 / 842,
      color: "#1f2329",
      font: "Helvetica",
      bold: false,
      italic: false,
      opacity: 1,
    });
    // 형광펜(multiply) — 저장 시 페이지 래스터를 백드롭으로 까는 혼합 모드 경로
    s.addObject(s.pages[1].id, {
      id: "h1",
      type: "stroke",
      kind: "highlight",
      color: "#ffd400",
      width: 0.03,
      points: [
        [0.1, 0.17],
        [0.6, 0.17],
      ],
    });
    s.addObject(s.pages[1].id, {
      id: "l2",
      type: "link",
      rect: { x: 0.1, y: 0.05, w: 0.3, h: 0.04 },
      target: { kind: "page", page: 3 },
    });
  });
  // 이미지 → 페이지(엔진 build_document + under) — 캔버스로 PNG 를 만들어 끝에 붙인다
  await win.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 200;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#d42f37";
    ctx.fillRect(0, 0, 400, 200);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    await window.__editor
      .getState()
      .pageImportImages([new File([blob], "red.png", { type: "image/png" })]);
  });
  await win.waitForTimeout(800);
  check((await pageCount()) === 4, "sample: image import adds a 4th page");
  const objs = await objectCount();
  check(objs >= 4, `sample: objects on pages (${objs})`);
  // 회전 1쪽: 엔진 rotation 명세
  await win.evaluate(() => {
    const s = window.__editor.getState();
    s.pageRotate(new Set([s.pages[2].id]), 90);
  });
  await win.waitForTimeout(500);
  await win.screenshot({ path: path.join(OUT, "01-sample-editor.png") });
  const sampleOut = path.join(OUT, "sample-saved.pdf");
  check(await save(sampleOut), "sample: saved via save button");
  if (fs.existsSync(sampleOut)) {
    const info = pdfInfo(sampleOut);
    check(info.pages === 4, `sample saved: 4 pages (${info.pages})`);
    check(
      info.ppmStatus === 0 && info.ppmErr === "",
      `sample saved: pdftoppm clean ${info.ppmErr ? `(${info.ppmErr.slice(0, 200)})` : ""}`,
    );
    const txt = execFileSync("pdftotext", ["-l", "1", sampleOut, "-"], {
      encoding: "utf8",
    });
    check(
      /orange tree/.test(txt),
      "sample saved: original text kept as text (vector)",
    );
    const p3 = execFileSync("pdfinfo", ["-f", "3", "-l", "3", sampleOut], {
      encoding: "utf8",
    });
    const m3 = /Page\s+3 size:\s+([\d.]+) x ([\d.]+)/.exec(p3);
    const rot3 = /Page\s+3 rot:\s+(\d+)/.exec(p3)?.[1];
    console.log(`   page 3 size ${m3?.[1]}x${m3?.[2]} rot ${rot3}; saved size ${fs.statSync(sampleOut).size} bytes`);
    check(
      !!m3 &&
        ((Number(m3[1]) > Number(m3[2]) && rot3 === "0") ||
          (Number(m3[1]) < Number(m3[2]) && rot3 === "90")),
      "sample saved: rotated page 3 is landscape",
    );
    const raw = inflateAll(sampleOut);
    check(/\/Subtype\s*\/Link/.test(raw), "sample saved: link annotation present");
    check(/\/URI\s*\(https:\/\/example\.com/.test(raw), "sample saved: URL link gets https://");
    check(/\/Subtype\s*\/Text/.test(raw), "sample saved: note annotation present");
  }

  // ── 2) 악보(내장 CID TrueType 6종) ──
  if (fs.existsSync(SCORE)) {
    await open("score.pdf", fs.readFileSync(SCORE));
    const n = await pageCount();
    const inkS = await ink();
    check(inkS > 0.001, `score: page 1 canvas has ink (${inkS.toFixed(4)})`);
    await addTextViaUi("score note");
    check((await objectCount()) >= 1, "score: text object added");
    await win.screenshot({ path: path.join(OUT, "02-score-editor.png") });
    const out = path.join(OUT, "score-saved.pdf");
    check(await save(out), "score: saved");
    if (fs.existsSync(out)) {
      const src = pdfInfo(SCORE);
      const info = pdfInfo(out);
      console.log(
        `   score: src pages ${src.pages} fonts ${src.fonts} · saved pages ${info.pages} fonts ${info.fonts} size ${fs.statSync(out).size}`,
      );
      check(
        info.pages === n && n === src.pages,
        `score saved: page count ${info.pages} = ${src.pages}`,
      );
      check(
        info.fonts >= 6,
        `score saved: pdffonts lists ${info.fonts} fonts (>= 6)`,
      );
      check(
        info.ppmStatus === 0 && info.ppmErr === "",
        `score saved: pdftoppm clean ${info.ppmErr ? `(${info.ppmErr.slice(0, 300)})` : ""}`,
      );
    }
  } else console.log("skip - score fixture missing");

  // ── 3) 한글 매뉴얼(30쪽, 내장 서브셋) ──
  if (fs.existsSync(KOREAN)) {
    await open("manual.pdf", fs.readFileSync(KOREAN));
    const n = await pageCount();
    check(n === 30, `korean: 30 pages (${n})`);
    const inkK = await ink();
    check(inkK > 0.001, `korean: page 1 canvas has ink (${inkK.toFixed(4)})`);
    const hits = await searchCount("소프트웨어");
    check(hits > 0, `korean: engine spans → search "소프트웨어" finds ${hits}`);
    await addTextViaUi("한글 추가");
    await win.screenshot({ path: path.join(OUT, "03-korean-editor.png") });
    const out = path.join(OUT, "korean-saved.pdf");
    check(await save(out), "korean: saved");
    if (fs.existsSync(out)) {
      const info = pdfInfo(out);
      const srcSize = fs.statSync(KOREAN).size;
      const size = fs.statSync(out).size;
      console.log(
        `   korean: saved pages ${info.pages} fonts ${info.fonts} size ${size} (src ${srcSize})`,
      );
      check(info.pages === 30, "korean saved: 30 pages");
      check(
        info.ppmStatus === 0 && info.ppmErr === "",
        `korean saved: pdftoppm clean ${info.ppmErr ? `(${info.ppmErr.slice(0, 300)})` : ""}`,
      );
      check(size < srcSize * 3, "korean saved: size not blown up (< 3x)");
      const txt = execFileSync("pdftotext", ["-l", "1", out, "-"], {
        encoding: "utf8",
      });
      check(/소프트웨어/.test(txt), "korean saved: original Korean text kept");
    }
  } else console.log("skip - korean fixture missing");

  await app.close();
  const relevant = errors.filter((e) => !/Autofill|DevTools/.test(e));
  if (relevant.length) console.log("console errors:\n" + relevant.join("\n"));
  check(relevant.length === 0, `no console errors (${relevant.length})`);
  console.log(failed ? "engine-smoke FAILED" : "engine-smoke done");
  if (failed) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
