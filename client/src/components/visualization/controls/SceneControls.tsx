import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

export default function SceneControls() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 6, 16]} fov={45} rotation={[-Math.PI / 9, 0, 0]} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 0]}
      />
    </>
  );
}
