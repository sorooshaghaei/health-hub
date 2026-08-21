import assert from "node:assert/strict";
import test from "node:test";

import {
  constrainPrivateStickyFrame,
  constrainPrivateStickyMinimized,
  defaultPrivateStickyFrame,
  defaultPrivateStickyMinimizedPosition,
  privateStickyBounds,
  privateStickyMinimizedHeight,
  privateStickyMinimizedWidth,
} from "../src/privateStickyGeometry.js";

function assertInsideBounds(frame, viewport) {
  const bounds = privateStickyBounds(viewport);
  assert.ok(frame.x >= bounds.left);
  assert.ok(frame.y >= bounds.top);
  assert.ok(frame.x + frame.width <= bounds.right);
  assert.ok(frame.y + frame.height <= bounds.bottom);
}

test("expanded sticky stays below the workspace header and above the Undo lane", () => {
  const viewport = { width: 1363, height: 768 };
  const bounds = privateStickyBounds(viewport);
  const frame = constrainPrivateStickyFrame({ x: -500, y: -500, width: 5000, height: 5000 }, viewport);

  assert.equal(bounds.top, 90);
  assert.equal(bounds.bottom, 650);
  assertInsideBounds(frame, viewport);
  assert.equal(frame.x, bounds.left);
  assert.equal(frame.y, bounds.top);
});

test("compact-height windows shrink the sticky instead of hiding its header", () => {
  const viewport = { width: 900, height: 400 };
  const frame = defaultPrivateStickyFrame(viewport);

  assert.equal(frame.y, 90);
  assert.equal(frame.height, 192);
  assertInsideBounds(frame, viewport);
});

test("dragging expanded and minimized states cannot escape safe viewport bounds", () => {
  const viewport = { width: 1024, height: 700 };
  const expanded = constrainPrivateStickyFrame({ x: 9999, y: 9999, width: 360, height: 300 }, viewport);
  const minimized = constrainPrivateStickyMinimized({ x: -9999, y: 9999 }, viewport);
  const bounds = privateStickyBounds(viewport);

  assertInsideBounds(expanded, viewport);
  assert.equal(minimized.x, bounds.left);
  assert.equal(minimized.y + privateStickyMinimizedHeight(viewport), bounds.bottom);
});

test("mobile minimized default remains above the reserved Undo lane", () => {
  const viewport = { width: 390, height: 844 };
  const bounds = privateStickyBounds(viewport);
  const position = defaultPrivateStickyMinimizedPosition(viewport, true);

  assert.equal(position.x + privateStickyMinimizedWidth(viewport), bounds.right);
  assert.equal(position.y + privateStickyMinimizedHeight(viewport), bounds.bottom);
});
