import { useForm } from 'react-hook-form';
import type { Product, ProductType } from '../../types/database';

export interface FormattedProductInput {
  name: string;
  description?: string;
  price_usd: number;
  is_active: boolean;
  metadata: Record<string, any>;
}

interface ProductFormProps {
  type: ProductType;
  initialProduct?: Product | null;
  onSubmit: (input: FormattedProductInput) => Promise<void> | void;
  onCancel: () => void;
  loading?: boolean;
}

export function ProductForm(props: ProductFormProps) {
  const { type } = props;
  switch (type) {
    case 'model':
      return <ModelProductForm {...props} />;
    case 'material':
      return <MaterialProductForm {...props} />;
    case 'option':
      return <OptionProductForm {...props} />;
    case 'color':
      return <ColourProductForm {...props} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {title ? <h3 style={{ margin: '12px 0 0', fontSize: 18 }}>{title}</h3> : null}
      {children}
    </section>
  );
}

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <span style={{ color: '#dc2626', fontSize: 13 }}>{message}</span>;
}

function FormActions({ onCancel, loading }: { onCancel: () => void; loading?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '10px 18px',
          borderRadius: 10,
          border: '1px solid #cbd5f5',
          background: '#fff',
          cursor: 'pointer',
        }}
        disabled={loading}
      >
        Cancel
      </button>
      <button
        type="submit"
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
        disabled={loading}
      >
        Save
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: 8,
  border: '1px solid #cbd5f5',
  fontSize: 15,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  fontFamily: 'inherit',
};

// ---------------------------------------------------------------------------
// Model form
// ---------------------------------------------------------------------------

interface ModelFormValues {
  code: string;
  name: string;
  description: string;
  loa: string;
  beam: string;
  baseEquipment: string;
  weightFiberglass: number;
  weightFullCarbon: number;
  tradePriceFiberglass: number;
  tradePriceFullCarbon: number;
  is_active: boolean;
}

