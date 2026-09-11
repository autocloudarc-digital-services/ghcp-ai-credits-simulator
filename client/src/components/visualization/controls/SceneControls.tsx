import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

export default function SceneControls() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 29]} fov={45} />
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
