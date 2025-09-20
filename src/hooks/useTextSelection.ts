import { useState, useEffect, useCallback } from 'react';

interface TextSelection {
  text: string;
  range: Range | null;
  rect: DOMRect | null;
  containerElement: Element | null;
}

export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelection>({
    text: '',
    range: null,
    rect: null,
    containerElement: null
  });

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();
    
    if (windowSelection && windowSelection.rangeCount > 0) {
      const range = windowSelection.getRangeAt(0);
      const text = windowSelection.toString().trim();
      
      if (text.length > 0) {
        // Get start and end containers
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        
        // Find their respective AI response containers
        const startAIContainer = (startContainer.nodeType === Node.TEXT_NODE 
          ? startContainer.parentElement 
          : startContainer as Element)?.closest('[data-ai-response="true"]');
          
        const endAIContainer = (endContainer.nodeType === Node.TEXT_NODE 
          ? endContainer.parentElement 
          : endContainer as Element)?.closest('[data-ai-response="true"]');
        
        // Find their respective card containers
        const startCard = startAIContainer?.closest('[data-node-id]');
        const endCard = endAIContainer?.closest('[data-node-id]');
        
        // Only allow selection if:
        // 1. Both start and end are within AI response areas
        // 2. Both are within the same card
        // 3. Both are within the same AI response container
        if (startAIContainer && 
            endAIContainer && 
            startCard && 
            endCard && 
            startCard === endCard && 
            startAIContainer === endAIContainer) {
          
          const rect = range.getBoundingClientRect();
          setSelection({
            text,
            range,
            rect,
            containerElement: startAIContainer
          });
        } else {
          // Clear selection if it spans multiple cards or non-AI areas
          windowSelection.removeAllRanges();
          setSelection({ text: '', range: null, rect: null, containerElement: null });
        }
      } else {
        setSelection({ text: '', range: null, rect: null, containerElement: null });
      }
    } else {
      setSelection({ text: '', range: null, rect: null, containerElement: null });
    }
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: '', range: null, rect: null, containerElement: null });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Add mousedown listener to prevent cross-card selection
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      const aiResponseArea = target.closest('[data-ai-response="true"]');
      
      // If clicking outside AI response areas, clear any existing selection
      if (!aiResponseArea) {
        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.rangeCount > 0) {
          currentSelection.removeAllRanges();
        }
      }
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleSelectionChange]);

  return {
    selection,
    clearSelection,
    hasSelection: selection.text.length > 0
  };
}