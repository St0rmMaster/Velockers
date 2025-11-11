import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  BoatViewer,
  DEFAULT_ENVIRONMENT,
  DEFAULT_MODEL_IDS,
  resolveModelPath,
  getBaseModelId,
} from '../components/BoatViewer';
import type {
  EnvironmentSettings,
  MaterialTextureVariant,
  MaterialVariant,
  MaterialVariantCollection,
  MaterialVariantSelection,
} from '../components/BoatViewer';
import type { WaveMode, GroupVisibilityMapping } from '../types';
import './DevSettingsPage.css';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as THREE from 'three';
import {
  ACTIVE_BOAT_PRESET_KEY,
  ACTIVE_ENV_PRESET_KEY,
  BOAT_PRESETS_KEY,
  ENV_PRESETS_KEY,
  deepClone,
} from '../utils/presets';
import {
  loadGroupVisibilitySettings,
  saveGroupVisibilitySettings,
  saveDefaultEnvironment,
  loadDefaultEnvironment,
  saveMaterialColorSettings,
  loadMaterialColorSettings,
} from '../services/visualizationService';
import { supabase } from '../lib/supabaseClient';

type EnvironmentPreset = {
  id: string;
  name: string;
  settings: EnvironmentSettings;
};

type BoatPreset = {
  id: string;
  name: string;
  modelId: string;
  hullColor: string;
  materialType: 'fiberglass' | 'fullCarbon';
  waveMode: WaveMode;
  environment: EnvironmentSettings;
  materialVariantCollections: MaterialVariantCollection[];
  activeVariants: MaterialVariantSelection;
};

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const loadEnvironmentPresets = (): EnvironmentPreset[] => {
  try {
    const raw = localStorage.getItem(ENV_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as EnvironmentPreset[];
    }
  } catch (error) {
    console.warn('Failed to load environment presets', error);
  }
  return [];
};

const loadBoatPresets = (): BoatPreset[] => {
  try {
    const raw = localStorage.getItem(BOAT_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as BoatPreset[];
    }
  } catch (error) {
    console.warn('Failed to load boat presets', error);
  }
  return [];
};

const saveEnvironmentPresets = (presets: EnvironmentPreset[]) => {
  localStorage.setItem(ENV_PRESETS_KEY, JSON.stringify(presets));
};

const saveBoatPresets = (presets: BoatPreset[]) => {
  localStorage.setItem(BOAT_PRESETS_KEY, JSON.stringify(presets));
};

const materialVariantDefault = (label: string, color = '#ffffff'): MaterialVariant => ({
  id: createId(),
  label,
  mode: 'color',
  color,
});

