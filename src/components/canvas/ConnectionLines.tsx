import React from 'react';

// Color palette for different root questions (matching CanvasNode colors)
const connectionColors = [
  'rgba(59, 130, 246, 0.7)',  // blue
  'rgba(147, 51, 234, 0.7)', // purple  
  'rgba(34, 197, 94, 0.7)',   // green
  'rgba(245, 158, 11, 0.7)',  // amber
  'rgba(244, 63, 94, 0.7)',   // rose
  'rgba(6, 182, 212, 0.7)'    // cyan
];

interface Node {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  root_id?: string;
}

interface Edge {
  id: string;
  source_id: string;
  target_id: string;
}

interface ConnectionLinesProps {
  edges: Edge[];
  nodes: Node[];
  offset: { x: number; y: number };
  zoom: number;
  rootQuestionIndices?: Record<string, number>;
}

export default function ConnectionLines({ 
  edges, 
  nodes, 
  offset, 
  zoom, 
  rootQuestionIndices = {} 
}: ConnectionLinesProps) {
  // Function to get the position of connection handles on a node
  const getNodeHandlePosition = (node: Node | undefined, type: 'source' | 'target') => {
    if (!node) return { x: 0, y: 0 };
    if (type === 'source') {
      // Right-middle handle for outgoing connections
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    }
    // Left-middle handle for incoming connections
    return { x: node.x, y: node.y + node.height / 2 };
  };

  return (
    <svg 
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: '0 0'
      }}
      width="100%"
      height="100%"
    >
      <defs>
        {connectionColors.map((color, index) => (
          <marker
            key={index}
            id={`arrowhead-${index}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
      
      {edges.map((edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source_id);
        const targetNode = nodes.find(n => n.id === edge.target_id);
        
        if (!sourceNode || !targetNode) return null;
        
        const rootId = sourceNode.root_id || sourceNode.id;
        const colorIndex = rootQuestionIndices[rootId] || 0;
        const color = connectionColors[colorIndex % connectionColors.length];
        
        const sourcePos = getNodeHandlePosition(sourceNode, 'source');
        const targetPos = getNodeHandlePosition(targetNode, 'target');
        
        const controlPointOffset = Math.max(100, Math.abs(targetPos.x - sourcePos.x) * 0.4);
        
        // Path for a smooth horizontal Bezier curve
        const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + controlPointOffset} ${sourcePos.y}, ${targetPos.x - controlPointOffset} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
        
        return (
          <g key={edge.id}>
            {/* Main line with animation */}
            <path
              d={path}
              stroke={color}
              strokeWidth="2"
              fill="none"
              strokeDasharray="6, 6"
              markerEnd={`url(#arrowhead-${colorIndex})`}
              style={{
                animation: 'dash-flow 1s linear infinite'
              }}
            />
          </g>
        );
      })}
      <style>{`
        @keyframes dash-flow {
          to {
            stroke-dashoffset: -12;
          }
        }
      `}</style>
    </svg>
  );
}