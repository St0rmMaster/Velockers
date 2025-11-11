import type { Product } from '../../types/database';

interface CommonProps {
  items: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  loading?: boolean;
}

export function ModelsList({ items, onEdit, onDelete, loading }: CommonProps) {
  if (!items.length) {
    return <EmptyState message="No models yet. Add your first boat model to the catalog." />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <HeaderCell>Model</HeaderCell>
            <HeaderCell>Code</HeaderCell>
            <HeaderCell>LOA</HeaderCell>
            <HeaderCell>Beam</HeaderCell>
            <HeaderCell>Fiberglass USD</HeaderCell>
            <HeaderCell>Full carbon USD</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {items.map((model) => {
            const metadata = model.metadata ?? {};
            const basePrices: Array<Record<string, any>> = Array.isArray(metadata.basePrices) ? metadata.basePrices : [];
            const fiberglassPrice = basePrices.find((entry) => entry.materialId === 'fiberglass');
            const fullCarbonPrice = basePrices.find((entry) => entry.materialId === 'fullCarbon');
            const equipment: string[] = Array.isArray(metadata.baseEquipment) ? metadata.baseEquipment : [];
            return (
              <tr key={model.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <Cell>
                  <strong>{model.name}</strong>
                  {equipment.length ? (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#475569', fontSize: 13 }}>
                      {equipment.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                      {equipment.length > 3 ? <li>+ ещё {equipment.length - 3}</li> : null}
                    </ul>
                  ) : null}
                </Cell>
                <Cell>
                  <code>{metadata.code || '—'}</code>
                </Cell>
                <Cell>{metadata.loa || '—'}</Cell>
                <Cell>{metadata.beam || '—'}</Cell>
                <Cell>
                  USD {Number(fiberglassPrice?.amountUsd ?? fiberglassPrice?.amountEur ?? model.price_usd ?? model.price_eur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </Cell>
                <Cell>
                  USD {Number(fullCarbonPrice?.amountUsd ?? fullCarbonPrice?.amountEur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </Cell>
                <Cell>
                  <StatusPill active={model.is_active} />
                </Cell>
                <Cell align="right">
                  <ActionButtons product={model} onEdit={onEdit} onDelete={onDelete} loading={loading} />
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        border: '1px dashed #cbd5f5',
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '28px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '15px',
      }}
    >
      {message}
    </div>
  );
}

function HeaderCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '12px',
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#475569',
        background: '#f1f5f9',
      }}
    >
      {children}
    </th>
  );
}

function Cell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td style={{ padding: '14px 12px', verticalAlign: 'top', textAlign: align, fontSize: 14, color: '#0f172a' }}>
      {children}
    </td>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.15)',
        color: active ? '#047857' : '#475569',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {active ? 'Active' : 'Hidden'}
    </span>
  );
}

function ActionButtons({
  product,
  onEdit,
  onDelete,
  loading,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  loading?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={() => onEdit(product)}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid #cbd5f5',
          background: '#fff',
          cursor: 'pointer',
        }}
        disabled={loading}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          if (!loading && window.confirm(`Archive ${product.name}? This removes it from the catalog.`)) {
            onDelete(product);
          }
        }}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid #fca5a5',
          background: '#fee2e2',
          color: '#b91c1c',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        disabled={loading}
      >
        Delete
      </button>
    </div>
  );
}

export type { CommonProps as ProductListProps };
export { EmptyState, HeaderCell, Cell, StatusPill, ActionButtons };
