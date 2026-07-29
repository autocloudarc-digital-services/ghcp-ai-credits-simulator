import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Points, Vector3 } from 'three';

interface FlowParticlesProps {
  path: [number, number, number][];
  count?: number;
  color?: string;
  speed?: number;
}

export default function FlowParticles({
  path,
  count = 40,
  color = '#2dd4bf',
  speed = 0.15,
}: FlowParticlesProps) {
  const pointsRef = useRef<Points>(null);
  const offsets = useRef<Float32Array>(new Float32Array(count).map((_, i) => i / count));

  const curve = useMemo(
    () => new CatmullRomCurve3(path.map((p) => new Vector3(...p))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(path)]
  );

  const positions = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position');
    for (let i = 0; i < count; i++) {
      offsets.current[i] = (offsets.current[i] + delta * speed) % 1;
      const point = curve.getPointAt(offsets.current[i]);
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.12} sizeAttenuation transparent opacity={0.9} />
    </points>
  );
}
