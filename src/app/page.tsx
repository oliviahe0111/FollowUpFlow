'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board, Node, Edge } from '@/entities/all';
import { InvokeLLM } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Plus, Brain, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';

import CanvasNode from '@/components/canvas/CanvasNode';
import CanvasControls from '@/components/canvas/CanvasControls';
import StartModal from '@/components/canvas/StartModal';
import BoardList from '@/components/BoardList';
import { useAnswerTextSelection } from '@/hooks/useAnswerTextSelection';
import { TextSelectionChip } from '@/components/canvas/TextSelectionChip';
import TextSelectionPopup from '@/components/canvas/TextSelectionPopup';

// Rate limit retry utility - moved outside the component to ensure stability
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.message.includes('Rate limit') && i < maxRetries - 1) {
        console.warn(`Rate limit hit, retrying in ${delay * Math.pow(2, i)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      throw error;
    }
  }
};

export default function BrainstormPage() {
  const [currentBoard, setCurrentBoard] = useState<any>(null);
  const [showBoardList, setShowBoardList] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalMode, setModalMode] = useState<'new-board' | 'add-question'>('new-board');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSelectionPopup, setShowSelectionPopup] = useState(false);

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Color coding state for root questions
  const [rootQuestionOrder, setRootQuestionOrder] = useState<Record<string, number>>({});
  const [nextRootIndex, setNextRootIndex] = useState(0);

  // Text selection hook for AI answers
  const { selection, snapshotSelection, clear: clearSelection, suppressClearTemporarily } = useAnswerTextSelection();

  // Debug selection changes
  useEffect(() => {
    console.log('🎈 Selection changed:', selection ? selection.text.slice(0, 50) : 'null');
    // Only close popup if selection is cleared AND we don't have a snapshot to preserve popup data
    if (!selection && !snapshotSelection) {
      console.log('🎈 Selection and snapshot cleared - closing popup (showSelectionPopup was:', showSelectionPopup, ')');
      setShowSelectionPopup(false);
    } else if (!selection && snapshotSelection) {
      console.log('🎈 Selection cleared but snapshot preserved - keeping popup open');
    }
  }, [selection, snapshotSelection, showSelectionPopup]);

  // Debug popup state changes
  useEffect(() => {
    console.log('🎈 showSelectionPopup state changed to:', showSelectionPopup, 'at timestamp:', Date.now());
  }, [showSelectionPopup]);

  // calculateNewNodePosition does not depend on any state directly, only its arguments
  const calculateNewNodePosition = useCallback((parentNodeId: string, allNodes: any[]) => {
    const parentNode = allNodes.find(n => n.id === parentNodeId);
    if (!parentNode) return { x: 100, y: 100 }; // Fallback position

    const children = allNodes.filter(n => n.parent_id === parentNodeId);

    // Position horizontally next to the parent
    const x = parentNode.x + parentNode.width + 100; // Horizontal spacing
    let y = parentNode.y;

    // If there are existing children, stack the new node below the last child
    if (children.length > 0) {
      const lastChild = children.reduce((prev, current) => (prev.y > current.y) ? prev : current);
      y = lastChild.y + lastChild.height + 40; // Vertical spacing
    }

    return { x, y };
  }, []);

  const loadBoard = useCallback(async (board: any) => {
    try {
      setCurrentBoard(board);

      // Load nodes and edges with retry logic
      const [boardNodes, boardEdges] = await Promise.all([
        retryWithBackoff(() => Node.filter({ board_id: board.id })),
        retryWithBackoff(() => Edge.filter({ board_id: board.id }))
      ]);

      setNodes(boardNodes);
      setEdges(boardEdges);
      setError(null);

      // Build root question color mapping
      const rootQuestions = boardNodes.filter((n: any) => n.type === 'root_question');
      const colorMapping: Record<string, number> = {};
      rootQuestions.forEach((root: any, index: number) => {
        colorMapping[root.id] = index;
      });
      setRootQuestionOrder(colorMapping);
      setNextRootIndex(rootQuestions.length);

    } catch (error) {
      console.error('Error loading board data:', error);
      setError('Failed to load board data. Please try again.');
      throw error; // Re-throw to propagate the error up
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Just show the board list instead of auto-loading a board
        setShowBoardList(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setError('Failed to initialize app. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [loadBoard]);

  // Build contextual prompt with conversation history
  const buildContextualPrompt = (parentNodeId: string, question: string, currentNodes: any[], rootId: string): string => {
    let context = "";
    
    // Find the root question for overall context
    const rootNode = currentNodes.find(n => n.id === rootId);
    if (rootNode) {
      context += `Original Topic: ${rootNode.content}\n\n`;
    }
    
    // Find the parent node to understand what we're following up on
    const parentNode = currentNodes.find(n => n.id === parentNodeId);
    if (parentNode) {
      if (parentNode.type === 'ai_answer' || parentNode.type === 'followup_answer') {
        // Following up on an AI response
        context += `Previous AI Response: ${parentNode.content}\n\n`;
        
        // Find the question that led to this answer
        const parentQuestion = currentNodes.find(n => n.id === parentNode.parent_id);
        if (parentQuestion) {
          context += `Previous Question: ${parentQuestion.content}\n\n`;
        }
      } else {
        // Following up on a question
        context += `Previous Question: ${parentNode.content}\n\n`;
        
        // Find the AI answer to that question
        const aiAnswer = currentNodes.find(n => n.parent_id === parentNode.id && (n.type === 'ai_answer' || n.type === 'followup_answer'));
        if (aiAnswer) {
          context += `Previous AI Response: ${aiAnswer.content}\n\n`;
        }
      }
    }
    
    // Build conversation thread by walking up the parent chain
    const conversationChain = [];
    let currentNodeId = parentNodeId;
    let depth = 0;
    const maxDepth = 3; // Limit context to avoid very long prompts
    
    while (currentNodeId && depth < maxDepth) {
      const node = currentNodes.find(n => n.id === currentNodeId);
      if (!node || node.id === rootId) break;
      
      if (node.type === 'root_question' || node.type === 'followup_question') {
        conversationChain.unshift(`Q: ${node.content}`);
      } else if (node.type === 'ai_answer' || node.type === 'followup_answer') {
        conversationChain.unshift(`A: ${node.content.substring(0, 200)}${node.content.length > 200 ? '...' : ''}`);
      }
      
      currentNodeId = node.parent_id;
      depth++;
    }
    
    if (conversationChain.length > 0) {
      context += `Recent Conversation:\n${conversationChain.join('\n')}\n\n`;
    }
    
    return `${context}New Question: ${question}\n\nProvide a thoughtful, detailed response that builds on this conversation context. Be insightful and offer specific, actionable ideas.`;
  };

  const generateAIResponse = useCallback(async (parentNodeId: string, question: string, boardId: string, rootId: string, currentNodes: any[]) => {
    setIsGenerating(true);
    setGeneratingNodeId(parentNodeId);
    setError(null);

    try {
      // Build contextual prompt with conversation history
      const fullPrompt = buildContextualPrompt(parentNodeId, question, currentNodes, rootId);
      
      // Log the full prompt being sent to the LLM
      console.log('🤖 LLM Prompt:', fullPrompt);

      const response = await InvokeLLM({
        prompt: fullPrompt,
        add_context_from_internet: false
      });

      const responseType = currentNodes.find((n: any) => n.id === parentNodeId)?.type === 'root_question' ? 'ai_answer' : 'followup_answer';

      const { x, y } = calculateNewNodePosition(parentNodeId, currentNodes);

      const responseNode = await retryWithBackoff(() => Node.create({
        board_id: boardId,
        type: responseType,
        content: response,
        root_id: rootId,
        parent_id: parentNodeId,
        x,
        y,
        width: 320,
        height: Math.max(160, Math.min(240, response.length / 4))
      }));

      const newEdge = await retryWithBackoff(() => Edge.create({
        board_id: boardId,
        source_id: parentNodeId,
        target_id: responseNode.id
      }));

      // Update local state instead of reloading everything
      setNodes(prev => [...prev, responseNode]);
      setEdges(prev => [...prev, newEdge]);

    } catch (error) {
      console.error('Error generating response:', error);
      setError('Failed to generate AI response. Please try again.');
    }

    setIsGenerating(false);
    setGeneratingNodeId(null);
  }, [calculateNewNodePosition]);

  const createBoard = useCallback(async (title: string, rootQuestion: string) => {
    try {
      setError(null);

      const board = await retryWithBackoff(() => Board.create({ title }));

      const rootNode = await retryWithBackoff(() => Node.create({
        board_id: board.id,
        type: 'root_question',
        content: rootQuestion,
        x: 100, // Always start root on the left
        y: 200,
        width: 320,
        height: 140
      }));

      await retryWithBackoff(() => Node.update(rootNode.id, { root_id: rootNode.id }));

      setCurrentBoard(board);
      const newNodes = [{ ...rootNode, root_id: rootNode.id }]; // Capture nodes immediately
      setNodes(newNodes);
      setEdges([]);

      // Initialize root question color mapping
      setRootQuestionOrder({ [rootNode.id]: 0 });
      setNextRootIndex(1);

      // Navigate to canvas view
      setShowBoardList(false);
      setShowStartModal(false);

      // Generate AI response after a short delay to avoid rate limits
      setTimeout(() => {
        generateAIResponse(rootNode.id, rootQuestion, board.id, rootNode.id, newNodes); // Pass the updated nodes
      }, 500);
    } catch (error) {
      console.error('Error creating board:', error);
      setError('Failed to create board. Please try again.');
    }
  }, [generateAIResponse]);

  const handleSelectBoard = useCallback(async (board: any) => {
    try {
      await loadBoard(board);
      setShowBoardList(false);
    } catch (error) {
      console.error('Error loading board:', error);
      setError('Failed to load board. Please try again.');
    }
  }, [loadBoard]);

  const handleCreateNewBoard = useCallback(() => {
    setModalMode('new-board');
    setShowStartModal(true);
  }, []);

  const handleBackToBoardList = useCallback(() => {
    setShowBoardList(true);
    setCurrentBoard(null);
    setNodes([]);
    setEdges([]);
  }, []);

  const addRootQuestion = useCallback(async (rootQuestion: string) => {
    if (!currentBoard) return;

    try {
      setError(null);

      // Find a good position for the new root question below the bottom-most existing root
      const existingRoots = nodes.filter((n: any) => n.type === 'root_question');
      const bottomMostRoot = existingRoots.reduce((prev, current) => {
        const prevY = prev.y !== undefined ? prev.y : -Infinity;
        const prevHeight = prev.height !== undefined ? prev.height : 0;
        const currentY = current.y !== undefined ? current.y : -Infinity;
        const currentHeight = current.height !== undefined ? current.height : 0;

        return (prevY + prevHeight) > (currentY + currentHeight) ? prev : current;
      }, { y: 100, height: 0 }); // Initial value to ensure calculation

      // Calculate y position for the new root
      const newRootY = (bottomMostRoot.y !== undefined ? bottomMostRoot.y : 100) + (bottomMostRoot.height !== undefined ? bottomMostRoot.height : 0) + 100;

      const rootNode = await retryWithBackoff(() => Node.create({
        board_id: currentBoard.id,
        type: 'root_question',
        content: rootQuestion,
        x: 100, // Fixed X for all root questions
        y: newRootY,
        width: 320,
        height: 140
      }));

      await retryWithBackoff(() => Node.update(rootNode.id, { root_id: rootNode.id }));

      // Update color mapping for new root question
      setRootQuestionOrder(prev => ({
        ...prev,
        [rootNode.id]: nextRootIndex
      }));
      setNextRootIndex(prev => prev + 1);

      // Update local state
      const newNodes = [...nodes, { ...rootNode, root_id: rootNode.id }]; // Capture nodes immediately
      setNodes(newNodes);

      // Generate AI response after a short delay
      setTimeout(() => {
        generateAIResponse(rootNode.id, rootQuestion, currentBoard.id, rootNode.id, newNodes); // Pass the updated nodes
      }, 500);
    } catch (error) {
      console.error('Error adding root question:', error);
      setError('Failed to add root question. Please try again.');
    }
  }, [currentBoard, nodes, generateAIResponse, nextRootIndex]);

  const handleAddFollowup = useCallback(async (parentNodeId: string, followupQuestion: string) => {
    if (!currentBoard) return;
    setError(null);

    // Log the follow-up question being processed
    console.log('🔗 Processing follow-up question:', {
      parentNodeId,
      question: followupQuestion,
      timestamp: new Date().toISOString()
    });

    try {
      const parentNode = nodes.find((n: any) => n.id === parentNodeId);
      if (!parentNode) {
        throw new Error('Parent node not found.');
      }
      const rootId = parentNode.root_id || parentNode.id;

      const { x, y } = calculateNewNodePosition(parentNodeId, nodes);

      const questionNode = await retryWithBackoff(() => Node.create({
        board_id: currentBoard.id,
        type: 'followup_question',
        content: followupQuestion,
        root_id: rootId,
        parent_id: parentNodeId,
        x,
        y,
        width: 320,
        height: Math.max(140, Math.min(180, followupQuestion.length / 3))
      }));

      const newEdge = await retryWithBackoff(() => Edge.create({
        board_id: currentBoard.id,
        source_id: parentNodeId,
        target_id: questionNode.id
      }));

      // Update local state
      const newNodes = [...nodes, questionNode]; // Capture nodes immediately
      setNodes(newNodes);
      setEdges(prev => [...prev, newEdge]);

      // Generate AI response after a short delay
      setTimeout(() => {
        generateAIResponse(questionNode.id, followupQuestion, currentBoard.id, rootId, newNodes); // Pass the updated nodes
      }, 500);

    } catch (error) {
      console.error('Error adding followup:', error);
      setError('Failed to add follow-up question. Please try again.');
    }
  }, [currentBoard, nodes, calculateNewNodePosition, generateAIResponse]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    if (!currentBoard) return;
    setError(null);

    try {
      // Optimistically update UI first
      const nodeToDelete = nodes.find(n => n.id === nodeId);
      if (!nodeToDelete) return;

      // Remove the node and its edges from state
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      setEdges(prev => prev.filter(e => e.source_id !== nodeId && e.target_id !== nodeId));

      // Call the API to delete the node (this will handle reparenting)
      await retryWithBackoff(() => Node.delete(nodeId));

      // Refresh the board data to get the updated parent-child relationships
      const updatedNodes = await Node.filter({ board_id: currentBoard.id });
      const updatedEdges = await Edge.filter({ board_id: currentBoard.id });
      
      setNodes(updatedNodes);
      setEdges(updatedEdges);

    } catch (error) {
      console.error('Error deleting node:', error);
      setError('Failed to delete question. Please try again.');
      
      // Refresh data to restore consistent state
      if (currentBoard) {
        const nodes = await Node.filter({ board_id: currentBoard.id });
        const edges = await Edge.filter({ board_id: currentBoard.id });
        setNodes(nodes);
        setEdges(edges);
      }
    }
  }, [currentBoard, nodes]);

  // Canvas interaction handlers
  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas panning when dragging a node

    let nodeElement = (e.currentTarget as HTMLElement).closest('[data-node-id]') as HTMLElement;
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    setIsDraggingNode(true);
    setDraggedNode(nodeId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left - offset.x) / zoom;
    const startY = (e.clientY - rect.top - offset.y) / zoom;

    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    const offsetX = startX - node.x;
    const offsetY = startY - node.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = (moveEvent.clientX - rect.left - offset.x) / zoom - offsetX;
      const newY = (moveEvent.clientY - rect.top - offset.y) / zoom - offsetY;

      setNodes(prev => prev.map((n: any) =>
        n.id === nodeId ? { ...n, x: newX, y: newY } : n
      ));
    };

    const handleMouseUp = async () => {
      setIsDraggingNode(false);
      setDraggedNode(null);

      const node = nodes.find((n: any) => n.id === nodeId);
      if (node) {
        try {
          await retryWithBackoff(() => Node.update(nodeId, { x: node.x, y: node.y }));
          setError(null);
        } catch (error) {
          console.error('Error updating node position:', error);
          setError('Failed to save node position. Please try again.');
        }
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [nodes, offset, zoom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isDraggingNode) return;

    const clickedNode = (e.target as HTMLElement).closest('[data-node-id]');
    if (clickedNode) return;

    e.preventDefault();
    setIsPanning(true);

    const startPan = { x: e.clientX - offset.x, y: e.clientY - offset.y };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setOffset({
        x: moveEvent.clientX - startPan.x,
        y: moveEvent.clientY - startPan.y
      });
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [offset, isDraggingNode]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointer = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const delta = e.deltaY * -0.002;
    const newZoom = Math.min(Math.max(0.1, zoom * (1 + delta)), 3);

    if (newZoom !== zoom) {
      const worldPosBeforeZoom = {
        x: (pointer.x - offset.x) / zoom,
        y: (pointer.y - offset.y) / zoom,
      };

      const worldPosAfterZoom = {
        x: (pointer.x - offset.x) / newZoom,
        y: (pointer.y - offset.y) / newZoom,
      };

      const newOffset = {
        x: offset.x + (worldPosAfterZoom.x - worldPosBeforeZoom.x) * newZoom,
        y: offset.y + (worldPosAfterZoom.y - worldPosBeforeZoom.y) * newZoom,
      };

      setZoom(newZoom);
      setOffset(newOffset);
    }
  }, [zoom, offset]);

  // Add wheel event listener for zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      handleWheel(e);
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [handleWheel]);

  // Control functions
  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 3);
    setZoom(newZoom);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
  }, [zoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const fitToContent = useCallback(() => {
    if (nodes.length === 0) return;

    const padding = 100;
    const bounds = nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      maxX: Math.max(acc.maxX, node.x + node.width),
      minY: Math.min(acc.minY, node.y),
      maxY: Math.max(acc.maxY, node.y + node.height)
    }), {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });

    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const centerX = bounds.minX + contentWidth / 2;
    const centerY = bounds.minY + contentHeight / 2;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 100;

    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const newZoom = Math.min(Math.max(0.1, Math.min(scaleX, scaleY)), 2);

    setZoom(newZoom);
    setOffset({
      x: canvasWidth / 2 - centerX * newZoom,
      y: (canvasHeight + 100) / 2 - centerY * newZoom,
    });
  }, [nodes]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your brainstorming workspace...</p>
        </div>
      </div>
    );
  }

  // Show board list view
  if (showBoardList) {
    return (
      <>
        <StartModal
          open={showStartModal}
          onClose={() => setShowStartModal(false)}
          onCreateBoard={createBoard}
          onAddRootQuestion={addRootQuestion}
          currentBoard={null}
          onSelectBoard={handleSelectBoard}
        />
        <BoardList
          onSelectBoard={handleSelectBoard}
          onCreateNewBoard={handleCreateNewBoard}
          currentBoard={null}
        />
      </>
    );
  }

  // Canvas view (when a board is selected)
  if (!currentBoard) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center space-y-4">
          <p className="text-gray-600">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50 relative">
      {/* Error Alert */}
      <AnimatePresence>
      {error && (
        <motion.div
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 flex items-center justify-between">
              {error}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-auto p-0 text-red-600 hover:text-red-800"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        className="absolute top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={handleBackToBoardList}
              title="Back to board list"
            >
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{currentBoard.title}</h1>
              <p className="text-xs text-gray-500">{nodes.length} ideas • Infinite Canvas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModalMode('add-question');
                setShowStartModal(true);
              }}
              className="text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-gray-800 font-medium border-gray-300"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalMode('new-board');
                setShowStartModal(true);
              }}
              className="text-sm hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors text-gray-800 font-medium border-gray-300"
              size="sm"
            >
              New Board
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="h-full w-full pt-20 relative overflow-hidden bg-gradient-to-br from-gray-50/50 via-white to-blue-50/30 canvas-container"
        onMouseDown={handleCanvasMouseDown}
        style={{
          cursor: isPanning ? 'grabbing' : isDraggingNode ? 'grabbing' : 'grab',
          touchAction: 'none'
        }}
      >

        <AnimatePresence>
          {nodes.map((node) => {
            const rootId = node.root_id || node.id;
            const rootIndex = rootQuestionOrder[rootId] !== undefined ? rootQuestionOrder[rootId] : 0;

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                className="absolute"
                style={{
                  transform: `translate(${offset.x + node.x * zoom}px, ${offset.y + node.y * zoom}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  zIndex: draggedNode === node.id ? 1000 : 1
                }}
              >
                <CanvasNode
                  node={node}
                  onAddFollowup={handleAddFollowup}
                  onDelete={handleDeleteNode}
                  isGenerating={generatingNodeId === node.id}
                  isDragging={draggedNode === node.id}
                  onMouseDown={handleNodeMouseDown}
                  rootQuestionIndex={rootIndex}
                  allNodes={nodes}
                />
              </div>
            );
          })}
        </AnimatePresence>

        {/* Generation indicator */}
        {isGenerating && (
          <motion.div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="bg-white rounded-xl shadow-xl p-6 flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">AI is thinking...</p>
                <p className="text-sm text-gray-500">Generating your response</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <CanvasControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={resetView}
        onFitToContent={fitToContent}
      />

      <StartModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
        onCreateBoard={createBoard}
        onAddRootQuestion={addRootQuestion}
        currentBoard={modalMode === 'add-question' ? currentBoard : null}
        onSelectBoard={handleSelectBoard}
      />

      {/* Text Selection Chip */}
      {selection && (
        <TextSelectionChip
          rect={selection.rect}
          onClick={() => {
            console.log('🎈 Chip clicked! Current state:', {
              selection: selection.text.slice(0, 50),
              showSelectionPopup,
              timestamp: Date.now()
            });
            console.log('🎈 Setting showSelectionPopup to true and suppressing clears');
            suppressClearTemporarily(); // Prevent selection clearing for 200ms
            setShowSelectionPopup(true);
          }}
        />
      )}

      {/* Text Selection Popup */}
      {(() => {
        // Use snapshotSelection for popup data - this persists even if current selection is cleared
        const popupData = snapshotSelection;
        const shouldShowPopup = popupData && showSelectionPopup;
        console.log('🎈 Popup render check:', {
          hasSnapshot: !!popupData,
          snapshotText: popupData?.text.slice(0, 50),
          showSelectionPopup,
          shouldShowPopup,
          reason: !popupData ? 'no snapshot' : !showSelectionPopup ? 'showSelectionPopup false' : 'should show'
        });
        
        return shouldShowPopup ? (
          <TextSelectionPopup
            selectedText={popupData.text}
            position={{ x: popupData.rect.right + 12, y: popupData.rect.top - 12 }}
            onAskAI={(selectedText, customQuestion) => {
              console.log('📝 Popup onAskAI called:', { selectedText, customQuestion, cardNodeId: popupData.cardNodeId });
              
              // Create a contextual question that includes the selected text
              const contextualQuestion = `Based on this selected text: "${selectedText}"\n\nQuestion: ${customQuestion}`;
              
              // Use the existing handleAddFollowup with the card node ID
              handleAddFollowup(popupData.cardNodeId, contextualQuestion);
              
              // Close the popup and clear the selection
              setShowSelectionPopup(false);
              clearSelection();
            }}
            onClose={() => {
              console.log('❌ Popup closed via onClose');
              setShowSelectionPopup(false);
            }}
            isVisible={showSelectionPopup}
          />
        ) : null;
      })()}
    </div>
  );
}
