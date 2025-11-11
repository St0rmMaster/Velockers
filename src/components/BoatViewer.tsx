import { useEffect, useMemo, useRef, Suspense } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { WaveMode, GroupVisibilityMapping } from '../types';
import { applyDepthMasks } from '../three/applyDepthMasks';

// Import Water from three examples path compatible with Vite bundling
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Water } from 'three/examples/jsm/objects/Water.js';

export const DEFAULT_MODEL_IDS = ['2.9', '2.9E', '3.3', '3.3E'] as const;

/**
 * Get base model ID without E suffix
 * Used for sharing group visibility settings between electric and non-electric variants
 * @example getBaseModelId('2.9E') => '2.9'
 * @example getBaseModelId('3.3') => '3.3'
 */
export function getBaseModelId(modelId: string): string {
  return modelId.replace(/E$/, '');
}

export type EnvironmentSettings = {
  skyColor: string;
  dryDockColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: string;
  directionalIntensity: number;
  directionalColor: string;
  hemisphereSkyColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  waterColor: string;
  waterSunColor: string;
  waterSunDirection: [number, number, number];
  waterDistortion: number;
  waterAlpha: number;
  waterSize: number;
  waterSpeed: number;
  // Environment preset for metallic material reflections
  // Available presets: sunset, dawn, night, warehouse, forest, apartment, studio, city, park, lobby
  environmentPreset?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
};

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  skyColor: '#EAF8FF',
  dryDockColor: '#ffffff',
  fogColor: '#EAF8FF',
  fogNear: 6,
  fogFar: 35,
  ambientIntensity: 1.0, // Increased for better metallic material visibility
  ambientColor: '#FFFFFF',
  directionalIntensity: 2.0, // Increased for better metallic material visibility
  directionalColor: '#FFF5E1',
  hemisphereSkyColor: '#E4F6FF',
  hemisphereGroundColor: '#0a5f73',
  hemisphereIntensity: 1.0, // Increased for better metallic material visibility
  waterColor: '#0b4f65',
  waterSunColor: '#e9f7ff',
  waterSunDirection: [1, 1, 1],
  waterDistortion: 0.1,
  waterAlpha: 0.65,
  waterSize: 3.0,
  waterSpeed: 0.156,
  environmentPreset: 'sunset', // Default preset for metallic reflections
};

type VariantBase = {
  id: string;
  label: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
};

export type MaterialColorVariant = VariantBase & {
  mode: 'color';
  color: string;
};

export type MaterialTextureVariant = VariantBase & {
  mode: 'texture';
  textureUrl: string;
  repeatU?: number;
  repeatV?: number;
  offsetU?: number;
  offsetV?: number;
  rotation?: number;
  tint?: string;
};

export type MaterialVariant = MaterialColorVariant | MaterialTextureVariant;

export type MaterialVariantCollection = {
  id: string;
  name: string;
  materials: string[];
  variants: MaterialVariant[];
};

export type MaterialVariantSelection = Record<string, string>;

const COLOR_TARGETS_BY_MODEL: Record<string, readonly string[]> = {
  '2.9': ['hull_white', 'hull_grey'],
  '2.9E': ['hull_white', 'hull_grey'],
  '3.3': ['hull_white', 'hull_grey'],
  '3.3E': ['hull_white', 'hull_grey'],
};

const DEFAULT_COLOR_TARGETS: readonly string[] = ['hull_white', 'hull_grey'];

const DEFAULT_HEMISPHERE_INTENSITY = 0.5;

// Meshes that change color based on material type (Fiberglass vs Full Carbon)
const MATERIAL_MESHES_BY_MODEL: Record<string, readonly string[]> = {
  '2.9': ['mesh1700', 'mesh1677', 'mesh1676', 'mesh1675', 'mesh1674', 'mesh1701', 'mesh1673', 'mesh1672', 'mesh1702', 'mesh1671', 'mesh1670'],
  '2.9E': ['mesh1700', 'mesh1677', 'mesh1676', 'mesh1675', 'mesh1674', 'mesh1701', 'mesh1673', 'mesh1672', 'mesh1702', 'mesh1671', 'mesh1670'],
  '3.3': ['mesh98', 'mesh105', 'mesh1023', 'mesh134', 'mesh135', 'mesh32', 'mesh34', 'mesh35', 'mesh20', 'mesh36', 'mesh37'],
  '3.3E': ['mesh98', 'mesh105', 'mesh1023', 'mesh134', 'mesh135', 'mesh32', 'mesh34', 'mesh35', 'mesh20', 'mesh36', 'mesh37'],
};

