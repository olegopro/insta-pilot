// Чистые функции интерактивного редактора распределения во времени.
// Вынесены отдельно от компонента, чтобы покрыть юнит-тестами без монтирования Vue.
// Контракт совпадает с серверным планировщиком: snap к минуте, минимальный зазор 60с.

export const SNAP_SECONDS = 60
export const MIN_GAP_SECONDS = 60

// Перевод горизонтального смещения в пикселях в секунды на текущем окне.
export const pxToSeconds = (px: number, trackPx: number, windowSeconds: number): number =>
  trackPx <= 0 ? 0 : (px / trackPx) * windowSeconds

// Обратный перевод секунд в проценты по ширине трека (для позиционирования кубика).
export const secondsToPercent = (seconds: number, windowSeconds: number): number =>
  windowSeconds <= 0 ? 0 : Math.min(Math.max((seconds / windowSeconds) * 100, 0), 100)

// Привязка к ближайшей минуте (или иному шагу).
export const snapSeconds = (seconds: number, step = SNAP_SECONDS): number =>
  Math.round(seconds / step) * step

// Зажатие смещения в границы окна [0, windowSeconds].
export const clampOffset = (seconds: number, windowSeconds: number): number =>
  Math.min(Math.max(seconds, 0), Math.max(windowSeconds, 0))

// Минимальное окно, при котором count кубиков ещё помещаются с зазором gap:
// (count-1) интервалов по gap. При меньшем окне even-распределение схлопывает соседние
// кубики при snap к минуте (offsets дублируются и визуально «исчезают») — поэтому окно
// нельзя сжать ниже этого порога.
export const minWindowSeconds = (count: number, gap = MIN_GAP_SECONDS): number =>
  Math.max(gap, (count - 1) * gap)

// Равномерное распределение: шаг = window / (count - 1), смещение = шаг * index.
export const evenDistribution = (count: number, windowSeconds: number): number[] => {
  if (count <= 0) return []
  if (count === 1) return [0]
  const step = windowSeconds / (count - 1)
  return Array.from({ length: count }, (_, index) => clampOffset(snapSeconds(step * index), windowSeconds))
}

// Перетаскивание кубика index в желаемое смещение: snap к минуте и зажатие между
// соседями по индексу (offsets[index-1]+gap … offsets[index+1]-gap) и границами окна.
// Кубики не меняются местами — index цели жёстко привязан к позиции на оси.
export const clampDragWithGap = (
  offsets: number[],
  index: number,
  desiredSeconds: number,
  windowSeconds: number,
  gap = MIN_GAP_SECONDS
): number => {
  const snapped = snapSeconds(desiredSeconds)
  const lowerNeighbor = index > 0 ? offsets[index - 1] : undefined
  const upperNeighbor = index < offsets.length - 1 ? offsets[index + 1] : undefined
  const lo = Math.max(0, lowerNeighbor !== undefined ? lowerNeighbor + gap : 0)
  const hi = Math.min(windowSeconds, upperNeighbor !== undefined ? upperNeighbor - gap : windowSeconds)
  // Если места между соседями не осталось — прижимаем к нижней допустимой границе.
  return hi <= lo ? lo : Math.min(Math.max(snapped, lo), hi)
}

// Сжатие окна: каждое смещение зажимается в новые границы [0, windowSeconds].
export const clampOffsetsToWindow = (offsets: number[], windowSeconds: number): number[] =>
  offsets.map((offset) => clampOffset(snapSeconds(offset), windowSeconds))

// Раздвигает смещения по возрастанию так, чтобы между соседями был зазор не меньше gap и
// все помещались в окно (каждому оставляем место под оставшиеся кубики). Не схлопывает в точку.
export const enforceMinGap = (offsets: number[], windowSeconds: number, gap = MIN_GAP_SECONDS): number[] => {
  const count = offsets.length
  let prev = -gap
  return offsets.map((offset, index) => {
    const lo = Math.max(prev + gap, 0)
    const hi = windowSeconds - (count - 1 - index) * gap
    const value = hi <= lo ? lo : Math.min(Math.max(offset, lo), hi)
    prev = value
    return value
  })
}

// Изменение окна: смещения масштабируются ПРОПОРЦИОНАЛЬНО в новое окно (сохраняя раскладку),
// snap к минуте и раздвигаются на min-зазор. Так кубики не схлопываются при сжатии окна.
export const rescaleOffsets = (offsets: number[], oldWindowSeconds: number, newWindowSeconds: number): number[] => {
  if (offsets.length === 0) return []
  const factor = oldWindowSeconds > 0 ? newWindowSeconds / oldWindowSeconds : 1
  const scaled = offsets.map((offset) => clampOffset(snapSeconds(offset * factor), newWindowSeconds))
  return enforceMinGap(scaled, newWindowSeconds)
}
