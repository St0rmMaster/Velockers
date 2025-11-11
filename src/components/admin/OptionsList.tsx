import {
  ActionButtons,
  Cell,
  EmptyState,
  HeaderCell,
  StatusPill,
  type ProductListProps,
} from './ModelsList';

export function OptionsList({ items, onEdit, onDelete, loading }: ProductListProps) {
  if (!items.length) {
    return <EmptyState message="No options yet. Add extras such as electronics or comfort packages." />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <HeaderCell>Option</HeaderCell>
            <HeaderCell>Code</HeaderCell>
            <HeaderCell>Price (USD)</HeaderCell>
            <HeaderCell>Highlights</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {items.map((option) => {
            const metadata = option.metadata ?? {};
            const features: string[] = Array.isArray(metadata.features) ? metadata.features : [];
            return (
              <tr key={option.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <Cell>
                  <strong>{option.name}</strong>
                  {option.description && (
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{option.description}</p>
                  )}
                </Cell>
                <Cell>
                  <code>{metadata.code || '—'}</code>
                </Cell>
                <Cell>USD {(option.price_usd ?? option.price_eur ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</Cell>
                <Cell>
                  {features.length ? (
                    <ul style={{ paddingLeft: 18, margin: 0, color: '#475569' }}>
                      {features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </Cell>
                <Cell>
                  <StatusPill active={option.is_active} />
                </Cell>
                <Cell align="right">
                  <ActionButtons product={option} onEdit={onEdit} onDelete={onDelete} loading={loading} />
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