function ModelProductForm({ initialProduct, onSubmit, onCancel, loading }: ProductFormProps) {
  const metadata = (initialProduct?.metadata ?? {}) as Record<string, any>;
  const basePrices: Array<Record<string, any>> = Array.isArray(metadata.basePrices) ? metadata.basePrices : [];

  const defaults: ModelFormValues = {
    code: metadata.code ?? '',
    name: initialProduct?.name ?? '',
    description: initialProduct?.description ?? '',
    loa: metadata.loa ?? '',
    beam: metadata.beam ?? '',
    baseEquipment: Array.isArray(metadata.baseEquipment) ? metadata.baseEquipment.join('\n') : '',
    weightFiberglass: Number(metadata.weightsByMaterial?.fiberglass ?? 0),
    weightFullCarbon: Number(metadata.weightsByMaterial?.fullCarbon ?? 0),
    tradePriceFiberglass: Number(basePrices.find((entry) => entry.materialId === 'fiberglass')?.tradePrice ?? initialProduct?.price_usd ?? initialProduct?.price_eur ?? 0),
    tradePriceFullCarbon: Number(basePrices.find((entry) => entry.materialId === 'fullCarbon')?.tradePrice ?? 0),
    is_active: initialProduct?.is_active ?? true,
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ModelFormValues>({ defaultValues: defaults });

  const submit = handleSubmit(async (values) => {
    const baseEquipment = values.baseEquipment
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length);

    const tradePriceFiberglass = Number.isFinite(values.tradePriceFiberglass) ? values.tradePriceFiberglass : 0;
    const tradePriceFullCarbon = Number.isFinite(values.tradePriceFullCarbon) ? values.tradePriceFullCarbon : 0;

    const payload: FormattedProductInput = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      price_usd: tradePriceFiberglass,
      is_active: values.is_active,
      metadata: {
        code: values.code.trim(),
        loa: values.loa.trim(),
        beam: values.beam.trim(),
        baseEquipment,
        weightsByMaterial: {
          fiberglass: Number.isFinite(values.weightFiberglass) ? values.weightFiberglass : 0,
          fullCarbon: Number.isFinite(values.weightFullCarbon) ? values.weightFullCarbon : 0,
        },
        basePrices: [
          {
            materialId: 'fiberglass',
            amountUsd: tradePriceFiberglass,
            tradePrice: tradePriceFiberglass,
          },
          {
            materialId: 'fullCarbon',
            amountUsd: tradePriceFullCarbon,
            tradePrice: tradePriceFullCarbon,
          },
        ],
      },
    };

    await onSubmit(payload);
  });

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormSection>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Model code">
            <input
              type="text"
              {...register('code', { required: 'Specify the model code (e.g. 2.9)' })}
              disabled={loading}
              style={inputStyle}
              placeholder="2.9"
            />
            <ErrorText message={errors.code?.message} />
          </FieldWrapper>
          <FieldWrapper label="Name">
            <input
              type="text"
              {...register('name', { required: 'Enter the display name' })}
              disabled={loading}
              style={inputStyle}
              placeholder="Exce1sior 2.9"
            />
            <ErrorText message={errors.name?.message} />
          </FieldWrapper>
        </div>
        <FieldWrapper label="Description (optional)">
          <textarea
            rows={3}
            {...register('description')}
            disabled={loading}
            style={textareaStyle}
            placeholder="Short marketing description"
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Dimensions">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Length (LOA)">
            <input
              type="text"
              {...register('loa', { required: 'Specify LOA' })}
              disabled={loading}
              style={inputStyle}
              placeholder="2.9 m"
            />
            <ErrorText message={errors.loa?.message} />
          </FieldWrapper>
          <FieldWrapper label="Beam width">
            <input
              type="text"
              {...register('beam', { required: 'Specify beam width' })}
              disabled={loading}
              style={inputStyle}
              placeholder="1.60 m"
            />
            <ErrorText message={errors.beam?.message} />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Base equipment">
        <FieldWrapper label="List (one item per line)">
          <textarea
            rows={6}
            {...register('baseEquipment', { required: 'Add at least one equipment item' })}
            disabled={loading}
            style={textareaStyle}
            placeholder="Locker set&#10;Anti-slip deck&#10;Removable bumper"
          />
          <ErrorText message={errors.baseEquipment?.message} />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Weight by material (kg)">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Fiberglass">
            <input
              type="number"
              step="0.1"
              {...register('weightFiberglass', {
                required: 'Enter weight for fiberglass layup',
                valueAsNumber: true,
                validate: (value) => (Number.isFinite(value) && value >= 0) || 'Weight must be non-negative',
              })}
              disabled={loading}
              style={inputStyle}
            />
            <ErrorText message={errors.weightFiberglass?.message} />
          </FieldWrapper>
          <FieldWrapper label="Full carbon">
            <input
              type="number"
              step="0.1"
              {...register('weightFullCarbon', {
                required: 'Enter weight for full carbon layup',
                valueAsNumber: true,
                validate: (value) => (Number.isFinite(value) && value >= 0) || 'Weight must be non-negative',
              })}
              disabled={loading}
              style={inputStyle}
            />
            <ErrorText message={errors.weightFullCarbon?.message} />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Prices (USD)">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Fiberglass price">
            <input
              type="number"
              step="1"
              {...register('tradePriceFiberglass', {
                required: 'Enter price for fiberglass',
                valueAsNumber: true,
                validate: (value) => (Number.isFinite(value) && value >= 0) || 'Price must be non-negative',
              })}
              disabled={loading}
              style={inputStyle}
            />
            <ErrorText message={errors.tradePriceFiberglass?.message} />
          </FieldWrapper>
          <FieldWrapper label="Full carbon price">
            <input
              type="number"
              step="1"
              {...register('tradePriceFullCarbon', {
                required: 'Enter price for full carbon',
                valueAsNumber: true,
                validate: (value) => (Number.isFinite(value) && value >= 0) || 'Price must be non-negative',
              })}
              disabled={loading}
              style={inputStyle}
            />
            <ErrorText message={errors.tradePriceFullCarbon?.message} />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" {...register('is_active')} disabled={loading} />
          <span>Visible in configurator</span>
        </label>
      </FormSection>

      <FormActions onCancel={onCancel} loading={loading} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Material form
