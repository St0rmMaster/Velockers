import { z } from 'zod';
import type { ProductType } from '../types/database';

// Common validators
export const emailSchema = z.string().email('Invalid email format');
export const uuidSchema = z.string().uuid('Invalid ID format');
export const currencySchema = z.string().length(3, 'Currency must be 3-letter ISO code').transform((value) => value.toUpperCase());
export const zipCodeUSSchema = z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid US ZIP code format (12345 or 12345-6789)');

// Product schemas
export const productBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z
    .string()
    .max(2000, 'Description too long')
    .optional()
    .or(z.literal('')),
  price_usd: z
    .number({ invalid_type_error: 'Price must be a number' })
    .min(0, 'Price must be non-negative'),
  is_active: z.boolean().default(true),
});

const materialIdSchema = z.enum(['fiberglass', 'fullCarbon']);

const modelMetadataSchema = z.object({
  code: z.string().min(1, 'Укажите код модели (например, 2.9)'),
  loa: z.string().min(1, 'Укажите длину (LOA)'),
  beam: z.string().min(1, 'Укажите ширину (Beam)'),
  baseEquipment: z
    .array(z.string().min(1))
    .min(1, 'Добавьте хотя бы один элемент базовой комплектации'),
  weightsByMaterial: z.object({
    fiberglass: z.number().min(0, 'Вес должен быть неотрицательным'),
    fullCarbon: z.number().min(0, 'Вес должен быть неотрицательным'),
  }),
  basePrices: z
    .array(
      z
        .object({
          materialId: materialIdSchema,
          amountUsd: z.number().min(0, 'Цена должна быть неотрицательной').optional(),
          amountEur: z.number().min(0, 'Цена должна быть неотрицательной').optional(),
          tradePrice: z.number().min(0, 'Trade price должна быть неотрицательной').optional(),
        })
        .refine(
          (data) => typeof data.amountUsd === 'number' || typeof data.amountEur === 'number',
          { message: 'Укажите amountUsd или amountEur', path: ['amountUsd'] }
        )
    )
    .min(1, 'Добавьте хотя бы одну цену по материалу'),
});

const materialMetadataSchema = z.object({
  code: materialIdSchema,
});

const optionMetadataSchema = z.object({
  code: z.string().min(1, 'Укажите код опции'),
  features: z.array(z.string().min(1)).optional(),
});

const paletteColourMetadataSchema = z.object({
  kind: z.literal('palette'),
  code: z.string().min(1, 'Укажите код цвета'),
  name: z.object({
    en: z.string().min(1, 'Укажите название на английском'),
    ru: z.string().min(1, 'Укажите название на русском'),
  }),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Неверный HEX-код цвета'),
  isDefault: z.boolean().optional(),
});

const customColourMetadataSchema = z.object({
  kind: z.literal('custom'),
  code: z.string().min(1, 'Укажите код цвета'),
  name: z.object({
    en: z.string().min(1, 'Укажите название на английском'),
    ru: z.string().min(1, 'Укажите название на русском'),
  }),
  description: z.object({
    en: z.string().min(1, 'Добавьте описание на английском'),
    ru: z.string().min(1, 'Добавьте описание на русском'),
  }),
  badge: z.object({
    en: z.string().min(1, 'Добавьте бейдж на английском'),
    ru: z.string().min(1, 'Добавьте бейдж на русском'),
  }),
  priceUsd: z.number().min(0, 'Цена должна быть неотрицательной'),
});

const colorMetadataSchema = z.discriminatedUnion('kind', [paletteColourMetadataSchema, customColourMetadataSchema]);

export const productModelSchema = productBaseSchema.extend({
  type: z.literal('model'),
  metadata: modelMetadataSchema,
});

export const productMaterialSchema = productBaseSchema.extend({
  type: z.literal('material'),
  metadata: materialMetadataSchema,
});

export const productColorSchema = productBaseSchema
  .extend({
    type: z.literal('color'),
    metadata: colorMetadataSchema,
  });

export const productOptionSchema = productBaseSchema.extend({
  type: z.literal('option'),
  metadata: optionMetadataSchema,
});

export const productSchemas: Record<ProductType, typeof productModelSchema | typeof productMaterialSchema | typeof productColorSchema | typeof productOptionSchema> = {
  model: productModelSchema,
  material: productMaterialSchema,
  color: productColorSchema,
  option: productOptionSchema,
};

export function validateProductInput<T extends ProductType>(type: T, payload: unknown) {
  const schema = productSchemas[type];
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

// Dealer schemas
export const dealerRegistrationSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  email: emailSchema,
  password: z.string().min(12, 'Password must be at least 12 characters'),
  company: z.string().min(1, 'Company details required').max(500),
  region: z.enum(['us', 'eu', 'asia', 'custom']),
  contact_details: z.string().optional(),
});

export const regionalSettingsSchema = z.object({
  region: z.string().min(1),
  region_slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  currency: currencySchema,
  tax_config: z.object({
    type: z.enum(['auto', 'manual']),
    rate: z.number().min(0).max(1),
    fallback_rate: z.number().min(0).max(1).optional(),
  }),
  shipping_config: z.object({
    mode: z.enum(['demo', 'live']),
    fixed_cost: z.number().min(0),
    api_provider: z.string().optional(),
  }),
  erpnext_webhook_url: z.string().url('Invalid webhook URL').optional().or(z.literal('')),
});

// Markup schemas
export const markupFieldSchema = z.object({
  name: z.string().min(1, 'Markup name is required').max(100),
  type: z.enum(['fixed', 'percentage']),
  value: z.number().min(0, 'Value must be non-negative'),
  basis: z.enum(['base', 'cumulative']),
}).refine(
  (data) => {
    if (data.type === 'percentage') {
      return data.value >= 0 && data.value <= 1;
    }
    return true;
  },
  {
    message: 'Percentage value must be between 0 and 1 (e.g., 0.07 for 7%)',
    path: ['value'],
  }
);

// Custom option schema
export const customOptionSchema = z.object({
  name: z.string().min(1, 'Option name is required').max(255),
  description: z.string().max(1000).optional(),
  price_local: z.number().min(0, 'Price must be non-negative'),
});

// Order schema
export const orderSubmissionSchema = z.object({
  dealer_id: uuidSchema,
  user_contact: z.object({
    name: z.string().min(1, 'Name is required').max(255),
    email: emailSchema,
    phone: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, 'Invalid phone format'),
    zip: z.string().min(3, 'ZIP code required').max(20),
  }),
  configuration: z.object({
    model_id: uuidSchema,
    material_id: uuidSchema,
    color: z.object({
      type: z.enum(['palette', 'custom']),
      value: z.string(),
    }),
    options: z.array(uuidSchema),
    custom_options: z.array(uuidSchema).optional(),
  }),
});

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Password reset schema
export const passwordResetSchema = z.object({
  email: emailSchema,
});

// Helper function to validate and return typed errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

