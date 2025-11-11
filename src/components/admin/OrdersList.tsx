import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus, deleteOrder } from '../../services/orderService';
import type { Order } from '../../services/orderService';
import { formatPrice } from '../../utils/priceCalculator';

type OrderStatus = 'new' | 'processing' | 'completed' | 'cancelled';

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: '#3b82f6',
  processing: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  processing: 'В обработке',
  completed: 'Завершен',
  cancelled: 'Отменен',
};

export function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status');
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот заказ?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteOrder(orderId);
      setOrders(orders.filter(order => order.id !== orderId));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Error deleting order:', err);
      alert('Failed to delete order');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === filterStatus);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#64748b' }}>Загрузка заказов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#ef4444' }}>{error}</div>
        <button 
          onClick={loadOrders}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>
      {/* Orders List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header with Filters */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px 20px',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
            Заказы ({filteredOrders.length})
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'new', 'processing', 'completed', 'cancelled'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: filterStatus === status ? '#3b82f6' : '#e2e8f0',
                  color: filterStatus === status ? 'white' : '#475569',
                  transition: 'all 0.2s',
                }}
              >
                {status === 'all' ? 'Все' : STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              Заказы не найдены
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Дата
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Клиент
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Конфигурация
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Сумма
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Статус
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: selectedOrder?.id === order.id ? '#f0f9ff' : 'transparent',
                    }}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      <div style={{ fontWeight: 500 }}>{order.customer_name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {order.customer_email || order.customer_phone}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      Exce1sior {order.configuration.modelId}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155', textAlign: 'right', fontWeight: 600 }}>
                      {formatPrice(order.total_price, order.configuration.locale)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: `${STATUS_COLORS[order.status]}20`,
                        color: STATUS_COLORS[order.status],
                      }}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        style={{
                          padding: '4px 12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          background: 'white',
                          color: '#475569',
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order Details Panel */}
      {selectedOrder && (
        <div style={{ 
          width: '400px', 
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxHeight: '100%',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Детали заказа
            </h3>
            <button
              onClick={() => setSelectedOrder(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Customer Info */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              Информация о клиенте
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div><strong>Имя:</strong> {selectedOrder.customer_name}</div>
              {selectedOrder.customer_email && (
                <div><strong>Email:</strong> {selectedOrder.customer_email}</div>
              )}
              {selectedOrder.customer_phone && (
                <div><strong>Телефон:</strong> {selectedOrder.customer_phone}</div>
              )}
              {selectedOrder.customer_address && (
                <div><strong>Адрес:</strong> {selectedOrder.customer_address}</div>
              )}
              {selectedOrder.comment && (
                <div>
                  <strong>Комментарий:</strong>
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '8px', 
                    background: '#f8fafc', 
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#475569',
                  }}>
                    {selectedOrder.comment}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              Конфигурация
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div><strong>Модель:</strong> Exce1sior {selectedOrder.configuration.modelId}</div>
              <div><strong>Материал:</strong> {selectedOrder.configuration.materialId}</div>
              <div>
                <strong>Цвет:</strong> {' '}
                {selectedOrder.configuration.colour.type === 'custom' 
                  ? `Пользовательский (${selectedOrder.configuration.colour.value})`
                  : selectedOrder.configuration.colour.value
                }
              </div>
              {selectedOrder.configuration.optionIds.length > 0 && (
                <div>
                  <strong>Опции:</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '13px' }}>
                    {selectedOrder.configuration.optionIds.map(optId => (
                      <li key={optId}>{optId}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedOrder.configuration.promoCode && (
                <div>
                  <strong>Промокод:</strong>{' '}
                  {selectedOrder.configuration.promoCode}{' '}
                  — скидка{' '}
                  {formatPrice(
                    Math.max(0, selectedOrder.configuration.promoDiscount || 0),
                    selectedOrder.configuration.locale
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Price */}
          <div style={{ 
            padding: '16px', 
            background: '#f8fafc', 
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>Общая сумма:</span>
            <span style={{ fontSize: '18px', fontWeight: 600, color: '#3b82f6' }}>
              {formatPrice(selectedOrder.total_price, selectedOrder.configuration.locale)}
            </span>
          </div>

          {/* Status Change */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              Изменить статус
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['new', 'processing', 'completed', 'cancelled'] as OrderStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(selectedOrder.id, status)}
                  disabled={selectedOrder.status === status}
                  style={{
                    padding: '10px',
                    border: selectedOrder.status === status ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: selectedOrder.status === status ? 'default' : 'pointer',
                    background: selectedOrder.status === status ? '#eff6ff' : 'white',
                    color: selectedOrder.status === status ? '#3b82f6' : '#334155',
                    transition: 'all 0.2s',
                  }}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={() => handleDelete(selectedOrder.id)}
            disabled={isDeleting}
            style={{
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              background: '#fee2e2',
              color: '#dc2626',
              transition: 'all 0.2s',
            }}
          >
            {isDeleting ? 'Удаление...' : 'Удалить заказ'}
          </button>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 'auto' }}>
            Создан: {new Date(selectedOrder.created_at).toLocaleString('ru-RU')}
          </div>
        </div>
      )}
    </div>
  );
}

