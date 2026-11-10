import { AutoShape } from '../types';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface OrthoSnapResult {
  pt: { x: number; y: number };
  angleDeg: number;
  label: string;
  isStrictlyHorizontal: boolean;
  isStrictlyVertical: boolean;
  is45Diagonal: boolean;
}

const DEFAULT_DIMS: CanvasDimensions = { width: 2000, height: 1414 };

/**
 * Snaps a target point (p1) relative to anchor (p0) to 0°, 45°, 90°, 135°, 180°, etc.
 * Uses real canvas pixel aspect ratio to guarantee true visual straightness on screen.
 */
export function snapPointToOrtho(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  dims: CanvasDimensions = DEFAULT_DIMS
): OrthoSnapResult {
  const dx_px = ((p1.x - p0.x) / 100) * dims.width;
  const dy_px = ((p1.y - p0.y) / 100) * dims.height;
  const dist_px = Math.hypot(dx_px, dy_px);

  if (dist_px < 1) {
    return {
      pt: p1,
      angleDeg: 0,
      label: '0°',
      isStrictlyHorizontal: true,
      isStrictlyVertical: false,
      is45Diagonal: false,
    };
  }

  // Raw angle in degrees (-180 to 180)
  const rawAngleDeg = (Math.atan2(dy_px, dx_px) * 180) / Math.PI;
  // Snap to nearest 45° increment
  const snappedAngleDeg = Math.round(rawAngleDeg / 45) * 45;
  const snappedRad = (snappedAngleDeg * Math.PI) / 180;

  let targetPxX = dx_px;
  let targetPxY = dy_px;
  let label = '';
  let isStrictlyHorizontal = false;
  let isStrictlyVertical = false;
  let is45Diagonal = false;

  if (snappedAngleDeg === 0 || Math.abs(snappedAngleDeg) === 180) {
    targetPxX = snappedAngleDeg === 0 ? dist_px : -dist_px;
    targetPxY = 0; // Pure visual horizontal
    isStrictlyHorizontal = true;
    label = snappedAngleDeg === 0 ? '0° Horizontal ➔' : '180° Horizontal ⬅';
  } else if (Math.abs(snappedAngleDeg) === 90) {
    targetPxX = 0; // Pure visual vertical
    targetPxY = snappedAngleDeg === 90 ? dist_px : -dist_px;
    isStrictlyVertical = true;
    label = snappedAngleDeg === 90 ? '90° Vertical ⬇' : '270° Vertical ⬆';
  } else {
    targetPxX = Math.cos(snappedRad) * dist_px;
    targetPxY = Math.sin(snappedRad) * dist_px;
    is45Diagonal = true;
    const normalizedDeg = (snappedAngleDeg + 360) % 360;
    label = `${normalizedDeg}° Diagonal`;
  }

  const snappedCanvasX = (p0.x / 100) * dims.width + targetPxX;
  const snappedCanvasY = (p0.y / 100) * dims.height + targetPxY;

  const snappedPercentX = Math.max(0, Math.min(100, Number(((snappedCanvasX / dims.width) * 100).toFixed(2))));
  const snappedPercentY = Math.max(0, Math.min(100, Number(((snappedCanvasY / dims.height) * 100).toFixed(2))));

  return {
    pt: {
      // Force exact match if purely horizontal or vertical to eliminate rounding noise
      x: isStrictlyVertical ? p0.x : snappedPercentX,
      y: isStrictlyHorizontal ? p0.y : snappedPercentY,
    },
    angleDeg: (snappedAngleDeg + 360) % 360,
    label,
    isStrictlyHorizontal,
    isStrictlyVertical,
    is45Diagonal,
  };
}

/**
 * Inspects line alignment and deviation from nearest straight axis.
 */
