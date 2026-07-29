import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface PoolCylinderProps {
  position: [number, number, number];
  fillLevel: number; // 0-1
  label?: string;
}

export default function PoolCylinder({ position, fillLevel, label = 'Included Pool' }: PoolCylinderProps) {
  const fillRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const clamped = Math.max(0, Math.min(1, fillLevel));

  const color = clamped > 0.75 ? '#2dd4bf' : clamped > 0.25 ? '#fbbf24' : '#ef4444';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      const pulse = clamped <= 0.75 ? 1 + Math.sin(t * (clamped <= 0.25 ? 4 : 2)) * 0.08 : 1;
      glowRef.current.scale.set(pulse, 1, pulse);
    }
    if (fillRef.current) {
      fillRef.current.position.y = -1.5 + clamped * 1.5;
    }
  });

  return (
    <group position={position}>
      {/* Outer shell */}
      <mesh>
        <cylinderGeometry args={[1, 1, 3, 32, 1, true]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.35} side={2} />
      </mesh>
      {/* Fill level */}
      <mesh ref={fillRef} position={[0, -1.5 + clamped * 1.5, 0]}>
        <cylinderGeometry args={[0.95, 0.95, Math.max(0.01, 3 * clamped), 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      {/* Glow ring */}
      <mesh ref={glowRef} position={[0, 1.5, 0]}>
        <torusGeometry args={[1.05, 0.05, 16, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <Text position={[0, 2.1, 0]} fontSize={0.28} color="#e2e8f0" anchorX="center">
        {label}
      </Text>
      <Text position={[0, -2.1, 0]} fontSize={0.24} color={color} anchorX="center">
        {Math.round(clamped * 100)}% full
      </Text>
    </group>
  );
}
