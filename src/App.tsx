import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Play, Pause, RefreshCw, Layers, Info, Wind, ChevronRight, PlayCircle } from 'lucide-react';

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
  const wireframeMeshRef = useRef<THREE.LineSegments | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
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
    scene.background = new THREE.Color(0xfdf2f8); // Soft pinkish white
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x60a5fa, 1.0, 200); // Blue
    pointLight1.position.set(30, 0, 50);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xf472b6, 0.8, 200); // Pink
    pointLight2.position.set(-30, 0, 30);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xc084fc, 0.6, 200); // Purple
    pointLight3.position.set(0, 40, 40);
    scene.add(pointLight3);

    // Breathing Glow Light below the plane
    const glowLight = new THREE.PointLight(0xc084fc, 0.4, 100);
    glowLight.position.set(0, 0, -15);
    scene.add(glowLight);
    glowLightRef.current = glowLight;

    // Geometry & Material
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentsX, segmentsY);
    geometryRef.current = geometry;

    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.6,
      thickness: 2,
      ior: 1.5,
      side: THREE.DoubleSide,
      wireframe: false,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });
    materialRef.current = material;

    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    planeRef.current = plane;

    // Separate Wireframe for better visibility
    const wireframeGeo = new THREE.WireframeGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({ 
      color: 0xc084fc, 
      transparent: true, 
      opacity: 0.4,
    });
    const wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
    wireframeMesh.visible = false;
    scene.add(wireframeMesh);
    wireframeMeshRef.current = wireframeMesh;

    // Create Corner Markers (Hollow Circles)
    const ringGeo = new THREE.RingGeometry(1.8, 2.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
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
      if (isDragging && planeRef.current && wireframeMeshRef.current) {
        const deltaX = e.clientX - prevMouse.x;
        const deltaY = e.clientY - prevMouse.y;
        planeRef.current.rotation.z -= deltaX * 0.005;
        planeRef.current.rotation.x -= deltaY * 0.005;
        wireframeMeshRef.current.rotation.copy(planeRef.current.rotation);
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
    if (wireframeMeshRef.current) {
      wireframeMeshRef.current.visible = showWireframe;
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
        glowLightRef.current.intensity = 0.2 + Math.sin(t * 1.5) * 0.1;
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
          const jitterFreq = 15;
          const jitter = (Math.sin(t * jitterFreq * Math.PI * 2) * 0.7) + (Math.sin(t * jitterFreq * 2.3 * Math.PI * 2) * 0.3);
          z = jitter * (A * 0.15);
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
        if (planeRef.current) {
          cornerMarkersRef.current.forEach((marker, idx) => {
            marker.rotation.copy(planeRef.current!.rotation);
            let zVal = 0;
            
            if (mode === 'TENSION') {
              const jitterFreq = 15;
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

      // Update wireframe geometry to match plane
      if (wireframeMeshRef.current) {
        wireframeMeshRef.current.geometry.dispose();
        wireframeMeshRef.current.geometry = new THREE.WireframeGeometry(geometry);
      }

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
    <div className="relative w-full h-screen overflow-hidden bg-[#fdf2f8] font-sans text-slate-900">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Header Overlay */}
      <div 
        className="absolute top-12 left-12 z-10 pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 flex items-center justify-center">
              <Wind className="w-6 h-6 text-brand-purple" />
            </div>
            <span className="text-xs font-bold tracking-[0.2em] text-brand-purple uppercase">Story Grows</span>
          </div>
          <h1 className="text-6xl font-bold tracking-tight text-slate-900 leading-[1.0] whitespace-pre-line">
            Story Grows{"\n"}
            <span className="text-brand-pink italic">Morphing</span> Mechanism
          </h1>
        </motion.div>
      </div>

      {/* Bottom Right Control Panel */}
      <div 
        className="absolute bottom-12 right-12 z-20 w-80"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-white/50 backdrop-blur-3xl border border-white/60 rounded-[3rem] p-8 shadow-[0_40px_80px_-20px_rgba(244,114,182,0.15)] overflow-hidden"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                <Settings className="w-5 h-5 text-brand-purple" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">控制面板</h2>
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center hover:bg-brand-purple/80 transition-all shadow-lg shadow-brand-purple/20"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-3 mb-10">
            {(['CALM', 'MAGIC', 'TENSION', 'JOY'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`py-3 px-4 rounded-2xl text-[10px] font-bold tracking-wider transition-all border ${
                  mode === m
                    ? 'bg-brand-pink border-brand-pink text-white shadow-lg shadow-brand-pink/30'
                    : 'bg-white/40 border-white/60 text-slate-500 hover:bg-white/60'
                }`}
              >
                {m === 'CALM' ? '宁静 CALM' : m === 'MAGIC' ? '幻妙 MAGIC' : m === 'TENSION' ? '紧张 TENSION' : '欢欣 JOY'}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase text-slate-400">
                <span>Amplitude</span>
                <span className="text-brand-pink">{amplitude} mm</span>
              </div>
              <div className="relative h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-brand-pink transition-all"
                  style={{ width: `${(amplitude / 60) * 100}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={amplitude}
                  onChange={(e) => setAmplitude(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase text-slate-400">
                <span>Frequency</span>
                <span className="text-brand-purple">{frequency.toFixed(2)} Hz</span>
              </div>
              <div className="relative h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-brand-purple transition-all"
                  style={{ width: `${(frequency / 2) * 100}%` }}
                />
                <input
                  type="range"
                  min="0.05"
                  max="2.0"
                  step="0.05"
                  value={frequency}
                  onChange={(e) => setFrequency(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase text-slate-400">
                <span>Phase Shift</span>
                <span className="text-brand-blue">{phaseShift}°</span>
              </div>
              <div className="relative h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-brand-blue transition-all"
                  style={{ width: `${(phaseShift / 180) * 100}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="15"
                  value={phaseShift}
                  onChange={(e) => setPhaseShift(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/60 flex items-center justify-between">
            <label className="flex items-center gap-4 cursor-pointer group">
              <div
                onClick={() => setShowWireframe(!showWireframe)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  showWireframe ? 'bg-brand-purple' : 'bg-white/60'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                    showWireframe ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400 group-hover:text-brand-purple transition-colors">
                Wireframe
              </span>
            </label>
            <Layers className={`w-5 h-5 ${showWireframe ? 'text-brand-purple' : 'text-slate-300'}`} />
          </div>
        </motion.div>
      </div>

      {/* Tooltip */}
      <div 
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 py-3 bg-white/40 backdrop-blur-md rounded-full border border-white/60 shadow-sm text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
          <Info className="w-3 h-3 text-brand-pink" />
          Drag to rotate | Scroll to zoom
        </div>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 15s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border: 2px solid #f472b6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(244,114,182,0.2);
        }
      `}</style>
    </div>
  );
}
