# pdf-engine (vendored wasm-pack output)

이 폴더는 **생성물 사본**이다. 손으로 고치지 않는다.

- 출처: 모노레포 `~/pdf-editor-live/packages/engine` (Rust 크레이트 `pdf-engine` 0.1.0, hayro + lopdf, wasm-bindgen) 의 `pkg/`.
  ADR 은 그 저장소 `docs/adr/0003-rust-wasm-engine.md`, 동작 설명은 `docs/guides/engine.md`.
- 현재 사본: 2026-10-29, 엔진 소스 커밋 `f93bc87`(문서 수준 항목 이월 포함) 빌드본, `pdf_engine_bg.wasm` sha256 `0b4da835a89ba10443ef1ffc5e2f8775787f116dbdd3273c67b2d8c0f771a95d`. (처음 복사는 같은 날 `546d6ab` 빌드본)
- 담은 파일: `pdf_engine.js`(JS 글루) · `pdf_engine_bg.wasm` · `pdf_engine.d.ts` · `pdf_engine_bg.wasm.d.ts` · `package.json`.

## 새로 고치는 법

```bash
# 모노레포에서 엔진을 빌드(Rust stable + wasm32-unknown-unknown + wasm-pack)
cd ~/pdf-editor-live && npm run build:engine
# 산출물을 이 폴더로 복사 (README 는 남긴다)
cp ~/pdf-editor-live/packages/engine/pkg/{pdf_engine.js,pdf_engine.d.ts,pdf_engine_bg.wasm,pdf_engine_bg.wasm.d.ts,package.json} \
   ~/pdf-editor/src/renderer/src/engine/pkg/
sha256sum ~/pdf-editor/src/renderer/src/engine/pkg/pdf_engine_bg.wasm   # 위 기록을 갱신
```

복사 뒤 `npm run typecheck && npm test && npm run build && node e2e/engine-smoke.cjs` 로 확인한다.
JS 쪽이 쓰는 함수는 `../worker.ts` 의 `ops` 표에 모여 있다 — 엔진 표면(`pdf_engine.d.ts`)이 바뀌면 거기와 `../types.ts` 를 맞춘다.