// Explicit mesh lists for Soft Deck (non-slip) and Stripe meshes by model
const SOFT_DECK_MESHES_BY_MODEL: Record<string, readonly string[]> = {
  '2.9': [
    'mesh304','mesh305','mesh1712','mesh16','mesh293','mesh1709','mesh6','mesh5','mesh1710','mesh8','mesh7',
  ],
  '2.9E': [
    'mesh304','mesh305','mesh1712','mesh16','mesh293','mesh1709','mesh6','mesh5','mesh1710','mesh8','mesh7',
  ],
  '3.3': [
    'mesh983','mesh984','mesh1042','mesh1040','mesh1043','mesh1044','mesh1057','mesh1055','mesh1056','mesh1054','mesh1053',
  ],
  '3.3E': [
    'mesh983','mesh984','mesh1042','mesh1040','mesh1043','mesh1044','mesh1057','mesh1055','mesh1056','mesh1054','mesh1053',
  ],
};

const STRIP_MESHES_BY_MODEL: Record<string, readonly string[]> = {
  '2.9': [
    'mesh0','mesh1','mesh1711','mesh2','mesh3','mesh9','mesh14','mesh13','mesh1713','mesh12','mesh11',
  ],
  '2.9E': [
    'mesh0','mesh1','mesh1711','mesh2','mesh3','mesh9','mesh14','mesh13','mesh1713','mesh12','mesh11',
  ],
  '3.3': [
    'mesh1051','mesh1050','mesh1049','mesh1048','mesh1047','mesh1052','mesh1058','mesh1059','mesh1060','mesh1061','mesh1062',
  ],
  '3.3E': [
    'mesh1051','mesh1050','mesh1049','mesh1048','mesh1047','mesh1052','mesh1058','mesh1059','mesh1060','mesh1061','mesh1062',
  ],
};

export function resolveModelPath(modelId: string, basePath = import.meta.env.BASE_URL) {
  // 2.9/2.9E use 29.glb, 3.3/3.3E use 33.glb
  const fileName = modelId.startsWith('2.9') ? '29' : '33';
  return `${basePath}models/${fileName}.glb`;
}
function OrbitControlsWrapper({ isDryDock, targetCenterRef }: { isDryDock: boolean; targetCenterRef: MutableRefObject<{ x: number; z: number }> }) {
  const targetY = 0.3; // держим панорамирование в горизонтальной плоскости
  const controlsRef = useRef<any>(null);
  const { gl, camera } = useThree();
  const rmbActiveRef = useRef(false);
  const initialCameraYRef = useRef<number | null>(null);

  useEffect(() => {
    const el = gl?.domElement as HTMLElement | undefined;
    if (!el) return;

    const preventContext = (e: Event) => {
      e.preventDefault();
    };
    const onDown = (e: MouseEvent | PointerEvent) => {
      // Блокируем среднюю кнопку полностью
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        return false as unknown as void;
      }
      // При зажатом ПКМ — только панорамирование: отключаем rotate/zoom
      if (e.button === 2) {
        rmbActiveRef.current = true;
        const c = controlsRef.current;
        if (c) {
          c.enableRotate = false;
          c.enableZoom = false;
          c.enablePan = true;
        }
        if (initialCameraYRef.current == null) {
          initialCameraYRef.current = (camera as THREE.PerspectiveCamera).position.y;
        }
      }
    };
    const onUp = (e: MouseEvent | PointerEvent) => {
      if (e.button === 2) {
        rmbActiveRef.current = false;
        const c = controlsRef.current;
        if (c) {
          c.enableRotate = true;
          c.enableZoom = true;
        }
      }
    };

    el.addEventListener('contextmenu', preventContext as EventListener);
    el.addEventListener('mousedown', onDown as EventListener, { passive: false } as AddEventListenerOptions);
    el.addEventListener('pointerdown', onDown as EventListener, { passive: false } as AddEventListenerOptions);
    el.addEventListener('mouseup', onUp as EventListener);
    el.addEventListener('pointerup', onUp as EventListener);

    return () => {
      el.removeEventListener('contextmenu', preventContext as EventListener);
      el.removeEventListener('mousedown', onDown as EventListener);
      el.removeEventListener('pointerdown', onDown as EventListener);
      el.removeEventListener('mouseup', onUp as EventListener);
      el.removeEventListener('pointerup', onUp as EventListener);
    };
  }, [gl, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!controls.target) return;
    const tgt = controls.target as THREE.Vector3;
    // обновляем цель по XZ из центра модели, удерживая Y постоянным
    tgt.x = targetCenterRef.current.x || 0;
    tgt.z = targetCenterRef.current.z || 0;
    if (Math.abs(tgt.y - targetY) > 1e-6) tgt.y = targetY;

    // во время ПКМ фиксируем высоту камеры, чтобы панорамирование было только влево-вправо
    if (rmbActiveRef.current && initialCameraYRef.current != null) {
      const cam = camera as THREE.PerspectiveCamera;
      if (Math.abs(cam.position.y - initialCameraYRef.current) > 1e-6) {
        cam.position.y = initialCameraYRef.current;
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, targetY, 0]}
      screenSpacePanning={true}
      enablePan={true}
      enableZoom={true}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      }}
      minDistance={isDryDock ? 0.35 : 0.35}
      maxDistance={isDryDock ? 12 : 10}
      minPolarAngle={isDryDock ? 0.1 : Math.PI / 6}
      maxPolarAngle={isDryDock ? Math.PI - 0.1 : Math.PI / 2.2}
      enableDamping={true}
      dampingFactor={0.05}
    />
  );
}


