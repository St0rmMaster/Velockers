import { useCallback, useEffect, useState } from 'react';
import { ConfigurationProvider, useConfiguration } from './contexts/ConfigurationContext';
import type { WaveMode, GroupVisibilityMapping } from './types';
import { loadCatalog } from './utils/catalogLoader';
import { calculatePrice, formatPrice } from './utils/priceCalculator';
import { BoatViewer, DEFAULT_ENVIRONMENT } from './components/BoatViewer';
import type { EnvironmentSettings, MaterialVariantCollection, MaterialVariantSelection } from './components/BoatViewer';
import { Accordion } from './components/Accordion';
import { OrderConfirmationModal } from './components/OrderConfirmationModal';
import { ChatModal } from './components/ChatModal';
import { TaxAndShippingModal } from './components/TaxAndShippingModal';
import './App.css';
import {
  ACTIVE_BOAT_PRESET_KEY,
  ACTIVE_ENV_PRESET_KEY,
  BOAT_PRESETS_KEY,
  ENV_PRESETS_KEY,
  deepClone,
} from './utils/presets';
import {
  loadGroupVisibilitySettings,
  loadDefaultEnvironment,
  loadMaterialColorSettings,
} from './services/visualizationService';

type StoredEnvironmentPreset = {
  id: string;
  settings: EnvironmentSettings;
};

type StoredBoatPreset = {
  id: string;
  modelId: string;
  hullColor: string;
  materialType: 'fiberglass' | 'fullCarbon';
  waveMode: WaveMode;
  environment: EnvironmentSettings;
  materialVariantCollections: MaterialVariantCollection[];
  activeVariants: MaterialVariantSelection;
};

