import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sparkles, Float, Html, QuadraticBezierLine } from '@react-three/drei';

// Animated glowing light pulse flowing along a 3D quadratic Bezier curve
function EnergyPulse({ start, mid, end, color, speed = 0.35, offset = 0 }) {
  const ref = useRef();
  const p0 = useMemo(() => new THREE.Vector3(...start), [start]);
  const p1 = useMemo(() => new THREE.Vector3(...mid), [mid]);
  const p2 = useMemo(() => new THREE.Vector3(...end), [end]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    const inv = 1 - t;
    tmp.set(
      inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
      inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
      inv * inv * p0.z + 2 * inv * t * p1.z + t * t * p2.z
    );
    ref.current.position.copy(tmp);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.085, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} />
    </mesh>
  );
}

// Luminous Central Hub Sphere with two rotating orbital rings
function CoreHub({ onReset, moduleCount }) {
  const ring1 = useRef();
  const ring2 = useRef();
  const core = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1.current) {
      ring1.current.rotation.z = t * 0.45;
      ring1.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.4) * 0.12;
    }
    if (ring2.current) {
      ring2.current.rotation.z = -t * 0.35;
      ring2.current.rotation.y = t * 0.25;
    }
    if (core.current) {
      core.current.rotation.y = t * 0.2;
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onReset(); }}>
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.25}>
        {/* Inner glowing crystal core */}
        <mesh ref={core} castShadow>
          <icosahedronGeometry args={[1.15, 2]} />
          <meshStandardMaterial
            color="#2563eb"
            emissive="#1d4ed8"
            emissiveIntensity={0.95}
            roughness={0.18}
            metalness={0.75}
          />
        </mesh>

        {/* Outer translucent glass aura */}
        <mesh>
          <sphereGeometry args={[1.42, 32, 32]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#3b82f6"
            emissiveIntensity={0.35}
            transparent
            opacity={0.18}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>

        {/* Orbital Ring 1 */}
        <mesh ref={ring1} rotation={[Math.PI / 2.6, 0.2, 0]}>
          <torusGeometry args={[1.95, 0.035, 16, 80]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.1} />
        </mesh>

        {/* Orbital Ring 2 */}
        <mesh ref={ring2} rotation={[Math.PI / 1.7, -0.5, 0]}>
          <torusGeometry args={[2.3, 0.022, 16, 80]} />
          <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.9} transparent opacity={0.75} />
        </mesh>

        {/* Crisp HTML Center Label */}
        <Html center position={[0, -2.05, 0]} distanceFactor={15} zIndexRange={[20, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="px-4 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-blue-400/50 shadow-[0_0_25px_rgba(59,130,246,0.45)] text-center cursor-pointer select-none whitespace-nowrap hover:scale-105 transition-transform"
          >
            <div className="text-sm font-black tracking-widest text-white uppercase">ARGUS BI</div>
            <div className="text-[10px] font-semibold text-sky-300 tracking-wide">
              {moduleCount} Core Modules • Click to Center
            </div>
          </button>
        </Html>
      </Float>
    </group>
  );
}

