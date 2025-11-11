import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../utils/logger';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user, role, profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: '#1a1a1a',
        color: 'white',
        padding: '15px 30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px' }}>
            Exce1sior Admin
            <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '12px', fontWeight: 'normal' }}>
              v{new Date().toISOString().slice(0, 19).replace('T', ' ')}
            </span>
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>{title}</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => logger.downloadLogs()}
            style={{
              padding: '6px 12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            title="Download application logs"
          >
            📥 Download Logs
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all logs?')) {
                logger.clearLogs();
                alert('Logs cleared!');
              }
            }}
            style={{
              padding: '6px 12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
            title="Clear all logs"
          >
            🗑️ Clear
          </button>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>{profile?.name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
              Administrator
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '30px', background: '#f5f5f5' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        background: '#1a1a1a',
        color: '#666',
        padding: '15px 30px',
        textAlign: 'center',
        fontSize: '14px',
      }}>
        Exce1sior Configurator Admin Panel © 2025
      </footer>
    </div>
  );
}

