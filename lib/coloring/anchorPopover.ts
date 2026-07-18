/** Clamp a popover near an anchor rect so it stays in the viewport. */

export interface PopoverPosition {
  top: number;
  left: number;
}

const MARGIN = 12;

/**
 * Prefer placing the popover to the left of the anchor (near the swatch),
 * falling back to the right; vertically align to the anchor top and clamp.
 */
export function clampPopoverNearAnchor(
  anchor: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  viewport: { width: number; height: number } = {
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768,
  }
): PopoverPosition {
  let left = anchor.left - popoverWidth - MARGIN;
  if (left < MARGIN) {
    left = Math.min(anchor.right + MARGIN, viewport.width - popoverWidth - MARGIN);
  }
  left = Math.max(MARGIN, Math.min(left, viewport.width - popoverWidth - MARGIN));

  let top = anchor.top;
  if (top + popoverHeight > viewport.height - MARGIN) {
    top = Math.max(MARGIN, viewport.height - popoverHeight - MARGIN);
  }
  top = Math.max(MARGIN, top);

  return { top, left };
}
