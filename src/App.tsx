import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useHandTracking } from './hooks/useHandTracking';
import { Stroke, Point, GestureType, HandState } from './types';
import { cn } from './lib/utils';
import { 
  Hand, 
  Eraser, 
  Trash2, 
  Move, 
  Maximize, 
  RotateCw, 
  Info,
  Settings,
  Sparkles
} from 'lucide-react';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { rightHand, leftHand } = useHandTracking(videoRef.current);
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStrokeId, setActiveStrokeId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  
  const [showGuide, setShowGuide] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Simulate loading or check for hand tracking readiness
  useEffect(() => {
    if (rightHand.isActive || leftHand.isActive) {
      setIsLoaded(true);
    }
  }, [rightHand.isActive, leftHand.isActive]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drawing Logic
  useEffect(() => {
    if (rightHand.gesture === 'DRAW') {
      const pos = { x: rightHand.position.x * canvasSize.width, y: rightHand.position.y * canvasSize.height };
      
      if (!activeStrokeId) {
        const newId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString();
        const newStroke: Stroke = {
          id: newId,
          points: [pos],
          color: '#00f2ff', // Neon Cyan
          width: 4,
          transform: { tx: 0, ty: 0, scale: 1, rotation: 0 }
        };
        setStrokes(prev => [...prev, newStroke]);
        setActiveStrokeId(newId);
      } else {
        setStrokes(prev => prev.map(s => 
          s.id === activeStrokeId 
            ? { ...s, points: [...s.points, pos] } 
            : s
        ));
      }
    } else {
      setActiveStrokeId(null);
    }
  }, [rightHand.gesture, rightHand.position, canvasSize, activeStrokeId]);

  // Erasing Logic
  useEffect(() => {
    if (rightHand.gesture === 'ERASE') {
      const pos = { x: rightHand.position.x * canvasSize.width, y: rightHand.position.y * canvasSize.height };
      setStrokes(prev => prev.filter(stroke => {
        // Simple distance check for eraser
        return !stroke.points.some(p => {
          const dx = (p.x + stroke.transform.tx) - pos.x;
          const dy = (p.y + stroke.transform.ty) - pos.y;
          return Math.sqrt(dx*dx + dy*dy) < 30;
        });
      }));
    }
  }, [rightHand.gesture, rightHand.position, canvasSize]);

  // Clearing Logic
  useEffect(() => {
    if (rightHand.gesture === 'CLEAR') {
      setStrokes([]);
    }
  }, [rightHand.gesture]);

  // Transformation Logic (Left Hand)
  useEffect(() => {
    if (!leftHand.isActive) {
      setSelectedStrokeId(null);
      return;
    }

    const pos = { x: leftHand.position.x * canvasSize.width, y: leftHand.position.y * canvasSize.height };

    // Find nearest stroke if none selected
    if (!selectedStrokeId && (leftHand.gesture === 'MOVE' || leftHand.gesture === 'SCALE' || leftHand.gesture === 'ROTATE')) {
      let minDist = Infinity;
      let nearestId = null;
      
      strokes.forEach(s => {
        s.points.forEach(p => {
          const dx = (p.x + s.transform.tx) - pos.x;
          const dy = (p.y + s.transform.ty) - pos.y;
          const d = Math.sqrt(dx*dx + dy*dy);
          if (d < minDist) {
            minDist = d;
            nearestId = s.id;
          }
        });
      });

      if (minDist < 100) {
        setSelectedStrokeId(nearestId);
      }
    }

    if (selectedStrokeId) {
      setStrokes(prev => prev.map(s => {
        if (s.id !== selectedStrokeId) return s;

        const newTransform = { ...s.transform };

        if (leftHand.gesture === 'MOVE') {
          // Simplified move: set tx/ty to follow hand (with offset logic ideally, but keeping it simple)
          // For better feel, we'd need to track the start position of the gesture
          newTransform.tx = pos.x - s.points[0].x;
          newTransform.ty = pos.y - s.points[0].y;
        } else if (leftHand.gesture === 'SCALE') {
          // Use distance from wrist to index tip as scale factor
          const wrist = leftHand.rawLandmarks[0];
          const tip = leftHand.rawLandmarks[8];
          const dist = Math.sqrt(Math.pow(wrist.x - tip.x, 2) + Math.pow(wrist.y - tip.y, 2));
          newTransform.scale = dist * 5; // Arbitrary multiplier
        } else if (leftHand.gesture === 'ROTATE') {
          // Use angle of hand relative to wrist
          const wrist = leftHand.rawLandmarks[0];
          const tip = leftHand.rawLandmarks[8];
          const angle = Math.atan2(tip.y - wrist.y, tip.x - wrist.x);
          let deg = angle * (180 / Math.PI);
          // Snap to 45
          deg = Math.round(deg / 45) * 45;
          newTransform.rotation = deg;
        }

        return { ...s, transform: newTransform };
      }));
    }
  }, [leftHand, canvasSize, selectedStrokeId, strokes]);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white">
      {/* Loading Overlay */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center gap-6"
          >
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-4 border-[#00f2ff]/20 rounded-full" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-4 border-t-[#00f2ff] rounded-full"
              />
              <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-[#00f2ff] animate-pulse" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tighter uppercase italic mb-2">Initializing AuraDraw</h2>
              <p className="text-white/40 font-mono text-[10px] tracking-[0.3em] uppercase">WASM Engine & Hand Tracking</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Video (Hidden but used for tracking) */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover opacity-20 pointer-events-none scale-x-[-1]"
        autoPlay
        playsInline
      />

      {/* Main Canvas */}
      <Canvas strokes={strokes} size={canvasSize} selectedId={selectedStrokeId} />

      {/* HUD Overlay */}
      <HUD 
        rightHand={rightHand} 
        leftHand={leftHand} 
        strokeCount={strokes.length}
        onToggleGuide={() => setShowGuide(!showGuide)}
      />

      {/* Gesture Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl w-full bg-[#151619] border border-white/10 rounded-3xl p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  <Info className="w-8 h-8 text-[#00f2ff]" />
                  Gesture Manual
                </h2>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <Trash2 className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section>
                  <h3 className="text-[#00f2ff] font-mono text-sm uppercase tracking-widest mb-4">Right Hand (Drawing)</h3>
                  <ul className="space-y-4">
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">☝️</div>
                      <div>
                        <p className="font-medium">Index Up</p>
                        <p className="text-sm text-white/50">Start drawing a stroke</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">🤏</div>
                      <div>
                        <p className="font-medium">Pinch</p>
                        <p className="text-sm text-white/50">Selective eraser</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">✊</div>
                      <div>
                        <p className="font-medium">Fist</p>
                        <p className="text-sm text-white/50">Clear entire canvas</p>
                      </div>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-[#ff4e00] font-mono text-sm uppercase tracking-widest mb-4">Left Hand (Control)</h3>
                  <ul className="space-y-4">
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">✌️</div>
                      <div>
                        <p className="font-medium">Two Fingers</p>
                        <p className="text-sm text-white/50">Move nearest stroke</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">🤏</div>
                      <div>
                        <p className="font-medium">Pinch & Spread</p>
                        <p className="text-sm text-white/50">Scale stroke size</p>
                      </div>
                    </li>
                    <li className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">🖐️</div>
                      <div>
                        <p className="font-medium">Open Palm</p>
                        <p className="text-sm text-white/50">Rotate stroke (45° snap)</p>
                      </div>
                    </li>
                  </ul>
                </section>
              </div>

              <button 
                onClick={() => setShowGuide(false)}
                className="w-full mt-10 py-4 bg-white text-black font-bold rounded-2xl hover:bg-[#00f2ff] transition-colors"
              >
                Got it, let's draw
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Canvas({ strokes, size, selectedId }: { strokes: Stroke[], size: { width: number, height: number }, selectedId: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size.width, size.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.save();
      
      const isSelected = stroke.id === selectedId;
      
      // Calculate centroid for rotation/scaling
      const centroid = stroke.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      centroid.x /= stroke.points.length;
      centroid.y /= stroke.points.length;

      // Apply Global Transforms
      ctx.translate(centroid.x + stroke.transform.tx, centroid.y + stroke.transform.ty);
      ctx.rotate(stroke.transform.rotation * Math.PI / 180);
      ctx.scale(stroke.transform.scale, stroke.transform.scale);
      ctx.translate(-centroid.x, -centroid.y);
      
      ctx.strokeStyle = isSelected ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      
      if (isSelected) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = stroke.color;
        
        // Draw bounding box for selected stroke
        const xs = stroke.points.map(p => p.x);
        const ys = stroke.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(minX - 10, minY - 10, (maxX - minX) + 20, (maxY - minY) + 20);
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = stroke.width;
      }

      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    });
  }, [strokes, size, selectedId]);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      className="absolute inset-0 z-10"
    />
  );
}

function HUD({ rightHand, leftHand, strokeCount, onToggleGuide }: { 
  rightHand: HandState, 
  leftHand: HandState, 
  strokeCount: number,
  onToggleGuide: () => void 
}) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none p-8 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00f2ff] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,242,255,0.5)]">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter uppercase italic">AuraDraw</h1>
              <p className="text-[10px] font-mono text-white/40 tracking-[0.2em] uppercase">Spatial Engine v1.0</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pointer-events-auto">
          <button 
            onClick={onToggleGuide}
            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all backdrop-blur-md"
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all backdrop-blur-md">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Feedback (Crosshairs) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-64 h-64 border border-white/10 rounded-full flex items-center justify-center">
          <div className="w-32 h-32 border border-white/20 rounded-full" />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        {/* Left Hand Status */}
        <div className={cn(
          "p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl w-64",
          leftHand.isActive ? "bg-white/10 border-white/20" : "bg-black/20 border-white/5 opacity-40"
        )}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Left Control</p>
            <div className={cn("w-2 h-2 rounded-full", leftHand.isActive ? "bg-[#ff4e00] animate-pulse" : "bg-white/20")} />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              {leftHand.gesture === 'MOVE' && <Move className="w-6 h-6 text-[#ff4e00]" />}
              {leftHand.gesture === 'SCALE' && <Maximize className="w-6 h-6 text-[#ff4e00]" />}
              {leftHand.gesture === 'ROTATE' && <RotateCw className="w-6 h-6 text-[#ff4e00]" />}
              {leftHand.gesture === 'NONE' && <Hand className="w-6 h-6 text-white/20" />}
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{leftHand.gesture === 'NONE' ? 'READY' : leftHand.gesture}</p>
              <p className="text-xs text-white/40">Spatial Transform</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Active Strokes</p>
          <p className="text-5xl font-black italic tracking-tighter">{strokeCount.toString().padStart(2, '0')}</p>
        </div>

        {/* Right Hand Status */}
        <div className={cn(
          "p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl w-64",
          rightHand.isActive ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(0,242,255,0.1)]" : "bg-black/20 border-white/5 opacity-40"
        )}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-mono text-white/40 tracking-widest uppercase">Right Dominant</p>
            <div className={cn("w-2 h-2 rounded-full", rightHand.isActive ? "bg-[#00f2ff] animate-pulse" : "bg-white/20")} />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              {rightHand.gesture === 'DRAW' && <Sparkles className="w-6 h-6 text-[#00f2ff]" />}
              {rightHand.gesture === 'ERASE' && <Eraser className="w-6 h-6 text-[#00f2ff]" />}
              {rightHand.gesture === 'CLEAR' && <Trash2 className="w-6 h-6 text-[#00f2ff]" />}
              {rightHand.gesture === 'NONE' && <Hand className="w-6 h-6 text-white/20" />}
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">{rightHand.gesture === 'NONE' ? 'READY' : rightHand.gesture}</p>
              <p className="text-xs text-white/40">Input Action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hand Cursors */}
      <HandCursor state={rightHand} color="#00f2ff" />
      <HandCursor state={leftHand} color="#ff4e00" />
    </div>
  );
}

function HandCursor({ state, color }: { state: HandState, color: string }) {
  if (!state.isActive) return null;

  return (
    <div 
      className="absolute pointer-events-none transition-transform duration-75 ease-out"
      style={{ 
        left: `${state.position.x * 100}%`, 
        top: `${state.position.y * 100}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="relative">
        {/* Outer Ring */}
        <div 
          className="w-12 h-12 rounded-full border-2 opacity-50 animate-ping"
          style={{ borderColor: color }}
        />
        {/* Inner Dot */}
        <div 
          className="absolute inset-0 m-auto w-3 h-3 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"
          style={{ backgroundColor: color }}
        />
        
        {/* Gesture Label */}
        {state.gesture !== 'NONE' && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-3 py-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full">
            <p className="text-[10px] font-bold tracking-widest uppercase whitespace-nowrap" style={{ color }}>
              {state.gesture}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
