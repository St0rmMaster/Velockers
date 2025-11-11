// Data Model Types for Exce1sior 3D Configurator

export interface Model {
  id: string;
  name: string;
  loa: string;
  beam: string;
  baseEquipment: string[];
  weightsByMaterial: {
    fiberglass: number;
    fullCarbon: number;
  };
}

export type MaterialId = 'fiberglass' | 'fullCarbon';

export interface Material {
  id: MaterialId;
  name: string;
}

export interface BasePrice {
  modelId: string;
  materialId: MaterialId;
  amountUsd: number;
  tradePrice?: number;
}

export interface Option {
  id: string;
  name: string;
  description?: string;
  priceUsd: number;
}

export type ColourType = 'palette' | 'custom';

export interface Colour {
  type: ColourType;
  value: string; // hex or palette id
}

export interface PaletteColour {
  id: string;
  name: {
    en: string;
    ru: string;
  };
  hex: string;
  isDefault?: boolean;
}

export interface CameraOrbit {
  azimuth: number;
  elevation: number;
  distance: number;
}

export type CameraPreset = 'default' | 'stern' | 'bow' | 'cockpit' | 'cabin';

export interface Camera {
  preset?: CameraPreset;
  orbit: CameraOrbit;
}

export type Locale = 'en' | 'ru';

// Visual modes for water/waves
export type WaveMode = 'ocean' | 'dry-dock';

export interface Configuration {
  modelId: string;
  materialId: MaterialId;
  colour: Colour;
  optionIds: string[];
  // Optional UI-only detail to persist with orders: chosen Soft Deck color
  softDeckColor?: string;
  // Optional referral info to persist with orders
  promoCode?: string;
  promoDiscount?: number;
  // Pricing toggles and breakdown (optional)
  taxRate?: number;
  taxAmount?: number;
  shippingCost?: number;
  includeTaxInTotal?: boolean;
  includeShippingInTotal?: boolean;
  camera: Camera;
  locale: Locale;
  waveMode: WaveMode;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

export interface EnquiryNotes {
  exVat: boolean;
  shippingSeparately: boolean;
  packingRule: string;
}

export interface Enquiry {
  contact: Contact;
  configuration: Configuration;
  totalExVatUsd: number;
  notes: EnquiryNotes;
  screenshotUrl?: string;
}

export type AnalyticsEventName =
  | 'session_start'
  | 'model_change'
  | 'material_change'
  | 'colour_change'
  | 'option_toggle'
  | 'share_link'
  | 'submit_enquiry'
  | 'error';

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  timestamp: string;
  sessionId: string;
  locale: Locale;
  [key: string]: any; // event-specific fields
}

// Catalog data structure
export interface Catalog {
  models: Model[];
  materials: Material[];
  basePrices: BasePrice[];
  options: Option[];
  colourPalette: PaletteColour[];
  customColor: {
    enabled: boolean;
    priceUsd: number;
    name: { en: string; ru: string };
    description: { en: string; ru: string };
    badge: { en: string; ru: string };
  };
}

// Price calculation result
export interface PriceBreakdown {
  basePrice: number;
  optionsTotal: number;
  customColorPrice: number;
  total: number;
}

// Visualization settings types
export interface GroupVisibilityMapping {
  groupName: string;
  modelId: string; // e.g., '2.9', '2.9E', '3.3', '3.3E'
  hiddenByDefault: boolean;
  linkedOptionId?: string;
}

export interface MaterialColorVariant {
  name: string;
  hex: string;
  isUserPalette?: boolean;
}

export interface MaterialColorMapping {
  materialName: string;
  variants: MaterialColorVariant[];
}

export interface GroupVisibilitySettings {
  mappings: GroupVisibilityMapping[];
}

export interface MaterialColorSettings {
  mappings: MaterialColorMapping[];
}

export interface EnvironmentDefaultSettings {
  environment: Record<string, any>;
}

