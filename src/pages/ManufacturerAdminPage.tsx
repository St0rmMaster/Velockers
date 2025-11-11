import { useMemo, useState, useCallback, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useAuth } from '../hooks/useAuth';
import { ProductManager } from '../components/admin/ProductManager';
import type { Dealer } from '../types/database';
import { DealerApprovalList } from '../components/admin/DealerApprovalList';
import { approveDealer, fetchPendingDealers, rejectDealer } from '../services/productService';
import { OrdersList } from '../components/admin/OrdersList';
import { MessagesList } from '../components/admin/MessagesList';

type TabKey = 'catalog' | 'approvals' | 'orders' | 'messages' | 'activity';

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

export function ManufacturerAdminPage() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [dealerLoading, setDealerLoading] = useState(false);
  const [dealerActionLoading, setDealerActionLoading] = useState(false);
  const [dealerError, setDealerError] = useState<string | null>(null);
  const [dealerMessage, setDealerMessage] = useState<string | null>(null);
  const [pendingDealers, setPendingDealers] = useState<Dealer[]>([]);

  const tabs = useMemo<TabDefinition[]>(
    () => [
      {
        key: 'catalog',
        label: 'Каталог',
        description: 'Управление моделями, материалами, цветами и опциями.',
      },
      {
        key: 'approvals',
        label: 'Одобрение дилеров',
        description: 'Проверка заявок дилеров и управление доступом.',
      },
      {
        key: 'orders',
        label: 'Заказы',
        description: 'Просмотр и управление заказами с сайта.',
      },
      {
        key: 'messages',
        label: 'Сообщения',
        description: 'Вопросы клиентов и ответы на них.',
      },
      {
        key: 'activity',
        label: 'Лог активности',
        description: 'Аудит изменений каталога и одобрений.',
      },
    ],
    []
  );

  const loadPendingDealers = useCallback(async () => {
    setDealerLoading(true);
    setDealerError(null);
    setDealerMessage(null);
    try {
      const result = await fetchPendingDealers();
      setPendingDealers(result);
    } catch (err: any) {
      setDealerError(err.message || 'Не удалось загрузить заявки дилеров');
    } finally {
      setDealerLoading(false);
    }
  }, [user]); // Added user dependency

  useEffect(() => {
    if (activeTab === 'approvals') {
      void loadPendingDealers();
    }
  }, [activeTab, loadPendingDealers]);

  async function handleApproveDealer(dealerId: string) {
    if (!user) {
      setDealerError('Сессия истекла. Войдите снова.');
      return;
    }
    setDealerActionLoading(true);
    setDealerError(null);
    try {
      await approveDealer({ dealerId, reviewerId: user.id });
      await loadPendingDealers();
      setDealerMessage('Дилер одобрен. Уведомление отправлено.');
    } catch (err: any) {
      setDealerError(err.message || 'Не удалось одобрить дилера');
    } finally {
      setDealerActionLoading(false);
    }
  }

  async function handleRejectDealer(dealerId: string, reason?: string) {
    if (!user) {
      setDealerError('Сессия истекла. Войдите снова.');
      return;
    }
    setDealerActionLoading(true);
    setDealerError(null);
    try {
      await rejectDealer({ dealerId, reviewerId: user.id, reason });
      await loadPendingDealers();
      setDealerMessage('Дилер отклонён. Уведомление отправлено.');
    } catch (err: any) {
      setDealerError(err.message || 'Не удалось отклонить дилера');
    } finally {
      setDealerActionLoading(false);
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].key);
  }

  function renderTabContent(tab: TabKey) {
    if (tab === 'catalog') {
      return <ProductManager />;
    }

    if (tab === 'approvals') {
      return (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Одобрение дилеров</h2>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Проверка заявок дилеров. Одобрение предоставляет немедленный доступ; отклонение автоматически уведомляет заявителя.
            </p>
          </div>
          {dealerError && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' }}>
              {dealerError}
            </div>
          )}
          {dealerMessage && (
            <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#dcfce7', border: '1px solid #86efac', color: '#166534' }}>
              {dealerMessage}
            </div>
          )}
          <DealerApprovalList
            dealers={pendingDealers}
            loading={dealerLoading || dealerActionLoading}
            onApprove={handleApproveDealer}
            onReject={handleRejectDealer}
            onRefresh={loadPendingDealers}
          />
        </div>
      );
    }

    if (tab === 'orders') {
      return (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)', height: 'calc(100vh - 300px)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Заказы с сайта</h2>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Список заказов от клиентов. Просматривайте детали и управляйте статусами.
            </p>
          </div>
          <OrdersList />
        </div>
      );
    }

    if (tab === 'messages') {
      return (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)', height: 'calc(100vh - 300px)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Сообщения от клиентов</h2>
            <p style={{ margin: '8px 0 0', color: '#64748b' }}>
              Вопросы от посетителей сайта. Читайте и отвечайте на сообщения.
            </p>
          </div>
          <MessagesList />
        </div>
      );
    }

    return (
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.4)' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Лог активности</h2>
          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            Каждое изменение каталога и одобрение записываются с отметкой времени и оператором для аудита.
          </p>
        </div>
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
          Лог активности появится здесь после настройки логирования.
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="Manufacturer Dashboard">
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
            Центр управления производителем
          </span>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 600, color: '#0f172a' }}>
            С возвращением{profile?.name ? `, ${profile.name}` : ''}.
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569' }}>
            Используйте вкладки ниже для управления каталогом Exce1sior, одобрения дилеров, просмотра заказов и сообщений. Все изменения мгновенно становятся доступны региональным порталам дилеров.
          </p>
        </section>

        <div>
          <div
            role="tablist"
            aria-label="Manufacturer admin navigation"
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`manufacturer-tab-${tab.key}`}
                id={`manufacturer-tab-${tab.key}-trigger`}
                tabIndex={activeTab === tab.key ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
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
            id={`manufacturer-tab-${activeTab}`}
            aria-labelledby={`manufacturer-tab-${activeTab}-trigger`}
          >
            {renderTabContent(activeTab)}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default ManufacturerAdminPage;