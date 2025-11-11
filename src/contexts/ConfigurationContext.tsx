import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Configuration, Catalog, Locale, MaterialId, ColourType, WaveMode } from '../types';

// Default camera orbit values
const DEFAULT_CAMERA = {
  orbit: {
    azimuth: 45,
    elevation: 30,
    distance: 5,
  },
};

// Default configuration
const DEFAULT_CONFIG: Configuration = {
  modelId: '2.9',
  materialId: 'fiberglass',
  colour: {
    type: 'palette',
    value: 'white-grey',
  },
  optionIds: ['soft-deck'],
  camera: DEFAULT_CAMERA,
  locale: 'en',
  waveMode: 'ocean',
};

interface ConfigurationContextValue {
  configuration: Configuration;
  catalog: Catalog | null;
  setCatalog: (catalog: Catalog) => void;
  setModel: (modelId: string) => void;
  setMaterial: (materialId: MaterialId) => void;
  setColour: (type: ColourType, value: string) => void;
  toggleOption: (optionId: string) => void;
  setLocale: (locale: Locale) => void;
  setCameraOrbit: (azimuth: number, elevation: number, distance: number) => void;
  setWaveMode: (mode: WaveMode) => void;
  resetConfiguration: () => void;
  loadConfiguration: (config: Configuration) => void;
}

const ConfigurationContext = createContext<ConfigurationContextValue | undefined>(undefined);

export function ConfigurationProvider({ children }: { children: ReactNode }) {
  const [configuration, setConfiguration] = useState<Configuration>(DEFAULT_CONFIG);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  const setModel = useCallback((modelId: string) => {
    setConfiguration((prev) => ({ ...prev, modelId }));
  }, []);

  const setMaterial = useCallback((materialId: MaterialId) => {
    setConfiguration((prev) => ({ ...prev, materialId }));
  }, []);

  const setColour = useCallback((type: ColourType, value: string) => {
    setConfiguration((prev) => ({
      ...prev,
      colour: { type, value },
    }));
  }, []);

  const toggleOption = useCallback((optionId: string) => {
    setConfiguration((prev) => {
      const optionIds = prev.optionIds.includes(optionId)
        ? prev.optionIds.filter((id) => id !== optionId)
        : [...prev.optionIds, optionId];
      return { ...prev, optionIds };
    });
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    setConfiguration((prev) => ({ ...prev, locale }));
  }, []);

  const setWaveMode = useCallback((mode: WaveMode) => {
    setConfiguration((prev) => ({ ...prev, waveMode: mode }));
  }, []);

  const setCameraOrbit = useCallback(
    (azimuth: number, elevation: number, distance: number) => {
      setConfiguration((prev) => ({
        ...prev,
        camera: {
          ...prev.camera,
          orbit: { azimuth, elevation, distance },
        },
      }));
    },
    []
  );

  const resetConfiguration = useCallback(() => {
    setConfiguration(DEFAULT_CONFIG);
  }, []);

  const loadConfiguration = useCallback((config: Configuration) => {
    setConfiguration(config);
  }, []);

  return (
    <ConfigurationContext.Provider
      value={{
        configuration,
        catalog,
        setCatalog,
        setModel,
        setMaterial,
        setColour,
        toggleOption,
        setLocale,
        setCameraOrbit,
        setWaveMode,
        resetConfiguration,
        loadConfiguration,
      }}
    >
      {children}
    </ConfigurationContext.Provider>
  );
}

export function useConfiguration() {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfiguration must be used within ConfigurationProvider');
  }
  return context;
}

