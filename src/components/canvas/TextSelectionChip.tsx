import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface TextSelectionChipProps {
  rect: DOMRect;
  onClick: () => void;
}

export function TextSelectionChip({ rect, onClick }: TextSelectionChipProps) {
  // Calculate position with viewport clamping
  const left = Math.min(rect.right + 8, window.innerWidth - 160);
  const top = Math.max(rect.top - 8, 12);

  return createPortal(
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
    >
      <Button
        size="sm"
        onClick={onClick}
        className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg border border-blue-500 text-xs px-3 py-1 h-auto"
      >
        <MessageCircle className="w-3 h-3 mr-1" />
        Ask AI about this
      </Button>
    </div>,
    document.body
  );
}