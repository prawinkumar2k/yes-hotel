import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function PanoramicRoom({ image }: { image: string }) {
  const texture = useTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <mesh ref={ref} scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Room3DViewer({ image = "/gallery/hotel-50.jpg" }: { image?: string }) {
  return (
    <div className="w-full h-[60vh] bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-700">
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur px-4 py-2 rounded-full text-xs font-mono font-bold text-white shadow-sm">
        INTERACTIVE 3D TOUR (DRAG TO PAN)
      </div>
      <Canvas camera={{ position: [0, 0, 0.1], fov: 60 }}>
        <color attach="background" args={['#0f172a']} />
        <Suspense fallback={null}>
          <PanoramicRoom image={image} />
        </Suspense>
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          rotateSpeed={-0.5}
        />
      </Canvas>
    </div>
  );
}
