import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';

interface ShockwaveRingProps {
  position: [number, number, number];
  color?: string;
}

export default function ShockwaveRing({ position, color = '#ef4444' }: ShockwaveRingProps) {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = (clock.getElapsedTime() % 1.5) / 1.5;
      const scale = 0.5 + t * 2.5;
      ringRef.current.scale.set(scale, scale, scale);
      const material = ringRef.current.material as any;
      material.opacity = 1 - t;
    }
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}
