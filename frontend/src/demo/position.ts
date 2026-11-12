/** Khoảng cách tới mép màn hình khi khung điều khiển bám góc, px. */
export const EDGE_MARGIN = 16
/** Thả trong khoảng này tính từ một góc thì bám vào góc đó, px. */
export const SNAP_DISTANCE = 96

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Vị trí khung điều khiển sau khi kéo: luôn nằm trọn trong khung nhìn, và bám vào góc nếu thả gần góc.
 * `minTop` là mép dưới thanh trên cùng, để khung không che thanh trên.
 */
export function placeController(box: Box, viewport: { width: number; height: number }, minTop = 0) {
  const maxX = Math.max(EDGE_MARGIN, viewport.width - box.width - EDGE_MARGIN)
  const maxY = Math.max(minTop + EDGE_MARGIN, viewport.height - box.height - EDGE_MARGIN)
  let x = Math.min(Math.max(box.x, EDGE_MARGIN), maxX)
  let y = Math.min(Math.max(box.y, minTop + EDGE_MARGIN), maxY)

  const nearLeft = x - EDGE_MARGIN <= SNAP_DISTANCE
  const nearRight = maxX - x <= SNAP_DISTANCE
  const nearTop = y - (minTop + EDGE_MARGIN) <= SNAP_DISTANCE
  const nearBottom = maxY - y <= SNAP_DISTANCE
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
    x = nearLeft ? EDGE_MARGIN : maxX
    y = nearTop ? minTop + EDGE_MARGIN : maxY
  }
  return { x, y }
}
