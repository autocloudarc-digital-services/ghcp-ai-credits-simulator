import { Text } from '@react-three/drei';

interface UlbTierBarsProps {
  position: [number, number, number];
  tiers: { label: string; value: number; max: number; color: string }[];
}

export default function UlbTierBars({ position, tiers }: UlbTierBarsProps) {
  const spacing = 1.1;
  const startX = -((tiers.length - 1) * spacing) / 2;

  return (
    <group position={position}>
      {tiers.map((tier, idx) => {
        const ratio = tier.max > 0 ? Math.max(0.02, Math.min(1, tier.value / tier.max)) : 0.02;
        const height = 2.4 * ratio;
        return (
          <group key={tier.label} position={[startX + idx * spacing, 0, 0]}>
            <mesh position={[0, height / 2 - 1.2, 0]}>
              <boxGeometry args={[0.6, height, 0.6]} />
              <meshStandardMaterial color={tier.color} emissive={tier.color} emissiveIntensity={0.4} />
            </mesh>
            <Text position={[0, -1.5, 0]} fontSize={0.18} color="#cbd5e1" anchorX="center">
              {tier.label}
            </Text>
          </group>
        );
      })}
      <Text position={[0, 1.6, 0]} fontSize={0.26} color="#e2e8f0" anchorX="center">
        Usage Cohorts
      </Text>
    </group>
  );
}
