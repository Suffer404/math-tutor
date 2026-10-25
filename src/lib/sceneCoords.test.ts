import { describe, expect, it } from 'vitest';
import {
  computeInkBounds,
  groupInkLines,
  normalizedBoxToScene,
  normalizeZoom,
  resolveStepRegion,
  sceneRectToContainer,
} from './sceneCoords';

const container = { left: 5, top: 7, width: 1000, height: 700 };

describe('sceneCoords', () => {
  it('maps scene coordinates through zoom, pan and container offset', () => {
    const view = {
      zoom: 1.5,
      scrollX: 100,
      scrollY: -40,
      offsetLeft: 12,
      offsetTop: 30,
    };
    const rect = { x: 20, y: 10, width: 200, height: 100 };
    const mapped = sceneRectToContainer(rect, view, container);

    expect(mapped.x).toBeCloseTo((20 + 100) * 1.5 + 12 - 5);
    expect(mapped.y).toBeCloseTo((10 - 40) * 1.5 + 30 - 7);
    expect(mapped.width).toBeCloseTo(300);
    expect(mapped.height).toBeCloseTo(150);
  });

  it('normalizes Excalidraw zoom objects and rejects broken values', () => {
    expect(normalizeZoom({ value: 2 })).toBe(2);
    expect(normalizeZoom(0.5)).toBe(0.5);
    expect(normalizeZoom(0)).toBe(1);
    expect(normalizeZoom(undefined)).toBe(1);
    expect(normalizeZoom({ value: Number.NaN })).toBe(1);
  });

  it('maps a normalized image box to scene bounds', () => {
    const bounds = { x: -24, y: -24, width: 400, height: 200 };
    expect(normalizedBoxToScene({ x: 0.5, y: 0.25, width: 0.1, height: 0.2 }, bounds)).toEqual({
      x: 176,
      y: 26,
      width: 40,
      height: 40,
    });
  });

  it('computes ink bounds and ignores deleted elements', () => {
    const bounds = computeInkBounds([
      { x: 0, y: 0, width: 100, height: 20 },
      { x: 50, y: 60, width: 80, height: 30 },
      { x: 200, y: 200, width: 50, height: 50, isDeleted: true },
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 130, height: 90 });
  });

  it('groups strokes into visual lines, not individual glyphs', () => {
    const lines = groupInkLines([
      { x: 10, y: 10, width: 30, height: 25 },
      { x: 45, y: 12, width: 40, height: 22 },
      { x: 12, y: 90, width: 60, height: 25 },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].x).toBe(10);
    expect(lines[0].width).toBe(75);
    expect(lines[1].y).toBe(90);
  });

  it('uses a valid AI box as an exact region', () => {
    const region = resolveStepRegion({
      aiBox: { x: 0.2, y: 0.1, width: 0.4, height: 0.1 },
      stepIndex: 0,
      stepCount: 2,
      sceneBounds: { x: 0, y: 0, width: 400, height: 300 },
      lines: [],
    });
    expect(region?.precision).toBe('exact');
    expect(region?.sceneRect).toEqual({ x: 80, y: 30, width: 160, height: 30 });
  });

  it('falls back to the whole matching ink line when no box exists', () => {
    const lines = [
      { x: 10, y: 10, width: 100, height: 20 },
      { x: 10, y: 60, width: 120, height: 20 },
    ];
    const region = resolveStepRegion({
      aiBox: null,
      stepIndex: 1,
      stepCount: 2,
      sceneBounds: { x: 0, y: 0, width: 400, height: 300 },
      lines,
    });
    expect(region?.precision).toBe('step');
    expect(region?.sceneRect.x).toBe(6);
    expect(region?.sceneRect.width).toBe(128);
  });

  it('returns null instead of guessing when neither box nor line count match', () => {
    expect(
      resolveStepRegion({
        aiBox: null,
        stepIndex: 0,
        stepCount: 3,
        sceneBounds: { x: 0, y: 0, width: 400, height: 300 },
        lines: [
          { x: 10, y: 10, width: 100, height: 20 },
          { x: 10, y: 60, width: 120, height: 20 },
        ],
      }),
    ).toBeNull();
  });

  it('rejects an AI box that extends outside the image', () => {
    expect(
      resolveStepRegion({
        aiBox: { x: 0.9, y: 0.1, width: 0.4, height: 0.1 },
        stepIndex: 0,
        stepCount: 1,
        sceneBounds: { x: 0, y: 0, width: 400, height: 300 },
        lines: [],
      }),
    ).toBeNull();
  });
});
