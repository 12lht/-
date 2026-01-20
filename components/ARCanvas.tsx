import React, { useRef, useEffect, useState } from 'react';
import { ToolType, Point, Particle, EffectType } from '../types';

// Declare MediaPipe globals loaded via script tags
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface ARCanvasProps {
  tool: ToolType;
  effect: EffectType;
  color: string;
  brushSize: number;
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  triggerClear: number;
}

// Configuration
const PINCH_START_THRESHOLD = 0.06;
const PINCH_STOP_THRESHOLD = 0.12;
const SMOOTHING_FACTOR = 0.4;

const ARCanvas: React.FC<ARCanvasProps> = ({ 
  tool, 
  effect,
  color, 
  brushSize, 
  onCanvasReady,
  triggerClear
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  
  // 1. Sync refs with props
  const propsRef = useRef({ tool, effect, color, brushSize });

  useEffect(() => {
    propsRef.current = { tool, effect, color, brushSize };
  }, [tool, effect, color, brushSize]);

  // Mutable state for the animation loop
  const stateRef = useRef({
    particles: [] as Particle[],
    lastPoint: null as Point | null,
    currentPoint: null as Point | null,
    rawPoint: null as Point | null,
    isDrawing: false,
    pinchDistance: 1.0,
    hueCounter: 0, // For rainbow effect
  });

  // Initialize MediaPipe Hands
  useEffect(() => {
    if (!window.Hands || !window.Camera) {
      console.error("MediaPipe libraries not loaded");
      return;
    }

    const hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    hands.onResults(onResults);

    let camera: any;
    if (videoRef.current) {
      camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720
      });
      camera.start()
        .then(() => setIsCameraReady(true))
        .catch((err: any) => console.error("Camera error:", err));
    }

    // Initialize Canvases
    const initCanvas = (canvas: HTMLCanvasElement | null) => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    initCanvas(canvasRef.current);
    initCanvas(fxCanvasRef.current);

    if (canvasRef.current) {
      onCanvasReady(canvasRef.current);
    }

    // Start Animation Loop
    let animationFrameId: number;
    const renderLoop = () => {
      updateAndDraw();
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const resize = (canvas: HTMLCanvasElement | null, persist = false) => {
        if (!canvas) return;
        if (persist) {
           const temp = document.createElement('canvas');
           temp.width = canvas.width;
           temp.height = canvas.height;
           temp.getContext('2d')?.drawImage(canvas, 0, 0);
           canvas.width = window.innerWidth;
           canvas.height = window.innerHeight;
           canvas.getContext('2d')?.drawImage(temp, 0, 0);
        } else {
           canvas.width = window.innerWidth;
           canvas.height = window.innerHeight;
        }
      };
      
      resize(canvasRef.current, true);
      resize(fxCanvasRef.current, false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Clear
  useEffect(() => {
    if (triggerClear === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stateRef.current.particles = [];
    }
  }, [triggerClear]);

  const onResults = (results: any) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0 && canvas) {
      const landmarks = results.multiHandLandmarks[0];
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];

      const distance = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      state.pinchDistance = distance;

      // Map coordinates: (1 - x) to flip horizontally to match mirror effect
      const targetX = (1 - indexTip.x) * canvas.width;
      const targetY = indexTip.y * canvas.height;

      if (!state.currentPoint) {
        state.currentPoint = { x: targetX, y: targetY };
      } else {
        state.currentPoint.x = state.currentPoint.x + (targetX - state.currentPoint.x) * SMOOTHING_FACTOR;
        state.currentPoint.y = state.currentPoint.y + (targetY - state.currentPoint.y) * SMOOTHING_FACTOR;
      }
      
      state.rawPoint = { x: targetX, y: targetY };

      if (!state.isDrawing && distance < PINCH_START_THRESHOLD) {
        state.isDrawing = true;
        setIsPinching(true);
      } else if (state.isDrawing && distance > PINCH_STOP_THRESHOLD) {
        state.isDrawing = false;
        setIsPinching(false);
        state.lastPoint = null;
      }

    } else {
      state.rawPoint = null;
      if (state.isDrawing) {
        state.isDrawing = false;
        state.lastPoint = null;
        setIsPinching(false);
      }
    }
  };

  const updateAndDraw = () => {
    const canvas = canvasRef.current;
    const fxCanvas = fxCanvasRef.current;
    if (!canvas || !fxCanvas) return;

    const ctx = canvas.getContext('2d');
    const fxCtx = fxCanvas.getContext('2d');
    if (!ctx || !fxCtx) return;

    const { tool: currentTool, effect: currentEffect, color: propsColor, brushSize: currentSize } = propsRef.current;
    const state = stateRef.current;
    
    // Clear Effects Layer
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // Determine Drawing Color based on Effect
    let drawColor = propsColor;
    if (currentTool !== ToolType.ERASER) {
        if (currentEffect === EffectType.RAINBOW) {
            state.hueCounter = (state.hueCounter + 2) % 360;
            drawColor = `hsl(${state.hueCounter}, 100%, 50%)`;
        } else if (currentEffect === EffectType.FIRE) {
            drawColor = '#ff4500'; // OrangeRed base
        } else if (currentEffect === EffectType.NEON) {
            // Neon uses the selected color but adds intense glow
        }
    }

    // --- Drawing Logic ---
    if (state.isDrawing && state.currentPoint) {
      const p = state.currentPoint;

      if (state.lastPoint) {
        // Draw main line (if not Fire - Fire is purely particles usually, but let's keep a thin core line)
        ctx.beginPath();
        ctx.moveTo(state.lastPoint.x, state.lastPoint.y);
        ctx.lineTo(p.x, p.y);
        
        ctx.globalCompositeOperation = currentTool === ToolType.ERASER ? 'destination-out' : 'source-over';
        
        // Dynamic Line Width/Style
        let lineWidth = currentSize;
        let shadowBlur = 0;
        let shadowColor = 'transparent';

        if (currentTool !== ToolType.ERASER) {
             if (currentEffect === EffectType.FIRE) {
                 lineWidth = currentSize * 0.2; // Thin core for fire
             } else if (currentEffect === EffectType.NEON) {
                 shadowBlur = 10;
                 shadowColor = drawColor;
             }
        } else {
            lineWidth = currentSize * 2;
        }

        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTool === ToolType.ERASER ? 'rgba(0,0,0,1)' : drawColor;
        
        // Neon Glow on Main Canvas
        if (currentEffect === EffectType.NEON && currentTool !== ToolType.ERASER) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = drawColor;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
        ctx.globalCompositeOperation = 'source-over';

        // Spawn Particles
        if (currentTool !== ToolType.ERASER) {
          const distMoved = Math.hypot(p.x - state.lastPoint.x, p.y - state.lastPoint.y);
          // Spawn rate depends on speed
          const baseCount = Math.min(5, Math.floor(distMoved / 2)); 
          const particleCount = currentEffect === EffectType.FIRE ? baseCount + 2 : baseCount;
          
          for (let i = 0; i < particleCount; i++) {
             let vx = (Math.random() - 0.5) * 2;
             let vy = (Math.random() - 0.5) * 2;
             let life = 1.0;
             let size = Math.random() * (currentSize / 3) + 2;
             let pColor = drawColor;

             // Special Particle Physics per Effect
             if (currentEffect === EffectType.FIRE) {
                 vx = (Math.random() - 0.5) * 4;
                 vy = (Math.random() * -3) - 1; // Always goes up
                 size = Math.random() * currentSize + 4;
                 // Randomize fire colors slightly at spawn
                 const yellowOrRed = Math.random() > 0.5 ? '#ff4500' : '#ffa500';
                 pColor = yellowOrRed;
             } else if (currentEffect === EffectType.NEON) {
                 life = 0.6; // Short life
             }

             state.particles.push({
               x: state.lastPoint.x + (Math.random() - 0.5) * 10,
               y: state.lastPoint.y + (Math.random() - 0.5) * 10,
               vx,
               vy,
               life,
               maxLife: life,
               size,
               color: pColor,
               effect: currentEffect
             });
          }
        }
      }
      state.lastPoint = { x: p.x, y: p.y };
    } else {
      state.lastPoint = null;
    }

    // --- Particles Logic ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= 0.02; // Default fade

      if (p.effect === EffectType.FIRE) {
          p.x += p.vx + Math.sin(Date.now() / 100) * 0.5; // Wiggle
          p.y += p.vy;
          p.size *= 0.96; // Shrink
      } else {
          p.x += p.vx;
          p.y += p.vy;
      }

      if (p.life <= 0) {
        state.particles.splice(i, 1);
      } else {
        fxCtx.globalAlpha = p.life;
        
        if (p.effect === EffectType.NEON) {
            fxCtx.shadowBlur = 10;
            fxCtx.shadowColor = p.color;
        } else if (p.effect === EffectType.FIRE) {
             // Fire turns to smoke/gray at end of life
             if (p.life < 0.3) fxCtx.fillStyle = '#555';
             else fxCtx.fillStyle = p.color;
        } else {
            fxCtx.fillStyle = p.color;
        }

        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.globalAlpha = 1.0;
        fxCtx.shadowBlur = 0;
      }
    }

    // --- Cursor Logic ---
    if (state.currentPoint && state.rawPoint) {
      const cp = state.currentPoint;
      
      fxCtx.shadowBlur = 15;
      fxCtx.shadowColor = state.isDrawing ? (currentTool === ToolType.ERASER ? '#ffffff' : drawColor) : '#ffffff';
      
      if (currentTool === ToolType.ERASER) {
          fxCtx.strokeStyle = '#ffffff';
          fxCtx.lineWidth = 3;
          fxCtx.beginPath();
          fxCtx.arc(cp.x, cp.y, currentSize * 1.5, 0, Math.PI * 2);
          fxCtx.stroke();
          
          fxCtx.fillStyle = 'rgba(255,255,255,0.5)';
          fxCtx.beginPath();
          fxCtx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
          fxCtx.fill();
      } else {
          // Pen Cursor
          fxCtx.strokeStyle = state.isDrawing ? '#ffffff' : drawColor;
          fxCtx.fillStyle = state.isDrawing ? drawColor : 'rgba(255,255,255,0.2)';
          fxCtx.lineWidth = 2;
          
          fxCtx.beginPath();
          // Fire cursor is bigger/wobbly? Keep simple for now.
          fxCtx.arc(cp.x, cp.y, state.isDrawing ? 6 : 10, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.stroke();
      }
      
      fxCtx.shadowBlur = 0;
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover mirror"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-10"
      />
      <canvas
        ref={fxCanvasRef}
        className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"
      />

      {!isCameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
           <div className="text-center">
             <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
             <p className="text-white">正在启动摄像头与 AI 模型...</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default ARCanvas;
