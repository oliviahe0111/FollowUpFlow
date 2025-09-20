import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Home, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

interface CanvasControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitToContent: () => void;
}

export default function CanvasControls({ 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  onResetView, 
  onFitToContent 
}: CanvasControlsProps) {
  return (
    <motion.div 
      className="fixed bottom-6 right-6 flex flex-col gap-2 z-50"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-2 space-y-1 min-w-[140px]">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200 text-gray-800 font-medium"
          onClick={onZoomIn}
          disabled={zoom >= 3}
        >
          <ZoomIn className="w-4 h-4 mr-2" />
          Zoom In
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200 text-gray-800 font-medium"
          onClick={onZoomOut}
          disabled={zoom <= 0.25}
        >
          <ZoomOut className="w-4 h-4 mr-2" />
          Zoom Out
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs hover:bg-green-100 hover:text-green-700 transition-colors duration-200 text-gray-800 font-medium"
          onClick={onFitToContent}
        >
          <Home className="w-4 h-4 mr-2" />
          Fit to Content
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs hover:bg-orange-100 hover:text-orange-700 transition-colors duration-200 text-gray-800 font-medium"
          onClick={onResetView}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
      </div>
      <div className="text-center text-xs text-gray-800 font-semibold bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1 border border-gray-200">
        {Math.round(zoom * 100)}%
      </div>
    </motion.div>
  );
}