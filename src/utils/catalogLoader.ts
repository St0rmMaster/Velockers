import type { BasePrice, Catalog, Material, MaterialId, Model, Option, PaletteColour } from '../types';
import { supabase } from '../lib/supabaseClient';
import { logger } from './logger';

const CATALOG_CACHE_KEY = 'exce1sior.catalog-cache.v1';
const MATERIAL_ORDER: Record<MaterialId, number> = { fiberglass: 0, fullCarbon: 1 };

export async function loadCatalog(): Promise<Catalog> {
  const cached = loadCatalogFromCache();

  try {
    const catalog = await loadCatalogFromSupabase();

    if (!catalog) {
      if (cached) {
        logger.warn('catalog', {
          event: 'loadCatalog:use-cache',
          reason: 'supabase dataset incomplete',
        });
        return cached;
      }
      throw new Error('Catalog dataset incomplete');
    }

    persistCatalogToCache(catalog);
    logger.debug('catalog', { event: 'loadCatalog:supabase' });
    return catalog;
  } catch (error) {
    logger.error('catalog', { event: 'loadCatalog:error', error });

    if (cached) {
      logger.warn('catalog', { event: 'loadCatalog:use-cache', reason: 'supabase error' });
      return cached;
    }

    throw error instanceof Error ? error : new Error('Failed to load catalog');
  }
}

async function loadCatalogFromSupabase(): Promise<Catalog | null> {
  const [
    { data: modelRows, error: modelError },
    { data: materialRows, error: materialError },
    { data: optionRows, error: optionError },
    { data: colourRows, error: colourError },
  ] = await Promise.all([
    supabase.from('products').select('*').eq('type', 'model').eq('is_active', true),
    supabase.from('products').select('*').eq('type', 'material').eq('is_active', true),
    supabase.from('products').select('*').eq('type', 'option').eq('is_active', true),
    supabase.from('products').select('*').eq('type', 'color').eq('is_active', true),
  ]);

  if (modelError || materialError || optionError || colourError) {
    throw modelError ?? materialError ?? optionError ?? colourError ?? new Error('Failed to fetch catalog data');
  }

  if (!modelRows?.length || !materialRows?.length || !colourRows?.length) {
    return null;
  }

  const materials = buildMaterials(materialRows);
  if (!materials.length) {
    return null;
  }

  const modelResult = buildModels(modelRows, materials);
  if (!modelResult) {
    return null;
  }
  const { models, basePrices } = modelResult;

  const options = buildOptions(optionRows ?? []);
  const colourResult = buildColourData(colourRows ?? []);

  if (!colourResult.palette.length || !colourResult.customColor) {
    return null;
  }

  return {
    models,
    materials,
    basePrices,
    options,
    colourPalette: colourResult.palette,
    customColor: colourResult.customColor,
  };
}

function buildMaterials(rows: any[]): Material[] {
  const materials: Material[] = [];

  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const code = metadata.code as string | undefined;

    if (!isMaterialId(code)) {
      continue;
    }

    materials.push({
      id: code,
      name: row.name ?? code,
    });
  }

  return materials.sort((a, b) => (MATERIAL_ORDER[a.id] ?? 99) - (MATERIAL_ORDER[b.id] ?? 99));
}

function buildModels(rows: any[], materials: Material[]): { models: Model[]; basePrices: BasePrice[] } | null {
  const materialIds = new Set(materials.map((material) => material.id));
  const models: Model[] = [];
  const basePrices: BasePrice[] = [];

  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const code = metadata.code as string | undefined;
    if (!code) {
      return null;
    }

    const loa = metadata.loa as string | undefined;
    const beam = metadata.beam as string | undefined;
    const baseEquipment: string[] = Array.isArray(metadata.baseEquipment) ? metadata.baseEquipment : [];
    const weights = metadata.weightsByMaterial ?? {};

    const materialPrices: Array<{ materialId: MaterialId; amountUsd: number; tradePrice?: number }> = Array.isArray(metadata.basePrices)
      ? metadata.basePrices
          .map((entry: any) => ({
            materialId: entry.materialId as MaterialId,
            amountUsd: Number(entry.amountUsd ?? entry.amountEur ?? 0),
            tradePrice: entry.tradePrice !== undefined ? Number(entry.tradePrice) : undefined,
          }))
          .filter((entry) => materialIds.has(entry.materialId))
      : [];

    if (!loa || !beam || !materialPrices.length) {
      return null;
    }

    models.push({
      id: code,
      name: row.name ?? code,
      loa,
      beam,
      baseEquipment,
      weightsByMaterial: {
        fiberglass: Number(weights.fiberglass ?? 0),
        fullCarbon: Number(weights.fullCarbon ?? 0),
      },
    });

    for (const price of materialPrices) {
      basePrices.push({
        modelId: code,
        materialId: price.materialId,
        amountUsd: price.amountUsd,
        tradePrice: price.tradePrice,
      });
    }
  }

  return { models, basePrices };
}

