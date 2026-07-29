import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface CostCenterRingProps {
  position: [number, number, number];
  utilization: number; // 0-1
}

export default function CostCenterRing({ position, utilization }: CostCenterRingProps) {
  const ringRef = useRef<Mesh>(null);
  const innerRadius = 0.4 + Math.max(0, Math.min(1, utilization)) * 0.6;

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.6;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef}>
        <torusGeometry args={[innerRadius, 0.18, 16, 40]} />
        <meshStandardMaterial color="#2dd4bf" emissive="#2dd4bf" emissiveIntensity={0.5} />
      </mesh>
      <Text position={[0, -1.3, 0]} fontSize={0.24} color="#2dd4bf" anchorX="center">
        Cost Center Ring
      </Text>
    </group>
  );
}
