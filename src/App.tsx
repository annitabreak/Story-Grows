import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Play, Pause, RefreshCw, Layers, Info, Wind } from 'lucide-react';

type Mode = 'CALM' | 'MAGIC' | 'TENSION' | 'JOY';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('CALM');
  const [amplitude, setAmplitude] = useState(20);
  const [frequency, setFrequency] = useState(0.15);
  const [phaseShift, setPhaseShift] = useState(0);
  const [showWireframe, setShowWireframe] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for Three.js objects to avoid re-renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const cornerMarkersRef = useRef<THREE.Mesh[]>([]);
  const glowLightRef = useRef<THREE.PointLight | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const requestRef = useRef<number | null>(null);

  // Constants for geometry
  const planeWidth = 80;
  const planeHeight = 45;
  const segmentsX = 40;
  const segmentsY = 22;

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, -65, 70);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x3498db, 1.2, 200);
    pointLight1.position.set(30, 0, 50);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xe74c3c, 0.6, 200);
    pointLight2.position.set(-30, 0, 30);
    scene.add(pointLight2);

    // Breathing Glow Light below the plane
    const glowLight = new THREE.PointLight(0x60a5fa, 0.5, 100);
    glowLight.position.set(0, 0, -15);
    scene.add(glowLight);
    glowLightRef.current = glowLight;

    // Geometry & Material
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
    geometryRef.current = geometry;

    const material = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.4,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    materialRef.current = material;

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    planeRef.current = plane;

    // Create Corner Markers (Hollow Circles)
    const ringGeo = new THREE.RingGeometry(1.8, 2.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3498db, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const markers: THREE.Mesh[] = [];

    const cornerPositions = [
      [-planeWidth / 2, -planeHeight / 2], // BL
      [planeWidth / 2, -planeHeight / 2],  // BR
      [-planeWidth / 2, planeHeight / 2],  // TL
      [planeWidth / 2, planeHeight / 2],   // TR
    ];

    cornerPositions.forEach(([x, y]) => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(x, y, 0);
      scene.add(ring);
      markers.push(ring);
    });
    cornerMarkersRef.current = markers;

    // Handle resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Interaction state
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const onMouseDown = () => (isDragging = true);
    const onMouseUp = () => (isDragging = false);
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging && planeRef.current) {
        const deltaX = e.clientX - prevMouse.x;
        const deltaY = e.clientY - prevMouse.y;
        planeRef.current.rotation.z -= deltaX * 0.005;
        planeRef.current.rotation.x -= deltaY * 0.005;
      }
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Sync state with Three.js
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.wireframe = showWireframe;
    }
  }, [showWireframe]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      if (isPaused) return;

      const t = clockRef.current.getElapsedTime();
      
      // Update breathing glow
      if (glowLightRef.current) {
        glowLightRef.current.intensity = 0.4 + Math.sin(t * 1.5) * 0.2;
      }

      const geometry = geometryRef.current;
      if (!geometry) return;

      const positionAttribute = geometry.attributes.position;
      const vertexCount = positionAttribute.count;

      const A = amplitude * 0.5;
      const f = frequency;
      const phase = phaseShift * (Math.PI / 180);

      for (let i = 0; i < vertexCount; i++) {
        const x = positionAttribute.getX(i);
        const y = positionAttribute.getY(i);

        const u = (x + planeWidth / 2) / planeWidth;
        const v = (y + planeHeight / 2) / planeHeight;

        let z = 0;

        if (mode === 'TENSION') {
          // Tension mode: Fast jitter/shiver
          // Base vibration + high frequency noise
          const baseFreq = f * 10; // Much faster
          const jitter = (Math.sin(t * baseFreq * Math.PI * 2) * 0.7) + (Math.sin(t * baseFreq * 2.3 * Math.PI * 2) * 0.3);
          z = jitter * (A * 0.15); // Small amplitude
          // Add a bit of spatial variation
          z += Math.sin(u * 10 + t * 5) * (A * 0.05);
        } else {
          const Z_BL = A * Math.sin(2 * Math.PI * f * t + 0 * phase);
          const Z_BR = A * Math.sin(2 * Math.PI * f * t + 1 * phase);
          const Z_TL = A * Math.sin(2 * Math.PI * f * t + 2 * phase);
          const Z_TR = A * Math.sin(2 * Math.PI * f * t + 3 * phase);

          z = (1 - u) * (1 - v) * Z_BL +
            u * (1 - v) * Z_BR +
            (1 - u) * v * Z_TL +
            u * v * Z_TR;
        }

        positionAttribute.setZ(i, z);
      }

      // Update corner markers
      if (cornerMarkersRef.current.length === 4) {
        // Sync markers with plane rotation
        if (planeRef.current) {
          cornerMarkersRef.current.forEach((marker, idx) => {
            marker.rotation.copy(planeRef.current!.rotation);
            let zVal = 0;
            
            if (mode === 'TENSION') {
              // Refined jitter logic: high frequency regardless of base f
              const jitterFreq = 15; // Fixed fast frequency for tension
              const jitter = (Math.sin(t * jitterFreq * Math.PI * 2) * 0.7) + (Math.sin(t * jitterFreq * 2.3 * Math.PI * 2) * 0.3);
              zVal = jitter * (A * 0.15);
              const u = idx % 2 === 0 ? 0 : 1;
              zVal += Math.sin(u * 10 + t * 5) * (A * 0.05);
            } else {
              const Z_BL = A * Math.sin(2 * Math.PI * f * t + 0 * phase);
              const Z_BR = A * Math.sin(2 * Math.PI * f * t + 1 * phase);
              const Z_TL = A * Math.sin(2 * Math.PI * f * t + 2 * phase);
              const Z_TR = A * Math.sin(2 * Math.PI * f * t + 3 * phase);
              zVal = idx === 0 ? Z_BL : idx === 1 ? Z_BR : idx === 2 ? Z_TL : Z_TR;
            }
            
            // Calculate rotated position
            const x = idx % 2 === 0 ? -planeWidth / 2 : planeWidth / 2;
            const y = idx < 2 ? -planeHeight / 2 : planeHeight / 2;
            
            const vector = new THREE.Vector3(x, y, zVal);
            vector.applyEuler(planeRef.current!.rotation);
            marker.position.copy(vector);
          });
        }
      }

      positionAttribute.needsUpdate = true;
      geometry.computeVertexNormals();

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode, amplitude, frequency, phaseShift, isPaused]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    switch (newMode) {
      case 'CALM':
        setAmplitude(20);
        setFrequency(0.15);
        setPhaseShift(0);
        break;
      case 'MAGIC':
        setAmplitude(35);
        setFrequency(0.25);
        setPhaseShift(90);
        break;
      case 'TENSION':
        setAmplitude(15);
        setFrequency(0.15);
        setPhaseShift(0);
        break;
      case 'JOY':
        setAmplitude(25);
        setFrequency(1.0);
        setPhaseShift(180);
        break;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans text-slate-200">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Header Overlay */}
      <div 
        className="absolute top-8 left-8 z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-1"
        >
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin-slow" />
            Kinematic Parameter Mapping
          </h1>
          <p className="text-sm text-slate-400 font-medium">Dynamic Plane Dynamics Simulator V1.4</p>
        </motion.div>
      </div>

      {/* Bottom Right Control Panel */}
      <div 
        className="absolute bottom-8 right-8 z-20 w-80"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              控制面板
            </h2>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 mb-8">
            {(['CALM', 'MAGIC', 'TENSION', 'JOY'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  mode === m
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border-blue-500'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-transparent'
                } border`}
              >
                {m === 'CALM' ? '宁静 CALM' : m === 'MAGIC' ? '幻妙 MAGIC' : m === 'TENSION' ? '紧张 TENSION' : '欢欣 JOY'}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">目标位移 (Amplitude)</span>
                <span className="text-blue-400 font-mono">{amplitude} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={amplitude}
                onChange={(e) => setAmplitude(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">运动频率 (Frequency)</span>
                <span className="text-blue-400 font-mono">{frequency.toFixed(2)} Hz</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="2.0"
                step="0.05"
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-slate-400">相位差 (Phase Shift)</span>
                <span className="text-blue-400 font-mono">{phaseShift}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                step="15"
                value={phaseShift}
                onChange={(e) => setPhaseShift(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setShowWireframe(!showWireframe)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  showWireframe ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${
                    showWireframe ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                显示拓扑网格 (Wireframe)
              </span>
            </label>
            <Layers className={`w-4 h-4 ${showWireframe ? 'text-blue-400' : 'text-slate-600'}`} />
          </div>
        </motion.div>
      </div>

      {/* Tooltip */}
      <div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 backdrop-blur-md rounded-full border border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <Info className="w-3 h-3" />
          鼠标左键拖拽旋转视角 | 滚轮缩放
        </div>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
