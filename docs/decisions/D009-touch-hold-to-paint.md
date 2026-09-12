# D009 · Touch paints on hold or tap; swipe scrolls the grid
Date: 2026-09-12 · Goal: G-001 (post-launch fix) · Status: active (superseded by: —)
Context: the grid used `touch-action: none`, so on a phone every touch became a paint stroke and a room wider than the screen could never be scrolled to its later days.
Decision: on touch, a tap paints one cell, holding still 250 ms then dragging paints a run, and any earlier movement is left to the browser as a native scroll; mouse and pen paint immediately.
Rejected: a scroll/paint mode toggle (an extra step before every stroke, easy to leave in the wrong mode); scrolling only via the header row (undiscoverable); `touch-action: none` with in-app scroll handling (reimplements momentum scrolling badly).
Consequence: the grid must keep `touch-action: manipulation` plus the non-passive `touchmove` listener that prevents default only while a stroke is active; changing `touch-action` mid-gesture has no effect, so the listener is the only thing stopping a scroll once painting starts. Cell lookup during a stroke uses `elementFromPoint`, not `pointerenter`.
Evidence: tests/e2e/touch-grid.spec.ts (Pixel 5 emulation, raw CDP touch events); tests/unit/paint.spec.ts (no-op strokes save nothing); commit 47cea71