// ---------------------------------------------------------------------------

interface MaterialFormValues {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

function MaterialProductForm({ initialProduct, onSubmit, onCancel, loading }: ProductFormProps) {
  const metadata = (initialProduct?.metadata ?? {}) as Record<string, any>;
  const defaults: MaterialFormValues = {
    code: metadata.code ?? '',
    name: initialProduct?.name ?? '',
    description: initialProduct?.description ?? '',
    is_active: initialProduct?.is_active ?? true,
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaterialFormValues>({ defaultValues: defaults });

  const submit = handleSubmit(async (values) => {
    const payload: FormattedProductInput = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      price_usd: 0,
      is_active: values.is_active,
      metadata: {
        code: values.code.trim(),
      },
    };
    await onSubmit(payload);
  });

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormSection>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Material code">
            <input
              type="text"
              {...register('code', { required: 'Specify material code (e.g. fiberglass)' })}
              disabled={loading}
              style={inputStyle}
              placeholder="fiberglass"
            />
            <ErrorText message={errors.code?.message} />
          </FieldWrapper>
          <FieldWrapper label="Name">
            <input
              type="text"
              {...register('name', { required: 'Enter material name' })}
              disabled={loading}
              style={inputStyle}
              placeholder="Fiberglass"
            />
            <ErrorText message={errors.name?.message} />
          </FieldWrapper>
        </div>
        <FieldWrapper label="Description (optional)">
          <textarea
            rows={3}
            {...register('description')}
            disabled={loading}
            style={textareaStyle}
            placeholder="Short description of material properties"
          />
        </FieldWrapper>
      </FormSection>

      <FormSection>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" {...register('is_active')} disabled={loading} />
          <span>Available in configurator</span>
        </label>
      </FormSection>

      <FormActions onCancel={onCancel} loading={loading} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Option form
// ---------------------------------------------------------------------------

interface OptionFormValues {
  code: string;
  name: string;
  description: string;
  price_usd: number;
  features: string;
  is_active: boolean;
}

function OptionProductForm({ initialProduct, onSubmit, onCancel, loading }: ProductFormProps) {
  const metadata = (initialProduct?.metadata ?? {}) as Record<string, any>;
  const defaults: OptionFormValues = {
    code: metadata.code ?? '',
    name: initialProduct?.name ?? '',
    description: initialProduct?.description ?? '',
    price_usd: Number(initialProduct?.price_usd ?? initialProduct?.price_eur ?? 0),
    features: Array.isArray(metadata.features) ? metadata.features.join('\n') : '',
    is_active: initialProduct?.is_active ?? true,
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OptionFormValues>({ defaultValues: defaults });

  const submit = handleSubmit(async (values) => {
    const features = values.features
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length);

    const payload: FormattedProductInput = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      price_usd: Number.isFinite(values.price_usd) ? values.price_usd : 0,
      is_active: values.is_active,
      metadata: {
        code: values.code.trim(),
        ...(features.length ? { features } : {}),
      },
    };

    await onSubmit(payload);
  });

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormSection>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Option code">
            <input
              type="text"
              {...register('code', { required: 'Specify option code' })}
              disabled={loading}
              style={inputStyle}
              placeholder="soft-deck"
            />
            <ErrorText message={errors.code?.message} />
          </FieldWrapper>
          <FieldWrapper label="Name">
            <input
              type="text"
              {...register('name', { required: 'Enter option name' })}
              disabled={loading}
              style={inputStyle}
              placeholder="Soft deck"
            />
            <ErrorText message={errors.name?.message} />
          </FieldWrapper>
        </div>
        <FieldWrapper label="Description (optional)">
          <textarea
            rows={3}
            {...register('description')}
            disabled={loading}
            style={textareaStyle}
            placeholder="Short description for sales team"
          />
        </FieldWrapper>
      </FormSection>

      <FormSection title="Price & highlights">
        <FieldWrapper label="Price (USD)">
          <input
            type="number"
            step="1"
            {...register('price_usd', {
              required: 'Enter price',
              valueAsNumber: true,
              validate: (value) => (Number.isFinite(value) && value >= 0) || 'Price must be non-negative',
            })}
            disabled={loading}
            style={inputStyle}
          />
          <ErrorText message={errors.price_usd?.message} />
        </FieldWrapper>
        <FieldWrapper label="Highlights (one per line, optional)">
          <textarea
            rows={4}
            {...register('features')}
            disabled={loading}
            style={textareaStyle}
            placeholder="Feature 1&#10;Feature 2"
          />
        </FieldWrapper>
      </FormSection>

      <FormSection>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" {...register('is_active')} disabled={loading} />
          <span>Visible in configurator</span>
        </label>
      </FormSection>

      <FormActions onCancel={onCancel} loading={loading} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Colour form
// ---------------------------------------------------------------------------

type ColourKind = 'palette' | 'custom';

interface ColourFormValues {
  kind: ColourKind;
  code: string;
  nameEn: string;
  nameRu: string;
  hex: string;
  isDefault: boolean;
  priceUsd: number;
  descriptionEn: string;
  descriptionRu: string;
  badgeEn: string;
  badgeRu: string;
  is_active: boolean;
}

function ColourProductForm({ initialProduct, onSubmit, onCancel, loading }: ProductFormProps) {
  const metadata = (initialProduct?.metadata ?? {}) as Record<string, any>;
  const kind: ColourKind = metadata.kind === 'custom' ? 'custom' : 'palette';

  const defaults: ColourFormValues = {
    kind,
    code: metadata.code ?? '',
    nameEn: metadata.name?.en ?? initialProduct?.name ?? '',
    nameRu: metadata.name?.ru ?? '',
    hex: kind === 'palette' ? metadata.hex ?? '#E8E8E8' : '#E8E8E8',
    isDefault: metadata.isDefault ?? false,
    priceUsd: kind === 'custom' ? Number(metadata.priceUsd ?? metadata.priceEur ?? initialProduct?.price_usd ?? initialProduct?.price_eur ?? 0) : 0,
    descriptionEn: metadata.description?.en ?? initialProduct?.description ?? '',
    descriptionRu: metadata.description?.ru ?? '',
    badgeEn: metadata.badge?.en ?? '',
    badgeRu: metadata.badge?.ru ?? '',
    is_active: initialProduct?.is_active ?? true,
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ColourFormValues>({ defaultValues: defaults });

  const currentKind = watch('kind');

  const submit = handleSubmit(async (values) => {
    const code = values.code.trim();
    const nameEn = values.nameEn.trim();
    const nameRu = values.nameRu.trim();

    if (values.kind === 'palette') {
      const payload: FormattedProductInput = {
        name: nameEn,
        description: nameRu ? `RU: ${nameRu}` : undefined,
        price_usd: 0,
        is_active: values.is_active,
        metadata: {
          kind: 'palette',
          code,
          name: { en: nameEn, ru: nameRu || nameEn },
          hex: values.hex || '#E8E8E8',
          isDefault: values.isDefault,
        },
      };
      await onSubmit(payload);
      return;
    }

    const price = Number.isFinite(values.priceUsd) ? values.priceUsd : 0;
    
    // Build clean metadata without deprecated fields
    const cleanMetadata: Record<string, any> = {
      kind: 'custom',
      code,
      name: { en: nameEn, ru: nameRu || nameEn },
      description: {
        en: values.descriptionEn.trim() || nameEn,
        ru: values.descriptionRu.trim() || nameRu || nameEn,
      },
      badge: {
        en: values.badgeEn.trim() || '',
        ru: values.badgeRu.trim() || '',
      },
      priceUsd: price,
    };
    
    const payload: FormattedProductInput = {
      name: nameEn,
      description: values.descriptionEn.trim() || undefined,
      price_usd: price,
      is_active: values.is_active,
      metadata: cleanMetadata,
    };
    await onSubmit(payload);
  });

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FormSection>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Colour type">
            <select {...register('kind')} disabled={loading} style={inputStyle}>
              <option value="palette">Palette</option>
              <option value="custom">Custom colour</option>
            </select>
          </FieldWrapper>
          <FieldWrapper label="Colour code">
            <input
              type="text"
              {...register('code', { required: 'Specify colour code' })}
              disabled={loading}
              style={inputStyle}
              placeholder="white-grey"
            />
            <ErrorText message={errors.code?.message} />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Localized name">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <FieldWrapper label="Name (EN)">
            <input
              type="text"
              {...register('nameEn', { required: 'Enter English name' })}
              disabled={loading}
              style={inputStyle}
              placeholder="Navy Blue"
            />
            <ErrorText message={errors.nameEn?.message} />
          </FieldWrapper>
          <FieldWrapper label="Name (RU)">
            <input type="text" {...register('nameRu')} disabled={loading} style={inputStyle} placeholder="Dark blue (RU)" />
          </FieldWrapper>
        </div>
      </FormSection>

      {currentKind === 'palette' ? (
        <FormSection title="Palette settings">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <FieldWrapper label="HEX">
              <input
                type="color"
                {...register('hex', {
                  required: 'Select HEX colour',
                  validate: (value) => /^#[0-9A-Fa-f]{6}$/.test(value) || 'Provide HEX value, e.g. #E8E8E8',
                })}
                disabled={loading}
                style={{ ...inputStyle, padding: 0, height: 48 }}
              />
              <ErrorText message={errors.hex?.message} />
            </FieldWrapper>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" {...register('isDefault')} disabled={loading} />
              <span>Set as default palette colour</span>
            </label>
          </div>
        </FormSection>
      ) : (
        <FormSection title="Custom colour settings">
          <FieldWrapper label="Price (USD)">
            <input
              type="number"
              step="10"
              {...register('priceUsd', {
                valueAsNumber: true,
                required: 'Enter custom colour price',
                validate: (value) => (Number.isFinite(value) && value >= 0) || 'Price must be non-negative',
              })}
              disabled={loading}
              style={inputStyle}
            />
            <ErrorText message={errors.priceUsd?.message} />
          </FieldWrapper>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FieldWrapper label="Description (EN)">
              <textarea
                rows={3}
                {...register('descriptionEn', { required: 'Add description in English' })}
                disabled={loading}
                style={textareaStyle}
              />
              <ErrorText message={errors.descriptionEn?.message} />
            </FieldWrapper>
            <FieldWrapper label="Description (RU)">
              <textarea rows={3} {...register('descriptionRu')} disabled={loading} style={textareaStyle} />
            </FieldWrapper>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <FieldWrapper label="Badge (EN)">
              <input type="text" {...register('badgeEn')} disabled={loading} style={inputStyle} />
            </FieldWrapper>
            <FieldWrapper label="Badge (RU)">
              <input type="text" {...register('badgeRu')} disabled={loading} style={inputStyle} />
            </FieldWrapper>
          </div>
        </FormSection>
      )}

      <FormSection>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" {...register('is_active')} disabled={loading} />
          <span>Visible in configurator</span>
        </label>
      </FormSection>

      <FormActions onCancel={onCancel} loading={loading} />
    </form>
  );
}
