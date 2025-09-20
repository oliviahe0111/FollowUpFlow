import { useRef, useCallback, useState } from 'react';
import { getSelectedTextIn } from '@/utils/textSelection';

export interface SelectionPayload {
  card_id: string;
  role: 'question' | 'answer';
  text_md: string;
}

export function useCardTextSelection() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleCardMouseDown = useCallback((cardId: string) => {
    setActiveCardId(cardId);
    setIsSelecting(true);
    // Add class to document element for CSS targeting
    document.documentElement.classList.add('selecting');
  }, []);

  const handleCardMouseUp = useCallback(() => {
    setIsSelecting(false);
    document.documentElement.classList.remove('selecting');
    // Keep active card for a brief moment to handle "Ask AI" clicks
    setTimeout(() => {
      setActiveCardId(null);
    }, 100);
  }, []);

  const getCardSelectionPayload = useCallback((
    cardRef: React.RefObject<HTMLElement | null>,
    cardId: string,
    role: 'question' | 'answer'
  ): SelectionPayload | null => {
    if (!cardRef.current) {
      return null;
    }

    // Try to get selected text within the card bounds
    let selectedText = getSelectedTextIn(cardRef.current);
    
    // If no valid selection, fall back to full card text
    if (!selectedText) {
      selectedText = cardRef.current.textContent?.trim() || '';
    }

    return {
      card_id: cardId,
      role,
      text_md: selectedText
    };
  }, []);

  const resetSelection = useCallback(() => {
    setActiveCardId(null);
    setIsSelecting(false);
    document.documentElement.classList.remove('selecting');
  }, []);

  return {
    activeCardId,
    isSelecting,
    handleCardMouseDown,
    handleCardMouseUp,
    getCardSelectionPayload,
    resetSelection
  };
}