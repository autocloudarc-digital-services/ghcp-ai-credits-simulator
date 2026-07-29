import { Text } from '@react-three/drei';

interface EnterpriseWallProps {
  position: [number, number, number];
}

export default function EnterpriseWall({ position }: EnterpriseWallProps) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[4.5, 2]} />
        <meshStandardMaterial color="#0b1220" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Glowing amber edge */}
      <mesh position={[0, 1, 0.01]}>
        <boxGeometry args={[4.5, 0.06, 0.02]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, -1, 0.01]}>
        <boxGeometry args={[4.5, 0.06, 0.02]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={1} />
      </mesh>
      <Text position={[0, 0, 0.05]} fontSize={0.28} color="#fbbf24" anchorX="center">
        Enterprise Spending Limit
      </Text>
    </group>
  );
}
