import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Lightbulb, Send, Plus, Clock, ArrowRight } from 'lucide-react';
import { Board } from '@/entities/all';
import type { Board as BoardType } from '@/types/domain';

// Utility function for retry logic
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

interface StartModalProps {
  open: boolean;
  onClose: () => void;
  onCreateBoard: (title: string, rootQuestion: string) => Promise<void>;
  onAddRootQuestion: (rootQuestion: string) => Promise<void>;
  currentBoard?: { id: string; title: string } | null;
  onSelectBoard?: (board: BoardType) => void;
}

export default function StartModal({ 
  open, 
  onClose, 
  onCreateBoard, 
  onAddRootQuestion, 
  currentBoard,
  onSelectBoard
}: StartModalProps) {
  const [title, setTitle] = useState('');
  const [rootQuestion, setRootQuestion] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [existingBoards, setExistingBoards] = useState<BoardType[]>([]);

  const isAddingToExisting = !!currentBoard;

  useEffect(() => {
    if (open && !isAddingToExisting) {
      // Load existing boards when modal opens for new board creation
      const loadBoards = async () => {
        try {
          const boards = await retryWithBackoff(() => Board.list());
          setExistingBoards(boards);
        } catch (error) {
          console.error('Error loading boards:', error);
        }
      };
      loadBoards();
    }
  }, [open, isAddingToExisting]);

  const handleCreate = async () => {
    if (!rootQuestion.trim()) return;
    if (!isAddingToExisting && !title.trim()) return;
    
    setIsCreating(true);
    try {
      if (isAddingToExisting) {
        await onAddRootQuestion(rootQuestion.trim());
      } else {
        await onCreateBoard(title.trim(), rootQuestion.trim());
      }
      setTitle('');
      setRootQuestion('');
      onClose();
    } catch (error) {
      console.error('Error:', error);
    }
    setIsCreating(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white shadow-2xl border-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-gray-900 font-semibold">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              {isAddingToExisting ? <Plus className="w-5 h-5 text-white" /> : <Lightbulb className="w-5 h-5 text-white" />}
            </div>
            {isAddingToExisting ? 'Add New Root Question' : 'Start Your Brainstorm'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!isAddingToExisting && (
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-semibold text-gray-900">
                Board Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Product Ideas, Marketing Strategy..."
                className="border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-gray-900 placeholder:text-gray-500"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="question" className="text-sm font-semibold text-gray-900">
              {isAddingToExisting ? 'New Root Question' : 'Your First Question'}
            </Label>
            <Textarea
              id="question"
              value={rootQuestion}
              onChange={(e) => setRootQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="What would you like to explore? Ask anything..."
              className="border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none text-gray-900 placeholder:text-gray-500"
              rows={3}
            />
          </div>
          
          <p className="text-xs text-gray-700 font-medium">
            Tip: Press Ctrl+Enter to {isAddingToExisting ? 'add question' : 'create board'} quickly
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 text-gray-900 font-semibold border-gray-300 hover:bg-gray-100"
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!rootQuestion.trim() || (!isAddingToExisting && !title.trim()) || isCreating}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
          >
            {isCreating ? (
              "Processing..."
            ) : (
              <>
                {isAddingToExisting ? <Plus className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {isAddingToExisting ? 'Add Question' : 'Create Board'}
              </>
            )}
          </Button>
        </div>

        {/* Show existing boards for new board creation */}
        {!isAddingToExisting && existingBoards.length > 0 && (
          <>
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Or continue with an existing board:</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {existingBoards.map((board) => (
                  <Card 
                    key={board.id}
                    className="p-3 cursor-pointer hover:bg-gray-50 transition-colors border hover:border-blue-300"
                    onClick={() => {
                      if (onSelectBoard) {
                        onSelectBoard(board);
                        onClose();
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{board.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-800" />
                          <span className="text-xs text-gray-900 font-medium">
                            {new Date(board.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-800 flex-shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}