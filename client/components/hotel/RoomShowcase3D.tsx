import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

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

export default function RoomShowcase3D({ image = "/gallery/hotel-50.jpg" }: { image?: string }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border border-hotel-black/10 bg-hotel-ivory">
      <Canvas camera={{ position: [0, 0, 0.1], fov: 60 }}>
        <Suspense fallback={null}>
          <PanoramicRoom image={image} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          rotateSpeed={-0.5}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-black/50">
        Immersive View
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-[10px] uppercase tracking-widest text-hotel-black/40">
        Drag to pan
      </div>
    </div>
  );
}