// Tree node component for hierarchical object display
function ObjectTreeNode({
  node,
  depth = 0,
  expandedSet,
  selectedNode,
  onToggle,
  onSelect,
}: {
  node: any;
  depth?: number;
  expandedSet: Set<string>;
  selectedNode: any | null;
  onToggle: (path: string) => void;
  onSelect: (node: any) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedSet.has(node.path);
  const isMesh = node.type === 'Mesh';
  const isSelected = selectedNode?.path === node.path;
  const isAutoManaged = node.name === 'el_motor' || node.name === 'battary_V_4_new';
  
  return (
    <div>
      <div 
        onClick={() => onSelect(node)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '6px 8px', 
          paddingLeft: `${8 + depth * 20}px`,
          borderBottom: '1px solid #f0f0f0',
          background: isSelected ? '#dbeafe' : isAutoManaged ? '#f0fdf4' : 'transparent',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = isAutoManaged ? '#ecfdf5' : '#f9fafb';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = isAutoManaged ? '#f0fdf4' : 'transparent';
          }
        }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.path);
          }}
          style={{
            width: '20px',
            height: '20px',
            border: 'none',
            background: 'transparent',
            cursor: hasChildren ? 'pointer' : 'default',
            visibility: hasChildren ? 'visible' : 'hidden',
            fontSize: '12px',
          }}
        >
          {hasChildren && (isExpanded ? '▼' : '▶')}
        </button>
        
        {/* Node name and type */}
        <span style={{ 
          fontFamily: 'monospace', 
          fontSize: '13px',
          flex: 1,
          color: isMesh ? '#666' : '#000',
          fontWeight: isMesh ? 'normal' : '500'
        }}>
          <span style={{ marginRight: '6px' }}>
            {isMesh ? '🔷' : '📁'}
          </span>
          {node.name}
          {isAutoManaged && (
            <span style={{ marginLeft: '8px', color: '#10b981', fontSize: '11px' }}>
              (auto)
            </span>
          )}
        </span>
        
        {/* Material info for meshes */}
        {isMesh && node.materials && node.materials.length > 0 && (
          <span style={{ fontSize: '11px', color: '#999', marginRight: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.materials[0]}
          </span>
        )}
      </div>
      
      {/* Recursively render children if expanded */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child: any, idx: number) => (
            <ObjectTreeNode
              key={`${child.path}-${idx}`}
              node={child}
              depth={depth + 1}
              expandedSet={expandedSet}
              selectedNode={selectedNode}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DevSettingsPage() {
  const [modelId, setModelId] = useState<typeof DEFAULT_MODEL_IDS[number]>(DEFAULT_MODEL_IDS[0]);
  const [environment, setEnvironment] = useState<EnvironmentSettings>(deepClone(DEFAULT_ENVIRONMENT));
  const [hullColor, setHullColor] = useState('#4d4d50');
  const [materialType, setMaterialType] = useState<'fiberglass' | 'fullCarbon'>('fiberglass');
  const [waveMode, setWaveMode] = useState<WaveMode>('ocean');
  const [materialNames, setMaterialNames] = useState<string[]>([]);
  const [objectNames, setObjectNames] = useState<string[]>([]);
  const [sceneHierarchy, setSceneHierarchy] = useState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [groupVisibilityMappings, setGroupVisibilityMappings] = useState<GroupVisibilityMapping[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [groupSearchFilter, setGroupSearchFilter] = useState('');
  const [environmentPresets, setEnvironmentPresets] = useState<EnvironmentPreset[]>(() => loadEnvironmentPresets());
  const [boatPresets, setBoatPresets] = useState<BoatPreset[]>(() => loadBoatPresets());
  const [materialCollectionsByModel, setMaterialCollectionsByModel] = useState<
    Record<string, MaterialVariantCollection[]>
  >({});
  const [activeVariantsByModel, setActiveVariantsByModel] = useState<Record<string, MaterialVariantSelection>>({});

  const currentCollections = materialCollectionsByModel[modelId] ?? [];
  const currentActiveVariants = activeVariantsByModel[modelId] ?? {};

  const updateCollections = useCallback(
    (updater: (collections: MaterialVariantCollection[]) => MaterialVariantCollection[]) => {
      setMaterialCollectionsByModel((prev) => {
        const next = { ...prev };
        next[modelId] = updater(prev[modelId] ?? []);
        return next;
      });
    },
    [modelId]
  );
  
  const updateCollection = useCallback(
    (collectionId: string, updater: (collection: MaterialVariantCollection) => MaterialVariantCollection) => {
      updateCollections((prev) =>
        prev.map((collection) =>
          collection.id === collectionId ? updater(collection) : collection
        )
      );
    },
    [updateCollections]
  );

  const updateActiveVariants = useCallback(
    (updater: (selection: MaterialVariantSelection) => MaterialVariantSelection) => {
      setActiveVariantsByModel((prev) => {
        const next = { ...prev };
        next[modelId] = updater(prev[modelId] ?? {});
        return next;
      });
    },
    [modelId]
  );

  useEffect(() => {
    const extension = MODEL_FILE_EXTENSIONS[modelId] ?? 'gltf';
    const loader = new GLTFLoader();
    const controller = new AbortController();

    // Setup DRACO loader for compressed GLB models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);

    const modelPath = resolveModelPath(modelId);

    loader.load(
      modelPath,
      (gltf) => {
        if (controller.signal.aborted) return;
        
        // Extract material names
        const materialNamesSet = new Set<string>();
        // Extract object/group names
        const objectNamesSet = new Set<string>();
        
        // Store original material properties
        const originalMaterialProps = new Map<string, { color: string; metalness: number; roughness: number }>();
        
        // Build hierarchical tree structure
        const buildNodeTree = (obj: THREE.Object3D, path: string = ''): any => {
          const isMesh = obj instanceof THREE.Mesh;
          const isDepthMask = isMesh && (
            obj.userData?.depthMask === 1 || 
            obj.userData?.depthMask === true ||
            (typeof obj.name === 'string' && obj.name.toUpperCase().startsWith('WATER_OCCLUDER'))
          );
          
          if (isDepthMask) return null;
          
          const nodePath = path ? `${path}/${obj.name || 'unnamed'}` : obj.name || 'root';
          const node: any = {
            name: obj.name || '(unnamed)',
            type: isMesh ? 'Mesh' : obj.children.length > 0 ? 'Group' : 'Empty',
            path: nodePath,
            children: [],
          };
          
          // If mesh, store material info
          if (isMesh) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            node.materials = materials.map((mat: any) => mat?.name || '(no material)');
            
            // Save material properties
            materials.forEach((mat: any) => {
              if (mat?.name && mat instanceof THREE.MeshStandardMaterial) {
                materialNamesSet.add(mat.name);
                if (!originalMaterialProps.has(mat.name)) {
                  originalMaterialProps.set(mat.name, {
                    color: '#' + mat.color.getHexString(),
                    metalness: mat.metalness ?? 0.0,
                    roughness: mat.roughness ?? 0.5,
                  });
                }
              }
            });
          }
          
          // Recursively build children
          for (const child of obj.children) {
            const childNode = buildNodeTree(child, nodePath);
            if (childNode) {
              node.children.push(childNode);
            }
          }
          
          return node;
        };
        
        const hierarchy = buildNodeTree(gltf.scene)?.children || [];
        setSceneHierarchy(hierarchy);
        
        setMaterialNames(Array.from(materialNamesSet).sort());
        setObjectNames(Array.from(objectNamesSet).sort());
        
        // Initialize material collections with original colors from the model
        // Only add new materials, preserve existing saved configurations
        setMaterialCollectionsByModel((prevByModel) => {
          const prevForModel = prevByModel[modelId] || [];
          
          // Create a map of existing collections by material name for faster lookup
          const existingByName = new Map<string, MaterialVariantCollection>();
          prevForModel.forEach(collection => {
            collection.materials.forEach(matName => {
              existingByName.set(matName, collection);
            });
          });
          
          // Only add materials that don't exist yet
          const additions = Array.from(materialNamesSet)
            .filter((name) => !existingByName.has(name))
            .map<MaterialVariantCollection>((name) => {
              const props = originalMaterialProps.get(name);
              return {
                id: createId(),
                name,
                materials: [name],
                variants: [
                  {
                    id: createId(),
                    label: 'Original',
                    mode: 'color',
                    color: props?.color || '#ffffff',
                    metalness: props?.metalness,
                    roughness: props?.roughness,
                  },
                ],
              };
            });
          
          if (!additions.length) return prevByModel;
          
          return {
            ...prevByModel,
            [modelId]: [...prevForModel, ...additions],
          };
        });
      },
      undefined,
      (error) => {
        console.error(`[DevSettings] Failed to load model ${modelId}:`, error);
        setMaterialNames([]);
        setObjectNames([]);
      }
    );

    return () => {
      controller.abort();
      dracoLoader.dispose();
    };
  }, [modelId]);

  // Material collections are now initialized directly in the loader
  // with original colors from the model

  // Load catalog options for group mapping
  useEffect(() => {
    const loadOptions = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, metadata')
        .eq('type', 'option')
        .eq('is_active', true);
      
      if (!error && data) {
        setCatalogOptions(
          data.map((row: any) => ({
            id: row.metadata?.code || row.id,
            name: row.name,
          }))
        );
      }
    };
    loadOptions();
  }, []);

  // Load existing visualization settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load group visibility
      const groupSettings = await loadGroupVisibilitySettings();
      if (groupSettings?.mappings) {
        setGroupVisibilityMappings(groupSettings.mappings);
      }
      
      // Load default environment
      const defaultEnv = await loadDefaultEnvironment();
      if (defaultEnv) {
        setEnvironment(defaultEnv);
      }

      // Load saved material color settings
      const materialSettings = await loadMaterialColorSettings();
      if (materialSettings?.mappings) {
        // Convert to MaterialVariantCollection format for all models
        const savedCollections: MaterialVariantCollection[] = materialSettings.mappings.map(mapping => ({
          id: mapping.materialName,
          name: mapping.materialName,
          materials: [mapping.materialName],
          variants: mapping.variants.map((v, idx) => ({
            id: `${mapping.materialName}-${idx}`,
            label: v.name,
            mode: 'color' as const,
            color: v.hex,
          })),
        }));

        // Apply saved collections to all models
        const collectionsForAllModels: Record<string, MaterialVariantCollection[]> = {};
        DEFAULT_MODEL_IDS.forEach(id => {
          collectionsForAllModels[id] = savedCollections;
        });
        setMaterialCollectionsByModel(collectionsForAllModels);
      }
    };
    loadSettings();
  }, []);

  // Initialize group mappings from scene hierarchy
  useEffect(() => {
    if (!sceneHierarchy.length) return;
    
    // Collect all node names from the hierarchy recursively
    const allNodeNames = new Set<string>();
    const collectNames = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node.name) allNodeNames.add(node.name);
        if (node.children) collectNames(node.children);
      });
    };
    collectNames(sceneHierarchy);
    
    setGroupVisibilityMappings((prev) => {
      const existingNames = new Set(prev.map((m) => m.groupName));
      const newMappings = Array.from(allNodeNames)
        .filter((name) => !existingNames.has(name))
        .map((name) => ({
          groupName: name,
          hiddenByDefault: false,
          linkedOptionId: undefined,
        }));
      
      return [...prev, ...newMappings];
    });
  }, [sceneHierarchy]);

  useEffect(() => {
    saveEnvironmentPresets(environmentPresets);
  }, [environmentPresets]);

  useEffect(() => {
    saveBoatPresets(boatPresets);
  }, [boatPresets]);

  const handleEnvironmentColorChange = (key: keyof EnvironmentSettings) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEnvironment((prev) => ({ ...prev, [key]: value }));
  };

  const handleEnvironmentNumberChange =
    (key: keyof EnvironmentSettings, transform: (value: number) => number = (value) => value) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = transform(Number(event.target.value));
      setEnvironment((prev) => ({ ...prev, [key]: nextValue }));
    };

  const handleMaterialsInputChange = (collectionId: string, rawValue: string) => {
    const materialList = rawValue
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    updateCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              materials: materialList,
            }
          : collection
      )
    );
  };

  const handleCollectionNameChange = (collectionId: string, value: string) => {
    updateCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              name: value,
            }
          : collection
      )
    );
  };

  const handleVariantFieldChange = (
    collectionId: string,
    variantId: string,
    updater: (variant: MaterialVariant) => MaterialVariant
  ) => {
    updateCollections((prev) =>
      prev.map((collection) => {
        if (collection.id !== collectionId) return collection;
        return {
          ...collection,
          variants: collection.variants.map((variant) =>
            variant.id === variantId ? updater(variant) : variant
          ),
        };
      })
    );
  };

  const handleAddColorVariant = (collectionId: string) => {
    updateCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              variants: [
                ...collection.variants,
                materialVariantDefault(`Variant ${collection.variants.length + 1}`, '#ffffff'),
              ],
            }
          : collection
      )
    );
  };

  const handleAddTextureVariant = (collectionId: string) => {
    const newVariant: MaterialTextureVariant = {
      id: createId(),
      label: `Texture ${Date.now()}`,
      mode: 'texture',
      textureUrl: '',
      repeatU: 1,
      repeatV: 1,
    };
    updateCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? { ...collection, variants: [...collection.variants, newVariant] }
          : collection
      )
    );
  };

  const handleRemoveVariant = (collectionId: string, variantId: string) => {
    updateCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              variants: collection.variants.filter((variant) => variant.id !== variantId),
            }
          : collection
      )
    );
    updateActiveVariants((prev) => {
      const current = prev[collectionId];
      if (!current || current !== variantId) return prev;
      const nextSelection = { ...prev };
      delete nextSelection[collectionId];
      return nextSelection;
    });
  };

  const handleSetActiveVariant = (collectionId: string, variantId: string) => {
    updateActiveVariants((prev) => ({
      ...prev,
      [collectionId]: variantId,
    }));
  };

  const handleSaveEnvironmentPreset = () => {
    const name = prompt('Preset name for environment:');
    if (!name) return;
    const preset: EnvironmentPreset = {
      id: createId(),
      name,
      settings: deepClone(environment),
    };
    setEnvironmentPresets((prev) => [...prev, preset]);
    localStorage.setItem(ACTIVE_ENV_PRESET_KEY, preset.id);
  };

  const handleApplyEnvironmentPreset = (id: string) => {
    const preset = environmentPresets.find((entry) => entry.id === id);
    if (!preset) return;
    setEnvironment(() => deepClone({ ...DEFAULT_ENVIRONMENT, ...preset.settings }));
    localStorage.setItem(ACTIVE_ENV_PRESET_KEY, id);
  };

  const handleDeleteEnvironmentPreset = (id: string) => {
    setEnvironmentPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (localStorage.getItem(ACTIVE_ENV_PRESET_KEY) === id) {
      localStorage.removeItem(ACTIVE_ENV_PRESET_KEY);
    }
  };

  const handleSaveBoatPreset = () => {
    const name = prompt('Preset name for boat configuration:');
    if (!name) return;
    const preset: BoatPreset = {
      id: createId(),
      name,
      modelId,
      hullColor,
      materialType,
      waveMode,
      environment: deepClone(environment),
      materialVariantCollections: deepClone(currentCollections),
      activeVariants: deepClone(currentActiveVariants),
    };
    setBoatPresets((prev) => [...prev, preset]);
    localStorage.setItem(ACTIVE_BOAT_PRESET_KEY, preset.id);
  };

  const handleApplyBoatPreset = (id: string) => {
    const preset = boatPresets.find((entry) => entry.id === id);
    if (!preset) return;
    setModelId(preset.modelId as typeof DEFAULT_MODEL_IDS[number]);
    setHullColor(preset.hullColor);
    setMaterialType(preset.materialType);
    setWaveMode(preset.waveMode);
    setEnvironment(() => deepClone({ ...DEFAULT_ENVIRONMENT, ...preset.environment }));
      setMaterialCollectionsByModel((prev) => ({
        ...prev,
        [preset.modelId]: deepClone(preset.materialVariantCollections),
      }));
      setActiveVariantsByModel((prev) => ({
        ...prev,
        [preset.modelId]: deepClone(preset.activeVariants),
      }));
      localStorage.setItem(ACTIVE_BOAT_PRESET_KEY, id);
    };

  const handleDeleteBoatPreset = (id: string) => {
    setBoatPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (localStorage.getItem(ACTIVE_BOAT_PRESET_KEY) === id) {
      localStorage.removeItem(ACTIVE_BOAT_PRESET_KEY);
    }
  };

  // Tree node expansion handlers
  const handleToggleNode = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Group visibility handlers
  const handleGroupHiddenChange = (groupName: string, hidden: boolean) => {
    setGroupVisibilityMappings((prev) => {
      // Use base model ID to share settings between E and non-E variants
      const baseModel = getBaseModelId(modelId);
      const existingIndex = prev.findIndex(m => m.groupName === groupName && m.modelId === baseModel);
      
      if (existingIndex >= 0) {
        // Update existing mapping
        return prev.map((m, i) =>
          i === existingIndex ? { ...m, hiddenByDefault: hidden } : m
        );
      } else if (hidden) {
        // Create new mapping only if hiding (don't create for unhiding non-existent)
        return [...prev, { groupName, modelId: baseModel, hiddenByDefault: hidden }];
      }
      return prev;
    });
  };

  const handleGroupOptionChange = (groupName: string, optionId: string | undefined) => {
    setGroupVisibilityMappings((prev) => {
      // Use base model ID to share settings between E and non-E variants
      const baseModel = getBaseModelId(modelId);
      const existingIndex = prev.findIndex(m => m.groupName === groupName && m.modelId === baseModel);
      
      if (existingIndex >= 0) {
        // Update existing mapping
        return prev.map((m, i) =>
          i === existingIndex ? { ...m, linkedOptionId: optionId || undefined } : m
        );
      } else if (optionId) {
        // Create new mapping only if linking to option
        return [...prev, { groupName, modelId: baseModel, hiddenByDefault: false, linkedOptionId: optionId }];
      }
      return prev;
    });
  };

  const handleSaveGroupVisibility = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save settings');
      return;
    }

    const success = await saveGroupVisibilitySettings(
      { mappings: groupVisibilityMappings },
      user.id
    );

    if (success) {
      alert('✅ Group visibility settings saved!');
    } else {
      alert('❌ Failed to save settings');
    }
  };

  const handleResetModelSettings = (resetModelId: string) => {
    const confirmed = confirm(`Reset all group visibility settings for model ${resetModelId}? This will remove all mappings for this model.`);
    if (!confirmed) return;

    setGroupVisibilityMappings((prev) => 
      prev.filter(m => m.modelId !== resetModelId)
    );
    alert(`✅ Settings for model ${resetModelId} have been reset. Don't forget to save!`);
  };

  const handleSaveEnvironmentAsDefault = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save settings');
      return;
    }

    const success = await saveDefaultEnvironment(environment, user.id);

    if (success) {
      alert('✅ Environment saved as default!');
    } else {
      alert('❌ Failed to save environment');
    }
  };

  const handleSaveMaterialColors = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save settings');
      return;
    }

    // Convert material collections to material color settings format
    const mappings = currentCollections.map((collection) => ({
      materialName: collection.name,
      variants: collection.variants
        .filter((v) => v.mode === 'color')
        .map((v) => ({
          name: v.label,
          hex: v.color,
          isUserPalette: false,
        })),
    }));

    const success = await saveMaterialColorSettings({ mappings }, user.id);

    if (success) {
      alert('✅ Material colors saved!');
    } else {
      alert('❌ Failed to save material colors');
    }
  };

  const environmentColorControls: Array<{ key: keyof EnvironmentSettings; label: string }> = [
    { key: 'skyColor', label: 'Sky Color' },
    { key: 'fogColor', label: 'Fog Color' },
    { key: 'dryDockColor', label: 'Dry Dock Color' },
    { key: 'ambientColor', label: 'Ambient Light Color' },
    { key: 'directionalColor', label: 'Directional Light Color' },
    { key: 'hemisphereSkyColor', label: 'Hemisphere Sky Color' },
    { key: 'hemisphereGroundColor', label: 'Hemisphere Ground Color' },
    { key: 'waterColor', label: 'Water Base Color' },
    { key: 'waterSunColor', label: 'Water Highlight Color' },
  ];

  const numericControlConfigs: Array<{
    key: keyof EnvironmentSettings;
    label: string;
    min: number;
    max: number;
    step: number;
    formatter?: (value: number) => string;
  }> = [
    { key: 'fogNear', label: 'Fog Near', min: 1, max: 100, step: 1 },
    { key: 'fogFar', label: 'Fog Far', min: 5, max: 200, step: 1 },
    { key: 'ambientIntensity', label: 'Ambient Intensity', min: 0, max: 2, step: 0.05 },
    { key: 'directionalIntensity', label: 'Directional Intensity', min: 0, max: 5, step: 0.05 },
    { key: 'hemisphereIntensity', label: 'Hemisphere Intensity', min: 0, max: 2, step: 0.05 },
    { key: 'waterAlpha', label: 'Water Transparency', min: 0, max: 1, step: 0.01 },
    { key: 'waterDistortion', label: 'Water Distortion', min: 0, max: 1, step: 0.01 },
    { key: 'waterSize', label: 'Water Wave Size', min: 0, max: 10, step: 0.1 },
    { key: 'waterSpeed', label: 'Water Animation Speed', min: 0, max: 1, step: 0.01 },
  ];

  return (
    <div className="dev-settings">
      <header className="dev-settings__header">
        <div>
          <h1>Visualization Sandbox</h1>
          <p>
            Adjust environment, water, and material overrides in real time. Saved presets are stored in your browser
            (localStorage).
          </p>
        </div>
        <div className="dev-settings__header-controls">
          <label>
            Model&nbsp;
            <select
              value={modelId}
              onChange={(event) => setModelId(event.target.value as typeof DEFAULT_MODEL_IDS[number])}
            >
              {DEFAULT_MODEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Material
            <select
              value={materialType}
              onChange={(event) => setMaterialType(event.target.value as 'fiberglass' | 'fullCarbon')}
            >
              <option value="fiberglass">Fiberglass</option>
              <option value="fullCarbon">Full Carbon</option>
            </select>
          </label>
          <label>
            Hull color
            <input type="color" value={hullColor} onChange={(event) => setHullColor(event.target.value)} />
          </label>
          <label>
            Wave mode
            <select value={waveMode} onChange={(event) => setWaveMode(event.target.value as WaveMode)}>
              <option value="ocean">Ocean</option>
              <option value="dry-dock">Dry dock</option>
            </select>
          </label>
        </div>
      </header>

      <section className="dev-settings__viewer">
        <BoatViewer
          modelId={modelId}
          color={hullColor}
          materialType={materialType}
          waveMode={waveMode}
          useCustomColor={true}
          hullColorMode="white"
          environment={environment}
          materialVariantCollections={currentCollections}
          activeMaterialVariants={currentActiveVariants}
        />
      </section>

      <section className="dev-settings__panel">
        <div className="dev-card">
          <h2>Environment</h2>
          <div className="dev-grid">
            <label className="dev-control">
              <span>Environment Preset (for metallic reflections)</span>
              <select
                value={environment.environmentPreset || 'sunset'}
                onChange={(e) => {
                  const value = e.target.value as EnvironmentSettings['environmentPreset'];
                  setEnvironment((prev) => ({
                    ...prev,
                    environmentPreset: value,
                  }));
                }}
              >
                <option value="sunset">Sunset</option>
                <option value="dawn">Dawn</option>
                <option value="night">Night</option>
                <option value="warehouse">Warehouse</option>
                <option value="forest">Forest</option>
                <option value="apartment">Apartment</option>
                <option value="studio">Studio</option>
                <option value="city">City</option>
                <option value="park">Park</option>
                <option value="lobby">Lobby</option>
              </select>
            </label>
            {environmentColorControls.map(({ key, label }) => (
              <label key={key} className="dev-control">
                <span>{label}</span>
                <input type="color" value={environment[key] as string} onChange={handleEnvironmentColorChange(key)} />
              </label>
            ))}
          </div>
          <div className="dev-grid dev-grid--wide">
            {numericControlConfigs.map(({ key, label, min, max, step, formatter }) => (
              <label key={key} className="dev-control dev-control--range">
                <span>
                  {label} ({formatter ? formatter(environment[key] as number) : (environment[key] as number).toFixed(2)})
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={environment[key] as number}
                  onChange={handleEnvironmentNumberChange(key)}
                />
              </label>
            ))}
          </div>
          <div className="dev-grid dev-grid--wide">
            <label className="dev-control dev-control--range">
              <span>Sun Direction X</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={environment.waterSunDirection[0]}
                onChange={(event) =>
                  setEnvironment((prev) => ({
                    ...prev,
                    waterSunDirection: [
                      clamp(Number(event.target.value), -1, 1),
                      prev.waterSunDirection[1],
                      prev.waterSunDirection[2],
                    ],
                  }))
                }
              />
            </label>
            <label className="dev-control dev-control--range">
              <span>Sun Direction Y</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={environment.waterSunDirection[1]}
                onChange={(event) =>
                  setEnvironment((prev) => ({
                    ...prev,
                    waterSunDirection: [
                      prev.waterSunDirection[0],
                      clamp(Number(event.target.value), -1, 1),
                      prev.waterSunDirection[2],
                    ],
                  }))
                }
              />
            </label>
            <label className="dev-control dev-control--range">
              <span>Sun Direction Z</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={environment.waterSunDirection[2]}
                onChange={(event) =>
                  setEnvironment((prev) => ({
                    ...prev,
                    waterSunDirection: [
                      prev.waterSunDirection[0],
                      prev.waterSunDirection[1],
                      clamp(Number(event.target.value), -1, 1),
                    ],
                  }))
                }
              />
            </label>
          </div>
          <div className="dev-presets__actions" style={{ marginTop: '1rem' }}>
            <button type="button" onClick={handleSaveEnvironmentAsDefault} style={{ background: '#10b981' }}>
              💾 Save as Default Environment
            </button>
          </div>
        </div>

        <div className="dev-card">
          <h2>Group Visibility</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Control which 3D objects/groups are visible. Link groups to options so they appear when option is selected.
            <br />
            <strong>Auto-managed:</strong> el_motor, battary_V_4_new (controlled by model type E/non-E)
          </p>
          {sceneHierarchy.length === 0 ? (
            <p>Loading 3D model hierarchy...</p>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Search objects (e.g. motor, pump, oars)..."
                  value={groupSearchFilter}
                  onChange={(e) => setGroupSearchFilter(e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: '14px', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      // Expand all top-level groups
                      const newExpanded = new Set<string>();
                      sceneHierarchy.forEach(node => {
                        if (node.children?.length > 0) {
                          newExpanded.add(node.path);
                        }
                      });
                      setExpandedNodes(newExpanded);
                    }}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    Expand Top Level
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setExpandedNodes(new Set())}
                    style={{ padding: '4px 12px', fontSize: '12px' }}
                  >
                    Collapse All
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '16px' }}>
                {/* Left: Object Tree */}
                <div style={{ 
                  maxHeight: '600px', 
                  overflowY: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  background: '#fafafa'
                }}>
                  {sceneHierarchy.map((node, idx) => (
                    <ObjectTreeNode
                      key={`${node.path}-${idx}`}
                      node={node}
                      depth={0}
                      expandedSet={expandedNodes}
                      selectedNode={selectedNode}
                      onToggle={handleToggleNode}
                      onSelect={setSelectedNode}
                    />
                  ))}
                </div>
                
                {/* Right: Material Controls */}
                <div style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  padding: '16px',
                  background: '#fff',
                  maxHeight: '600px',
                  overflowY: 'auto'
                }}>
                  {selectedNode ? (
                    <>
                      <h3 style={{ marginTop: 0, fontSize: '16px', borderBottom: '2px solid #e0e0e0', paddingBottom: '8px' }}>
                        {selectedNode.name}
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                          ({selectedNode.type})
                        </span>
                      </h3>
                      
                      {/* Visibility controls */}
                      {selectedNode.name !== 'el_motor' && selectedNode.name !== 'battary_V_4_new' && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '4px' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Visibility Control</h4>
                          
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <input
                              type="checkbox"
                              checked={groupVisibilityMappings.find(m => m.groupName === selectedNode.name && m.modelId === getBaseModelId(modelId))?.hiddenByDefault || false}
                              onChange={(e) => handleGroupHiddenChange(selectedNode.name, e.target.checked)}
                            />
                            <span style={{ fontSize: '13px' }}>
                              Hidden by default (for {getBaseModelId(modelId)} & {getBaseModelId(modelId)}E)
                            </span>
                          </label>
                          
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '13px' }}>Link to catalog option:</span>
                            <select
                              value={groupVisibilityMappings.find(m => m.groupName === selectedNode.name && m.modelId === getBaseModelId(modelId))?.linkedOptionId || ''}
                              onChange={(e) => handleGroupOptionChange(selectedNode.name, e.target.value || undefined)}
                              style={{ padding: '6px', fontSize: '13px' }}
                            >
                              <option value="">None</option>
                              {catalogOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                            <span style={{ fontSize: '11px', color: '#666' }}>
                              When linked, this object appears only when the option is selected
                            </span>
                          </label>
                        </div>
                      )}
                      
                      {/* Material controls */}
                      {selectedNode.materials && selectedNode.materials.length > 0 ? (
                        <div>
                          <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                            Materials: {selectedNode.materials.join(', ')}
                          </p>
                          
                          {selectedNode.materials.map((matName: string) => {
                            const collection = currentCollections.find(c => c.materials.includes(matName));
                            if (!collection) return null;
                            
                            const variant = collection.variants.find(
                              v => v.id === (currentActiveVariants[collection.id] || collection.variants[0]?.id)
                            ) || collection.variants[0];
                            
                            if (!variant) return null;
                            
                            return (
                              <div key={matName} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                                <p style={{ fontFamily: 'monospace', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                                  {matName}
                                </p>
                                
                                {variant.mode === 'color' && (
                                  <div style={{ display: 'grid', gap: '12px' }}>
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px' }}>Color</span>
                                      <input
                                        type="color"
                                        value={variant.color}
                                        onChange={(e) =>
                                          handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                            ...current,
                                            color: e.target.value,
                                          }))
                                        }
                                        style={{ height: '40px', cursor: 'pointer' }}
                                      />
                                    </label>
                                    
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px' }}>
                                        Metalness: {(variant.metalness ?? 0.0).toFixed(2)}
                                      </span>
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={variant.metalness ?? 0.0}
                                        onChange={(e) =>
                                          handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                            ...current,
                                            metalness: Number(e.target.value),
                                          }))
                                        }
                                      />
                                    </label>
                                    
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '13px' }}>
                                        Roughness: {(variant.roughness ?? 0.5).toFixed(2)}
                                      </span>
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={variant.roughness ?? 0.5}
                                        onChange={(e) =>
                                          handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                            ...current,
                                            roughness: Number(e.target.value),
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ color: '#999', fontSize: '13px' }}>
                          This {selectedNode.type.toLowerCase()} has no materials to configure.
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: '#999', textAlign: 'center', marginTop: '40px' }}>
                      ← Select an object from the tree to configure its materials
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button type="button" onClick={handleSaveGroupVisibility} style={{ background: '#3b82f6', flex: '1 1 auto' }}>
                  💾 Save Group Visibility Settings
                </button>
              </div>
              
              <div style={{ marginTop: '1rem', padding: '12px', background: '#e7f3ff', borderRadius: '4px', border: '1px solid #2196f3' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#0d47a1' }}>ℹ️ Model Groups (E/non-E share settings)</h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#0d47a1' }}>
                  Currently editing: <strong>Model {modelId}</strong> (uses {getBaseModelId(modelId)} settings)<br />
                  Electric models (E) and non-electric models share the same visibility settings.<br />
                  Only motor and battery groups are managed automatically.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
                  {['2.9', '3.3'].map((baseModel) => {
                    const count = groupVisibilityMappings.filter(m => m.modelId === baseModel).length;
                    return (
                      <button 
                        key={baseModel}
                        type="button" 
                        onClick={() => handleResetModelSettings(baseModel)}
                        disabled={count === 0}
                        style={{ 
                          background: count > 0 ? '#dc3545' : '#e0e0e0', 
                          color: count > 0 ? '#fff' : '#999',
                          fontSize: '11px',
                          padding: '8px 10px',
                          cursor: count > 0 ? 'pointer' : 'not-allowed'
                        }}
                        title={count > 0 ? `${count} mapping(s) for ${baseModel} & ${baseModel}E` : 'No mappings'}
                      >
                        🗑️ Reset {baseModel} & {baseModel}E {count > 0 ? `(${count})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="dev-card" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <h2>Material Overrides <span style={{ fontSize: '14px', color: '#999', fontWeight: 'normal' }}>(Disabled)</span></h2>
          <p style={{ color: '#999', fontStyle: 'italic', marginTop: '0.5rem' }}>
            Material Overrides are currently disabled. Models will use their original colors from the 3D model files.
          </p>
          {currentCollections.length === 0 ? (
            <p>No materials detected yet for this model.</p>
          ) : (
            currentCollections.map((collection) => (
              <div key={collection.id} className="dev-material">
                <div className="dev-material__header">
                  <input
                    type="text"
                    value={collection.name}
                    onChange={(event) => handleCollectionNameChange(collection.id, event.target.value)}
                    placeholder="Material group name"
                    disabled
                  />
                  <button type="button" onClick={() => handleAddColorVariant(collection.id)} disabled>
                    + Color variant
                  </button>
                  <button type="button" onClick={() => handleAddTextureVariant(collection.id)} disabled>
                    + Texture variant
                  </button>
                </div>
                <label className="dev-material__materials">
                  <span>Materials (comma separated)</span>
                  <input
                    type="text"
                    value={collection.materials.join(', ')}
                    onChange={(event) => handleMaterialsInputChange(collection.id, event.target.value)}
                    placeholder="material_Main, material_Ring"
                    disabled
                  />
                </label>
                <div className="dev-material__variants">
                  {collection.variants.map((variant) => (
                    <div key={variant.id} className="dev-material__variant">
                      <div className="dev-material__variant-header">
                        <input
                          type="text"
                          value={variant.label}
                          onChange={(event) =>
                            handleVariantFieldChange(collection.id, variant.id, (current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          disabled
                        />
                        <label>
                          <input
                            type="radio"
                            checked={
                              currentActiveVariants[collection.id]
                                ? currentActiveVariants[collection.id] === variant.id
                                : collection.variants[0]?.id === variant.id
                            }
                            onChange={() => handleSetActiveVariant(collection.id, variant.id)}
                            disabled
                          />
                          Active
                        </label>
                        <button type="button" onClick={() => handleRemoveVariant(collection.id, variant.id)} disabled>
                          Remove
                        </button>
                      </div>
                      {variant.mode === 'color' ? (
                        <div className="dev-material__variant-body dev-material__variant-body--grid">
                          <label>
                            Color
                            <input
                              type="color"
                              value={variant.color}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  color: event.target.value,
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Metalness
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={variant.metalness ?? 0.0}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  metalness: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {(variant.metalness ?? 0.0).toFixed(2)}
                            </span>
                          </label>
                          <label>
                            Roughness
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={variant.roughness ?? 0.5}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  roughness: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {(variant.roughness ?? 0.5).toFixed(2)}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="dev-material__variant-body dev-material__variant-body--grid">
                          <label>
                            Texture URL
                            <input
                              type="text"
                              value={variant.textureUrl}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  textureUrl: event.target.value,
                                }))
                              }
                              placeholder="/textures/custom.png"
                              disabled
                            />
                          </label>
                          <label>
                            Tint
                            <input
                              type="color"
                              value={variant.tint ?? '#ffffff'}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  tint: event.target.value,
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Repeat U
                            <input
                              type="number"
                              step={0.1}
                              value={variant.repeatU ?? 1}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  repeatU: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Repeat V
                            <input
                              type="number"
                              step={0.1}
                              value={variant.repeatV ?? 1}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  repeatV: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Offset U
                            <input
                              type="number"
                              step={0.05}
                              value={variant.offsetU ?? 0}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  offsetU: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Offset V
                            <input
                              type="number"
                              step={0.05}
                              value={variant.offsetV ?? 0}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  offsetV: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                          </label>
                          <label>
                            Rotation
                            <input
                              type="number"
                              step={0.1}
                              value={variant.rotation ?? 0}
                              onChange={(event) =>
                                handleVariantFieldChange(collection.id, variant.id, (current) => ({
                                  ...current,
                                  rotation: Number(event.target.value),
                                }))
                              }
                              disabled
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {currentCollections.length > 0 && (
            <button type="button" onClick={handleSaveMaterialColors} style={{ background: '#8b5cf6', marginTop: '1rem' }} disabled>
              💾 Save Material Colors as Default
            </button>
          )}
        </div>

        <div className="dev-presets">
          <div className="dev-card">
            <h2>Environment Presets</h2>
            <div className="dev-presets__actions">
              <button type="button" onClick={handleSaveEnvironmentPreset}>
                Save current environment
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const settings = {
                    environment: environment,
                    boat: {
                      modelId,
                      hullColor,
                      materialType,
                      waveMode,
                      materialVariantCollections,
                      activeMaterialVariants: activeVariants,
                    }
                  };
                  const json = JSON.stringify(settings, null, 2);
                  navigator.clipboard.writeText(json).then(() => {
                    alert('✅ Settings copied to clipboard!\n\nPaste this into DEFAULT_ENVIRONMENT in BoatViewer.tsx');
                  }).catch(() => {
                    // Fallback - show in console
                    console.log('=== CURRENT SETTINGS ===');
                    console.log(json);
                    alert('Settings logged to console (F12)');
                  });
                }}
                style={{ background: '#10b981' }}
              >
                📋 Export Current Settings
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const exportData = {
                    environmentPresets,
                    boatPresets,
                    version: '1.0',
                    exportedAt: new Date().toISOString()
                  };
                  const json = JSON.stringify(exportData, null, 2);
                  
                  // Create and download file
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `visualization-presets-${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                style={{ background: '#3b82f6' }}
              >
                📦 Export All Presets
              </button>
              <button 
                type="button" 
                onClick={() => {
                  // Create hidden file input
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const json = event.target?.result as string;
                        const data = JSON.parse(json);
                        
                        if (!data.version || !Array.isArray(data.environmentPresets) || !Array.isArray(data.boatPresets)) {
                          throw new Error('Invalid format');
                        }
                        
                        // Import environment presets
                        if (data.environmentPresets.length > 0) {
                          localStorage.setItem(ENV_PRESETS_KEY, JSON.stringify(data.environmentPresets));
                          setEnvironmentPresets(data.environmentPresets);
                        }
                        
                        // Import boat presets
                        if (data.boatPresets.length > 0) {
                          localStorage.setItem(BOAT_PRESETS_KEY, JSON.stringify(data.boatPresets));
                          setBoatPresets(data.boatPresets);
                        }
                        
                        alert(`✅ Imported successfully!\n\n${data.environmentPresets.length} environment presets\n${data.boatPresets.length} boat presets`);
                      } catch (error) {
                        alert('❌ Invalid file format. Please check and try again.');
                        console.error('Import error:', error);
                      }
                    };
                    
                    reader.readAsText(file);
                  };
                  
                  input.click();
                }}
                style={{ background: '#8b5cf6' }}
              >
                📥 Import Presets
              </button>
            </div>
            {environmentPresets.length === 0 ? (
              <p>No saved presets yet.</p>
            ) : (
              <ul>
                {environmentPresets.map((preset) => (
                  <li key={preset.id} className="dev-presets__item">
                    <span>{preset.name}</span>
                    <div>
                      <button type="button" onClick={() => handleApplyEnvironmentPreset(preset.id)}>
                        Apply
                      </button>
                      <button type="button" onClick={() => handleDeleteEnvironmentPreset(preset.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dev-card">
            <h2>Boat Presets</h2>
            <div className="dev-presets__actions">
              <button type="button" onClick={handleSaveBoatPreset}>
                Save current configuration
              </button>
            </div>
            {boatPresets.length === 0 ? (
              <p>No boat presets yet.</p>
            ) : (
              <ul>
                {boatPresets.map((preset) => (
                  <li key={preset.id} className="dev-presets__item">
                    <span>
                      {preset.name} ({preset.modelId})
                    </span>
                    <div>
                      <button type="button" onClick={() => handleApplyBoatPreset(preset.id)}>
                        Apply
                      </button>
                      <button type="button" onClick={() => handleDeleteBoatPreset(preset.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default DevSettingsPage;
