import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface ContinueArrowProps {
  position: [number, number, number];
  active: boolean;
}

export default function ContinueArrow({ position, active }: ContinueArrowProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 2) * 0.08;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.4, 1, 3]} />
        <meshStandardMaterial
          color={active ? '#4ade80' : '#475569'}
          emissive={active ? '#4ade80' : '#1e293b'}
          emissiveIntensity={active ? 0.6 : 0.15}
        />
      </mesh>
      <Text position={[0, -0.9, 0]} fontSize={0.24} color={active ? '#4ade80' : '#64748b'} anchorX="center">
        Continue
      </Text>
    </group>
  );
}