function ConfiguratorContent() {
  const {
    configuration,
    catalog,
    setCatalog,
    setModel,
    setMaterial,
    setColour,
    toggleOption,
    setWaveMode,
  } = useConfiguration();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environmentOverrides, setEnvironmentOverrides] = useState<EnvironmentSettings | null>(null);
  const [materialCollectionsOverride, setMaterialCollectionsOverride] = useState<MaterialVariantCollection[] | null>(
    null
  );
  const [activeVariantOverrides, setActiveVariantOverrides] = useState<MaterialVariantSelection | null>(null);
  const [activeBoatPreset, setActiveBoatPreset] = useState<StoredBoatPreset | null>(null);
  const [groupVisibilityMappings, setGroupVisibilityMappings] = useState<GroupVisibilityMapping[]>([]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  // Tax & Shipping (calculated in modal)
  const [taxRate, setTaxRate] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [taxCalculated, setTaxCalculated] = useState(false);
  const [includeTaxInTotal, setIncludeTaxInTotal] = useState(true);
  const [includeShippingInTotal, setIncludeShippingInTotal] = useState(true);
  
  // Hull color settings
  const [useCustomHullColor, setUseCustomHullColor] = useState(false);
  const [hullColorMode, setHullColorMode] = useState<'white' | 'grey'>('white');
  const [customHullColor, setCustomHullColor] = useState('#FF6B00');
  
  // Soft deck color
  const [softDeckColor, setSoftDeckColor] = useState<string | undefined>('#9D622BFF');
  // Referral code
  const [referralCode, setReferralCode] = useState('');

  // Load catalog on mount
  useEffect(() => {
    loadCatalog()
      .then((data) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load catalog');
        setLoading(false);
        console.error(err);
      });
  }, [setCatalog]);

  // Load visualization settings (group visibility and default environment)
  useEffect(() => {
    const loadVisualizationSettings = async () => {
      // Load group visibility settings
      const groupSettings = await loadGroupVisibilitySettings();
      if (groupSettings?.mappings) {
        setGroupVisibilityMappings(groupSettings.mappings);
      }

      // Load default environment (only if not already overridden by preset)
      const defaultEnv = await loadDefaultEnvironment();
      if (defaultEnv && !environmentOverrides) {
        setEnvironmentOverrides(defaultEnv);
      }

      // Load material color settings
      const materialSettings = await loadMaterialColorSettings();
      if (materialSettings?.mappings) {
        // Convert MaterialColorSettings to MaterialVariantCollection format
        const collections: MaterialVariantCollection[] = materialSettings.mappings.map(mapping => ({
          id: mapping.materialName, // Use material name as ID
          name: mapping.materialName,
          materials: [mapping.materialName],
          variants: mapping.variants.map((v, idx) => ({
            id: `${mapping.materialName}-${idx}`,
            label: v.name,
            mode: 'color' as const,
            color: v.hex,
          })),
        }));
        
        if (collections.length > 0) {
          setMaterialCollectionsOverride(collections);
        }
      }
    };

    loadVisualizationSettings();
  }, []); // Run once on mount

  const applyPresetsFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const envPresetsRaw = window.localStorage.getItem(ENV_PRESETS_KEY);
      const envActiveId = window.localStorage.getItem(ACTIVE_ENV_PRESET_KEY);
      let envPreset: StoredEnvironmentPreset | null = null;
      if (envPresetsRaw && envActiveId) {
        const parsed = JSON.parse(envPresetsRaw) as StoredEnvironmentPreset[];
        envPreset = parsed.find((entry) => entry.id === envActiveId) ?? null;
      }

      const boatPresetsRaw = window.localStorage.getItem(BOAT_PRESETS_KEY);
      const boatActiveId = window.localStorage.getItem(ACTIVE_BOAT_PRESET_KEY);
      let boatPreset: StoredBoatPreset | null = null;
      if (boatPresetsRaw && boatActiveId) {
        const parsed = JSON.parse(boatPresetsRaw) as StoredBoatPreset[];
        const found = parsed.find((entry) => entry.id === boatActiveId);
        if (found) {
          boatPreset = deepClone(found);
        }
      }

      const mergedEnvironment = (() => {
        if (!envPreset && !boatPreset?.environment) return null;
        return deepClone({
          ...DEFAULT_ENVIRONMENT,
          ...(envPreset ? envPreset.settings : {}),
          ...(boatPreset?.environment ?? {}),
        });
      })();

      setEnvironmentOverrides(mergedEnvironment);
      setMaterialCollectionsOverride(boatPreset ? deepClone(boatPreset.materialVariantCollections ?? []) : null);
      setActiveVariantOverrides(boatPreset ? deepClone(boatPreset.activeVariants ?? {}) : null);
      setActiveBoatPreset(boatPreset);
    } catch (storageError) {
      console.warn('Failed to apply presets from storage', storageError);
    }
  }, []);

  useEffect(() => {
    applyPresetsFromStorage();
    const handler = () => applyPresetsFromStorage();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [applyPresetsFromStorage]);

  useEffect(() => {
    if (!activeBoatPreset) return;
    setModel(activeBoatPreset.modelId);
    setMaterial(activeBoatPreset.materialType);
    if (activeBoatPreset.hullColor) {
      setColour('custom', activeBoatPreset.hullColor);
    }
    setWaveMode(activeBoatPreset.waveMode);
  }, [activeBoatPreset, setModel, setMaterial, setColour, setWaveMode]);

  // Material and color management is now handled directly in BoatViewer

  // Автопересчёт налога при изменениях состава заказа/ставки — хук ДОЛЖЕН быть до ранних return
  useEffect(() => {
    if (!taxCalculated) return;
    if (!catalog) return;
    const breakdown = calculatePrice(catalog, configuration);
    if (useCustomHullColor && catalog.customColor) {
      breakdown.total += catalog.customColor.priceUsd;
    }
    const normalized = (referralCode || '').trim().toUpperCase();
    const isValid = normalized === 'ITSLULU';
    const isElectric = configuration.modelId.endsWith('E');
    const discount = isValid ? (isElectric ? 1000 : 500) : 0;
    const taxBase = Math.max(0, breakdown.total - discount);
    const recalculatedTax = Math.max(0, Math.round(taxBase * taxRate));
    setTaxAmount(recalculatedTax);
    if (recalculatedTax === 0) {
      setIncludeTaxInTotal(false);
    }
  }, [taxCalculated, taxRate, catalog, configuration, useCustomHullColor, referralCode]);
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading configurator...</p>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{error || 'Catalog not available'}</p>
      </div>
    );
  }

  // Calculate current price
  const priceBreakdown = calculatePrice(catalog, configuration);
  
  // Add custom hull color price if enabled
  if (useCustomHullColor && catalog.customColor) {
    priceBreakdown.total += catalog.customColor.priceUsd;
  }

  // Referral discount (ITSLULU): $1000 for electric models, $500 otherwise
  const normalizedReferral = (referralCode || '').trim().toUpperCase();
  const isReferralValid = normalizedReferral === 'ITSLULU';
  const isElectricModel = configuration.modelId.endsWith('E');
  const referralDiscount = isReferralValid ? (isElectricModel ? 1000 : 500) : 0;
  const subtotalAfterDiscount = Math.max(0, priceBreakdown.total - referralDiscount);

  const handleTaxCalculated = (rate: number, amount: number, shipping: number) => {
    const hadPreviousCalculation = taxCalculated;
    setTaxRate(rate);
    setTaxAmount(amount);
    setShippingCost(shipping);
    setIncludeTaxInTotal((prev) => {
      if (amount > 0) {
        return hadPreviousCalculation ? prev : true;
      }
      return false;
    });
    setIncludeShippingInTotal((prev) => {
      if (shipping > 0) {
        return hadPreviousCalculation ? prev : true;
      }
      return false;
    });
    setTaxCalculated(rate > 0 || shipping > 0);
  };

  const totalWithAdjustments =
    subtotalAfterDiscount +
    (includeTaxInTotal ? taxAmount : 0) +
    (includeShippingInTotal ? shippingCost : 0);
  return (
    <div className="configurator">
      <div className="main-layout">
        {/* 3D Viewer */}
        <div className="viewer-container">
          <BoatViewer
            modelId={configuration.modelId}
            color={useCustomHullColor ? customHullColor : '#FFFFFF'}
            materialType={configuration.materialId}
            waveMode={configuration.waveMode}
            useCustomColor={useCustomHullColor}
            hullColorMode={hullColorMode}
            softDeckColor={configuration.optionIds.includes('soft-deck') ? softDeckColor : undefined}
            environment={environmentOverrides ?? undefined}
            materialVariantCollections={undefined}
            activeMaterialVariants={undefined}
            groupVisibilityMappings={groupVisibilityMappings}
            selectedOptions={configuration.optionIds}
          />
          
          {/* Header overlay */}
          <div className="viewer-header">
            <div className="viewer-branding">
              <h1 className="viewer-title">Exce1sior 3D Configurator</h1>
              <a
                className="home-link-btn"
                href="https://boats.gramini.org/"
                rel="noopener"
              >
                ← Back to Home
              </a>
            </div>
          </div>
          
          {/* Wave mode switcher */}
          <div className="wave-mode-switch">
            <span className="wave-mode-label">Viewing mode:</span>
            {(['ocean', 'dry-dock'] as WaveMode[]).map((mode) => (
              <button
                key={mode}
                className={`chip ${configuration.waveMode === mode ? 'active' : ''}`}
                onClick={() => setWaveMode(mode)}
              >
                {mode === 'ocean' ? 'Ocean' : 'Dry Dock'}
              </button>
            ))}
          </div>

          {/* Hints */}
          <div className="viewer-hints">
            <div>Drag to rotate</div>
            <div>Scroll to zoom</div>
            <div>Middle mouse: pan</div>
          </div>
          </div>
        {/* Configuration Panel */}
        <aside className="config-panel">
          <div className="config-panel-scrollable">
            <Accordion title="Select Model" defaultOpen={true}>
              {catalog.models
                .slice()
                .sort((a, b) => {
                  const order = ['2.9', '2.9E', '3.3', '3.3E'];
                  return order.indexOf(a.id) - order.indexOf(b.id);
                })
                .map((model) => (
                <label key={model.id} className="radio-option">
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={configuration.modelId === model.id}
                    onChange={() => setModel(model.id)}
                  />
                  <span>{`Exce1sior ${model.id}`}</span>
                </label>
              ))}
            </Accordion>

            <Accordion title="Select Material" defaultOpen={true}>
              {catalog.materials.map((material) => (
                <label key={material.id} className="radio-option">
                  <input
                    type="radio"
                    name="material"
                    value={material.id}
                    checked={configuration.materialId === material.id}
                    onChange={() => setMaterial(material.id)}
                  />
                  <span>{material.name}</span>
                </label>
              ))}
            </Accordion>

            <Accordion title="Select Hull Color" defaultOpen={true}>
              <div className="color-row-two">
                <button
                  className={`rect-color rect-sm ${!useCustomHullColor && hullColorMode === 'grey' ? 'selected' : ''}`}
                  style={{ backgroundColor: '#9EA0A1' }}
                  onClick={() => {
                    setUseCustomHullColor(false);
                    setHullColorMode('grey');
                    // Синхронизируем конфигурацию для заказов/уведомлений
                    setColour('palette', 'grey');
                  }}
                  title="Grey — RAL 7004"
                >Grey</button>
                <button
                  className={`rect-color rect-sm ${!useCustomHullColor && hullColorMode === 'white' ? 'selected' : ''}`}
                  style={{ backgroundColor: '#ECECE8' }}
                  onClick={() => {
                    setUseCustomHullColor(false);
                    setHullColorMode('white');
                    // Синхронизация с конфигурацией
                    setColour('palette', 'white');
                  }}
                  title="White — RAL 9003"
                >White</button>
              </div>
              
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={useCustomHullColor}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setUseCustomHullColor(enabled);
                    if (enabled) {
                      setColour('custom', customHullColor);
                    } else {
                      setColour('palette', hullColorMode);
                    }
                  }}
                />
                <span>
                  Custom hull color <span className="price">+{formatPrice(catalog.customColor.priceUsd, configuration.locale)}</span>
                </span>
              </label>
              {useCustomHullColor && (
                <input
                  type="color"
                  value={customHullColor}
                  onChange={(e) => {
                    setCustomHullColor(e.target.value);
                    setColour('custom', e.target.value);
                  }}
                  className="color-picker"
                />
              )}
            </Accordion>

            <Accordion title="Options" defaultOpen={false}>
              {catalog?.options
                .filter((option) => {
                  // Filter out 10.5kW motor upgrade for non-electric models
                  if (option.id === '10.5kw-motor' && !configuration.modelId.endsWith('E')) {
                    return false;
                  }
                  return true;
                })
                .map((option) => (
                  <div key={option.id}>
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={configuration.optionIds.includes(option.id)}
                        onChange={() => toggleOption(option.id)}
                      />
                      <span>
                        {option.name} <span className="price">+{formatPrice(option.priceUsd, configuration.locale)}</span>
                      </span>
                    </label>
                    
                    {option.id === 'soft-deck' && configuration.optionIds.includes('soft-deck') && (
                      <div style={{ marginLeft: '28px', marginTop: '8px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Soft Deck Color:</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className={`rect-color ${softDeckColor === '#9D622BFF' ? 'selected' : ''}`}
                            style={{ 
                              backgroundColor: '#9D622B', 
                              width: '40px', 
                              height: '24px',
                              fontSize: '9px',
                              padding: '2px'
                            }}
                            onClick={() => setSoftDeckColor('#9D622BFF')}
                            title="Sandstone + Strips Grey"
                          />
                          <button
                            className={`rect-color ${softDeckColor === '#BCBCBCFF' ? 'selected' : ''}`}
                            style={{ 
                              backgroundColor: '#939393', 
                              width: '40px', 
                              height: '24px',
                              fontSize: '9px',
                              padding: '2px'
                            }}
                            onClick={() => setSoftDeckColor('#BCBCBCFF')}
                            title="Soft Grey + Strips Grey"
                          />
                          <button
                            className={`rect-color ${softDeckColor === '#95070BFF' ? 'selected' : ''}`}
                            style={{ 
                              backgroundColor: '#95070B', 
                              width: '40px', 
                              height: '24px',
                              fontSize: '9px',
                              padding: '2px'
                            }}
                            onClick={() => setSoftDeckColor('#95070BFF')}
                            title="Soft Grey + Strips Red"
                          />
                        </div>
                      </div>
                    )}
                  </div>
              ))}
            </Accordion>
          </div>

          <section className="price-summary">
            <div className="zip-tax-form" style={{ marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Referral code"
                className="zip-input"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
              />
            </div>

            {referralDiscount > 0 && (
              <div className="price-row discount">
                <span>Referral discount:</span>
                <span className="amount">-{formatPrice(referralDiscount, configuration.locale)}</span>
              </div>
            )}

            {taxCalculated && (
              <>
                {taxAmount > 0 && (
                  <div className="price-row tax">
                    <span>Tax ({Math.round(taxRate * 100)}%):</span>
                    <span className="amount">
                      {formatPrice(taxAmount, configuration.locale)}
                      {!includeTaxInTotal && <span className="toggle-tag">excluded</span>}
                    </span>
                  </div>
                )}
                {shippingCost > 0 && (
                  <div className="price-row shipping">
                    <span>Shipping:</span>
                    <span className="amount">
                      {formatPrice(shippingCost, configuration.locale)}
                      {!includeShippingInTotal && <span className="toggle-tag">excluded</span>}
                    </span>
                  </div>
                )}
              </>
            )}

            {(taxAmount > 0 || shippingCost > 0) && (
              <div className="include-toggles">
                {taxAmount > 0 && (
                  <label className="include-toggle">
                    <input
                      type="checkbox"
                      checked={includeTaxInTotal}
                      onChange={(e) => setIncludeTaxInTotal(e.target.checked)}
                    />
                    <span>Include tax in total</span>
                  </label>
                )}
                {shippingCost > 0 && (
                  <label className="include-toggle">
                    <input
                      type="checkbox"
                      checked={includeShippingInTotal}
                      onChange={(e) => setIncludeShippingInTotal(e.target.checked)}
                    />
                    <span>Include shipping in total</span>
                  </label>
                )}
              </div>
            )}

            <div className="price-row total">
              <span>Total:</span>
              <span className="amount">{formatPrice(totalWithAdjustments, configuration.locale)}</span>
            </div>
            <p className="price-notes">
              {taxCalculated
                ? 'Use the toggles to include or exclude tax and shipping from the total.'
                : 'Taxes and delivery are not included.'}
            </p>
          </section>

          <div className="action-buttons">
            <button 
              className="btn-secondary btn-sm" 
              onClick={() => setIsTaxModalOpen(true)}
            >
              Calculate Tax & Shipping
            </button>
            <button 
              className="btn-primary btn-sm" 
              onClick={() => setIsOrderModalOpen(true)}
            >
              Place Order
            </button>
            <button 
              className="btn-secondary btn-sm" 
              onClick={() => setIsChatModalOpen(true)}
            >
              Ask a Question
            </button>
          </div>
          
          {/* Order Confirmation Modal */}
          <OrderConfirmationModal
            isOpen={isOrderModalOpen}
            onClose={() => setIsOrderModalOpen(false)}
            configuration={{
              ...configuration,
              softDeckColor: configuration.optionIds.includes('soft-deck') ? softDeckColor : undefined,
              promoCode: isReferralValid ? normalizedReferral : undefined,
              promoDiscount: referralDiscount,
              taxAmount,
              taxRate,
              shippingCost,
              includeTaxInTotal,
              includeShippingInTotal,
            }}
            catalog={catalog}
            totalPrice={totalWithAdjustments}
          />

          {/* Tax & Shipping Modal */}
          <TaxAndShippingModal
            isOpen={isTaxModalOpen}
            onClose={() => setIsTaxModalOpen(false)}
            configuration={configuration}
            catalog={catalog}
            subtotal={priceBreakdown.total}
            referralDiscount={referralDiscount}
            onTaxCalculated={handleTaxCalculated}
          />

          {/* Chat Modal */}
          <ChatModal
            isOpen={isChatModalOpen}
            onClose={() => setIsChatModalOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}

function App() {
  return (
    <ConfigurationProvider>
      <ConfiguratorContent />
    </ConfigurationProvider>
  );
}

export default App;
