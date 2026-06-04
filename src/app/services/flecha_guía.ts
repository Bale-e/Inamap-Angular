import * as BABYLON from 'babylonjs';

export function dibujarFlechaGuia(
  scene: BABYLON.Scene,
  origen: BABYLON.Vector3,
  destino: BABYLON.Vector3,
  color = new BABYLON.Color3(0.05, 0.7, 0.15)
): BABYLON.AbstractMesh[] {
  const meshes: BABYLON.AbstractMesh[] = [];

  const points = [origen, destino];
  const lines = BABYLON.MeshBuilder.CreateLines('guideLines', { points }, scene);
  (lines as any).color = color;
  meshes.push(lines);

  const arrowMat = new BABYLON.StandardMaterial('guideArrowMat', scene);
  arrowMat.diffuseColor = color;
  arrowMat.emissiveColor = color;

  const dir = destino.subtract(origen);
  const length = dir.length();
  if (length > 0) {
    const mid = origen.add(dir.scale(0.5));
    const head = BABYLON.MeshBuilder.CreateCylinder('guideArrowHead', {
      height: Math.min(1.2, Math.max(0.4, length * 0.25)),
      diameterTop: 0,
      diameterBottom: Math.min(0.6, Math.max(0.15, length * 0.08))
    }, scene);
    head.material = arrowMat;
    head.position = mid;
    head.lookAt(destino);
    head.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2, BABYLON.Space.LOCAL);
    head.isPickable = false;
    head.checkCollisions = false;
    meshes.push(head);
  }

  return meshes;
}
