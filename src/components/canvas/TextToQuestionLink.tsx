import React from 'react';

interface TextToQuestionLinkProps {
  sourceElement: Element;
  targetNodeId: string;
  selectedText: string;
  nodes: any[];
  offset: { x: number; y: number };
  zoom: number;
}

export default function TextToQuestionLink({
  sourceElement,
  targetNodeId,
  selectedText,
  nodes,
  offset,
  zoom
}: TextToQuestionLinkProps) {
  const targetNode = nodes.find(n => n.id === targetNodeId);
  if (!targetNode || !sourceElement) return null;

  const sourceRect = sourceElement.getBoundingClientRect();
  const targetRect = {
    x: offset.x + targetNode.x * zoom,
    y: offset.y + targetNode.y * zoom,
    width: targetNode.width * zoom,
    height: targetNode.height * zoom
  };

  // Calculate connection points
  const sourcePoint = {
    x: sourceRect.left + sourceRect.width / 2,
    y: sourceRect.bottom
  };

  const targetPoint = {
    x: targetRect.x + targetRect.width / 2,
    y: targetRect.y
  };

  // Create SVG path
  const controlPoint1 = {
    x: sourcePoint.x,
    y: sourcePoint.y + (targetPoint.y - sourcePoint.y) / 3
  };

  const controlPoint2 = {
    x: targetPoint.x,
    y: targetPoint.y - (targetPoint.y - sourcePoint.y) / 3
  };

  const pathData = `M ${sourcePoint.x} ${sourcePoint.y} C ${controlPoint1.x} ${controlPoint1.y} ${controlPoint2.x} ${controlPoint2.y} ${targetPoint.x} ${targetPoint.y}`;

  return (
    <svg
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#3b82f6"
          />
        </marker>
      </defs>
      <path
        d={pathData}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        fill="none"
        markerEnd="url(#arrowhead)"
      />
    </svg>
  );
}