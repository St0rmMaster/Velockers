import { useState } from 'react';
import type { Configuration, Catalog } from '../types';
import { formatPrice } from '../utils/priceCalculator';
import { createOrder } from '../services/orderService';
import type { OrderFormData } from '../services/orderService';
import './OrderConfirmationModal.css';

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  configuration: Configuration;
  catalog: Catalog;
  totalPrice: number;
}

export function OrderConfirmationModal({
  isOpen,
  onClose,
  configuration,
  catalog,
  totalPrice,
}: OrderConfirmationModalProps) {
  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    comment: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Get configuration details for display
  const model = catalog.models.find(m => m.id === configuration.modelId);
  const material = catalog.materials.find(m => m.id === configuration.materialId);
  
  // Get color name
  let colorName = '';
  if (configuration.colour.type === 'custom') {
    colorName = `Custom Color (${configuration.colour.value})`;
  } else {
    const paletteColor = catalog.colourPalette.find(c => c.id === configuration.colour.value);
    colorName = paletteColor?.name[configuration.locale] || configuration.colour.value;
  }

  // Get selected options
  const selectedOptions = catalog.options.filter(opt => 
    configuration.optionIds.includes(opt.id)
  );

  const taxAmount = configuration.taxAmount ?? 0;
  const taxRate = configuration.taxRate ?? 0;
  const shippingCost = configuration.shippingCost ?? 0;
  const includeTax = configuration.includeTaxInTotal ?? false;
  const includeShipping = configuration.includeShippingInTotal ?? false;
  const subtotalBeforeExtras = Math.max(
    0,
    totalPrice - (includeTax ? taxAmount : 0) - (includeShipping ? shippingCost : 0)
  );

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error when user types
  };

  const validateForm = (): boolean => {
    if (!formData.customer_name.trim()) {
      setError('Name is required');
      return false;
    }

    if (!formData.customer_email?.trim() && !formData.customer_phone?.trim()) {
      setError('Please provide either email or phone number');
      return false;
    }

    // Basic email validation if provided
    if (formData.customer_email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customer_email)) {
        setError('Please enter a valid email address');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createOrder({
        formData,
        configuration,
        totalPrice,
        currency: 'USD',
      });

      setSuccess(true);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        // Reset form
        setFormData({
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          customer_address: '',
          comment: '',
        });
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error submitting order:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setError(null);
      setSuccess(false);
    }
  };

  if (success) {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content success-message" onClick={(e) => e.stopPropagation()}>
          <div className="success-icon">✓</div>
          <h2>Order Submitted Successfully!</h2>
          <p>We will contact you soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} disabled={isSubmitting}>
          ×
        </button>
        
        <h2>Confirm Your Order</h2>
        
        {/* Configuration Summary */}
        <div className="order-summary">
          <h3>Configuration</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="label">Model:</span>
              <span className="value">Exce1sior {model?.id}</span>
            </div>
            <div className="summary-item">
              <span className="label">Material:</span>
              <span className="value">{material?.name}</span>
            </div>
            <div className="summary-item">
              <span className="label">Color:</span>
              <span className="value">{colorName}</span>
            </div>
            {selectedOptions.length > 0 && (
              <div className="summary-item options">
                <span className="label">Options:</span>
                <ul className="value">
                  {selectedOptions.map(opt => (
                    <li key={opt.id}>
                      {opt.name} <span className="option-price">+{formatPrice(opt.priceUsd, configuration.locale)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="total-price" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
            <div className="summary-item" style={{ margin: 0 }}>
              <span className="label">Subtotal:</span>
              <span className="value">{formatPrice(subtotalBeforeExtras, configuration.locale)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="summary-item" style={{ margin: 0 }}>
                <span className="label">Tax ({Math.round(taxRate * 100)}%):</span>
                <span className="value">
                  {formatPrice(taxAmount, configuration.locale)}
                  {!includeTax && <span className="option-price" style={{ marginLeft: '8px' }}>excluded</span>}
                </span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="summary-item" style={{ margin: 0 }}>
                <span className="label">Shipping:</span>
                <span className="value">
                  {formatPrice(shippingCost, configuration.locale)}
                  {!includeShipping && <span className="option-price" style={{ marginLeft: '8px' }}>excluded</span>}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total Price:</span>
              <span className="price-amount">{formatPrice(totalPrice, configuration.locale)}</span>
            </div>
          </div>
          <p className="price-note">
            {taxAmount > 0 || shippingCost > 0
              ? 'Displayed total reflects current tax and shipping toggles.'
              : 'Taxes and delivery are not included.'}
          </p>
        </div>

        {/* Contact Form */}
        <form onSubmit={handleSubmit} className="order-form">
          <h3>Your Contact Information</h3>
          
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="customer_name">
              Name <span className="required">*</span>
            </label>
            <input
              id="customer_name"
              type="text"
              value={formData.customer_name}
              onChange={(e) => handleInputChange('customer_name', e.target.value)}
              placeholder="John Doe"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer_email">
              Email <span className="optional">(at least one required)</span>
            </label>
            <input
              id="customer_email"
              type="email"
              value={formData.customer_email}
              onChange={(e) => handleInputChange('customer_email', e.target.value)}
              placeholder="john@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer_phone">
              Phone <span className="optional">(at least one required)</span>
            </label>
            <input
              id="customer_phone"
              type="tel"
              value={formData.customer_phone}
              onChange={(e) => handleInputChange('customer_phone', e.target.value)}
              placeholder="+1 234 567 8900"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer_address">
              Address <span className="optional">(optional)</span>
            </label>
            <input
              id="customer_address"
              type="text"
              value={formData.customer_address}
              onChange={(e) => handleInputChange('customer_address', e.target.value)}
              placeholder="123 Main St, City, Country"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="comment">
              Comment <span className="optional">(optional)</span>
            </label>
            <textarea
              id="comment"
              value={formData.comment}
              onChange={(e) => handleInputChange('comment', e.target.value)}
              placeholder="Any additional comments or questions..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

