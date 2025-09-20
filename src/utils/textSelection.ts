/**
 * Returns only text that is selected within the given container element.
 * Uses Range intersection to clamp selection to container bounds.
 */
export function getSelectedTextIn(container: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const range = selection.getRangeAt(0);
  
  // Check if selection intersects with container
  if (!intersectsContainer(range, container)) {
    return '';
  }

  // Create a new range clamped to container bounds
  const clampedRange = clampRangeToContainer(range, container);
  if (!clampedRange) {
    return '';
  }

  // Return text from clamped range
  return clampedRange.toString().trim();
}

/**
 * Checks if a range intersects with a container element
 */
function intersectsContainer(range: Range, container: HTMLElement): boolean {
  const containerRange = document.createRange();
  containerRange.selectNodeContents(container);
  
  try {
    // Check if ranges overlap
    return (
      range.compareBoundaryPoints(Range.END_TO_START, containerRange) <= 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, containerRange) >= 0
    );
  } catch (e) {
    return false;
  }
}

/**
 * Clamps a range to be within container bounds
 */
function clampRangeToContainer(range: Range, container: HTMLElement): Range | null {
  const containerRange = document.createRange();
  containerRange.selectNodeContents(container);
  
  try {
    const clampedRange = range.cloneRange();
    
    // Clamp start boundary
    if (range.compareBoundaryPoints(Range.START_TO_START, containerRange) < 0) {
      clampedRange.setStart(containerRange.startContainer, containerRange.startOffset);
    }
    
    // Clamp end boundary
    if (range.compareBoundaryPoints(Range.END_TO_END, containerRange) > 0) {
      clampedRange.setEnd(containerRange.endContainer, containerRange.endOffset);
    }
    
    return clampedRange.toString().trim() ? clampedRange : null;
  } catch (e) {
    return null;
  }
}