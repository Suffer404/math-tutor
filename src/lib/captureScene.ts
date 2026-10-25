import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types/types';
import { computeInkBounds, type Rect } from './sceneCoords';

export const EXPORT_PADDING = 24;
export const MAX_EXPORT_DIMENSION = 1400;

export interface CapturedScene {
  imageBase64: string;
  /** Scene-space rectangle that the exported image covers (incl. padding). */
  sceneBounds: Rect;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read board image'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Export the actual Excalidraw scene to a PNG for the vision model.
 *
 * This replaces capturing a single <canvas>: Excalidraw draws across several
 * canvases, so `canvas.toDataURL()` can return an empty or partial image.
 * `exportToBlob` renders the real scene. The scene bounds are returned with the
 * image so normalized model coordinates can be mapped back exactly.
 */
export async function captureScene(
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles | null | undefined,
): Promise<CapturedScene | null> {
  const liveElements = elements.filter((element) => !element.isDeleted);
  if (!liveElements.length) return null;

  // Imported lazily so Jest/Vitest suites that mock Excalidraw never need the
  // real exporter.
  const excalidraw = await import('@excalidraw/excalidraw');
  const exporter = (excalidraw as unknown as {
    exportToBlob?: (opts: {
      elements: readonly unknown[];
      files?: BinaryFiles | null;
      mimeType?: string;
      exportPadding?: number;
      maxWidthOrHeight?: number;
    }) => Promise<Blob>;
    getCommonBounds?: (elements: readonly unknown[]) => [number, number, number, number];
  }).exportToBlob;

  if (typeof exporter !== 'function') {
    throw new Error('The whiteboard exporter is unavailable in this build.');
  }

  const boundsFn = (excalidraw as unknown as {
    getCommonBounds?: (elements: readonly unknown[]) => [number, number, number, number];
  }).getCommonBounds;

  let bounds = computeInkBounds(liveElements);
  if (typeof boundsFn === 'function') {
    try {
      const [minX, minY, maxX, maxY] = boundsFn(liveElements);
      if ([minX, minY, maxX, maxY].every(Number.isFinite) && maxX > minX && maxY > minY) {
        bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    } catch {
      // keep the local element-bounds fallback
    }
  }
  if (!bounds) return null;

  const blob = await exporter({
    elements: liveElements,
    files: files || null,
    mimeType: 'image/png',
    exportPadding: EXPORT_PADDING,
    maxWidthOrHeight: MAX_EXPORT_DIMENSION,
  });

  const dataUrl = await blobToDataUrl(blob);
  const imageBase64 = dataUrl.split(',')[1] || '';
  if (!imageBase64) throw new Error('The board exported an empty image.');

  return {
    imageBase64,
    sceneBounds: {
      x: bounds.x - EXPORT_PADDING,
      y: bounds.y - EXPORT_PADDING,
      width: bounds.width + EXPORT_PADDING * 2,
      height: bounds.height + EXPORT_PADDING * 2,
    },
  };
}
