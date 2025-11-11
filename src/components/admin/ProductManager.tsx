import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductType } from '../../types/database';
import { useAuth } from '../../hooks/useAuth';
import { ProductForm, type FormattedProductInput } from './ProductForm';
import { ModelsList, type ProductListProps } from './ModelsList';
import { MaterialsList } from './MaterialsList';
import { OptionsList } from './OptionsList';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from '../../services/productService';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../utils/logger';
import { clearCatalogCache } from '../../utils/catalogLoader';

type FormMode = 'create' | 'edit';

interface TypeConfig {
  label: string;
  description: string;
  helper: string;
}

const typeConfig: Record<ProductType, TypeConfig> = {
  model: {
    label: 'Models',
    description: 'Boat hull configurations with base USD pricing.',
    helper: 'Define base Exce1sior models that dealers can sell.',
  },
  material: {
    label: 'Materials',
    description: 'Upholstery, carbon upgrades, performance packages.',
    helper: 'Add material modifiers with USD price impact.',
  },
  color: {
    label: 'Colours (Deprecated)',
    description: 'No longer used - hull colors are now built into models.',
    helper: 'Colors are managed directly in the 3D configurator.',
  },
  option: {
    label: 'Options',
    description: 'Accessories, electronics and comfort upgrades.',
    helper: 'Options include USD price and marketing highlights.',
  },
};

const listComponentMap: Record<ProductType, (props: ProductListProps) => JSX.Element> = {
  model: (props) => <ModelsList {...props} />,
  material: (props) => <MaterialsList {...props} />,
  color: (props) => <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
    <p>Color management has been deprecated.</p>
    <p>Hull colors (White/Grey) are now built into the models.</p>
  </div>,
  option: (props) => <OptionsList {...props} />,
};

export function ProductManager() {
  const { profile, user } = useAuth();
  const adminId = profile?.id ?? null;

  const [activeType, setActiveType] = useState<ProductType>('model');
  const [products, setProducts] = useState<Product[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentConfig = useMemo(() => typeConfig[activeType], [activeType]);
  const ListComponent = listComponentMap[activeType];

  const loadProducts = useCallback(
    async (type: ProductType) => {
      setListLoading(true);
      setError(null);
      try {
        const data = await fetchProducts({ type });
        setProducts(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load products');
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadProducts(activeType);
  }, [activeType, loadProducts]);

  useEffect(() => {
    const channel = supabase
      .channel(`products-${activeType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `type=eq.${activeType}`,
        },
        () => {
          void loadProducts(activeType);
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeType, loadProducts]);

  function handleCreateClick() {
    setFormMode('create');
    setSelectedProduct(null);
    setFormOpen(true);
    setMessage(null);
    setError(null);
  }

  function handleEdit(product: Product) {
    setFormMode('edit');
    setSelectedProduct(product);
    setFormOpen(true);
    setMessage(null);
    setError(null);
  }

  async function handleDelete(product: Product) {
    if (!user) {
      setError('User session expired. Please sign in again.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await deleteProduct({
        productId: product.id,
        userId: user.id,
        adminId,
      });
      await loadProducts(activeType);
      // Clear catalog cache to reflect deletion in configurator
      clearCatalogCache();
      logger.info('ProductManager:handleDelete', { action: 'cache_cleared' });
      setMessage(`${product.name} removed from catalog.`);
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFormSubmit(input: FormattedProductInput) {
    logger.info('ProductManager:handleFormSubmit', { 
      action: 'start', 
      formMode, 
      selectedProduct: selectedProduct?.id, 
      input,
      userId: user?.id,
      adminId
    });

    if (!user) {
      logger.error('ProductManager:handleFormSubmit', { action: 'no_user' });
      setError('User session is missing. Please sign in again.');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      if (formMode === 'edit' && selectedProduct) {
        logger.info('ProductManager:handleFormSubmit', { 
          action: 'updating', 
          productId: selectedProduct.id,
          input 
        });
        await updateProduct({
          productId: selectedProduct.id,
          userId: user.id,
          input,
        });
        logger.info('ProductManager:handleFormSubmit', { action: 'update_success' });
        setMessage('Product updated successfully.');
        // Clear catalog cache to reflect changes in configurator
        clearCatalogCache();
        logger.info('ProductManager:handleFormSubmit', { action: 'cache_cleared' });
      } else {
        logger.info('ProductManager:handleFormSubmit', { 
          action: 'creating', 
          type: activeType,
          input 
        });
        await createProduct({
          adminId,
          userId: user.id,
          type: activeType,
          input,
        });
        logger.info('ProductManager:handleFormSubmit', { action: 'create_success' });
        setMessage('Product added to the catalog.');
        // Clear catalog cache to reflect changes in configurator
        clearCatalogCache();
        logger.info('ProductManager:handleFormSubmit', { action: 'cache_cleared' });
      }
      setFormOpen(false);
      await loadProducts(activeType);
    } catch (err: any) {
      logger.error('ProductManager:handleFormSubmit', { 
        action: 'error', 
        error: err,
        errorMessage: err?.message,
        formMode,
        selectedProduct: selectedProduct?.id
      });
      setError(err.message || 'Failed to save product');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
          borderRadius: 16,
          padding: '20px 24px',
          boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '22px' }}>{currentConfig.label}</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b' }}>{currentConfig.description}</p>
        </div>
        <button
          type="button"
          onClick={handleCreateClick}
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          disabled={actionLoading}
        >
          Add {currentConfig.label.slice(0, -1)}
        </button>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#fff',
          borderRadius: 16,
          padding: '12px',
          boxShadow: '0 8px 20px -18px rgba(15, 23, 42, 0.4)',
        }}
      >
        {(Object.keys(typeConfig) as ProductType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: activeType === type ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: activeType === type ? 'rgba(37, 99, 235, 0.12)' : '#fff',
              color: activeType === type ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            disabled={listLoading && activeType !== type}
          >
            {typeConfig[type].label}
          </button>
        ))}
      </nav>

      <section
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 20px 40px -28px rgba(15, 23, 42, 0.45)',
        }}
      >
        <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{currentConfig.helper}</p>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#166534',
            }}
          >
            {message}
          </div>
        )}

        {formOpen ? (
          <ProductForm
            type={activeType}
            initialProduct={formMode === 'edit' ? selectedProduct : null}
            onSubmit={(input) => handleFormSubmit(input)}
            onCancel={() => {
              setFormOpen(false);
              setSelectedProduct(null);
            }}
            loading={actionLoading}
          />
        ) : listLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569' }}>Loading {currentConfig.label}...</div>
        ) : (
          <ListComponent items={products} onEdit={handleEdit} onDelete={handleDelete} loading={actionLoading} />
        )}
      </section>
    </div>
  );
}
