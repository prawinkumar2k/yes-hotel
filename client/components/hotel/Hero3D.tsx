import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import { PCFShadowMap } from "three";
import type { Mesh, Group } from "three";

interface Hero3DProps {
  pointer: { x: number; y: number };
}

function FloatingGoldSculpture({ pointer }: { pointer: { x: number; y: number } }) {
  const ringRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.2;
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
    if (coreRef.current) {
      coreRef.current.rotation.y -= delta * 0.15;
    }
    if (groupRef.current) {
      // Mouse pointer parallax response
      groupRef.current.rotation.y = (pointer.x * Math.PI) / 12;
      groupRef.current.rotation.x = (-pointer.y * Math.PI) / 16;
    }
  });

  return (
    <group ref={groupRef} position={[1.2, 0.2, 0]}>
      {/* Outer Champagne Gold Torus Ring */}
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.8}>
        <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[1.6, 0.04, 32, 100]} />
          <meshStandardMaterial color="#C9A227" metalness={0.95} roughness={0.15} />
        </mesh>
      </Float>

      {/* Inner Floating Octahedron Core */}
      <Float speed={1.5} rotationIntensity={0.6} floatIntensity={1}>
        <mesh ref={coreRef} position={[0, 0, 0]}>
          <octahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#E5C76B" metalness={0.85} roughness={0.2} wireframe={false} />
        </mesh>
      </Float>

      {/* Glass Panel Accents */}
      <mesh position={[-0.8, -0.6, 0.4]} rotation={[0, 0.4, 0.2]}>
        <boxGeometry args={[1.2, 0.8, 0.02]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          opacity={0.6}
          transparent
          roughness={0.1}
          ior={1.5}
        />
      </mesh>
    </group>
  );
}

function Scene({ pointer }: { pointer: { x: number; y: number } }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 4]} intensity={1.5} color="#ffffff" castShadow />
      <pointLight position={[-4, 2, -2]} intensity={0.8} color="#C9A227" />
      <pointLight position={[3, -2, 2]} intensity={0.5} color="#E5C76B" />

      <FloatingGoldSculpture pointer={pointer} />

      <ContactShadows position={[1.2, -1.5, 0]} opacity={0.4} scale={7} blur={2.5} far={3} frames={1} />
    </>
  );
}

export default function Hero3D({ pointer }: Hero3DProps) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      <Canvas
        shadows={{ type: PCFShadowMap }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <Scene pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}
