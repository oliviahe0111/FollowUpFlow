import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, X } from 'lucide-react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when popup opens
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      // Small delay to ensure the popup is fully rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isVisible]);

  // Handle escape key to close popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, onClose]);

  if (!isVisible || !selectedText) return null;

  const handleAskAI = () => {
    if (customQuestion.trim()) {
      onAskAI(selectedText, customQuestion.trim());
      setCustomQuestion('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4"
        style={{
          left: Math.min(position.x, window.innerWidth - 320),
          top: position.y - 180,
          width: '300px'
        }}
        onClick={(e) => {
          console.log('🎈 Popup clicked - preventing propagation');
          e.stopPropagation();
        }}
        data-selection-popup="true" // Mark as selection UI to prevent interference
        data-selection-ui="true" // Additional marker
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-900">Ask AI about this</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="w-3 h-3 text-gray-900" />
          </Button>
        </div>
        
        {/* Selected Text Preview */}
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-600 mb-1 block">Selected text:</span>
          <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border max-h-16 overflow-y-auto">
            "{selectedText.length > 80 ? selectedText.substring(0, 80) + '...' : selectedText}"
          </div>
        </div>
        
        {/* Question Input */}
        <div className="mb-3">
          <span className="text-xs font-medium text-gray-600 mb-1 block">Your question:</span>
          <Textarea
            ref={textareaRef}
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="What would you like to ask about this text?"
            className="border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none text-gray-900 placeholder:text-gray-500"
            rows={3}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleAskAI}
            disabled={!customQuestion.trim()}
            className="text-white text-sm flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Brain className="w-4 h-4 mr-1" />
            Ask AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-sm text-gray-900 font-semibold"
          >
            Cancel
          </Button>
        </div>
        
        {/* Keyboard hints */}
        <div className="mt-2 text-center">
          <span className="text-xs text-gray-500">
            Press Escape to close • Ctrl+Enter to submit
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(popupContent, document.body);
}