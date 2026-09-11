import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Text } from '@react-three/drei';
import ShockwaveRing from '../effects/ShockwaveRing';

interface StopBlockProps {
  position: [number, number, number];
  active: boolean;
}

export default function StopBlock({ position, active }: StopBlockProps) {
  const meshRef = useRef<Mesh<BufferGeometry, MeshStandardMaterial>>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.material.emissiveIntensity = active ? 0.7 + Math.sin(clock.getElapsedTime() * 5) * 0.3 : 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.4, 6]} />
        <meshStandardMaterial
          color={active ? '#ef4444' : '#475569'}
          emissive={active ? '#ef4444' : '#1e293b'}
          emissiveIntensity={active ? 0.7 : 0.15}
        />
      </mesh>
      <Text position={[0, 0, 0.25]} fontSize={0.32} color="#fef2f2" anchorX="center" fontWeight="bold">
        STOP
      </Text>
      {active && <ShockwaveRing position={[0, 0, 0]} color="#ef4444" />}
    </group>
  );
}
