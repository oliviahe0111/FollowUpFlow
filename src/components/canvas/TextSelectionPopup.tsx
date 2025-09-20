import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TextSelectionPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onAskAI: (selectedText: string, customQuestion: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function TextSelectionPopup({
  selectedText,
  position,
  onAskAI,
  onClose,
  isVisible
}: TextSelectionPopupProps) {
  const [customQuestion, setCustomQuestion] = useState('');
  const [showInput, setShowInput] = useState(false);

  if (!isVisible || !selectedText) return null;

  const handleAskAI = () => {
    if (customQuestion.trim()) {
      onAskAI(selectedText, customQuestion.trim());
      setCustomQuestion('');
      setShowInput(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskAI();
    }
  };

  const popupContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3"
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: position.y - (showInput ? 140 : 100),
          width: '300px'
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium">Selected Text</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1"
            onClick={onClose}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        
        <div className="text-xs text-gray-700 mb-3 max-h-16 overflow-y-auto bg-gray-50 p-2 rounded border">
          "{selectedText.length > 80 ? selectedText.substring(0, 80) + '...' : selectedText}"
        </div>
        
        {!showInput ? (
          <Button
            size="sm"
            className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setShowInput(true)}
          >
            <Brain className="w-3 h-3 mr-1" />
            Ask AI about this
          </Button>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="What would you like to ask about the selected text?"
              className="text-xs resize-none border-2 focus:ring-2 focus:ring-blue-500/20"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAskAI}
                disabled={!customQuestion.trim()}
                className="text-white text-xs flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-3 h-3 mr-1" />
                Ask AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowInput(false);
                  setCustomQuestion('');
                }}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(popupContent, document.body);
}