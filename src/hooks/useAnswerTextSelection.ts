import { useState, useEffect, useCallback } from 'react';

interface TextSelection {
  text: string;
  rect: DOMRect;
  cardNodeId: string;
}

export function useAnswerTextSelection() {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clear = useCallback(() => {
    setSelection(null);
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      console.log('🔍 Selection change detected');
      const windowSelection = window.getSelection();
      
      // Early return on empty selections
      if (!windowSelection || windowSelection.rangeCount === 0) {
        console.log('❌ No selection or no ranges');
        setSelection(null);
        return;
      }

      const range = windowSelection.getRangeAt(0);
      const selectedText = windowSelection.toString().trim();
      console.log('📝 Selected text:', selectedText);
      
      // Early return on empty text
      if (!selectedText) {
        console.log('❌ Empty selected text');
        setSelection(null);
        return;
      }

      // Check if selection is fully inside one [data-ai-response="true"] container
      const commonAncestor = range.commonAncestorContainer;
      console.log('🎯 Common ancestor:', commonAncestor);
      let aiResponseContainer: Element | null = null;
      
      // Find the closest AI response container
      let currentElement = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement 
        : commonAncestor as Element;
        
      console.log('🔍 Starting element search from:', currentElement);
      
      while (currentElement && currentElement !== document.body) {
        console.log('🔍 Checking element:', currentElement, 'data-ai-response:', currentElement.getAttribute?.('data-ai-response'));
        if (currentElement.getAttribute?.('data-ai-response') === 'true') {
          aiResponseContainer = currentElement;
          console.log('✅ Found AI response container:', aiResponseContainer);
          break;
        }
        currentElement = currentElement.parentElement;
      }

      // Early return if not inside an AI response container
      if (!aiResponseContainer) {
        console.log('❌ Not inside AI response container');
        setSelection(null);
        return;
      }

      // Verify the entire selection is within this AI response container
      const aiResponseRect = aiResponseContainer.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();
      
      console.log('📐 AI response rect:', aiResponseRect);
      console.log('📐 Range rect:', rangeRect);
      
      // Check if selection is fully contained within the AI response container
      if (
        rangeRect.left < aiResponseRect.left ||
        rangeRect.right > aiResponseRect.right ||
        rangeRect.top < aiResponseRect.top ||
        rangeRect.bottom > aiResponseRect.bottom
      ) {
        console.log('❌ Selection extends outside AI response container');
        setSelection(null);
        return;
      }

      // Get the node ID from the AI response container
      const cardNodeId = aiResponseContainer.getAttribute('data-node-id');
      console.log('🎯 Card node ID:', cardNodeId);
      if (!cardNodeId) {
        console.log('❌ No card node ID found');
        setSelection(null);
        return;
      }

      // Set the valid selection
      console.log('✅ Setting valid selection:', { text: selectedText, cardNodeId });
      setSelection({
        text: selectedText,
        rect: rangeRect,
        cardNodeId
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  return { selection, clear };
}