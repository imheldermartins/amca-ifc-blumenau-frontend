const MIN_IMAGE_WIDTH = 120

export function projectImageWidth(
  initialWidth: number,
  initialHeight: number,
  deltaX: number,
  deltaY: number,
  maxWidth: number,
): number {
  const diagonalLengthSquared = initialWidth ** 2 + initialHeight ** 2
  const scaleDelta = diagonalLengthSquared > 0
    ? (deltaX * initialWidth + deltaY * initialHeight) / diagonalLengthSquared
    : 0
  return Math.min(
    maxWidth,
    Math.max(MIN_IMAGE_WIDTH, initialWidth * (1 + scaleDelta)),
  )
}
