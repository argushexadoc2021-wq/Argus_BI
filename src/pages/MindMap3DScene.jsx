import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sparkles, Float, Html, QuadraticBezierLine } from '@react-three/drei';

// Animated glowing energy pulse flowing along a 3D Bezier curve
function EnergyPulse({ start, mid, end, color, speed = 0.3, offset = 0, dimmed = false }) {
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

  if (dimmed) return null;

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.09, 10, 10]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} />
    </mesh>
  );
}

// Luminous Central 3D Core ("ARGUS BI")
function CoreHub({ onReset, moduleCount }) {
  const ring1 = useRef();
  const ring2 = useRef();
  const core = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1.current) {
      ring1.current.rotation.z = t * 0.45;
      ring1.current.rotation.x = Math.PI / 2.6 + Math.sin(t * 0.4) * 0.1;
    }
    if (ring2.current) {
      ring2.current.rotation.z = -t * 0.3;
      ring2.current.rotation.y = t * 0.25;
    }
    if (core.current) {
      core.current.rotation.y = t * 0.22;
    }
  });

  return (
    <group position={[0, 0, 1.2]} onClick={(e) => { e.stopPropagation(); onReset(); }}>
      <Float speed={1.5} rotationIntensity={0.12} floatIntensity={0.2}>
        <mesh
          ref={core}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <icosahedronGeometry args={[1.1, 2]} />
          <meshStandardMaterial
            color="#2563eb"
            emissive="#1d4ed8"
            emissiveIntensity={0.95}
            roughness={0.18}
            metalness={0.75}
          />
        </mesh>

        {/* Glass Aura */}
        <mesh>
          <sphereGeometry args={[1.38, 32, 32]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#3b82f6"
            emissiveIntensity={0.35}
            transparent
            opacity={0.16}
            roughness={0.1}
          />
        </mesh>

        {/* Spinning 3D Halo Rings */}
        <mesh ref={ring1} rotation={[Math.PI / 2.6, 0.2, 0]}>
          <torusGeometry args={[1.85, 0.032, 16, 72]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.1} />
        </mesh>
        <mesh ref={ring2} rotation={[Math.PI / 1.7, -0.45, 0]}>
          <torusGeometry args={[2.15, 0.02, 16, 72]} />
          <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.85} transparent opacity={0.7} />
        </mesh>

        {/* Center Crisp Badge */}
        <Html center position={[0, -2.0, 0]} zIndexRange={[30, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            className="px-4 py-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.45)] text-center cursor-pointer select-none whitespace-nowrap hover:scale-105 transition-transform"
          >
            <div className="text-sm font-black tracking-widest text-white uppercase">ARGUS BI</div>
            <div className="text-[10px] font-semibold text-sky-300">{moduleCount} Core Modules</div>
          </button>
        </Html>
      </Float>
    </group>
  );
}

// Smooth Camera Controller (yields immediately when user drags)
function CameraRig({ controlsRef, focusPos, focusTarget, trigger }) {
  const { camera } = useThree();
  const isAnimating = useRef(false);
  const desiredPos = useRef(new THREE.Vector3(0, 0.4, 21.5));
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
    const alpha = Math.min(1, delta * 4.5);
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

// Subtle Curved 3D Background Grid Arc (gives spatial depth without clutter)
function SpaceBackdropGrid() {
  return (
    <group position={[0, 0, -4.5]}>
      {[-6.5, -2.15, 2.15, 6.5].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <planeGeometry args={[28, 0.018]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.09} />
        </mesh>
      ))}
    </group>
  );
}

// Compute non-overlapping 3D amphitheater coordinates for each branch
export function computeBranchPos3D(branch, sideIndex) {
  const isLeft = branch.side === 'left';
  // 4 cleanly spaced vertical lanes: +6.3, +2.1, -2.1, -6.3 (4.2 units apart!)
  const yPositions = [6.3, 2.1, -2.1, -6.3];
  const y = yPositions[sideIndex] ?? 0;
  const x = isLeft ? -5.8 : 5.8;
  // Gentle amphitheater arc curve in Z so outer edges wrap smoothly toward viewer
  const z = Math.abs(y) > 4 ? 0.5 : -0.4;
  return [x, y, z];
}