interface BoatModelProps {
  modelPath: string;
  modelId: string;
  color: string;
  materialType: 'fiberglass' | 'fullCarbon';
  colorTargets: readonly string[];
  useCustomColor: boolean;
  hullColorMode: 'white' | 'grey';
  softDeckColor?: string;
  materialVariantCollections?: MaterialVariantCollection[];
  activeMaterialVariants?: MaterialVariantSelection;
  groupVisibilityMappings?: GroupVisibilityMapping[];
  selectedOptions?: string[];
  onCenterComputed?: (center: { x: number; z: number }) => void;
}

function BoatModel({
  modelPath,
  modelId,
  color,
  materialType,
  colorTargets,
  useCustomColor,
  hullColorMode,
  softDeckColor,
  materialVariantCollections,
  activeMaterialVariants,
  groupVisibilityMappings = [],
  selectedOptions = [],
  onCenterComputed,
}: BoatModelProps) {
  // Clone the scene to avoid using cached versions with modified colors
  // This ensures we always get original materials from the GLTF/GLB file
  const { scene: originalScene } = useGLTF(modelPath, true);
  const scene = useMemo(() => {
    return originalScene.clone(true); // Deep clone to preserve materials
  }, [originalScene, modelPath]);
  
  const modelRef = useRef<THREE.Group>(null);
  const textureCache = useRef(new Map<string, THREE.Texture>());
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  // Превращаем крышки из Blender в depth-маски
  useMemo(() => {
    applyDepthMasks(scene);
    
    // Shadows disabled - better performance and visual quality
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }, [scene]);

  // Automatic visibility control for electric motor and battery
  // These are managed automatically based on model type (E vs non-E)
  const isElectricModel = modelId.endsWith('E');

  // Store original colors
  const originalColors = useRef<{ 
    white?: THREE.Color; 
    grey?: THREE.Color;
  }>({});
  
  // Collect original hull colors once when scene loads
  useEffect(() => {
    if (!scene) return;
    
    // Reset colors when scene changes
    originalColors.current = {};
    
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        const matName = mat.name.toLowerCase();
        
        if (matName === 'hull_white' && !originalColors.current.white) {
          originalColors.current.white = mat.color.clone();
        } else if (matName === 'hull_grey' && !originalColors.current.grey) {
          originalColors.current.grey = mat.color.clone();
        }
      });
    });
  }, [scene]);
  
  // Apply colors and materials
  useEffect(() => {
    if (!scene) return;

    // Get material meshes for current model
    const materialMeshes = MATERIAL_MESHES_BY_MODEL[modelId] || [];

    // Second pass: apply colors and material properties
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      
      const meshName = child.name.toLowerCase();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      
      materials.forEach((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        
        const matName = mat.name.toLowerCase();
        
        // Apply hull colors
        if (matName === 'hull_white' || matName === 'hull_grey') {
          if (useCustomColor) {
            mat.color.set(color);
          } else {
            // Use original colors with fallbacks
            const whiteColor = originalColors.current.white || new THREE.Color('#ECECE8');
            const greyColor = originalColors.current.grey || new THREE.Color('#9EA0A1');
            
            // Apply the selected color mode to both hull materials
            if (hullColorMode === 'white') {
              mat.color.copy(whiteColor);
            } else {
              mat.color.copy(greyColor);
            }
          }
          mat.needsUpdate = true;
        }
      });
      
      // Resolve soft deck/strip mesh lists for current model
      const softDeckMeshes = (SOFT_DECK_MESHES_BY_MODEL[modelId] || []).map((n) => n.toLowerCase());
      const stripMeshes = (STRIP_MESHES_BY_MODEL[modelId] || []).map((n) => n.toLowerCase());

      // Apply material type color to specific meshes (skip soft deck and strips)
      if (materialMeshes.includes(meshName) && !softDeckMeshes.includes(meshName) && !stripMeshes.includes(meshName)) {
        materials.forEach((mat) => {
          if (!(mat instanceof THREE.MeshStandardMaterial)) return;
          
          // Set color based on material type
          if (materialType === 'fullCarbon') {
            mat.color.set('#0A0C10');
          } else {
            mat.color.set('#C7C7C7');
          }
          
          // Set material properties
          mat.metalness = 0.5;
          mat.roughness = 0.5;
          mat.opacity = 1.0;
          mat.transparent = false;
          mat.needsUpdate = true;
        });
      }

      // Apply soft deck and strip colors explicitly based on selection
        if (softDeckColor) {
          const sel = softDeckColor.toUpperCase();
          let softDeckHex = '#9D622B';
          let stripHex = '#FFFDFC';
          if (sel === '#9D622BFF') {
            softDeckHex = '#9D622B';
            stripHex = '#FFFDFC';
          } else if (sel === '#BCBCBCFF') {
            softDeckHex = '#939393';
            stripHex = '#FFFDFC';
          } else if (sel === '#95070BFF') {
            softDeckHex = '#939393';
            stripHex = '#95070B';
          }

        if (softDeckMeshes.includes(meshName)) {
          materials.forEach((mat) => {
            if (!(mat instanceof THREE.MeshStandardMaterial)) return;
            mat.color.set(softDeckHex);
            mat.metalness = 0;
            mat.roughness = 1;
            mat.opacity = 1.0;
            mat.transparent = false;
            mat.needsUpdate = true;
          });
        }

        if (stripMeshes.includes(meshName)) {
          materials.forEach((mat) => {
            if (!(mat instanceof THREE.MeshStandardMaterial)) return;
            mat.color.set(stripHex);
            mat.metalness = 0;
            mat.roughness = 1;
            mat.opacity = 1.0;
            mat.transparent = false;
            mat.needsUpdate = true;
          });
        }
      }
    });
  }, [scene, color, useCustomColor, hullColorMode, softDeckColor, materialType, modelId]);

  // Apply group visibility settings
  useEffect(() => {
    if (!scene) return;

    const setGroupVisibility = (object: THREE.Object3D, visible: boolean) => {
      object.visible = visible;
      
      // Recursively set visibility and shadows for all children
      object.traverse((child) => {
        child.visible = visible;
        
        // Disable shadows on hidden objects to prevent ghost shadows
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          const isDepthMask = 
            mesh.userData?.depthMask === 1 || 
            mesh.userData?.depthMask === true ||
            (typeof mesh.name === 'string' && mesh.name.toUpperCase().startsWith('WATER_OCCLUDER'));
          
          if (!isDepthMask) {
            mesh.castShadow = visible;
          }
        }
      });
    };

    scene.traverse((child) => {
      const childName = child.name;
      if (!childName) return; // Skip unnamed objects

      // Auto-hide electric motor group on non-E models
      if (childName === 'el_motor') {
        setGroupVisibility(child, isElectricModel);
        return;
      }

      // Auto-hide battery group on non-E models
      if (childName === 'battary_V_4_new') {
        setGroupVisibility(child, isElectricModel);
        return;
      }

      // Apply custom group visibility mappings
      // Use base model ID to share settings between E and non-E variants (e.g., 2.9 and 2.9E share settings)
      // This avoids conflicts between different models (2.9 vs 3.3) while allowing E variants to inherit settings
      const baseModel = getBaseModelId(modelId);
      const mapping = groupVisibilityMappings.find(
        m => m.groupName === childName && m.modelId === baseModel
      );
      if (mapping) {
        if (mapping.hiddenByDefault) {
          // If group is hidden by default and linked to an option
          if (mapping.linkedOptionId) {
            // Show only if the linked option is selected
            const isOptionSelected = selectedOptions.includes(mapping.linkedOptionId);
            setGroupVisibility(child, isOptionSelected);
          } else {
            // Hidden by default with no linked option - always hide
            setGroupVisibility(child, false);
          }
        } else {
          // Not hidden by default - always show
          setGroupVisibility(child, true);
        }
      }
    });
  }, [scene, isElectricModel, groupVisibilityMappings, selectedOptions]);

  const appliedVariants = useMemo(() => {
    const map = new Map<string, MaterialVariant>();
    (materialVariantCollections ?? []).forEach((collection) => {
      if (!collection.variants.length) return;
      const selectedId = activeMaterialVariants?.[collection.id] ?? collection.variants[0]?.id;
      const variant =
        collection.variants.find((candidate) => candidate.id === selectedId) ?? collection.variants[0];
      if (!variant) return;
      collection.materials.forEach((materialName) => {
        if (materialName) {
          map.set(materialName, variant);
        }
      });
    });
    return map;
  }, [materialVariantCollections, activeMaterialVariants]);

  // Ensure materials have proper envMapIntensity for reflections
  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((mat) => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return;
        
        // Set envMapIntensity for proper reflections on metallic materials
        // The Environment component will provide the actual envMap
        if (mat.envMapIntensity === undefined || mat.envMapIntensity === 0) {
          mat.envMapIntensity = 1.0;
        }
        mat.needsUpdate = true;
      });
    });
  }, [scene]);

  useEffect(() => {
    if (!scene) return;

    // Сообщаем центр модели по XZ, чтобы привязать орбиту
    try {
      const box = new THREE.Box3().setFromObject(scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      onCenterComputed?.({ x: center.x, z: center.z });
    } catch {/* noop */}
  }, [
    scene,
    onCenterComputed,
  ]);

  return <primitive ref={modelRef} object={scene} scale={0.8} />;
}

