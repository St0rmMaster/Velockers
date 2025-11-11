import type { Dealer } from '../../types/database';

interface DealerApprovalListProps {
  dealers: Dealer[];
  loading?: boolean;
  onApprove: (dealerId: string) => void;
  onReject: (dealerId: string, reason?: string) => void;
  onRefresh?: () => void;
}

export function DealerApprovalList({ dealers, loading, onApprove, onReject, onRefresh }: DealerApprovalListProps) {
  if (!dealers.length) {
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
        No pending dealer applications. You're up to date.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <HeaderCell>Name</HeaderCell>
            <HeaderCell>Region</HeaderCell>
            <HeaderCell>Email</HeaderCell>
            <HeaderCell>Submitted</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell align="right">Actions</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {dealers.map((dealer) => (
            <tr key={dealer.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <Cell>
                <strong>{dealer.name}</strong>
              </Cell>
              <Cell>{dealer.region.toUpperCase()}</Cell>
              <Cell>
                <a href={`mailto:${dealer.email}`} style={{ color: '#2563eb' }}>
                  {dealer.email}
                </a>
              </Cell>
              <Cell>{formatTimestamp(dealer.created_at)}</Cell>
              <Cell>
                <StatusPill status={dealer.status} />
              </Cell>
              <Cell align="right">
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (loading) return;
                      const confirmApprove = window.confirm(`Approve ${dealer.name}? They will gain access immediately.`);
                      if (confirmApprove) {
                        onApprove(dealer.id);
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #16a34a',
                      background: '#dcfce7',
                      color: '#166534',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    disabled={loading}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (loading) return;
                      const reason = window.prompt(`Reject ${dealer.name}? Optionally note a reason:`);
                      const confirmReject = window.confirm('Confirm rejection? Dealer will be notified.');
                      if (confirmReject) {
                        onReject(dealer.id, reason ?? undefined);
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
                    Reject
                  </button>
                </div>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>

      {onRefresh && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => onRefresh()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5f5',
              background: '#fff',
              color: '#2563eb',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      )}
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

function StatusPill({ status }: { status: Dealer['status'] }) {
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        background: isPending
          ? 'rgba(250, 204, 21, 0.18)'
          : isApproved
          ? 'rgba(34, 197, 94, 0.18)'
          : 'rgba(244, 63, 94, 0.18)',
        color: isPending ? '#a16207' : isApproved ? '#15803d' : '#991b1b',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status.toUpperCase()}
    </span>
  );
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
