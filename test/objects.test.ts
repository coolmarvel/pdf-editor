import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rotateRectCW,
  rotatePointCW,
  rotateObjectCW,
  hitTest,
  textBoxRect,
  objectRect,
  setObjectRect,
  unrotatePoint,
  NOTE_HIT_SIZE,
  newId,
  type NoteObj,
  type ShapeObj,
  type StrokeObj,
  type TextObj
} from '../src/core/objects'

function makeText(over: Partial<TextObj> = {}): TextObj {
  return {
    id: newId(),
    type: 'text',
    x: 0.4,
    y: 0.4,
    w: 0.2,
    h: 0,
    text: 'hello',
    size: 0.02,
    color: '#111',
    bgColor: null,
    font: 'Helvetica',
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    valign: 'top',
    rotation: 0,
    opacity: 1,
    ...over
  }
}

test('rotatePointCW: (x,y) → (1-y, x)', () => {
  assert.deepEqual(rotatePointCW([0, 0]), [1, 0]) // 좌상단 → 우상단
  assert.deepEqual(rotatePointCW([1, 0]), [1, 1]) // 우상단 → 우하단
})

test('rotateRectCW: 좌상단 rect 보존', () => {
  const r = rotateRectCW({ x: 0, y: 0, w: 0.5, h: 0.2 })
  assert.deepEqual(r, { x: 0.8, y: 0, w: 0.2, h: 0.5 })
})

test('rotateObjectCW: stroke 점 변환', () => {
  const s: StrokeObj = {
    id: newId(),
    type: 'stroke',
    kind: 'pencil',
    color: '#000',
    width: 0.005,
    opacity: 1,
    points: [
      [0, 0],
      [0.5, 0.5]
    ]
  }
  const out = rotateObjectCW(s) as StrokeObj
  assert.deepEqual(out.points[0], [1, 0])
  assert.deepEqual(out.points[1], [0.5, 0.5])
})

test('hitTest: shape rect 안팎', () => {
  const sh: ShapeObj = {
    id: newId(),
    type: 'shape',
    kind: 'rect',
    rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.1 },
    stroke: '#f00',
    strokeWidth: 0.004,
    fill: null,
    opacity: 1
  }
  assert.ok(hitTest(sh, 0.3, 0.25, 0.01))
  assert.ok(!hitTest(sh, 0.8, 0.8, 0.01))
})

test('textBoxRect: 줄 수 반영', () => {
  const one = textBoxRect(makeText())
  const three = textBoxRect(makeText({ text: 'a\nb\nc' }))
  assert.ok(three.h > one.h * 2.5)
  assert.equal(one.w, 0.2)
})

test('textBoxRect: 명시 높이(h)는 내용 높이 이상으로 존중', () => {
  const tall = textBoxRect(makeText({ h: 0.3 }))
  assert.equal(tall.h, 0.3)
  const clamped = textBoxRect(makeText({ h: 0.01, text: 'a\nb\nc' })) // 내용(3줄)보다 작은 h
  assert.ok(Math.abs(clamped.h - 0.02 * 1.25 * 3) < 1e-9)
})

test('hitTest: 회전 없는 텍스트 상자 안팎', () => {
  const t = makeText()
  assert.ok(hitTest(t, 0.45, 0.41, 0.005))
  assert.ok(!hitTest(t, 0.45, 0.6, 0.005))
})

test('hitTest: 90도 회전 텍스트 — 상자가 세로로 선다 (aspect=1)', () => {
  const t = makeText({ rotation: 90 })
  const r = textBoxRect(t) // 중심 (0.5, 0.4+h/2)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  // 회전 후에는 중심 기준 세로 방향 ±w/2 안이 히트
  assert.ok(hitTest(t, cx, cy + r.w * 0.4, 0.005))
  assert.ok(hitTest(t, cx, cy - r.w * 0.4, 0.005))
  // 원래 가로 방향 끝은 이제 빗나감
  assert.ok(!hitTest(t, r.x + 0.002, r.y + 0.002, 0.001))
})

test('rotateObjectCW: 텍스트 rotation 이 90도 누적', () => {
  const t = makeText({ rotation: 300 })
  const out = rotateObjectCW(t) as TextObj
  assert.equal(out.rotation, 30)
})

test('objectRect/setObjectRect: 종류별 상자 왕복', () => {
  const t = makeText({ w: 0.2, h: 0.1 })
  assert.deepEqual(objectRect(t), textBoxRect(t))
  assert.deepEqual(setObjectRect(t, { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }), { x: 0.1, y: 0.2, w: 0.3, h: 0.4 })

  const sh: ShapeObj = {
    id: newId(),
    type: 'shape',
    kind: 'rect',
    rect: { x: 0.2, y: 0.2, w: 0.2, h: 0.1 },
    stroke: '#f00',
    strokeWidth: 0.004,
    fill: null,
    opacity: 1
  }
  assert.equal(objectRect(sh), sh.rect)
  assert.deepEqual(setObjectRect(sh, { x: 0, y: 0, w: 1, h: 1 }), { rect: { x: 0, y: 0, w: 1, h: 1 } })

  const n: NoteObj = { id: newId(), type: 'note', x: 0.5, y: 0.6, color: '#ff0', text: '', opacity: 1 }
  assert.deepEqual(objectRect(n), { x: 0.5, y: 0.6, w: NOTE_HIT_SIZE, h: NOTE_HIT_SIZE })
  // 노트는 위치만 옮기고 크기는 고정
  assert.deepEqual(setObjectRect(n, { x: 0.1, y: 0.2, w: 0.5, h: 0.5 }), { x: 0.1, y: 0.2 })

  const s: StrokeObj = { id: newId(), type: 'stroke', kind: 'pencil', color: '#000', width: 0.01, opacity: 1, points: [[0, 0]] }
  assert.equal(objectRect(s), null)
  assert.deepEqual(setObjectRect(s, { x: 0, y: 0, w: 1, h: 1 }), {})
})

test('unrotatePoint: 0도는 항등, 90도는 중심 기준 역회전 (aspect 보정)', () => {
  assert.deepEqual(unrotatePoint(0.3, 0.7, 0.5, 0.5, 0, 2), [0.3, 0.7])
  // aspect=1: 중심 (0.5,0.5) 기준 시계 90도 회전된 상자에서 중심 아래 점 (0.5, 0.6) 은 회전 전 오른쪽 (0.6, 0.5)
  const [ux, uy] = unrotatePoint(0.5, 0.6, 0.5, 0.5, 90, 1)
  assert.ok(Math.abs(ux - 0.6) < 1e-9 && Math.abs(uy - 0.5) < 1e-9)
  // aspect=2 (가로가 긴 페이지): px 공간의 x 거리 0.1 은 정규화 x 거리 0.05
  const [vx, vy] = unrotatePoint(0.5, 0.6, 0.5, 0.5, 90, 2)
  assert.ok(Math.abs(vx - 0.55) < 1e-9 && Math.abs(vy - 0.5) < 1e-9)
})