interface OceanWaterProps {
  size?: number;
  environment: EnvironmentSettings;
}

function OceanWater({ size = 100, environment }: OceanWaterProps) {
  const normals = useLoader(
    THREE.TextureLoader,
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg'
  );

  const sunDirection = useMemo(
    () =>
      new THREE.Vector3(
        environment.waterSunDirection[0],
        environment.waterSunDirection[1],
        environment.waterSunDirection[2]
      ).normalize(),
    [environment.waterSunDirection]
  );

  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const radius = size * 0.75; // увеличен радиус воды в 1.5 раза
    const geometry = new THREE.CircleGeometry(radius, 256);

    const w = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection,
      sunColor: new THREE.Color(environment.waterSunColor),
      waterColor: new THREE.Color(environment.waterColor),
      distortionScale: environment.waterDistortion,
      fog: false,
      alpha: environment.waterAlpha,
    });

    w.rotation.x = -Math.PI / 2;
    const material = (w as any).material as THREE.ShaderMaterial;

    if (material.uniforms?.distortionScale) {
      material.uniforms.distortionScale.value = environment.waterDistortion;
    }

    if (material.uniforms?.alpha) {
      material.uniforms.alpha.value = environment.waterAlpha;
    }

    if (material.uniforms?.size) {
      material.uniforms.size.value = environment.waterSize;
    }

    return w as THREE.Object3D;
  }, [environment.waterAlpha, environment.waterColor, environment.waterDistortion, environment.waterSize, environment.waterSunColor, normals, size, sunDirection]);

  useFrame((_, delta) => {
    const material = (water as any).material as THREE.ShaderMaterial;
    if (material?.uniforms?.time) {
      material.uniforms.time.value += delta * environment.waterSpeed;
    }
  });

  // Добавляем мягкую дымку вдоль горизонта поверх воды
  return <primitive object={water} position={[0, 0, 0]} renderOrder={100} />;
}