export function getLineAlignmentInfo(
  shape: AutoShape,
  dims: CanvasDimensions = DEFAULT_DIMS
) {
  if (shape.endX === undefined || shape.endY === undefined) {
    return {
      angleDeg: 0,
      label: 'N/A',
      isStrictlyHorizontal: false,
      isStrictlyVertical: false,
      nearestAxis: 'horizontal' as const,
      deviationDeg: 0,
    };
  }

  const dx_px = ((shape.endX - shape.x) / 100) * dims.width;
  const dy_px = ((shape.endY - shape.y) / 100) * dims.height;
  const rawAngleDeg = (Math.atan2(dy_px, dx_px) * 180) / Math.PI;
  const angleDeg = (Math.round(rawAngleDeg) + 360) % 360;

  // Strict checks with tiny tolerance
  const isStrictlyHorizontal = Math.abs(dy_px) < 0.6 || shape.y === shape.endY;
  const isStrictlyVertical = Math.abs(dx_px) < 0.6 || shape.x === shape.endX;

  const nearestHorizontalDist = Math.min(
    Math.abs(angleDeg - 0),
    Math.abs(angleDeg - 180),
    Math.abs(angleDeg - 360)
  );
  const nearestVerticalDist = Math.min(
    Math.abs(angleDeg - 90),
    Math.abs(angleDeg - 270)
  );

  const nearestAxis = nearestHorizontalDist <= nearestVerticalDist ? ('horizontal' as const) : ('vertical' as const);
  const deviationDeg = nearestAxis === 'horizontal' ? nearestHorizontalDist : nearestVerticalDist;

  let label = `${angleDeg}°`;
  if (isStrictlyHorizontal) label = `${angleDeg === 180 ? '180°' : '0°'} Horizontal ✓`;
  else if (isStrictlyVertical) label = `${angleDeg === 270 ? '270°' : '90°'} Vertical ✓`;
  else label = `${angleDeg}° (Desv. ${deviationDeg.toFixed(1)}°)`;

  return {
    angleDeg,
    label,
    isStrictlyHorizontal,
    isStrictlyVertical,
    nearestAxis,
    deviationDeg,
  };
}

/**
 * Straightens an existing line or arrow, strictly preserving its physical length.
 */
export function straightenLine(
  shape: AutoShape,
  mode: 'auto' | 'horizontal' | 'vertical' | 'diagonal45',
  dims: CanvasDimensions = DEFAULT_DIMS,
  metersPerPercent = 2.5
): Partial<AutoShape> {
  if (shape.endX === undefined || shape.endY === undefined) {
    return {};
  }

  const px1 = (shape.x / 100) * dims.width;
  const py1 = (shape.y / 100) * dims.height;
  const px2 = (shape.endX / 100) * dims.width;
  const py2 = (shape.endY / 100) * dims.height;

  const dx_px = px2 - px1;
  const dy_px = py2 - py1;
  const dist_px = Math.max(1, Math.hypot(dx_px, dy_px));

  let chosenMode = mode;
  if (mode === 'auto') {
    chosenMode = Math.abs(dx_px) >= Math.abs(dy_px) ? 'horizontal' : 'vertical';
  }

  let newPx2 = px2;
  let newPy2 = py2;

  if (chosenMode === 'horizontal') {
    newPy2 = py1; // Exact same Y in pixel space
    newPx2 = px1 + (dx_px >= 0 ? dist_px : -dist_px);
  } else if (chosenMode === 'vertical') {
    newPx2 = px1; // Exact same X in pixel space
    newPy2 = py1 + (dy_px >= 0 ? dist_px : -dist_px);
  } else if (chosenMode === 'diagonal45') {
    const dDist = dist_px / Math.SQRT2;
    newPx2 = px1 + (dx_px >= 0 ? dDist : -dDist);
    newPy2 = py1 + (dy_px >= 0 ? dDist : -dDist);
  }

  const newEndX = Number(((newPx2 / dims.width) * 100).toFixed(2));
  const newEndY = Number(((newPy2 / dims.height) * 100).toFixed(2));

  // Recalculate meters
  const distPercent = Math.hypot(newEndX - shape.x, newEndY - shape.y);
  const calculatedMeters = Number((distPercent * metersPerPercent).toFixed(1));

  return {
    endX: chosenMode === 'vertical' ? shape.x : Math.max(0, Math.min(100, newEndX)),
    endY: chosenMode === 'horizontal' ? shape.y : Math.max(0, Math.min(100, newEndY)),
    metros: shape.metros !== undefined ? (calculatedMeters > 0 ? calculatedMeters : shape.metros) : calculatedMeters,
  };
}

/**
 * Inverts the start and end point of a line or arrow.
 */
export function invertLineDirection(shape: AutoShape): Partial<AutoShape> {
  if (shape.endX === undefined || shape.endY === undefined) return {};
  return {
    x: shape.endX,
    y: shape.endY,
    endX: shape.x,
    endY: shape.y,
  };
}
