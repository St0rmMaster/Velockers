import { useState } from 'react';
import { createChatMessage, type ChatMessageFormData } from '../services/chatService';
import './ChatModal.css';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [formData, setFormData] = useState<ChatMessageFormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.customer_name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!formData.message.trim()) {
      setError('Please enter your question');
      return;
    }

    if (!formData.customer_email?.trim() && !formData.customer_phone?.trim()) {
      setError('Please provide email or phone for contact');
      return;
    }

    try {
      setIsSubmitting(true);
      await createChatMessage({ formData });
      setSuccess(true);
      
      // Reset form after 2 seconds and close
      setTimeout(() => {
        setFormData({
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          message: '',
        });
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof ChatMessageFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h2>Ask a Question</h2>
          <button className="chat-modal-close" onClick={onClose}>×</button>
        </div>

        {success ? (
          <div className="chat-success-message">
            <div className="success-icon">✓</div>
            <h3>Message Sent!</h3>
            <p>We will get back to you shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="chat-modal-form">
            {error && (
              <div className="chat-error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="customer_name">
                Your Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleChange('customer_name', e.target.value)}
                placeholder="John Doe"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer_email">Email</label>
              <input
                type="email"
                id="customer_email"
                value={formData.customer_email}
                onChange={(e) => handleChange('customer_email', e.target.value)}
                placeholder="john@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer_phone">Phone</label>
              <input
                type="tel"
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => handleChange('customer_phone', e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">
                Your Question <span className="required">*</span>
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="Describe your question..."
                rows={5}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="chat-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send'}
              </button>
            </div>

            <p className="chat-hint">
              <span className="required">*</span> Required fields
            </p>
            <p className="chat-hint">
              Please provide at least one contact method (email or phone)
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