function BoatWithRocking({
  modelPath,
  modelId,
  color,
  materialType,
  waveMode,
  boatRef,
  colorTargets,
  useCustomColor,
  hullColorMode,
  softDeckColor,
  materialVariantCollections,
  activeMaterialVariants,
  groupVisibilityMappings,
  selectedOptions,
  onCenterComputed,
}: {
  modelPath: string;
  modelId: string;
  color: string;
  materialType: 'fiberglass' | 'fullCarbon';
  waveMode: WaveMode;
  boatRef: MutableRefObject<THREE.Group | null>;
  colorTargets: readonly string[];
  useCustomColor: boolean;
  hullColorMode: 'white' | 'grey';
  softDeckColor?: string;
  materialVariantCollections?: MaterialVariantCollection[];
  activeMaterialVariants?: MaterialVariantSelection;
  groupVisibilityMappings?: GroupVisibilityMapping[];
  selectedOptions?: string[];
  onCenterComputed?: (center: { x: number; z: number }) => void;
}) {
  const boatGroupRef = boatRef;
  const pitchGroupRef = useRef<THREE.Group>(null);
  const pitchOffset = useMemo(() => 0, []);

  useFrame((state) => {
    const boat = boatGroupRef.current;
    const pitchGroup = pitchGroupRef.current;
    if (!boat || !pitchGroup) return;

    boat.rotation.x = 0;
    boat.rotation.y = 0;
    pitchGroup.rotation.y = 0;
    pitchGroup.rotation.z = 0;

    const t = state.clock.getElapsedTime();

    if (waveMode === 'ocean') {
      boat.position.y = 0.32;
      pitchGroup.rotation.x = pitchOffset + Math.sin(t * 1.2) * 0.0075;
      boat.rotation.z = Math.cos(t * 1.1) * 0.00625;
    } else {
      boat.position.y = 0.34;
      pitchGroup.rotation.x = pitchOffset;
      boat.rotation.z = 0;
    }
  });

  return (
    <group ref={boatGroupRef}>
      <group ref={pitchGroupRef}>
        <group rotation={[0, -Math.PI / 4, 0]}>
          <BoatModel
            modelPath={modelPath}
            modelId={modelId}
            color={color}
            materialType={materialType}
            colorTargets={colorTargets}
            useCustomColor={useCustomColor}
            hullColorMode={hullColorMode}
            softDeckColor={softDeckColor}
            materialVariantCollections={materialVariantCollections}
            activeMaterialVariants={activeMaterialVariants}
            groupVisibilityMappings={groupVisibilityMappings}
            selectedOptions={selectedOptions}
            onCenterComputed={onCenterComputed}
          />
        </group>
      </group>
    </group>
  );
}

