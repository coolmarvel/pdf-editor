---
title: TODO
created: 2026-07-08
updated: 2026-07-09
domain: development
---

# TODO (미해결·향후 작업만 — 완료분은 session-log로)

## P1 — 다음 릴리스에서 다뤄야 함

- [ ] **사용자 v1.4.8 설치 테스트** — macOS DMG(Applications 설치/실행) 및 Sign 다이얼로그 실물 확인.
      이어서 1.4.x 후보:
      Search / 워터마크 / Document Crop / Annotations 아이콘 세트
- [ ] v1.4.8 DMG 생성 재시도 — 코드/앱 번들/서명 검증은 통과했으나 현재 세션에서 `hdiutil` 장치 접근 제한으로
      `PDF편집기-1.4.8-arm64.dmg` 생성과 Desktop 복사가 막힘
- [ ] macOS Developer ID 인증서 발급 후 정식 codesign + notarization 적용
- [ ] 저장 서명 영속화 검토 — 현재는 앱 세션 중에만 유지
- [ ] 혼합 모드 저장 결과 실물 검증 — Adobe/크롬 뷰어에서 화면과 동일한지 (백드롭 래스터 조각 방식)
- [ ] 지우개 도형 종류 확장 검토 (Guru: Line/Arrow/Polygon/Polyline — 현재 사각형/원)
- [ ] 테두리 선 스타일에 물결(scalloped/wavy) 추가 검토 (Guru 지원, 현재 실선/점선/파선)
- [ ] Edit Text 정밀도 개선: 스팬 병합(줄 단위), 원본 폰트 크기/색 추정, 회전 페이지에서 검증
- [ ] 저장 결과 실물 검증: 링크/노트 주석이 Adobe·크롬 뷰어에서 열리는지, 회전 평탄화 4방향 확인, **회전 텍스트 저장 확인**

## P2 — 가까운 로드맵 (PDF Guru 파리티 잔여)

- [ ] 상단바 **Search**(문서 내 텍스트 검색·하이라이트)
- [ ] **More tools**: Document Crop, 줌 메뉴
- [ ] Page layout: 페이지 모드(단면/양면)·전환 옵션 (현재 회전만 구현)
- [ ] **워터마크** 도구 이식 (file-converter의 `watermark/model.ts` 재사용)
- [ ] Annotations 아이콘 세트(화살표·별 등 pdfguru의 2열 아이콘) — 현재 말풍선 1종
- [ ] Manage Pages: 드래그로 순서 변경(현재 앞/뒤 버튼), "Move" 대상 지정 이동
- [ ] 페이지 썸네일 사이에 + 버튼(해당 위치에 빈 페이지 삽입)

## P3 — 품질

- [ ] 대용량 PDF(100p+) 성능: 썸네일 지연 렌더·페이지 캔버스 해제
- [ ] 텍스트 객체 회전 시 글자 크기 보정(현재 좌표만 회전, 크기는 근사)
- [ ] 회전 텍스트: aspect 왜곡 보정 — 표시 px 공간 각도를 정규화 공간에 저장하므로 페이지 90° 회전 시 비정방형 페이지에서 각도가 근사임(rotateObjectCW가 +90 단순 누적)
- [ ] 저장 시 진행률 표시(페이지 많으면 오래 걸림)

## P4 — 아이디어

- [ ] 자동 저장/복구(임시 세션 파일)
- [ ] 다국어(영어) UI
- [ ] PDF 병합·분할 전용 화면 (Tools 메뉴)
