import type { Product } from '../../types/database';
import {
  ActionButtons,
  Cell,
  EmptyState,
  HeaderCell,
  StatusPill,
  type ProductListProps,
} from './ModelsList';

export function MaterialsList({ items, onEdit, onDelete, loading }: ProductListProps) {
  if (!items.length) {
    return <EmptyState message="No materials yet. Add composite or upholstery materials here." />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <HeaderCell>Material</HeaderCell>
            <HeaderCell>Code</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {items.map((material) => {
            const metadata = material.metadata ?? {};
            return (
              <tr key={material.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <Cell>
                  <strong>{material.name}</strong>
                  {material.description && (
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{material.description}</p>
                  )}
                </Cell>
                <Cell>
                  <code>{metadata.code || '—'}</code>
                </Cell>
                <Cell>
                  <StatusPill active={material.is_active} />
                </Cell>
                <Cell align="right">
                  <ActionButtons product={material} onEdit={onEdit} onDelete={onDelete} loading={loading} />
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