export interface BoatViewerProps {
  modelId: string;
  color: string;
  materialType: 'fiberglass' | 'fullCarbon';
  waveMode: WaveMode;
  useCustomColor: boolean;
  hullColorMode: 'white' | 'grey';
  softDeckColor?: string;
  environment?: Partial<EnvironmentSettings>;
  materialVariantCollections?: MaterialVariantCollection[];
  activeMaterialVariants?: MaterialVariantSelection;
  groupVisibilityMappings?: GroupVisibilityMapping[];
  selectedOptions?: string[];
}

export function BoatViewer({
  modelId,
  color,
  materialType,
  waveMode,
  useCustomColor,
  hullColorMode,
  softDeckColor,
  environment,
  materialVariantCollections,
  activeMaterialVariants,
  groupVisibilityMappings,
  selectedOptions,
}: BoatViewerProps) {
  const basePath = import.meta.env.BASE_URL;
  const modelPath = resolveModelPath(modelId, basePath);
  
  // Log model path for debugging mobile issues
  useEffect(() => {
    console.log('Loading model:', modelPath, 'for modelId:', modelId);
  }, [modelPath, modelId]);
  
  const colorTargets = COLOR_TARGETS_BY_MODEL[modelId] ?? DEFAULT_COLOR_TARGETS;
  const boatRef = useRef<THREE.Group>(null);
  const isDryDock = waveMode === 'dry-dock';
  const targetCenterRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  const environmentConfig = useMemo<EnvironmentSettings>(
    () => ({
      ...DEFAULT_ENVIRONMENT,
      ...environment,
      hemisphereIntensity:
        environment?.hemisphereIntensity ?? DEFAULT_ENVIRONMENT.hemisphereIntensity ?? DEFAULT_HEMISPHERE_INTENSITY,
    }),
    [environment]
  );

  return (
    <>
      <Canvas 
        shadows={false} 
        style={{ width: '100%', height: '100%' }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false
        }}
        onCreated={(state) => {
          const el = state.gl.domElement as HTMLElement;
          const blockMiddle = (e: any) => {
            if (e && typeof e.button === 'number' && e.button === 1) {
              e.preventDefault?.();
              e.stopPropagation?.();
            }
          };
          el.addEventListener('pointerdown', blockMiddle as EventListener, { passive: false } as AddEventListenerOptions);
          el.addEventListener('mousedown', blockMiddle as EventListener, { passive: false } as AddEventListenerOptions);
          el.addEventListener('auxclick', blockMiddle as EventListener, { passive: false } as AddEventListenerOptions);
          el.addEventListener('contextmenu', (e) => e.preventDefault());
        }}
      >
        {isDryDock ? (
          <color attach="background" args={[environmentConfig.dryDockColor]} />
        ) : (
          <>
            <color attach="background" args={[environmentConfig.skyColor]} />
            <fog attach="fog" args={[environmentConfig.fogColor, environmentConfig.fogNear, environmentConfig.fogFar]} />
          </>
        )}

        <PerspectiveCamera makeDefault position={[4, 2.5, 4]} fov={55} near={0.05} />

        <ambientLight
          intensity={environmentConfig.ambientIntensity}
          color={environmentConfig.ambientColor}
        />
        <directionalLight
          position={[10, 15, 5]}
          intensity={environmentConfig.directionalIntensity}
          castShadow={false}
          color={environmentConfig.directionalColor}
        />
        <hemisphereLight
          args={[
            environmentConfig.hemisphereSkyColor,
            environmentConfig.hemisphereGroundColor,
            environmentConfig.hemisphereIntensity || DEFAULT_HEMISPHERE_INTENSITY,
          ]}
        />

        {/* Environment map for metallic material reflections */}
        <Environment preset={environmentConfig.environmentPreset || 'sunset'} />

        <Suspense fallback={null}>
          <BoatWithRocking
            modelPath={modelPath}
            modelId={modelId}
            color={color}
            materialType={materialType}
            waveMode={waveMode}
            boatRef={boatRef}
            colorTargets={colorTargets}
            useCustomColor={useCustomColor}
            hullColorMode={hullColorMode}
            softDeckColor={softDeckColor}
            materialVariantCollections={materialVariantCollections}
            activeMaterialVariants={activeMaterialVariants}
            groupVisibilityMappings={groupVisibilityMappings}
            selectedOptions={selectedOptions}
            onCenterComputed={(c) => {
              targetCenterRef.current = c;
            }}
          />
        </Suspense>

        {/** Управление камерой: средняя кнопка — панорамирование по XZ, колесо — зум */}
        {/** Фиксируем высоту цели, чтобы панорамирование оставалось в горизонтальной плоскости */}
        <OrbitControlsWrapper isDryDock={isDryDock} targetCenterRef={targetCenterRef} />

        {waveMode === 'ocean' && <OceanWater environment={environmentConfig} />}

      </Canvas>
    </>
  );
}

// Preload models
const preloadBasePath = import.meta.env.BASE_URL;
useGLTF.preload(`${preloadBasePath}models/29.glb`);
useGLTF.preload(`${preloadBasePath}models/33.glb`);

