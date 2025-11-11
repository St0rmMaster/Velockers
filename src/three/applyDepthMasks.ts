import * as THREE from 'three';

export const MASK_RENDER_ORDER = 50; // маска рисуется до воды

export function applyDepthMasks(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const byUserData =
      mesh.userData?.depthMask === 1 || mesh.userData?.depthMask === true;
    const byName =
      typeof mesh.name === 'string' &&
      mesh.name.toUpperCase().startsWith('WATER_OCCLUDER');

    if (!byUserData && !byName) return;

    // Материал маски: не рисуем цвет, но пишем глубину.
    mesh.material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,      // чтобы тонкая крышка работала с обеих сторон
      polygonOffset: true,         // меньше z-мигания по кромке
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    mesh.renderOrder = MASK_RENDER_ORDER;
    mesh.frustumCulled = false;     // тонкую маску нельзя выкидывать из кадра
    // mesh.visible = true — цвет не рисуем, так что объект и так «невидим».
  });
}