// Subtle futuristic radial grid rings on the floor plane
function HoloFloor() {
  return (
    <group position={[0, -4.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {[3.2, 6.2, 9.6, 13.0].map((r, i) => (
        <mesh key={r}>
          <ringGeometry args={[r - 0.025, r + 0.025, 96]} />
          <meshBasicMaterial
            color={i === 1 ? '#38bdf8' : '#334155'}
            transparent
            opacity={i === 1 ? 0.22 : 0.16}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// Smooth camera fly-to controller that yields immediately when user drags
function CameraRig({ controlsRef, focusPos, focusTarget, trigger }) {
  const { camera } = useThree();
  const isAnimating = useRef(false);
  const desiredPos = useRef(new THREE.Vector3(0, 5.2, 16.2));
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (focusPos && focusTarget) {
      desiredPos.current.set(...focusPos);
      desiredTarget.current.set(...focusTarget);
      isAnimating.current = true;
    }
  }, [focusPos, focusTarget, trigger]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const stopAnim = () => {
      isAnimating.current = false;
    };
    ctrl.addEventListener('start', stopAnim);
    return () => ctrl.removeEventListener('start', stopAnim);
  }, [controlsRef]);

  useFrame((_, delta) => {
    if (!isAnimating.current || !controlsRef.current) return;
    const alpha = Math.min(1, delta * 4.2);
    camera.position.lerp(desiredPos.current, alpha);
    controlsRef.current.target.lerp(desiredTarget.current, alpha);
    controlsRef.current.update();
    if (
      camera.position.distanceTo(desiredPos.current) < 0.06 &&
      controlsRef.current.target.distanceTo(desiredTarget.current) < 0.06
    ) {
      isAnimating.current = false;
    }
  });

  return null;
}

// Individual 3D Module Orb + its blooming 3D Satellite Leaves
function BranchNode3D({
  branch,
  index,
  total,
  isExpanded,
  isFocused,
  onToggle,
  onSelectLeaf,
}) {
  const ringRef = useRef();

  const { pos, midToHub, satellites } = useMemo(() => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const radius = 6.3;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = index % 2 === 0 ? 1.15 : -1.05;

    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const tanX = -Math.sin(angle);
    const tanZ = Math.cos(angle);

    const mid = [x * 0.5, y * 0.5 + (index % 2 === 0 ? 0.9 : -0.7), z * 0.5];

    const count = branch.children.length;
    const sats = branch.children.map((leaf, li) => {
      const spread = count > 1 ? (li / (count - 1)) - 0.5 : 0; // -0.5 .. +0.5
      const outDist = 3.55;
      const latSpread = spread * 3.1;
      const vertSpread = spread * 2.5 + (li % 2 === 0 ? 0.35 : -0.35);

      const sx = x + dirX * outDist + tanX * latSpread;
      const sy = y + vertSpread;
      const sz = z + dirZ * outDist + tanZ * latSpread;

      const smid = [
        (x + sx) / 2,
        (y + sy) / 2 + 0.45,
        (z + sz) / 2,
      ];

      return { leaf, pos: [sx, sy, sz], mid: smid };
    });

    return { pos: [x, y, z], midToHub: mid, satellites: sats };
  }, [branch, index, total]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.7 + index;
    }
  });

  return (
    <group>
      {/* Glowing 3D Curve from Core Hub -> Branch Orb */}
      <QuadraticBezierLine
        start={[0, 0, 0]}
        mid={midToHub}
        end={pos}
        color={branch.color}
        lineWidth={isFocused ? 3.5 : 2.1}
        transparent
        opacity={isFocused ? 0.95 : 0.62}
      />

      {/* Animated Energy Pulse flowing outward */}
      <EnergyPulse
        start={[0, 0, 0]}
        mid={midToHub}
        end={pos}
        color={branch.color}
        speed={0.28 + (index % 3) * 0.05}
        offset={index * 0.13}
      />

      {/* Main Branch 3D Sphere */}
      <group position={pos}>
        <Float speed={2} rotationIntensity={0.25} floatIntensity={0.22}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onToggle(branch.id, pos);
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <sphereGeometry args={[isFocused ? 0.76 : 0.62, 32, 32]} />
            <meshStandardMaterial
              color={branch.color}
              emissive={branch.color}
              emissiveIntensity={isFocused ? 0.9 : 0.48}
              roughness={0.2}
              metalness={0.55}
            />
          </mesh>

          {/* Subtle glowing halo ring around branch orb */}
          <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0.3, 0]}>
            <torusGeometry args={[isFocused ? 1.05 : 0.86, 0.022, 12, 56]} />
            <meshBasicMaterial color={branch.color} transparent opacity={isFocused ? 0.9 : 0.5} />
          </mesh>

          {/* Floating Crisp Glass Label */}
          <Html center position={[0, 1.15, 0]} distanceFactor={16} zIndexRange={[15, 0]}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(branch.id, pos);
              }}
              className={`px-3 py-1.5 rounded-xl backdrop-blur-md border transition-all cursor-pointer select-none whitespace-nowrap flex items-center gap-2 ${
                isFocused
                  ? 'bg-slate-900/95 text-white border-white/60 scale-105 shadow-[0_0_24px_rgba(255,255,255,0.25)]'
                  : 'bg-slate-950/80 text-slate-100 border-white/20 hover:border-white/50 hover:scale-105'
              }`}
              style={{
                boxShadow: isFocused ? `0 0 22px ${branch.color}80` : `0 4px 16px rgba(0,0,0,0.4)`,
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: branch.color, boxShadow: `0 0 10px ${branch.color}` }}
              />
              <div className="text-left">
                <div className="text-xs font-extrabold leading-tight">{branch.title}</div>
                <div className="text-[9px] text-slate-300 leading-tight">{branch.subtitle}</div>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-200 ml-0.5">
                {branch.children.length}
              </span>
            </button>
          </Html>
        </Float>
      </group>

      {/* Blooming 3D Satellite Leaf Nodes when Expanded */}
      {isExpanded &&
        satellites.map(({ leaf, pos: sPos, mid: sMid }) => (
          <group key={leaf.id}>
            <QuadraticBezierLine
              start={pos}
              mid={sMid}
              end={sPos}
              color={branch.color}
              lineWidth={1.6}
              transparent
              opacity={0.75}
            />

            <group position={sPos}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLeaf(leaf.route);
                }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'auto'; }}
              >
                <sphereGeometry args={[0.26, 20, 20]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={branch.color}
                  emissiveIntensity={0.85}
                  roughness={0.2}
                  metalness={0.4}
                />
              </mesh>

              <Html center position={[0, 0.55, 0]} distanceFactor={15} zIndexRange={[10, 0]}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLeaf(leaf.route);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/95 hover:bg-white text-slate-900 text-[11px] font-bold shadow-lg border border-white/80 hover:scale-105 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  style={{ borderLeft: `3px solid ${branch.color}` }}
                >
                  <span>{leaf.label}</span>
                  <span className="text-[10px] opacity-60">→</span>
                </button>
              </Html>
            </group>
          </group>
        ))}
    </group>
  );
}

