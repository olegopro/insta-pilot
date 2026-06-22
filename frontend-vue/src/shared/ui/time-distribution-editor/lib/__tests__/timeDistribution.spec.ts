import { describe, it, expect } from 'vitest'
import {
  pxToSeconds,
  secondsToPercent,
  snapSeconds,
  clampOffset,
  evenDistribution,
  clampDragWithGap,
  clampOffsetsToWindow,
  minWindowSeconds,
  enforceMinGap,
  rescaleOffsets
} from '@/shared/ui/time-distribution-editor/lib'

describe('pxToSeconds', () => it.each([
  [0, 100, 600, 0],
  [50, 100, 600, 300],
  [100, 100, 600, 600],
  // нулевая/некорректная ширина трека — деление не падает, возвращает 0
  [40, 0, 600, 0]
])('px=%i track=%i window=%i → %i сек', (px, track, windowSeconds, expected) =>
  expect(pxToSeconds(px, track, windowSeconds)).toBe(expected)))

describe('secondsToPercent', () => it.each([
  [0, 600, 0],
  [300, 600, 50],
  [600, 600, 100],
  // выход за окно зажимается в [0, 100]
  [900, 600, 100],
  [-60, 600, 0]
])('seconds=%i window=%i → %i%', (seconds, windowSeconds, expected) =>
  expect(secondsToPercent(seconds, windowSeconds)).toBe(expected)))

describe('snapSeconds', () => it.each([
  [0, 0],
  [29, 0],
  [30, 60],
  [89, 60],
  [90, 120],
  [615, 600]
])('snap(%i) → %i', (input, expected) => expect(snapSeconds(input)).toBe(expected)))

describe('clampOffset', () => it.each([
  [-100, 600, 0],
  [0, 600, 0],
  [300, 600, 300],
  [900, 600, 600]
])('clamp(%i, window=%i) → %i', (input, windowSeconds, expected) =>
  expect(clampOffset(input, windowSeconds)).toBe(expected)))

describe('evenDistribution', () => it.each([
  [0, 600, []],
  [1, 600, [0]],
  [3, 600, [0, 300, 600]],
  // шаг 1200/3 = 400, со snap к минуте: 0, 420, 780, 1200
  [4, 1200, [0, 420, 780, 1200]]
])('count=%i window=%i → %j', (count, windowSeconds, expected) =>
  expect(evenDistribution(count, windowSeconds)).toEqual(expected)))

describe('clampDragWithGap', () => {
  it('snap к минуте при свободном перемещении', () =>
    expect(clampDragWithGap([0, 600], 1, 305, 1200)).toBe(300))

  it('не подходит к нижнему соседу ближе 60с', () =>
    expect(clampDragWithGap([0, 600], 1, 30, 1200)).toBe(60))

  it('не подходит к верхнему соседу ближе 60с', () =>
    expect(clampDragWithGap([0, 600], 0, 590, 1200)).toBe(540))

  it('зажимает в правую границу окна (одиночный кубик)', () =>
    expect(clampDragWithGap([0], 0, 9000, 600)).toBe(600))

  it('зажимает в левую границу окна (одиночный кубик)', () =>
    expect(clampDragWithGap([600], 0, -120, 600)).toBe(0))

  it('нет места между соседями — прижимает к нижней границе', () =>
    expect(clampDragWithGap([0, 60, 120], 1, 100, 1200)).toBe(60))
})

describe('clampOffsetsToWindow', () => {
  it('зажимает все смещения при сжатии окна', () =>
    expect(clampOffsetsToWindow([0, 300, 900, 1800], 600)).toEqual([0, 300, 600, 600]))

  it('оставляет смещения внутри окна без изменений', () =>
    expect(clampOffsetsToWindow([0, 120, 600], 600)).toEqual([0, 120, 600]))
})

describe('minWindowSeconds', () => it.each([
  [1, 60],
  [2, 60],
  [5, 240],
  [0, 60]
])('count=%i → %i сек', (count, expected) => expect(minWindowSeconds(count)).toBe(expected)))

describe('окно не схлопывает кубики при минимальном окне', () => it.each([
  [2], [5], [11]
])('count=%i: even-распределение на minWindow даёт уникальные смещения', (count) => {
  const offsets = evenDistribution(count, minWindowSeconds(count))
  expect(new Set(offsets).size).toBe(count)
}))

describe('enforceMinGap', () => {
  it('раздвигает наложенные смещения на min-зазор в пределах окна', () =>
    expect(enforceMinGap([0, 0, 0, 0], 180)).toEqual([0, 60, 120, 180]))

  it('не трогает уже разнесённые смещения', () =>
    expect(enforceMinGap([0, 120, 600], 600)).toEqual([0, 120, 600]))
})

describe('rescaleOffsets', () => {
  it('пропорционально сжимает окно без схлопывания (6 кубиков 3600→300)', () =>
    expect(rescaleOffsets([0, 720, 1440, 2160, 2880, 3600], 3600, 300)).toEqual([0, 60, 120, 180, 240, 300]))

  it.each([[4], [6], [11]])('count=%i: после сжатия в minWindow все позиции уникальны', (count) => {
    const out = rescaleOffsets(evenDistribution(count, 3600), 3600, minWindowSeconds(count))
    expect(new Set(out).size).toBe(count)
  })
})
