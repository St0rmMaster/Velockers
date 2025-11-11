import { supabase } from '../lib/supabaseClient';
import type { Dealer, Product, ProductType } from '../types/database';
import { validateProductInput } from '../utils/validators';
import { logger } from '../utils/logger';

export interface ProductInput {
  name: string;
  description?: string;
  price_usd: number;
  is_active: boolean;
  metadata?: Record<string, any>;
}

interface FetchProductsOptions {
  type: ProductType;
}

interface ProductMutationContext {
  adminId: string;
  userId: string;
  type: ProductType;
  input: ProductInput;
}

interface ProductUpdateContext {
  productId: string;
  userId: string;
  input: ProductInput;
}

interface ProductDeleteContext {
  productId: string;
  userId: string;
  adminId?: string | null;
}

type ActivityEntity = 'product' | 'dealer';

interface ActivityEntry {
  entity: ActivityEntity;
  action: string;
  actorId: string;
  entityId?: string;
  adminId?: string | null;
  payload?: Record<string, unknown>;
}

const ACTIVITY_TABLE = 'admin_activity_log';

async function logActivity(entry: ActivityEntry) {
  try {
    await supabase.from(ACTIVITY_TABLE).insert([
      {
        entity: entry.entity,
        action: entry.action,
        actor_id: entry.actorId,
        entity_id: entry.entityId ?? null,
        admin_id: entry.adminId ?? null,
        details: entry.payload ?? {},
      },
    ]);
  } catch (error) {
    console.warn('[activity-log] Failed to persist admin activity', error);
  }
}

function normalizeProductPayload(type: ProductType, input: ProductInput) {
  const basePayload = {
    type,
    name: input.name,
    description: input.description ?? '',
    price_usd: input.price_usd,
    is_active: input.is_active,
    metadata: input.metadata ?? {},
  };

  return validateProductInput(type, basePayload);
}

export async function fetchProducts(options: FetchProductsOptions): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('type', options.type)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as Product[]) ?? [];
}

export async function createProduct(context: ProductMutationContext): Promise<Product> {
  logger.info('productService:createProduct', { action: 'start', type: context.type, input: context.input });

  try {
    const validated = normalizeProductPayload(context.type, context.input);
    logger.debug('productService:createProduct', { action: 'validated', validated });

    const payload = {
      // Ensure admin ownership matches auth.uid() for RLS policies
      admin_id: context.adminId ?? context.userId,
      type: validated.type,
      name: validated.name,
      description: validated.description ? validated.description : null,
      price_usd: validated.price_usd,
      is_active: validated.is_active,
      metadata: validated.metadata ?? {},
    };

    logger.debug('productService:createProduct', { action: 'insert_payload', payload });

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select();

    logger.debug('productService:createProduct', { action: 'insert_result', result: { data, error, dataLength: data?.length } });

    if (error) {
      logger.error('productService:createProduct', { action: 'insert_error', error, payload });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.error('productService:createProduct', { action: 'no_data_returned', data });
      throw new Error('Failed to create product');
    }

    const created = data[0] as Product;
    logger.info('productService:createProduct', { action: 'success', createdProduct: created });

    await logActivity({
      entity: 'product',
      action: 'created',
      actorId: context.userId,
      entityId: created.id,
      adminId: context.adminId,
      payload: {
        type: context.type,
        name: created.name,
      },
    });

    return created;
  } catch (error) {
    logger.error('productService:createProduct', { action: 'catch_error', error, context });
    throw error;
  }
}

export async function updateProduct(context: ProductUpdateContext): Promise<Product> {
  logger.info('productService:updateProduct', { action: 'start', productId: context.productId, input: context.input });

  try {
    const current = await supabase.from('products').select('*').eq('id', context.productId).maybeSingle();
    
    logger.debug('productService:updateProduct', { action: 'fetch_current', result: { data: current.data, error: current.error } });

    if (current.error) {
      logger.error('productService:updateProduct', { action: 'fetch_error', error: current.error });
      throw current.error;
    }

    if (!current.data) {
      logger.error('productService:updateProduct', { action: 'not_found', productId: context.productId });
      throw new Error('Product not found');
    }

    const validated = normalizeProductPayload((current.data as Product).type, context.input);
    logger.debug('productService:updateProduct', { action: 'validated', validated });

    // Clean metadata by removing undefined values to ensure deprecated fields are deleted
    const cleanMetadata = validated.metadata ? 
      Object.fromEntries(
        Object.entries(validated.metadata).filter(([_, value]) => value !== undefined)
      ) : {};

    const payload = {
      name: validated.name,
      description: validated.description ? validated.description : null,
      price_usd: validated.price_usd,
      is_active: validated.is_active,
      metadata: cleanMetadata,
      updated_at: new Date().toISOString(),
    };

    logger.debug('productService:updateProduct', { action: 'update_payload', payload });

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', context.productId)
      .select();

    logger.debug('productService:updateProduct', { action: 'update_result', result: { data, error, dataLength: data?.length } });

    if (error) {
      logger.error('productService:updateProduct', { action: 'update_error', error, payload });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.error('productService:updateProduct', { action: 'no_data_returned', data, productId: context.productId });
      throw new Error('Failed to update product');
    }

    const updated = data[0] as Product;
    logger.info('productService:updateProduct', { action: 'success', updatedProduct: updated });

    await logActivity({
      entity: 'product',
      action: 'updated',
      actorId: context.userId,
      entityId: updated.id,
      adminId: (current.data as Product).admin_id ?? null,
      payload: {
        before: current.data,
        after: updated,
      },
    });

    return updated;
  } catch (error) {
    logger.error('productService:updateProduct', { action: 'catch_error', error, context });
    throw error;
  }
}

