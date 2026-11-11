// Keep the hovered block while crossing the gap to its floating controls.
export const isInBlockHandleCorridor = (
  point: { x: number; y: number },
  block: Pick<DOMRect, 'left' | 'top' | 'height'>,
  controls?: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
) => {
  const left = controls?.left ?? block.left - 80;
  const right = Math.max(block.left + 2, controls?.right ?? block.left);
  const top = Math.min(block.top, controls?.top ?? block.top) - 2;
  const bottom =
    Math.max(
      block.top + Math.min(block.height, 32),
      controls?.bottom ?? block.top
    ) + 2;
  return (
    point.x >= left - 2 &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  );
};
