import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rotateRectCW, rotatePointCW, rotateObjectCW, hitTest, textBoxRect, newId, type ShapeObj, type StrokeObj, type TextObj } from '../src/core/objects'

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
