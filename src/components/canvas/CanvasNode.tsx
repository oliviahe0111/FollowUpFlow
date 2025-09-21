import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Sparkles, Plus, Send, Loader2, X } from 'lucide-react';
import type { Node as NodeType } from '@/types/domain';

const nodeTypeConfig = {
  root_question: { icon: MessageCircle, title: 'Root Question' },
  ai_answer: { icon: Sparkles, title: 'AI Response' },
  followup_question: { icon: MessageCircle, title: 'Follow-up Question' },
  followup_answer: { icon: Sparkles, title: 'Follow-up Response' }
};

// Color palette for different root questions
const rootQuestionColors = [
  { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', border: 'border-blue-200', iconColor: 'text-blue-600', accent: 'blue' },
  { bg: 'bg-gradient-to-br from-purple-50 to-pink-50', border: 'border-purple-200', iconColor: 'text-purple-600', accent: 'purple' },
  { bg: 'bg-gradient-to-br from-green-50 to-emerald-50', border: 'border-green-200', iconColor: 'text-green-600', accent: 'green' },
  { bg: 'bg-gradient-to-br from-amber-50 to-orange-50', border: 'border-amber-200', iconColor: 'text-amber-600', accent: 'amber' },
  { bg: 'bg-gradient-to-br from-rose-50 to-pink-50', border: 'border-rose-200', iconColor: 'text-rose-600', accent: 'rose' },
  { bg: 'bg-gradient-to-br from-cyan-50 to-blue-50', border: 'border-cyan-200', iconColor: 'text-cyan-600', accent: 'cyan' }
];

interface CanvasNodeProps {
  node: {
    id: string;
    type: string;
    content: string;
    parent_id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onAddFollowup: (nodeId: string, question: string) => void;
  onDelete?: (nodeId: string) => void;
  isGenerating: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  rootQuestionIndex?: number;
  allNodes?: NodeType[]; // Array of all nodes to find parent/answer
}

export default function CanvasNode({
  node,
  onAddFollowup,
  onDelete,
  isGenerating,
  onMouseDown,
  isDragging,
  rootQuestionIndex = 0,
  allNodes = []
}: CanvasNodeProps) {
  const [showFollowupInput, setShowFollowupInput] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const cardRef = useRef<HTMLDivElement>(null);

  // Move hooks before any conditional returns
  // If this were an answer node, show its parent question (kept for completeness)
  const parentQuestion = useMemo(() => {
    if ((node.type === 'ai_answer' || node.type === 'followup_answer') && node.parent_id && allNodes.length > 0) {
      const parentNode = allNodes.find(n => n.id === node.parent_id);
      return parentNode?.content || 'Unknown Question';
    }
    return null;
  }, [node.type, node.parent_id, allNodes]);

  // Inline the AI answer for question-type nodes
  const aiAnswer = useMemo(() => {
    if ((node.type === 'root_question' || node.type === 'followup_question') && allNodes.length > 0) {
      const answerType = node.type === 'root_question' ? 'ai_answer' : 'followup_answer';
      const answer = allNodes.find(n => n.parent_id === node.id && n.type === answerType);
      return answer?.content || null;
    }
    return null;
  }, [node.type, node.id, allNodes]);

  // Delete handler
  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this ${node.type.replace('_', ' ')}? This action cannot be undone.`)) {
      onDelete?.(node.id);
    }
  };

  // Don't render standalone AI answers - they're shown inline with their question
  if (node.type === 'ai_answer' || node.type === 'followup_answer') {
    return null;
  }

  const typeConfig = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig];
  const colorConfig = rootQuestionColors[rootQuestionIndex % rootQuestionColors.length];
  const Icon = typeConfig.icon;

  // Drag start (for moving the card on the canvas)
  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection during drag
    onMouseDown?.(e);
  };

  // Prevent clicks inside card from bubbling to canvas
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  // Generic follow-up submit
  const handleAddFollowup = () => {
    if (!followupText.trim()) return;

    // If this question already has an AI answer node, attach follow-ups to that answer;
    // otherwise attach to this question node.
    const targetNodeId =
      (node.type === 'root_question' || node.type === 'followup_question') && aiAnswer
        ? allNodes.find(n => n.parent_id === node.id && (n.type === 'ai_answer' || n.type === 'followup_answer'))?.id || node.id
        : node.id;

    onAddFollowup(targetNodeId, followupText.trim());
    setFollowupText('');
    setShowFollowupInput(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddFollowup();
    }
  };

  return (
    <motion.div
      className="absolute"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card
        ref={cardRef}
        className={`
          qa-card ${colorConfig.bg} ${colorConfig.border} border-2 shadow-lg hover:shadow-xl 
          transition-all duration-300
          ${isDragging ? 'shadow-2xl scale-105 cursor-grabbing' : 'cursor-grab'}
          overflow-hidden relative isolate
        `}
        style={{
          width: node.width,
          minHeight: isExpanded ? (aiAnswer ? 'auto' : node.height) : 80,
          height: aiAnswer && isExpanded ? 'auto' : undefined
        }}
        data-node-id={node.id}
        onMouseDown={handleDragStart}
      >
        <div className="p-4 h-full flex flex-col" onClick={stopPropagation}>
          {/* Header - Also draggable, except for expand/collapse button */}
          <div 
            className="flex items-start gap-3 mb-3 flex-shrink-0 cursor-grab active:cursor-grabbing"
            onMouseDown={handleDragStart}
          >
            <div className={`p-2 rounded-full ${colorConfig.bg} ${colorConfig.border} border flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${colorConfig.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {typeConfig.title}
                </p>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 hover:bg-red-100 text-gray-500 hover:text-red-600"
                    onClick={handleDelete}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Delete question"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* (Only relevant if this were an answer node; kept harmless) */}
              {parentQuestion && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-600 mb-1">Question:</p>
                  <p className="text-sm text-gray-800 leading-relaxed select-text">
                    {parentQuestion.length > 80 ? `${parentQuestion.substring(0, 80)}...` : parentQuestion}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Question Content - Always visible */}
          <div className="flex-shrink-0 mb-3">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Question:</h3>
            <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-line">
              {node.content}
            </div>
          </div>

          {/* AI Response Section - Always visible header */}
          {aiAnswer && (
            <div className="border-t pt-4 mb-3" onMouseDown={(e) => e.stopPropagation()}>
              <button
                className="w-full text-sm font-medium text-green-700 mb-2 flex items-center justify-between hover:bg-green-50/50 rounded p-1 -m-1 transition-colors text-left"
                onClick={() => setIsExpanded(!isExpanded)}
                onMouseDown={(e) => e.stopPropagation()}
                aria-expanded={isExpanded}
                aria-controls={`ai-response-${node.id}`}
                title={isExpanded ? "Collapse AI Response" : "Expand AI Response"}
              >
                <div className="flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Response:
                  {!isExpanded && <span className="ml-2 text-xs font-normal text-green-600">(expand to view)</span>}
                </div>
                <span className="text-green-600 text-2xl leading-none">
                  {isExpanded ? '▴' : '▾'}
                </span>
              </button>
              {isExpanded && (
                <div 
                  id={`ai-response-${node.id}`}
                  data-ai-response="true"
                  data-node-id={node.id}
                  className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap bg-green-50 p-3 rounded-lg border border-green-200 isolate cursor-text"
                >
                  {aiAnswer}
                </div>
              )}
            </div>
          )}

          {/* Follow-up Section (generic, no selection) */}
          <div className="flex-shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            {!showFollowupInput ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed hover:bg-gray-50 transition-colors text-xs text-gray-900 border-gray-400 hover:border-gray-600"
                onClick={() => setShowFollowupInput(true)}
                disabled={isGenerating}
              >
                <Plus className="w-3 h-3 mr-1" />
                Ask Follow-up
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="What would you like to explore further?"
                  className="border border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none text-gray-900 placeholder:text-gray-500"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddFollowup}
                    disabled={!followupText.trim() || isGenerating}
                    className={`text-white text-xs flex-1 ${
                      colorConfig.accent === 'blue'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : colorConfig.accent === 'purple'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : colorConfig.accent === 'green'
                        ? 'bg-green-600 hover:bg-green-700'
                        : colorConfig.accent === 'amber'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : colorConfig.accent === 'rose'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-cyan-600 hover:bg-cyan-700'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Asking...
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 mr-1" />
                        Ask AI
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowFollowupInput(false);
                      setFollowupText('');
                    }}
                    disabled={isGenerating}
                    className="w-full hover:bg-gray-50 transition-colors text-xs text-gray-900 border-gray-400 hover:border-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
