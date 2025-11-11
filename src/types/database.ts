// Database types for Supabase schema

export type UserRole = 'admin';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type ProductType = 'model' | 'material' | 'option' | 'color';

export type MarkupType = 'fixed' | 'percentage';

export type MarkupBasis = 'base' | 'cumulative';

export interface Admin {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// Legacy: Kept for backward compatibility with orders and existing data
export interface Dealer {
  id: string;
  name: string;
  email: string;
  region: string;
  region_slug: string;
  currency: string;
  tax_config: {
    type: 'auto' | 'manual';
    rate: number;
    fallback_rate?: number;
  };
  shipping_config: {
    mode: 'demo' | 'live';
    fixed_cost: number;
    api_provider?: string;
  };
  erpnext_webhook_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  admin_id: string;
  type: ProductType;
  name: string;
  description?: string;
  price_usd: number;
  price_eur?: number; // Legacy field for backward compatibility
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealerMarkup {
  id: string;
  dealer_id: string;
  order_index: number;
  name: string;
  type: MarkupType;
  value: number;
  basis: MarkupBasis;
  created_at: string;
  updated_at: string;
}

export interface DealerCatalogFilter {
  id: string;
  dealer_id: string;
  product_id: string;
  is_visible: boolean;
  created_at: string;
}

export interface DealerCustomOption {
  id: string;
  dealer_id: string;
  name: string;
  description?: string;
  price_local: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  dealer_id: string;
  user_contact: {
    name: string;
    email: string;
    phone: string;
    zip: string;
  };
  configuration: {
    model_id: string;
    model_name: string;
    material_id: string;
    material_name: string;
    color: {
      type: 'palette' | 'custom';
      value: string;
      name: string;
    };
    options: string[];
    custom_options?: string[];
    option_names: string[];
  };
  price_snapshot: {
    base_usd: number;
    material_price_usd: number;
    options_price_usd: number;
    subtotal_usd: number;
    markups: Array<{
      name: string;
      type: MarkupType;
      value: number;
      applied_amount: number;
    }>;
    subtotal_after_markups: number;
    exchange_rate: number;
    currency: string;
    subtotal_local: number;
    tax_rate: number;
    tax_amount: number;
    shipping_cost: number;
    total: number;
  };
  currency: string;
  total_amount: number;
  status: OrderStatus;
  webhook_sent_at?: string;
  webhook_status?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  message: string;
  admin_response: string | null;
  admin_response_at: string | null;
  admin_id: string | null;
  status: 'new' | 'replied' | 'closed';
}

export type VisualizationSettingsType = 'groups' | 'materials' | 'environment';

export interface VisualizationSettings {
  id: string;
  admin_id: string;
  settings_type: VisualizationSettingsType;
  settings_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

