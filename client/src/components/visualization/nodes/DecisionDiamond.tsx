import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface DecisionDiamondProps {
  position: [number, number, number];
  utilization: number; // 0-1
}

export default function DecisionDiamond({ position, utilization }: DecisionDiamondProps) {
  const meshRef = useRef<Mesh>(null);
  const flashing = utilization > 0.8;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.4;
      if (flashing) {
        const material = meshRef.current.material as any;
        material.emissiveIntensity = 0.6 + Math.sin(clock.getElapsedTime() * 6) * 0.4;
      }
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial
          color={flashing ? '#fbbf24' : '#64748b'}
          emissive={flashing ? '#fbbf24' : '#1e293b'}
          emissiveIntensity={flashing ? 0.8 : 0.2}
        />
      </mesh>
      <Text position={[-1.6, 0, 0]} fontSize={0.24} color="#4ade80" anchorX="center">
        No (Continue)
      </Text>
      <Text position={[1.6, 0, 0]} fontSize={0.24} color="#ef4444" anchorX="center">
        Yes (Stop)
      </Text>
      <Text position={[0, 1.4, 0]} fontSize={0.26} color="#e2e8f0" anchorX="center">
        Budget Exceeded?
      </Text>
    </group>
  );
}