// One 3D Branch Sphere + its cleanly spaced outer 3D Satellite Leaf Nodes
function BranchNode3D({
  branch,
  sideIndex,
  isExpanded,
  isFocused,
  isDimmed,
  onFocusBranch,
  onSelectLeaf,
}) {
  const ringRef = useRef();
  const isLeft = branch.side === 'left';

  const { pos, hubMid, satellites } = useMemo(() => {
    const bPos = computeBranchPos3D(branch, sideIndex);
    const [bx, by, bz] = bPos;

    // Smooth curved midpoint from Core [0, 0, 1.2] -> Branch [bx, by, bz]
    const mid = [bx * 0.48, by * 0.85, (1.2 + bz) * 0.5 + 0.6];

    // Space child leaves cleanly in a vertical ladder outside the branch orb
    // Branch spacing is 4.2 units; 5 leaves at 0.78 spacing = 3.12 total height -> guaranteed zero overlap!
    const count = branch.children.length;
    const stepY = 0.78;
    const leafX = isLeft ? -10.8 : 10.8;

    const sats = branch.children.map((leaf, li) => {
      const offsetY = (li - (count - 1) / 2) * stepY;
      // Top-to-bottom order matches list order (invert offsetY so index 0 is highest)
      const sy = by - offsetY;
      const sz = bz + 1.15 - Math.abs(offsetY) * 0.12;
      const smid = [
        (bx + leafX) * 0.5,
        by + (sy - by) * 0.6,
        (bz + sz) * 0.5 + 0.4,
      ];
      return { leaf, pos: [leafX, sy, sz], mid: smid };
    });

    return { pos: bPos, hubMid: mid, satellites: sats };
  }, [branch, sideIndex, isLeft]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.getElapsedTime() * 0.65 + sideIndex;
    }
  });

  const opacity = isDimmed ? 0.2 : 1;

  return (
    <group>
      {/* Glowing 3D Curve: Core -> Branch */}
      <QuadraticBezierLine
        start={[0, 0, 1.2]}
        mid={hubMid}
        end={pos}
        color={branch.color}
        lineWidth={isFocused ? 3.2 : 2.0}
        transparent
        opacity={isDimmed ? 0.12 : isFocused ? 0.95 : 0.65}
      />

      {/* Animated Light Pulse along Core -> Branch */}
      <EnergyPulse
        start={[0, 0, 1.2]}
        mid={hubMid}
        end={pos}
        color={branch.color}
        speed={0.26 + (sideIndex % 3) * 0.04}
        offset={sideIndex * 0.22 + (isLeft ? 0 : 0.11)}
        dimmed={isDimmed}
      />

      {/* Branch 3D Orb */}
      <group position={pos}>
        <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.14}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onFocusBranch(branch.id, pos);
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            <sphereGeometry args={[isFocused ? 0.68 : 0.54, 28, 28]} />
            <meshStandardMaterial
              color={branch.color}
              emissive={branch.color}
              emissiveIntensity={isDimmed ? 0.15 : isFocused ? 0.95 : 0.55}
              roughness={0.2}
              metalness={0.55}
              transparent
              opacity={opacity}
            />
          </mesh>

          <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0.25, 0]}>
            <torusGeometry args={[isFocused ? 0.95 : 0.78, 0.022, 12, 48]} />
            <meshBasicMaterial color={branch.color} transparent opacity={isDimmed ? 0.1 : 0.6} />
          </mesh>

          {/* Clean Branch Title Pill positioned directly below the orb */}
          <Html center position={[0, -0.95, 0]} zIndexRange={[20, 0]}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocusBranch(branch.id, pos);
              }}
              className={`px-3 py-1 rounded-xl backdrop-blur-md border transition-all cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5 ${
                isDimmed
                  ? 'opacity-25 bg-slate-950/60 border-white/10 text-slate-400'
                  : isFocused
                  ? 'bg-slate-900/95 text-white border-white/70 scale-105'
                  : 'bg-slate-950/85 text-white border-white/25 hover:border-white/60 hover:scale-105'
              }`}
              style={{
                boxShadow: isDimmed ? 'none' : `0 0 18px ${branch.color}55`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: branch.color }}
              />
              <span className="text-[11px] font-extrabold tracking-tight">{branch.title}</span>
            </button>
          </Html>
        </Float>
      </group>

      {/* Outer Satellite 3D Leaf Nodes (Guaranteed Non-Overlapping) */}
      {isExpanded &&
        satellites.map(({ leaf, pos: sPos, mid: sMid }) => (
          <group key={leaf.id}>
            <QuadraticBezierLine
              start={pos}
              mid={sMid}
              end={sPos}
              color={branch.color}
              lineWidth={isFocused ? 2.0 : 1.35}
              transparent
              opacity={isDimmed ? 0.08 : isFocused ? 0.85 : 0.55}
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
                <sphereGeometry args={[0.2, 18, 18]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={branch.color}
                  emissiveIntensity={isDimmed ? 0.15 : 0.85}
                  roughness={0.2}
                  metalness={0.3}
                  transparent
                  opacity={opacity}
                />
              </mesh>

              {/* Outer-Aligned Crisp Leaf Label (never crosses connecting beams!) */}
              <Html
                position={[isLeft ? -0.35 : 0.35, 0, 0]}
                zIndexRange={[10, 0]}
                style={{
                  transform: isLeft ? 'translate(-100%, -50%)' : 'translate(0%, -50%)',
                  pointerEvents: isDimmed ? 'none' : 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLeaf(leaf.route);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-md ${
                    isDimmed
                      ? 'opacity-15 bg-slate-900/50 text-slate-400 border border-white/10'
                      : 'bg-white/95 hover:bg-white text-slate-900 border border-white hover:scale-105'
                  }`}
                  style={
                    isDimmed
                      ? undefined
                      : isLeft
                      ? { borderRight: `3px solid ${branch.color}` }
                      : { borderLeft: `3px solid ${branch.color}` }
                  }
                >
                  {isLeft && <span className="text-[10px] text-slate-400">↗</span>}
                  <span>{leaf.label}</span>
                  {!isLeft && <span className="text-[10px] text-slate-400">→</span>}
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
  onFocusBranch,
  onResetView,
  onNavigate,
}) {
  const controlsRef = useRef();

  const leftBranches = useMemo(() => branches.filter((b) => b.side === 'left'), [branches]);
  const rightBranches = useMemo(() => branches.filter((b) => b.side === 'right'), [branches]);

  return (
    <Canvas
      camera={{ position: [0, 0.4, 21.5], fov: 44, near: 0.1, far: 140 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#060b19']} />
      <fog attach="fog" args={['#060b19', 32, 70]} />

      {/* Clean Studio Lighting */}
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 0, 4]} intensity={2.4} color="#60a5fa" distance={28} />
      <directionalLight position={[10, 14, 14]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-10, -8, 10]} intensity={0.5} color="#818cf8" />

      {/* Subtle Floating Star Particles */}
      <Sparkles count={70} scale={[34, 20, 14]} size={2.0} speed={0.2} opacity={0.38} color="#93c5fd" />

      <SpaceBackdropGrid />

      {/* Center Core */}
      <CoreHub onReset={onResetView} moduleCount={branches.length} />

      {/* Left Wing (Operations: Sales, Production, Inventory, Finance) */}
      {leftBranches.map((branch, idx) => (
        <BranchNode3D
          key={branch.id}
          branch={branch}
          sideIndex={idx}
          isExpanded={!!expanded[branch.id]}
          isFocused={focusedId === branch.id}
          isDimmed={focusedId !== null && focusedId !== branch.id}
          onFocusBranch={onFocusBranch}
          onSelectLeaf={onNavigate}
        />
      ))}

      {/* Right Wing (Suites: Attendance, Retail, Reports, Admin) */}
      {rightBranches.map((branch, idx) => (
        <BranchNode3D
          key={branch.id}
          branch={branch}
          sideIndex={idx}
          isExpanded={!!expanded[branch.id]}
          isFocused={focusedId === branch.id}
          isDimmed={focusedId !== null && focusedId !== branch.id}
          onFocusBranch={onFocusBranch}
          onSelectLeaf={onNavigate}
        />
      ))}

      <CameraRig
        controlsRef={controlsRef}
        focusPos={cameraTarget?.pos}
        focusTarget={cameraTarget?.target}
        trigger={cameraTrigger}
      />

      {/* Smooth 3D Orbit Controls constrained to front hemisphere so labels never flip backwards */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        autoRotate={autoRotate}
        autoRotateSpeed={0.35}
        minDistance={8}
        maxDistance={36}
        minAzimuthAngle={-Math.PI / 2.6}
        maxAzimuthAngle={Math.PI / 2.6}
        minPolarAngle={Math.PI / 3.2}
        maxPolarAngle={Math.PI - Math.PI / 3.2}
      />
    </Canvas>
  );
}
