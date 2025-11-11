import { useState, useEffect } from 'react';
import { getChatMessages, updateMessageStatus, deleteChatMessage, replyToChatMessage } from '../../services/chatService';
import type { ChatMessage } from '../../services/chatService';
import { useAuth } from '../../hooks/useAuth';

type MessageStatus = 'new' | 'replied' | 'closed';

const STATUS_COLORS: Record<MessageStatus, string> = {
  new: '#3b82f6',
  replied: '#10b981',
  closed: '#64748b',
};

const STATUS_LABELS: Record<MessageStatus, string> = {
  new: 'Новое',
  replied: 'Отвечено',
  closed: 'Закрыто',
};

export function MessagesList() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MessageStatus | 'all'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getChatMessages();
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const handleStatusChange = async (messageId: string, newStatus: MessageStatus) => {
    try {
      await updateMessageStatus(messageId, newStatus);
      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, status: newStatus } : msg
      ));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating message status:', err);
      alert('Failed to update message status');
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это сообщение?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteChatMessage(messageId);
      setMessages(messages.filter(msg => msg.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !user || !replyText.trim()) {
      return;
    }

    try {
      setIsSendingReply(true);
      const updatedMessage = await replyToChatMessage(selectedMessage.id, replyText, user.id);
      setMessages(messages.map(msg => 
        msg.id === updatedMessage.id ? updatedMessage : msg
      ));
      setSelectedMessage(updatedMessage);
      setReplyText('');
    } catch (err) {
      console.error('Error sending reply:', err);
      alert('Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  const filteredMessages = filterStatus === 'all' 
    ? messages 
    : messages.filter(msg => msg.status === filterStatus);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#64748b' }}>Загрузка сообщений...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#ef4444' }}>{error}</div>
        <button 
          onClick={loadMessages}
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
      {/* Messages List */}
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
            Сообщения ({filteredMessages.length})
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'new', 'replied', 'closed'] as const).map((status) => (
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

        {/* Messages Table */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          {filteredMessages.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
              Сообщения не найдены
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
                    Сообщение
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
                {filteredMessages.map((message) => (
                  <tr 
                    key={message.id}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: selectedMessage?.id === message.id ? '#f0f9ff' : 'transparent',
                    }}
                    onClick={() => {
                      setSelectedMessage(message);
                      setReplyText('');
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      {new Date(message.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      <div style={{ fontWeight: 500 }}>{message.customer_name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {message.customer_email || message.customer_phone}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#334155' }}>
                      <div style={{ 
                        maxWidth: '300px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {message.message}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: `${STATUS_COLORS[message.status]}20`,
                        color: STATUS_COLORS[message.status],
                      }}>
                        {STATUS_LABELS[message.status]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMessage(message);
                          setReplyText('');
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

      {/* Message Details Panel */}
      {selectedMessage && (
        <div style={{ 
          width: '450px', 
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
              Детали сообщения
            </h3>
            <button
              onClick={() => setSelectedMessage(null)}
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
              <div><strong>Имя:</strong> {selectedMessage.customer_name}</div>
              {selectedMessage.customer_email && (
                <div><strong>Email:</strong> {selectedMessage.customer_email}</div>
              )}
              {selectedMessage.customer_phone && (
                <div><strong>Телефон:</strong> {selectedMessage.customer_phone}</div>
              )}
            </div>
          </div>

          {/* Message */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              Сообщение от клиента
            </h4>
            <div style={{ 
              padding: '12px', 
              background: '#f8fafc', 
              borderRadius: '8px',
              fontSize: '14px',
              color: '#334155',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {selectedMessage.message}
            </div>
          </div>

          {/* Admin Response */}
          {selectedMessage.admin_response ? (
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                Ваш ответ
              </h4>
              <div style={{ 
                padding: '12px', 
                background: '#eff6ff', 
                borderRadius: '8px',
                fontSize: '14px',
                color: '#334155',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid #bfdbfe',
              }}>
                {selectedMessage.admin_response}
              </div>
              {selectedMessage.admin_response_at && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                  Отправлено: {new Date(selectedMessage.admin_response_at).toLocaleString('ru-RU')}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {selectedMessage.customer_email && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMessage.customer_email!);
                      alert('Email скопирован в буфер обмена');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: 'white',
                      color: '#475569',
                    }}
                  >
                    📋 Копировать Email
                  </button>
                )}
                <button
                  onClick={() => {
                    const text = `Здравствуйте, ${selectedMessage.customer_name}!\n\n${selectedMessage.admin_response}`;
                    navigator.clipboard.writeText(text);
                    alert('Ответ скопирован в буфер обмена');
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: 'white',
                    color: '#475569',
                  }}
                >
                  📋 Копировать ответ
                </button>
              </div>
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                background: '#fef3c7', 
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
                border: '1px solid #fbbf24'
              }}>
                ⚠️ Ответ сохранён в базе, но не отправлен автоматически. Скопируйте email и ответ, затем отправьте письмо вручную.
              </div>
            </div>
          ) : (
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                Ответить клиенту
              </h4>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Введите ваш ответ..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <button
                onClick={handleSendReply}
                disabled={isSendingReply || !replyText.trim()}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isSendingReply || !replyText.trim() ? 'not-allowed' : 'pointer',
                  background: isSendingReply || !replyText.trim() ? '#cbd5e1' : '#3b82f6',
                  color: 'white',
                  transition: 'all 0.2s',
                }}
              >
                {isSendingReply ? 'Отправка...' : 'Отправить ответ'}
              </button>
            </div>
          )}

          {/* Status Change */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
              Изменить статус
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(['new', 'replied', 'closed'] as MessageStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(selectedMessage.id, status)}
                  disabled={selectedMessage.status === status}
                  style={{
                    padding: '10px',
                    border: selectedMessage.status === status ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: selectedMessage.status === status ? 'default' : 'pointer',
                    background: selectedMessage.status === status ? '#eff6ff' : 'white',
                    color: selectedMessage.status === status ? '#3b82f6' : '#334155',
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
            onClick={() => handleDelete(selectedMessage.id)}
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
            {isDeleting ? 'Удаление...' : 'Удалить сообщение'}
          </button>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 'auto' }}>
            Получено: {new Date(selectedMessage.created_at).toLocaleString('ru-RU')}
          </div>
        </div>
      )}
    </div>
  );
}

