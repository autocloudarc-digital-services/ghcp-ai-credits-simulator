import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface OverageTickerProps {
  position: [number, number, number];
  overageCredits: number;
  active: boolean;
}

export default function OverageTicker({ position, overageCredits, active }: OverageTickerProps) {
  const meshRef = useRef<Mesh>(null);
  const [displayValue, setDisplayValue] = useState(0);

  useFrame((_, delta) => {
    if (meshRef.current && active) {
      meshRef.current.rotation.z += delta * 2;
    }
    setDisplayValue((prev) => {
      const diff = overageCredits - prev;
      if (Math.abs(diff) < 1) return overageCredits;
      return prev + diff * Math.min(1, delta * 3);
    });
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <torusKnotGeometry args={[0.55, 0.16, 64, 12]} />
        <meshStandardMaterial
          color={active ? '#f97316' : '#334155'}
          emissive={active ? '#ef4444' : '#0f172a'}
          emissiveIntensity={active ? 0.8 : 0.1}
        />
      </mesh>
      <Text position={[0, 1.1, 0]} fontSize={0.24} color={active ? '#f97316' : '#64748b'} anchorX="center">
        Overage: {Math.round(displayValue).toLocaleString()} credits
      </Text>
    </group>
  );
}
