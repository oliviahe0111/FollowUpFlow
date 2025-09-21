import { useState, useEffect, useCallback } from 'react';

interface TextSelection {
  text: string;
  rect: DOMRect;
  cardNodeId: string;
}

export function useAnswerTextSelection() {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [snapshotSelection, setSnapshotSelection] = useState<TextSelection | null>(null);
  const [suppressClearUntil, setSuppressClearUntil] = useState<number>(0);

  const clear = useCallback(() => {
    setSelection(null);
    setSnapshotSelection(null);
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  // Function to suppress selection clearing for a short window (e.g., after chip click)
  const suppressClearTemporarily = useCallback(() => {
    const suppressUntil = Date.now() + 200; // 200ms suppress window
    setSuppressClearUntil(suppressUntil);
    console.log('🔒 Suppressing selection clears until:', suppressUntil);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const windowSelection = window.getSelection();
      const selectedText = windowSelection?.toString().trim() || '';
      const now = Date.now();
      const isInSuppressWindow = now < suppressClearUntil;
      
      console.log('🔍 Selection change detected - text length:', selectedText.length, 'current stored selection:', !!selection, 'suppress window active:', isInSuppressWindow);
      
      // Early return on empty selections, but respect suppress window
      if (!windowSelection || windowSelection.rangeCount === 0) {
        if (isInSuppressWindow) {
          console.log('🔒 Ignoring empty selection due to suppress window');
          return;
        }
        console.log('❌ No selection or no ranges - clearing stored selection');
        setSelection(null);
        return;
      }

      const range = windowSelection.getRangeAt(0);
      console.log('📝 Selected text length:', selectedText.length, 'text preview:', selectedText.slice(0, 30));
      
      // Early return on empty text, but respect suppress window
      if (!selectedText) {
        if (isInSuppressWindow) {
          console.log('🔒 Ignoring empty text selection due to suppress window');
          return;
        }
        console.log('❌ Empty selected text - clearing stored selection');
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
        const isAiResponse = currentElement.getAttribute?.('data-ai-response') === 'true';
        console.log('🔍 Checking element:', currentElement.tagName, 'data-ai-response:', isAiResponse);
        if (isAiResponse) {
          aiResponseContainer = currentElement;
          console.log('✅ Found AI response container:', aiResponseContainer);
          break;
        }
        currentElement = currentElement.parentElement;
      }

      // Early return if not inside an AI response container
      if (!aiResponseContainer) {
        console.log('❌ Not inside AI response container - clearing stored selection');
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
      const newSelection = {
        text: selectedText,
        rect: rangeRect,
        cardNodeId
      };
      setSelection(newSelection);
      setSnapshotSelection(newSelection); // Always snapshot valid selections
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [selection, suppressClearUntil]);

  return { selection, snapshotSelection, clear, suppressClearTemporarily };
}