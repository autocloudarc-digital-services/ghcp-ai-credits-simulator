import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { Text } from '@react-three/drei';

interface GovernanceShieldProps {
  position: [number, number, number];
}

export default function GovernanceShield({ position }: GovernanceShieldProps) {
  const shieldRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (shieldRef.current) {
      shieldRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group position={position}>
      <mesh ref={shieldRef}>
        <torusGeometry args={[2.2, 0.06, 16, 48]} />
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#8b5cf6"
          emissiveIntensity={0.5}
          transparent
          opacity={0.55}
        />
      </mesh>
      <Text position={[0, 2.7, 0]} fontSize={0.26} color="#a5b4fc" anchorX="center">
        Governance Shield
      </Text>
    </group>
  );
}
