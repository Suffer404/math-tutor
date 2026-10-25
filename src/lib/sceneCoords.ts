/**
 * Pure coordinate maths for the live-feedback overlay.
 *
 * Excalidraw stores drawings in "scene" coordinates. The overlay lives in the
 * same DOM container as the canvas, so a scene point becomes an overlay point
 * with Excalidraw's own formula:
 *
 *   overlayX = (sceneX + scrollX) * zoom + offsetLeft - containerRect.left
 *
 * Keeping this in a pure module (no Excalidraw imports) makes it testable and
 * keeps the overlay correct through zoom, pan, resize and fullscreen.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportTransform {
  zoom: number;
  scrollX: number;
  scrollY: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface ContainerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ElementGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  type?: string;
}

export interface StepRegion {
  sceneRect: Rect;
  /** exact = AI box; step = whole ink line used as an honest fallback. */
  precision: 'exact' | 'step';
}

export const DEFAULT_VIEWPORT: ViewportTransform = {
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  offsetLeft: 0,
  offsetTop: 0,
};

export function normalizeZoom(zoom: unknown): number {
  if (typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) {
    return zoom;
  }
  if (zoom && typeof zoom === 'object') {
    const value = (zoom as { value?: unknown }).value;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 1;
}

export function isFiniteRect(rect: Rect | null | undefined): rect is Rect {
  return (
    !!rect &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/** Map a scene-coordinate rectangle to pixels inside the overlay container. */
export function sceneRectToContainer(
  rect: Rect,
  view: ViewportTransform,
  container: ContainerRect,
): Rect {
  const zoom = normalizeZoom(view.zoom);
  return {
    x: (rect.x + view.scrollX) * zoom + view.offsetLeft - container.left,
    y: (rect.y + view.scrollY) * zoom + view.offsetTop - container.top,
    width: rect.width * zoom,
    height: rect.height * zoom,
  };
}

/** Map a normalized [0..1] image box onto the exported scene bounds. */
export function normalizedBoxToScene(box: NormalizedBox, sceneBounds: Rect): Rect {
  return {
    x: sceneBounds.x + box.x * sceneBounds.width,
    y: sceneBounds.y + box.y * sceneBounds.height,
    width: box.width * sceneBounds.width,
    height: box.height * sceneBounds.height,
  };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    if (!isFiniteRect(rect)) continue;
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function computeInkBounds(elements: readonly ElementGeometry[]): Rect | null {
  return unionRects(
    elements
      .filter((el) => !el.isDeleted)
      .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }))
      .filter(isFiniteRect),
  );
}

/**
 * Group strokes into visual lines, top to bottom. This is *not* OCR: it only
 * describes where ink sits, so a fallback highlight covers a whole written
 * step instead of a guessed symbol.
 */
export function groupInkLines(elements: readonly ElementGeometry[]): Rect[] {
  const items = elements
    .filter((el) => !el.isDeleted)
    .map((el) => ({ x: el.x, y: el.y, width: el.width, height: el.height }))
    .filter(isFiniteRect)
    .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2) || a.x - b.x);

  if (!items.length) return [];

  const heights = items.map((item) => item.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 24;
  const verticalSlack = Math.max(10, medianHeight * 0.55);

  const lines: Rect[] = [];
  let current: Rect | null = null;

  for (const item of items) {
    if (!current) {
      current = { ...item };
      continue;
    }
    const currentBottom = current.y + current.height;
    const overlaps = item.y <= currentBottom + verticalSlack;
    const centerGap = Math.abs(
      item.y + item.height / 2 - (current.y + current.height / 2),
    );
    if (overlaps && centerGap <= Math.max(medianHeight * 1.1, item.height)) {
      const merged = unionRects([current, item]);
      current = merged || current;
    } else {
      lines.push(current);
      current = { ...item };
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Pick the scene rectangle for the first-error step.
 *
 * 1. a sane AI box wins (exact);
 * 2. otherwise, if the line count matches the step count, outline that whole
 *    ink line (precision "step");
 * 3. otherwise return null so the UI highlights the step's full text instead
 *    of putting a laser somewhere invented.
 */
export function resolveStepRegion(args: {
  aiBox?: NormalizedBox | null;
  stepIndex: number;
  stepCount: number;
  sceneBounds: Rect | null;
  lines: Rect[];
}): StepRegion | null {
  const { aiBox, stepIndex, stepCount, sceneBounds, lines } = args;
  if (stepIndex < 0 || stepIndex >= Math.max(stepCount, 1)) return null;

  if (aiBox && sceneBounds) {
    const validBox =
      Number.isFinite(aiBox.x) &&
      Number.isFinite(aiBox.y) &&
      Number.isFinite(aiBox.width) &&
      Number.isFinite(aiBox.height) &&
      aiBox.x >= 0 &&
      aiBox.y >= 0 &&
      aiBox.width > 0.01 &&
      aiBox.height > 0.004 &&
      aiBox.x + aiBox.width <= 1.02 &&
      aiBox.y + aiBox.height <= 1.02;
    if (validBox) {
      return {
        sceneRect: normalizedBoxToScene(aiBox, sceneBounds),
        precision: 'exact',
      };
    }
  }

  if (lines.length === stepCount && stepIndex < lines.length) {
    const line = lines[stepIndex];
    return {
      sceneRect: {
        x: line.x - 4,
        y: line.y - 4,
        width: line.width + 8,
        height: line.height + 8,
      },
      precision: 'step',
    };
  }

  return null;
}
