export const STICKY_EDGE_MARGIN = 14;
export const STICKY_UNDO_LANE_RESERVE = 104;
export const STICKY_WORKSPACE_HEADER_HEIGHT = 76;
export const STICKY_MINIMIZED_WIDTH = 236;
export const STICKY_MINIMIZED_HEIGHT = 38;
export const STICKY_MIN_WIDTH = 300;
export const STICKY_MIN_HEIGHT = 260;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function privateStickyBounds(viewport) {
  const viewportWidth = Math.max(0, finite(viewport?.width, 0));
  const viewportHeight = Math.max(0, finite(viewport?.height, 0));
  const left = Math.min(STICKY_EDGE_MARGIN, viewportWidth / 2);
  const right = Math.max(left, viewportWidth - STICKY_EDGE_MARGIN);
  const top = Math.min(
    STICKY_WORKSPACE_HEADER_HEIGHT + STICKY_EDGE_MARGIN,
    Math.max(0, viewportHeight - STICKY_EDGE_MARGIN - STICKY_MINIMIZED_HEIGHT),
  );
  const viewportBottom = Math.max(top, viewportHeight - STICKY_EDGE_MARGIN);
  const preferredBottom = viewportHeight - STICKY_UNDO_LANE_RESERVE - STICKY_EDGE_MARGIN;
  const bottom = Math.min(
    viewportBottom,
    Math.max(top + Math.min(STICKY_MINIMIZED_HEIGHT, viewportBottom - top), preferredBottom),
  );
  return { left, right, top, bottom };
}

export function privateStickyMinimizedWidth(viewport) {
  const bounds = privateStickyBounds(viewport);
  return Math.min(STICKY_MINIMIZED_WIDTH, bounds.right - bounds.left);
}

export function privateStickyMinimizedHeight(viewport) {
  const bounds = privateStickyBounds(viewport);
  return Math.min(STICKY_MINIMIZED_HEIGHT, bounds.bottom - bounds.top);
}

export function defaultPrivateStickyFrame(viewport) {
  const bounds = privateStickyBounds(viewport);
  const width = Math.min(440, bounds.right - bounds.left);
  const height = Math.min(460, bounds.bottom - bounds.top);
  return {
    width,
    height,
    x: bounds.right - width,
    y: bounds.top,
  };
}

export function constrainPrivateStickyFrame(frame, viewport) {
  const bounds = privateStickyBounds(viewport);
  const availableWidth = bounds.right - bounds.left;
  const availableHeight = bounds.bottom - bounds.top;
  const width = clamp(
    finite(frame?.width, Math.min(440, availableWidth)),
    Math.min(STICKY_MIN_WIDTH, availableWidth),
    availableWidth,
  );
  const height = clamp(
    finite(frame?.height, Math.min(460, availableHeight)),
    Math.min(STICKY_MIN_HEIGHT, availableHeight),
    availableHeight,
  );
  return {
    width,
    height,
    x: clamp(finite(frame?.x, bounds.right - width), bounds.left, bounds.right - width),
    y: clamp(finite(frame?.y, bounds.top), bounds.top, bounds.bottom - height),
  };
}

export function constrainPrivateStickyMinimized(position, viewport) {
  const bounds = privateStickyBounds(viewport);
  const width = privateStickyMinimizedWidth(viewport);
  const height = privateStickyMinimizedHeight(viewport);
  return {
    x: clamp(finite(position?.x, bounds.right - width), bounds.left, bounds.right - width),
    y: clamp(finite(position?.y, bounds.top), bounds.top, bounds.bottom - height),
  };
}

export function defaultPrivateStickyMinimizedPosition(viewport, mobile) {
  const bounds = privateStickyBounds(viewport);
  const width = privateStickyMinimizedWidth(viewport);
  const height = privateStickyMinimizedHeight(viewport);
  return {
    x: bounds.right - width,
    y: mobile ? bounds.bottom - height : bounds.top,
  };
}
