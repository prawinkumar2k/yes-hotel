import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Float } from "@react-three/drei";
import type { Mesh } from "three";

/**
 * An interactive 3D showcase — deliberately NOT a literal render of any
 * specific room (no real 3D room models exist for this project). An
 * abstract, brand-colored architectural composition (a floor plane, a bed
 * platform, a floating gold ring) that's honestly interactive — drag to
 * rotate, auto-rotates when idle — rather than a static image pretending to
 * be more than it is. Labeled as a "3D Preview" in the parent, not "Photo".
 */
function GoldRing() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.15;
  });
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.6}>
      <mesh ref={ref} position={[0, 1.4, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.1, 0.05, 24, 100]} />
        <meshStandardMaterial color="#C9A227" metalness={0.9} roughness={0.25} />
      </mesh>
    </Float>
  );
}

function BedPlatform() {
  return (
    <group position={[0, -0.4, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.3, 1.6]} />
        <meshStandardMaterial color="#F8F6F0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.42, -0.55]} castShadow>
        <boxGeometry args={[2.4, 0.5, 0.15]} />
        <meshStandardMaterial color="#151515" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      {/* Deliberately no <Environment> HDRI here — it requires fetching a
          map from a third-party CDN at runtime, which resolved to two
          different hostnames (raw.githack.com and raw.githubusercontent.com)
          across a couple of real requests during testing: real fragility
          for a polish feature, plus an external CSP surface for no
          essential gain. Standard lights only, self-contained. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 3]} intensity={1.2} castShadow />
      <pointLight position={[-3, 2, -2]} intensity={0.4} color="#C9A227" />
      <BedPlatform />
      <GoldRing />
      <ContactShadows position={[0, -0.85, 0]} opacity={0.5} scale={6} blur={2.4} far={2} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </>
  );
}

export default function RoomShowcase3D() {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border border-hotel-black/10 bg-hotel-ivory">
      <Canvas shadows camera={{ position: [3, 1.6, 3.2], fov: 42 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-black/50">
        Interactive 3D Preview
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-[10px] uppercase tracking-widest text-hotel-black/40">
        Drag to rotate
      </div>
    </div>
  );
}