export async function deleteProduct(context: ProductDeleteContext): Promise<void> {
  logger.info('productService:deleteProduct', { action: 'start', productId: context.productId });

  try {
    const existing = await supabase
      .from('products')
      .select('*')
      .eq('id', context.productId)
      .maybeSingle();

    logger.debug('productService:deleteProduct', { action: 'fetch_existing', result: { data: existing.data, error: existing.error } });

    if (existing.error) {
      logger.error('productService:deleteProduct', { action: 'fetch_error', error: existing.error });
      throw existing.error;
    }

    if (!existing.data) {
      logger.error('productService:deleteProduct', { action: 'not_found', productId: context.productId });
      throw new Error('Product not found');
    }

    const { error } = await supabase.from('products').delete().eq('id', context.productId);

    logger.debug('productService:deleteProduct', { action: 'delete_result', error });

    if (error) {
      logger.error('productService:deleteProduct', { action: 'delete_error', error });
      throw error;
    }

    logger.info('productService:deleteProduct', { action: 'success', productId: context.productId });

    await logActivity({
      entity: 'product',
      action: 'deleted',
      actorId: context.userId,
      entityId: context.productId,
      adminId: context.adminId ?? (existing.data as Product).admin_id ?? null,
      payload: {
        snapshot: existing.data,
      },
    });
  } catch (error) {
    logger.error('productService:deleteProduct', { action: 'catch_error', error, context });
    throw error;
  }
}

export async function fetchPendingDealers(): Promise<Dealer[]> {
  const { data, error } = await supabase
    .from('dealers')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data as Dealer[]) ?? [];
}

interface DealerDecisionContext {
  dealerId: string;
  reviewerId: string;
  status: 'approved' | 'rejected';
  reason?: string;
}

export async function approveDealer(context: Omit<DealerDecisionContext, 'status' | 'reason'>) {
  return updateDealerStatus({
    dealerId: context.dealerId,
    reviewerId: context.reviewerId,
    status: 'approved',
  });
}

export async function rejectDealer(context: Omit<DealerDecisionContext, 'status'>) {
  return updateDealerStatus({
    dealerId: context.dealerId,
    reviewerId: context.reviewerId,
    status: 'rejected',
    reason: context.reason,
  });
}

async function updateDealerStatus(context: DealerDecisionContext): Promise<Dealer> {
  const existing = await supabase.from('dealers').select('*').eq('id', context.dealerId).maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (!existing.data) {
    throw new Error('Dealer not found');
  }

  let nextSlug = existing.data.region_slug;

  if (context.status === 'approved') {
    nextSlug = await ensureUniqueRegionSlug(existing.data.region_slug, existing.data.id);
  }

  const updatePayload: Partial<Dealer> = {
    status: context.status,
    region_slug: nextSlug,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('dealers')
    .update(updatePayload)
    .eq('id', context.dealerId)
    .select();

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Failed to update dealer status');
  }

  const typedData = data[0] as Dealer;

  await logActivity({
    entity: 'dealer',
    action: context.status === 'approved' ? 'approved' : 'rejected',
    actorId: context.reviewerId,
    entityId: typedData.id,
    payload: {
      dealer: {
        name: typedData.name,
        email: typedData.email,
        region: typedData.region,
        status: typedData.status,
      },
      reason: context.reason ?? null,
    },
  });

  try {
    const { error: functionError } = await supabase.functions.invoke('send-email', {
      body: {
        template: 'dealer-status-change',
        dealerId: typedData.id,
        dealerName: typedData.name,
        dealerEmail: typedData.email,
        status: typedData.status,
        region: typedData.region,
        reason: context.reason ?? null,
      },
    });
    if (functionError) {
      throw functionError;
    }
  } catch (notificationError) {
    console.warn('[dealer-status] Failed to dispatch status email', notificationError);
  }

  return typedData;
}

async function ensureUniqueRegionSlug(currentSlug: string, dealerId: string): Promise<string> {
  const base = currentSlug.replace(/-pending$/i, '') || currentSlug;
  let candidate = base;
  let attempt = 0;

  while (true) {
    const query = supabase
      .from('dealers')
      .select('id')
      .eq('region_slug', candidate)
      .neq('id', dealerId)
      .maybeSingle();

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
}

export async function notifyManufacturerOfDealerApplication(payload: {
  dealerId: string;
  dealerName: string;
  dealerEmail: string;
  region: string;
}) {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        template: 'dealer-application',
        dealerId: payload.dealerId,
        dealerName: payload.dealerName,
        dealerEmail: payload.dealerEmail,
        region: payload.region,
      },
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('[dealer-application] Failed to notify manufacturer', error);
  }
}
