import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useAuth } from '../hooks/useAuth';
import { ProductManager } from '../components/admin/ProductManager';
import { OrdersList } from '../components/admin/OrdersList';
import { MessagesList } from '../components/admin/MessagesList';
import DevSettingsPage from './DevSettingsPage';
import App from '../App';

type TabKey = 'catalog' | 'orders' | 'messages' | 'configurator' | 'visualization';

interface TabDefinition {
  key: TabKey;
  label: string;
  description: string;
}

const tabButtonBase: CSSProperties = {
  padding: '12px 18px',
  borderRadius: '8px',
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '15px',
  color: '#475569',
  transition: 'all 0.2s ease',
};

function getTabButtonStyle(isActive: boolean): CSSProperties {
  if (isActive) {
    return {
      ...tabButtonBase,
      background: '#2563eb',
      color: '#ffffff',
      borderColor: '#2563eb',
      boxShadow: '0 8px 16px -6px rgba(37, 99, 235, 0.45)',
    };
  }

  return {
    ...tabButtonBase,
    background: '#f1f5f9',
    color: '#475569',
    borderColor: '#e2e8f0',
  };
}

export function DealerAdminPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');

  const tabs: TabDefinition[] = [
    {
      key: 'catalog',
      label: 'Catalog',
      description: 'Manage models, materials, colors, and options',
    },
    {
      key: 'orders',
      label: 'Orders',
      description: 'View and manage customer orders',
    },
    {
      key: 'messages',
      label: 'Messages',
      description: 'Customer inquiries and responses',
    },
    {
      key: 'configurator',
      label: 'Configurator',
      description: 'Configure boats and create customer quotes',
    },
    {
      key: 'visualization',
      label: 'Visualization',
      description: 'Advanced visualization and environment settings',
    },
  ];

  function renderTabContent(tab: TabKey) {
    if (tab === 'catalog') {
      return <ProductManager />;
    }

    if (tab === 'orders') {
      return (
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '24px',
          boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)',
          height: 'calc(100vh - 320px)',
          minHeight: '600px',
        }}>
          <OrdersList />
        </div>
      );
    }

    if (tab === 'messages') {
      return (
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          padding: '24px',
          boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)',
          height: 'calc(100vh - 320px)',
          minHeight: '600px',
        }}>
          <MessagesList />
        </div>
      );
    }

    if (tab === 'configurator') {
      return (
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          overflow: 'hidden',
          boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)',
          height: 'calc(100vh - 320px)',
          minHeight: '600px',
        }}>
          <App />
        </div>
      );
    }

    if (tab === 'visualization') {
      return (
        <div style={{ 
          background: '#ffffff', 
          borderRadius: '16px', 
          overflow: 'hidden',
          boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)',
        }}>
          <DevSettingsPage />
        </div>
      );
    }

    return null;
  }

  return (
    <AdminLayout title="Dealer Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <section
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(14, 165, 233, 0.1))',
            borderRadius: '20px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid rgba(37, 99, 235, 0.15)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Admin Control Panel
          </span>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 600, color: '#0f172a' }}>
            Welcome back{profile?.name ? `, ${profile.name}` : ''}.
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569' }}>
            Manage your product catalog, configure boats for customers, and fine-tune visualization settings.
          </p>
        </section>

        <div>
          <div
            role="tablist"
            aria-label="Dealer admin navigation"
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`dealer-tab-${tab.key}`}
                id={`dealer-tab-${tab.key}-trigger`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                style={getTabButtonStyle(activeTab === tab.key)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                  <span>{tab.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 400, color: activeTab === tab.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>
                    {tab.description}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`dealer-tab-${activeTab}`}
            aria-labelledby={`dealer-tab-${activeTab}-trigger`}
          >
            {renderTabContent(activeTab)}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default DealerAdminPage;