function buildOptions(rows: any[]): Option[] {
  return rows.map((row) => {
    const metadata = row.metadata ?? {};
    return {
      id: metadata.code ?? row.id,
      name: row.name ?? metadata.code ?? 'Option',
      description: row.description ?? undefined,
      priceUsd: Number(row.price_usd ?? row.price_eur ?? 0),
    };
  });
}

function buildColourData(rows: any[]): { palette: PaletteColour[]; customColor: Catalog['customColor'] | null } {
  const palette: PaletteColour[] = [];
  let customColor: Catalog['customColor'] | null = null;

  for (const row of rows) {
    const metadata = row.metadata ?? {};

    if (metadata.kind === 'palette') {
      const name = metadata.name ?? {};
      palette.push({
        id: metadata.code ?? row.id,
        name: {
          en: name.en ?? row.name ?? 'Palette colour',
          ru: name.ru ?? name.en ?? row.name ?? 'Palette colour',
        },
        hex: metadata.hex ?? '#E8E8E8',
        isDefault: !!metadata.isDefault,
      });
      continue;
    }

    if (metadata.kind === 'custom') {
      // Warn if deprecated priceEur field is present
      if (metadata.priceEur !== undefined) {
        logger.warn('catalog', {
          event: 'buildColourData:deprecated_field',
          message: 'Custom color has deprecated priceEur field. Please run fix-custom-color-metadata.mjs',
          productId: row.id,
          priceEur: metadata.priceEur,
          priceUsd: metadata.priceUsd,
        });
      }

      const price = Number(metadata.priceUsd ?? metadata.priceEur ?? row.price_usd ?? row.price_eur ?? 0);
      
      logger.info('catalog', { 
        event: 'buildColourData:custom_color', 
        row: {
          id: row.id,
          name: row.name,
          price_eur: row.price_eur,
          price_usd: row.price_usd,
        },
        metadata: {
          priceEur: metadata.priceEur,
          priceUsd: metadata.priceUsd,
        },
        finalPrice: price
      });
      
      customColor = {
        enabled: !!row.is_active,
        priceUsd: price,
        name: metadata.name ?? {
          en: row.name ?? 'Custom colour',
          ru: row.name ?? 'Custom colour',
        },
        description:
          metadata.description ?? {
            en: row.description ?? 'Choose any colour',
            ru: row.description ?? 'Choose any colour',
          },
        badge: metadata.badge ?? { en: '', ru: '' },
      };
    }
  }

  return { palette, customColor };
}

function isMaterialId(value: unknown): value is MaterialId {
  return value === 'fiberglass' || value === 'fullCarbon';
}

export function getBasePrice(catalog: Catalog, modelId: string, materialId: MaterialId): number | undefined {
  const priceEntry = catalog.basePrices.find((price) => price.modelId === modelId && price.materialId === materialId);
  return priceEntry?.tradePrice ?? priceEntry?.amountUsd;
}

export function getOption(catalog: Catalog, optionId: string): Option | undefined {
  return catalog.options.find((option) => option.id === optionId);
}

export function getPaletteColour(catalog: Catalog, colourId: string): PaletteColour | undefined {
  return catalog.colourPalette.find((paletteColour) => paletteColour.id === colourId);
}

function persistCatalogToCache(catalog: Catalog) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const payload = {
      catalog,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    logger.warn('catalog', { event: 'cache:write-error', error });
  }
}

export function clearCatalogCache() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(CATALOG_CACHE_KEY);
    logger.info('catalog', { event: 'cache:cleared' });
  } catch (error) {
    logger.warn('catalog', { event: 'cache:clear-error', error });
  }
}

function loadCatalogFromCache(): Catalog | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const payload = JSON.parse(raw);
    if (payload?.catalog) {
      return payload.catalog as Catalog;
    }
    return null;
  } catch (error) {
    logger.warn('catalog', { event: 'cache:read-error', error });
    try {
      window.localStorage.removeItem(CATALOG_CACHE_KEY);
    } catch (removeError) {
      logger.warn('catalog', { event: 'cache:clear-error', error: removeError });
    }
    return null;
  }
}
