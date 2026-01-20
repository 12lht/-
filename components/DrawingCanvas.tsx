import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, Point } from '../types';

interface DrawingCanvasProps {
  tool: ToolType;
  color: string;
  brushSize: number;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  triggerClear: number; // Increment to clear
  triggerUndo: number; // Increment to undo
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ 
  tool, 
  color, 
  brushSize, 
  onCanvasReady,
  triggerClear,
  triggerUndo
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  // Simple history stack for Undo
  const historyRef = useRef<ImageData[]>([]); 

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveState(); // Initial white state
    }
    
    onCanvasReady(canvas);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      // Ideally we would resize and redraw content, 
      // but for simplicity we just maintain the buffer or clear.
      // Here we just prevent breaking layout.
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      if (historyRef.current.length > 10) {
        historyRef.current.shift(); // Limit history
      }
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  };

  // Handle Clear
  useEffect(() => {
    if (triggerClear === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveState();
    }
  }, [triggerClear]);

  // Handle Undo
  useEffect(() => {
    if (triggerUndo === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && historyRef.current.length > 1) {
      historyRef.current.pop(); // Remove current state
      const previousState = historyRef.current[historyRef.current.length - 1];
      ctx.putImageData(previousState, 0, 0);
    }
  }, [triggerUndo]);

  const getCoordinates = (e: React.PointerEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const point = getCoordinates(e);
    setLastPoint(point);
    
    // Draw a dot immediately for feedback
    draw(point, point);
  };

  const draw = useCallback((start: Point, end: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    
    ctx.strokeStyle = tool === ToolType.ERASER ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    ctx.stroke();
  }, [tool, color, brushSize]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !lastPoint) return;
    e.preventDefault();
    const currentPoint = getCoordinates(e);
    
    // Quadratic curve smoothing could go here, but simple lineTo is responsive enough for now
    draw(lastPoint, currentPoint);
    setLastPoint(currentPoint);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPoint(null);
      saveState();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="touch-none cursor-crosshair w-full h-full block"
      onPointerDown={startDrawing}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrawing}
      onPointerLeave={stopDrawing}
      style={{ touchAction: 'none' }}
    />
  );
};

export default DrawingCanvas;
