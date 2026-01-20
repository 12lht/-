import React, { useState } from 'react';
import ARCanvas from './components/ARCanvas';
import { IconPen, IconEraser, IconTrash, IconSparkles, IconDownload, IconX } from './components/Icons';
import { ToolType, EffectType } from './types';
import { analyzeDrawing, getCreativeSuggestions } from './services/geminiService';

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ffffff', // White
];

const BRUSH_SIZES = [4, 8, 15, 25];

const INSPIRATION_TOPICS = [
  "一只戴墨镜的猫", "未来的飞行汽车", "正在吃冰淇淋的恐龙", 
  "住在云朵上的城堡", "深海里的发光水母", "长着翅膀的汉堡包",
  "会魔法的扫帚", "赛博朋克风格的机器人", "外星人的飞船", "森林里的树屋"
];

export default function App() {
  const [tool, setTool] = useState<ToolType>(ToolType.PEN);
  const [effect, setEffect] = useState<EffectType>(EffectType.NORMAL);
  const [color, setColor] = useState<string>(COLORS[4]); 
  const [brushSize, setBrushSize] = useState<number>(8);
  const [canvasInstance, setCanvasInstance] = useState<HTMLCanvasElement | null>(null);
  const [triggerClear, setTriggerClear] = useState(0);
  
  // AI State
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'identify' | 'suggest'>('identify');
  const [showHelp, setShowHelp] = useState(true);
  
  // Game State
  const [inspiration, setInspiration] = useState<string | null>(null);

  const handleClear = () => {
    setTriggerClear(c => c + 1);
    setAiResponse(null);
  };

  const handleDownload = () => {
    if (canvasInstance) {
      const link = document.createElement('a');
      link.download = `fingerflow-ar-${Date.now()}.png`;
      link.href = canvasInstance.toDataURL();
      link.click();
    }
  };

  const handleRollDice = () => {
    const randomTopic = INSPIRATION_TOPICS[Math.floor(Math.random() * INSPIRATION_TOPICS.length)];
    setInspiration(randomTopic);
    // Auto open AI panel for context? No, just toast or small overlay.
    // Let's reset effect to normal if they want to draw clearly? No, let them chose.
  };

  const handleAiAction = async (mode: 'identify' | 'suggest') => {
    if (!canvasInstance) return;
    
    setAiMode(mode);
    setIsAiPanelOpen(true);
    setAiLoading(true);
    setAiResponse(null);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasInstance.width;
    tempCanvas.height = canvasInstance.height;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
        // Draw black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0,0, tempCanvas.width, tempCanvas.height);
        // Draw main canvas
        ctx.drawImage(canvasInstance, 0, 0);
    }
    
    const base64 = tempCanvas.toDataURL('image/png');
    
    let result = '';
    if (mode === 'identify') {
      result = await analyzeDrawing(base64);
    } else {
      result = await getCreativeSuggestions(base64);
    }

    setAiResponse(result);
    setAiLoading(false);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 text-white overflow-hidden font-sans">
      
      {/* AR Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <ARCanvas 
          tool={tool}
          effect={effect}
          color={color}
          brushSize={brushSize}
          onCanvasReady={setCanvasInstance}
          triggerClear={triggerClear}
        />
      </div>

      {/* Help Overlay (Tutorial) */}
      {showHelp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
            <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl border border-slate-700 animate-pulse-fast-once">
                <div className="text-5xl mb-4">👆 + 👍</div>
                <h2 className="text-2xl font-bold mb-2 text-white">如何绘画？</h2>
                <ul className="text-slate-300 text-left space-y-3 mb-6">
                    <li className="flex items-center gap-2"><span className="bg-brand-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span> 举起手，伸出食指移动光标</li>
                    <li className="flex items-center gap-2"><span className="bg-brand-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span> <span className="text-brand-400 font-bold">捏合食指和拇指</span> 开始绘画/擦除</li>
                    <li className="flex items-center gap-2"><span className="bg-brand-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span> 松开手指停止</li>
                </ul>
                <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-brand-600 hover:bg-brand-500 rounded-full font-bold transition-colors">
                    开始体验
                </button>
            </div>
        </div>
      )}

      {/* Inspiration Toast */}
      {inspiration && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-brand-600 px-6 py-3 rounded-full shadow-xl z-20 animate-bounce flex items-center gap-3 border border-white/20">
            <span className="text-2xl">🎲</span>
            <div>
                <p className="text-xs text-white/80 uppercase font-bold tracking-wider">挑战题目</p>
                <p className="font-bold text-lg">{inspiration}</p>
            </div>
            <button onClick={() => setInspiration(null)} className="ml-2 opacity-60 hover:opacity-100"><IconX className="w-4 h-4" /></button>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-20 px-4 pt-4 flex items-start justify-between pointer-events-none z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="pointer-events-auto flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white drop-shadow-md tracking-wider">
            灵动指绘 <span className="text-brand-400 text-xs align-top">AR</span>
          </h1>
        </div>
        
        <div className="pointer-events-auto flex gap-2">
           {/* Inspiration Button */}
           <button 
            onClick={handleRollDice}
            className="p-2.5 bg-purple-600/80 backdrop-blur rounded-full border border-purple-400 hover:bg-purple-500 transition-all text-white mr-2 shadow-[0_0_15px_rgba(147,51,234,0.4)]"
            title="给我一点灵感"
          >
            <span className="text-lg">🎲</span>
          </button>

          <button onClick={() => setShowHelp(true)} className="p-2.5 bg-black/40 backdrop-blur rounded-full border border-white/10 hover:bg-white/20 transition-all text-white">
            ?
          </button>
          <button 
            onClick={handleClear}
            className="p-2.5 bg-black/40 backdrop-blur rounded-full border border-white/10 hover:bg-red-500/50 hover:border-red-500 transition-all text-white"
            title="一键清空"
          >
            <IconTrash />
          </button>
          <button 
            onClick={handleDownload}
            className="p-2.5 bg-black/40 backdrop-blur rounded-full border border-white/10 hover:bg-green-500/50 hover:border-green-500 transition-all text-white"
            title="保存"
          >
            <IconDownload />
          </button>
        </div>
      </div>

      {/* AI Panel */}
      <div className={`absolute bottom-32 right-4 sm:top-24 sm:bottom-auto w-full sm:w-80 bg-slate-900/90 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-700 z-30 transition-all duration-300 transform ${isAiPanelOpen ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-brand-400 font-semibold">
              <IconSparkles className="w-5 h-5" />
              <span>Gemini 助手</span>
            </div>
            <button onClick={() => setIsAiPanelOpen(false)} className="text-slate-400 hover:text-white">
              <IconX />
            </button>
          </div>

          <div className="bg-black/50 rounded-xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto text-sm text-slate-200 leading-relaxed border border-slate-800">
            {aiLoading ? (
               <div className="flex flex-col items-center justify-center h-full py-4 text-slate-400 gap-2">
                 <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                 <p>正在分析线条...</p>
               </div>
            ) : aiResponse ? (
              <p className="whitespace-pre-wrap">{aiResponse}</p>
            ) : (
              <p className="text-slate-500 text-center py-4">AI 准备就绪</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-20 w-[95%] max-w-lg pointer-events-auto">
        
        {/* Magic Effects Selector */}
        {tool === ToolType.PEN && (
            <div className="flex gap-2 bg-black/50 backdrop-blur-md p-1.5 rounded-full border border-white/10">
                <button 
                    onClick={() => setEffect(EffectType.NORMAL)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${effect === EffectType.NORMAL ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}
                >
                    普通
                </button>
                <button 
                    onClick={() => setEffect(EffectType.RAINBOW)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${effect === EffectType.RAINBOW ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white' : 'text-white hover:bg-white/10'}`}
                >
                    🌈 彩虹
                </button>
                <button 
                    onClick={() => setEffect(EffectType.FIRE)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${effect === EffectType.FIRE ? 'bg-orange-600 text-white shadow-[0_0_10px_#ea580c]' : 'text-white hover:bg-white/10'}`}
                >
                    🔥 火焰
                </button>
                <button 
                    onClick={() => setEffect(EffectType.NEON)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${effect === EffectType.NEON ? 'bg-cyan-500 text-black shadow-[0_0_10px_cyan]' : 'text-white hover:bg-white/10'}`}
                >
                    ✨ 霓虹
                </button>
            </div>
        )}

        {/* AI Triggers */}
        <div className="flex gap-3">
          <button 
            onClick={() => handleAiAction('identify')}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-brand-600 to-purple-600 text-white rounded-full shadow-[0_0_20px_rgba(147,51,234,0.5)] active:scale-95 transition-transform text-sm font-bold tracking-wide border border-white/10"
          >
            <IconSparkles className="w-4 h-4" />
            AI 猜画
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-2.5 rounded-3xl shadow-2xl flex items-center gap-4 w-full justify-between">
          
          <div className="flex gap-1 bg-white/10 p-1 rounded-2xl">
            <button 
              onClick={() => setTool(ToolType.PEN)}
              className={`p-2.5 rounded-xl transition-all ${tool === ToolType.PEN ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <IconPen />
            </button>
            <button 
              onClick={() => {
                  setTool(ToolType.ERASER);
                  setEffect(EffectType.NORMAL); // Eraser doesn't have effects
              }}
              className={`p-2.5 rounded-xl transition-all ${tool === ToolType.ERASER ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <IconEraser />
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-2 min-w-0">
             <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
               {COLORS.map(c => (
                 <button
                   key={c}
                   onClick={() => {
                     setColor(c);
                     setTool(ToolType.PEN);
                   }}
                   className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c && tool === ToolType.PEN ? 'scale-110 border-white shadow-[0_0_10px_currentColor]' : 'border-transparent opacity-70 hover:opacity-100'}`}
                   style={{ backgroundColor: c, color: c }}
                 />
               ))}
             </div>
             
             <div className="flex items-center justify-between px-2">
                {BRUSH_SIZES.map(size => (
                  <button 
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={`rounded-full bg-white transition-all ${brushSize === size ? 'opacity-100 scale-125' : 'opacity-30 hover:opacity-60'}`}
                    style={{ width: Math.max(6, size/2), height: Math.max(6, size/2) }}
                  />
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
