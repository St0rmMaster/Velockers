import type { Product } from '../../types/database';
import {
  ActionButtons,
  Cell,
  EmptyState,
  HeaderCell,
  StatusPill,
  type ProductListProps,
} from './ModelsList';

export function ColorsList({ items, onEdit, onDelete, loading }: ProductListProps) {
  if (!items.length) {
    return <EmptyState message="No colours defined. Add branded palette entries here." />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <HeaderCell>Colour</HeaderCell>
            <HeaderCell>Code</HeaderCell>
            <HeaderCell>Type</HeaderCell>
            <HeaderCell>Details</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {items.map((colour) => {
            const metadata = colour.metadata ?? {};
            const kind = metadata.kind === 'custom' ? 'custom' : 'palette';
            const nameEn = metadata.name?.en ?? colour.name;
            const nameRu = metadata.name?.ru;
            return (
              <tr key={colour.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <Cell>
                  <strong>{nameEn}</strong>
                  {nameRu ? <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{nameRu}</p> : null}
                </Cell>
                <Cell>
                  <code>{metadata.code || '—'}</code>
                </Cell>
                <Cell>{kind === 'custom' ? 'Custom' : 'Palette'}</Cell>
                <Cell>
                  {kind === 'palette' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid #cbd5f5',
                          background: metadata.hex ?? '#E8E8E8',
                        }}
                      />
                      <code style={{ fontSize: 13 }}>{metadata.hex ?? '#E8E8E8'}</code>
                      {metadata.isDefault ? <span style={{ fontSize: 12, color: '#2563eb' }}>Default</span> : null}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>Цена: USD {(colour.price_usd ?? colour.price_eur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
                      {metadata.badge?.en ? <span style={{ fontSize: 12, color: '#475569' }}>{metadata.badge.en}</span> : null}
                    </div>
                  )}
                </Cell>
                <Cell>
                  <StatusPill active={colour.is_active} />
                </Cell>
                <Cell align="right">
                  <ActionButtons product={colour} onEdit={onEdit} onDelete={onDelete} loading={loading} />
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
