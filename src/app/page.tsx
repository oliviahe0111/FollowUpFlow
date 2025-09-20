'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Board, Node, Edge } from '@/entities/all';
import { InvokeLLM } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Plus, Brain, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import '../styles/text-selection.css';

import CanvasNode from '@/components/canvas/CanvasNode';
import CanvasControls from '@/components/canvas/CanvasControls';
import StartModal from '@/components/canvas/StartModal';
import BoardList from '@/components/BoardList';

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

  // Track text-to-question relationships for visual connections
  const [textToQuestionLinks, setTextToQuestionLinks] = useState<Array<{
    sourceNodeId: string;
    targetNodeId: string;
    selectedText: string;
  }>>([]);

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
  }, []); // No external dependencies, as it relies on passed arguments

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
  }, []); // Setters are stable and don't need to be in deps

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
  }, [loadBoard]); // loadBoard is now a stable useCallback

  const buildContext = useCallback(async (currentNodeId: string, rootId: string, nodesSnapshot: any[] | null = null) => {
    try {
      // Prioritize the passed nodesSnapshot for immediate consistency
      const allNodes = nodesSnapshot || (currentBoard ? await retryWithBackoff(() => Node.filter({ board_id: currentBoard.id })) : []);

      // Get path from root to current node
      const pathNodes = [];
      let currentId: string | null = currentNodeId;

      while (currentId) {
        const node = allNodes.find((n: any) => n.id === currentId);
        if (node) {
          pathNodes.unshift(node);
          currentId = node.parent_id;
        } else {
          break;
        }
      }

      // Get sibling nodes (nodes with same parent)
      const currentNode = allNodes.find((n: any) => n.id === currentNodeId);
      const siblings = currentNode?.parent_id
        ? allNodes.filter((n: any) => n.parent_id === currentNode.parent_id && n.id !== currentNodeId).slice(0, 2)
        : [];

      const contextParts = [];
      contextParts.push("Context from this brainstorming session:");

      if (pathNodes.length > 0) {
        contextParts.push("\n=== Conversation Thread ===");
        pathNodes.forEach((node, i) => {
          const prefix = node.type.includes('question') ? 'Q' : 'A';
          contextParts.push(`${prefix}${i + 1}: ${node.content}`);
        });
      }

      if (siblings.length > 0) {
        contextParts.push("\n=== Related Ideas ===");
        siblings.forEach((node: any) => {
          const prefix = node.type.includes('question') ? 'Q' : 'A';
          contextParts.push(`${prefix}: ${node.content}`);
        });
      }

      return contextParts.join('\n');
    } catch (error) {
      console.error('Error building context:', error);
      setError('Failed to build context for AI. Answering based on the current question.');
      return "Unable to load context. Answering based on the current question.";
    }
  }, [currentBoard, setError]); // Node.filter is stable import. retryWithBackoff is global.

  const generateAIResponse = useCallback(async (parentNodeId: string, question: string, boardId: string, rootId: string, currentNodes: any[]) => {
    setIsGenerating(true);
    setGeneratingNodeId(parentNodeId);
    setError(null);

    try {
      const context = await buildContext(parentNodeId, rootId, currentNodes); // Use currentNodes as snapshot
      const fullPrompt = `${context}\n\nNew Question: ${question}\n\nProvide a thoughtful, detailed response that builds on the conversation context. Be insightful and offer specific, actionable ideas.`;

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
  }, [calculateNewNodePosition, buildContext, setNodes, setEdges, setIsGenerating, setGeneratingNodeId, setError]); // InvokeLLM, Node.create, Edge.create are stable imports. retryWithBackoff is global.

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
  }, [generateAIResponse, setCurrentBoard, setNodes, setEdges, setRootQuestionOrder, setNextRootIndex, setError]); // Board.create, Node.create, Node.update are stable imports. retryWithBackoff is global.

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
        // Ensure prev is a valid node with position and height
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
  }, [currentBoard, nodes, generateAIResponse, nextRootIndex, setNodes, setRootQuestionOrder, setNextRootIndex, setError]); // Node.create, Node.update are stable imports. retryWithBackoff is global.

  const handleAddFollowup = useCallback(async (parentNodeId: string, followupQuestion: string) => {
    if (!currentBoard) return;
    setError(null);

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
  }, [currentBoard, nodes, calculateNewNodePosition, generateAIResponse, setNodes, setEdges, setError]); // Node.create, Edge.create are stable imports. retryWithBackoff is global.

  // Build conversation context for AI responses
  const buildConversationContext = useCallback((nodeId: string, allNodes: any[]) => {
    const targetNode = allNodes.find((n: any) => n.id === nodeId);
    if (!targetNode) return '';

    // Find the root question
    const rootId = targetNode.root_id || targetNode.id;
    const rootQuestion = allNodes.find((n: any) => n.id === rootId && n.type === 'root_question');
    
    if (!rootQuestion) return '';

    // Build conversation thread
    let context = `Previous conversation:\n\nOriginal Question: ${rootQuestion.content}\n\n`;
    
    // Find all nodes in this conversation thread
    const threadNodes = allNodes.filter((n: any) => 
      (n.root_id === rootId || n.id === rootId) && n.id !== rootId
    ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let conversationPairs: Array<{question: string, answer: string}> = [];
    
    // Group questions and answers
    for (let i = 0; i < threadNodes.length; i += 2) {
      const question = threadNodes[i];
      const answer = threadNodes[i + 1];
      
      if (question && answer && question.type.includes('question') && answer.type.includes('answer')) {
        conversationPairs.push({
          question: question.content,
          answer: answer.content
        });
      }
    }

    // Add conversation pairs to context
    conversationPairs.forEach((pair, index) => {
      context += `Q${index + 1}: ${pair.question}\nA${index + 1}: ${pair.answer}\n\n`;
    });

    return context;
  }, []);

  // Handle text-based questions with context
  const handleAskAboutText = useCallback(async (parentNodeId: string, selectedText: string, question: string) => {
    if (!currentBoard) return;
    setError(null);

    try {
      const parentNode = nodes.find((n: any) => n.id === parentNodeId);
      if (!parentNode) {
        throw new Error('Parent node not found.');
      }
      const rootId = parentNode.root_id || parentNode.id;

      // Build context from conversation history
      const conversationContext = buildConversationContext(parentNodeId, nodes);
      const contextualQuestion = `${conversationContext}Selected text: "${selectedText}"\n\nNew question: ${question}`;

      const { x, y } = calculateNewNodePosition(parentNodeId, nodes);

      const questionNode = await retryWithBackoff(() => Node.create({
        board_id: currentBoard.id,
        type: 'followup_question',
        content: question,
        root_id: rootId,
        parent_id: parentNodeId,
        x,
        y,
        width: 320,
        height: Math.max(140, Math.min(180, question.length / 3))
      }));

      const newEdge = await retryWithBackoff(() => Edge.create({
        board_id: currentBoard.id,
        source_id: parentNodeId,
        target_id: questionNode.id
      }));

      // Track text-to-question relationship
      setTextToQuestionLinks(prev => [...prev, {
        sourceNodeId: parentNode.parent_id || parentNode.id, // Link to the actual question node (not AI answer)
        targetNodeId: questionNode.id,
        selectedText
      }]);

      // Update local state
      const newNodes = [...nodes, questionNode];
      setNodes(newNodes);
      setEdges(prev => [...prev, newEdge]);

      // Generate AI response with context
      setTimeout(() => {
        generateAIResponse(questionNode.id, contextualQuestion, currentBoard.id, rootId, newNodes);
      }, 500);

    } catch (error) {
      console.error('Error asking about text:', error);
      setError('Failed to process text-based question. Please try again.');
    }
  }, [currentBoard, nodes, buildConversationContext, calculateNewNodePosition, generateAIResponse, setNodes, setEdges, setError]);


  // Canvas interaction handlers
  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation(); // Prevent canvas panning when dragging a node

    // Find the node element that contains the data-node-id
    let nodeElement = (e.currentTarget as HTMLElement).closest('[data-node-id]') as HTMLElement;
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    setIsDraggingNode(true);
    setDraggedNode(nodeId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate mouse position relative to canvas content, considering zoom and offset
    const startX = (e.clientX - rect.left - offset.x) / zoom;
    const startY = (e.clientY - rect.top - offset.y) / zoom;

    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) return; // Should not happen

    // Calculate offset within the node itself
    const offsetX = startX - node.x;
    const offsetY = startY - node.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate new node position
      const newX = (moveEvent.clientX - rect.left - offset.x) / zoom - offsetX;
      const newY = (moveEvent.clientY - rect.top - offset.y) / zoom - offsetY;

      setNodes(prev => prev.map((n: any) =>
        n.id === nodeId ? { ...n, x: newX, y: newY } : n
      ));
    };

    const handleMouseUp = async () => {
      setIsDraggingNode(false);
      setDraggedNode(null);

      // Find the updated node position from the current state
      const node = nodes.find((n: any) => n.id === nodeId);
      if (node) {
        try {
          await retryWithBackoff(() => Node.update(nodeId, { x: node.x, y: node.y }));
          setError(null); // Clear error on successful save
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
  }, [nodes, offset, zoom, setError, setIsDraggingNode, setDraggedNode, setNodes]); // Node.update is stable import. retryWithBackoff is global.

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isDraggingNode) return; // Only left click, and not if a node is being dragged

    // Check if we clicked on a node or its children. If so, return to prevent panning.
    const clickedNode = (e.target as HTMLElement).closest('[data-node-id]');
    if (clickedNode) return;

    // Only start panning if clicking directly on the canvas background
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
  }, [offset, isDraggingNode, setIsPanning, setOffset]); // Setters are stable.

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointer = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const delta = e.deltaY * -0.002; // Slower, smoother zoom speed
    const newZoom = Math.min(Math.max(0.1, zoom * (1 + delta)), 3); // Min zoom 0.1x, Max zoom 3x

    if (newZoom !== zoom) {
      // Calculate the point we're zooming towards
      const worldPosBeforeZoom = {
        x: (pointer.x - offset.x) / zoom,
        y: (pointer.y - offset.y) / zoom,
      };

      // Calculate the equivalent point after the new zoom
      const worldPosAfterZoom = {
        x: (pointer.x - offset.x) / newZoom,
        y: (pointer.y - offset.y) / newZoom,
      };

      // Adjust offset to keep the point under the cursor
      const newOffset = {
        x: offset.x + (worldPosAfterZoom.x - worldPosBeforeZoom.x) * newZoom,
        y: offset.y + (worldPosAfterZoom.y - worldPosBeforeZoom.y) * newZoom,
      };

      setZoom(newZoom);
      setOffset(newOffset);
    }
  }, [zoom, offset, setZoom, setOffset]);

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
    const newZoom = Math.min(zoom * 1.2, 3); // Zoom in by 20%
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.1); // Zoom out by 20%
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [setZoom, setOffset]);

  const fitToContent = useCallback(() => {
    if (nodes.length === 0) return;

    const padding = 100; // Padding around the content
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
    // Account for header height (e.g., 64px from header + 20px padding = 84, use 100 for safety)
    const canvasHeight = window.innerHeight - 100;

    // Calculate scale factoring in padding
    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const newZoom = Math.min(Math.max(0.1, Math.min(scaleX, scaleY)), 2); // Max zoom 2x for fit to content

    setZoom(newZoom);
    setOffset({
      x: canvasWidth / 2 - centerX * newZoom,
      y: (canvasHeight + 100) / 2 - centerY * newZoom, // +100 to center vertically considering the header offset
    });
  }, [nodes, setZoom, setOffset]);

  // Event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleCanvasMouseDown as any, { passive: false });
    canvas.addEventListener('wheel', handleWheel as any, { passive: false });

    // Prevent context menu on right click
    const handleContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', handleContextMenu);


    return () => {
      canvas.removeEventListener('mousedown', handleCanvasMouseDown as any);
      canvas.removeEventListener('wheel', handleWheel as any);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleCanvasMouseDown, handleWheel]);

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
          currentBoard={null} // Always null for new board creation
          onSelectBoard={handleSelectBoard}
        />
        <BoardList
          onSelectBoard={handleSelectBoard}
          onCreateNewBoard={handleCreateNewBoard}
          currentBoard={null} // No current board when in list view
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
          touchAction: 'none' // Disable browser's touch gestures
        }}
      >

        <AnimatePresence>
          {nodes.map((node) => {
            const rootId = node.root_id || node.id;
            const rootIndex = rootQuestionOrder[rootId] !== undefined ? rootQuestionOrder[rootId] : 0;

            return (
              <div
                key={node.id}
                data-node-id={node.id} // Add data attribute for easier node identification during drag
                className="absolute" // Ensure div is positioned absolutely for transform
                style={{
                  transform: `translate(${offset.x + node.x * zoom}px, ${offset.y + node.y * zoom}px) scale(${zoom})`,
                  transformOrigin: '0 0', // Ensures scaling is from the top-left of the node
                  zIndex: draggedNode === node.id ? 1000 : 1 // Bring dragged node to front
                }}
              >
                <CanvasNode
                  node={node}
                  onAddFollowup={handleAddFollowup}
                  onAskAboutText={handleAskAboutText}
                  isGenerating={generatingNodeId === node.id}
                  isDragging={draggedNode === node.id}
                  onMouseDown={handleNodeMouseDown} // Attach drag handler to the CanvasNode component
                  rootQuestionIndex={rootIndex}
                  allNodes={nodes}
                  textToQuestionLinks={textToQuestionLinks}
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
        currentBoard={modalMode === 'add-question' ? currentBoard : null} // Pass currentBoard only for add-question mode
        onSelectBoard={handleSelectBoard}
      />
    </div>
  );
}