export default function MindMap3DScene({
  branches,
  expanded,
  focusedId,
  autoRotate,
  cameraTarget,
  cameraTrigger,
  onToggleBranch,
  onResetView,
  onNavigate,
}) {
  const controlsRef = useRef();

  return (
    <Canvas
      camera={{ position: [0, 5.2, 16.2], fov: 46, near: 0.1, far: 120 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => {}}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060b19']} />
      <fog attach="fog" args={['#060b19', 24, 52]} />

      {/* Studio 3D Lighting */}
      <ambientLight intensity={0.65} />
      <pointLight position={[0, 0, 0]} intensity={2.6} color="#60a5fa" distance={22} />
      <directionalLight position={[10, 14, 10]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-10, -8, -10]} intensity={0.55} color="#818cf8" />

      {/* Subtle Ambient Floating Star Particles */}
      <Sparkles count={90} scale={[26, 14, 26]} size={2.2} speed={0.25} opacity={0.45} color="#93c5fd" />

      {/* Holographic Floor Rings */}
      <HoloFloor />

      {/* Central ARGUS BI 3D Core */}
      <CoreHub onReset={onResetView} moduleCount={branches.length} />

      {/* 8 Orbital 3D Module Branches */}
      {branches.map((branch, idx) => (
        <BranchNode3D
          key={branch.id}
          branch={branch}
          index={idx}
          total={branches.length}
          isExpanded={!!expanded[branch.id]}
          isFocused={focusedId === branch.id}
          onToggle={onToggleBranch}
          onSelectLeaf={onNavigate}
        />
      ))}

      {/* Smooth Camera Transitions */}
      <CameraRig
        controlsRef={controlsRef}
        focusPos={cameraTarget?.pos}
        focusTarget={cameraTarget?.target}
        trigger={cameraTrigger}
      />

      {/* Full 360° Interactive 3D Orbit Controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
        minDistance={5.5}
        maxDistance={30}
        maxPolarAngle={Math.PI * 0.85}
      />
    </Canvas>
  );
}
