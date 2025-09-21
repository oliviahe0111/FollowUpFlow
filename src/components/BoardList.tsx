import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Plus, MessageCircle, Calendar, AlertTriangle, X } from 'lucide-react';
import { Board } from '@/entities/all';
import type { Board as BoardType } from '@/types/domain';
import AuthStatusBadge from '@/components/AuthStatusBadge';

// Utility function for retry logic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface BoardListProps {
  onSelectBoard: (board: BoardType) => void;
  onCreateNewBoard: () => void;
  currentBoard?: BoardType;
}

export default function BoardList({ onSelectBoard, onCreateNewBoard, currentBoard }: BoardListProps) {
  const [boards, setBoards] = useState<BoardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);

  const deleteBoard = async (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent board selection when clicking delete
    
    if (!confirm('Are you sure you want to delete this board? This action cannot be undone.')) {
      return;
    }

    setDeletingBoardId(boardId);
    
    try {
      const response = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete board');
      }

      // Remove the board from the local state
      setBoards(prevBoards => prevBoards.filter(board => board.id !== boardId));
      
      // If the deleted board was the current board, clear the selection
      if (currentBoard?.id === boardId) {
        // You might want to call a callback here to clear the current board
        // onSelectBoard(null); // Uncomment if you have this functionality
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      setError('Failed to delete board. Please try again.');
    } finally {
      setDeletingBoardId(null);
    }
  };

  useEffect(() => {
    const loadBoards = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const allBoards = await retryWithBackoff(() => Board.list());
        setBoards(allBoards);
      } catch (error) {
        console.error('Error loading boards:', error);
        setError('Failed to load boards. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadBoards();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
            <Brain className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">Loading your boards...</p>
            <p className="text-sm text-gray-500">Just a moment</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Header */}
      <motion.header
        className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">FollowUpFlow</h1>
                <p className="text-sm text-gray-600 font-medium">AI-powered brainstorming boards</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AuthStatusBadge />
              <Button
                onClick={onCreateNewBoard}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Board
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {boards.length === 0 && !error ? (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to FollowUpFlow</h2>
              <p className="text-gray-700 font-medium mb-8 max-w-md mx-auto">
                Create your first brainstorming board to start exploring ideas with AI-powered follow-up questions.
              </p>
              <Button
                onClick={onCreateNewBoard}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-8 py-3 text-lg"
              >
                <Plus className="w-5 h-5 mr-3" />
                Create Your First Board
              </Button>
            </motion.div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Your Boards</h2>
                <p className="text-gray-700 font-medium">Continue working on your existing brainstorming sessions</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {boards.map((board, index) => (
                    <motion.div
                      key={board.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card 
                        className={`
                          group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 overflow-hidden
                          ${currentBoard?.id === board.id 
                            ? 'border-blue-300 bg-blue-50/50' 
                            : 'border-gray-200 hover:border-blue-200'
                          }
                        `}
                        onClick={() => onSelectBoard(board)}
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                                {board.title}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">
                                  {formatDate(board.created_at)}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => deleteBoard(board.id, e)}
                              disabled={deletingBoardId === board.id}
                              className="p-1 rounded-full hover:bg-red-100 transition-colors group/delete flex-shrink-0 ml-2"
                              title="Delete board"
                            >
                              <X className={`w-4 h-4 transition-colors ${
                                deletingBoardId === board.id 
                                  ? 'text-gray-400' 
                                  : 'text-gray-400 group-hover/delete:text-red-600'
                              }`} />
                            </button>
                          </div>
                          
                          {board.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                              {board.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>Ideas</span>
                            </div>
                            {currentBoard?.id === board.id && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                Current
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}