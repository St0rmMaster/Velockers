import { useState, useEffect, useRef } from 'react';
import type { Configuration, Catalog } from '../types';
import { formatPrice } from '../utils/priceCalculator';
import { suggestAddresses, type AddressSuggestion } from '../services/addressService';
import { supabase } from '../lib/supabaseClient';
import './OrderConfirmationModal.css';
import './TaxAndShippingModal.css';

interface TaxAndShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  configuration: Configuration;
  catalog: Catalog;
  subtotal: number;
  referralDiscount: number;
  onTaxCalculated: (taxRate: number, taxAmount: number, shippingCost: number) => void;
}

export function TaxAndShippingModal({
  isOpen,
  onClose,
  configuration,
  catalog,
  subtotal,
  referralDiscount,
  onTaxCalculated,
}: TaxAndShippingModalProps) {
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [addressStreet, setAddressStreet] = useState<string | null>(null);
  const [addressCity, setAddressCity] = useState<string | null>(null);
  const [addressStateCode, setAddressStateCode] = useState<string | null>(null);
  const [addressPostcode, setAddressPostcode] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [isCalculatingTax, setIsCalculatingTax] = useState(false);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestTimer = useRef<number | null>(null);

  const subtotalAfterDiscount = Math.max(0, subtotal - referralDiscount);

  // Адресные подсказки (дебаунс 300 мс)
  useEffect(() => {
    if (!isOpen) return;
    if (suggestTimer.current) {
      window.clearTimeout(suggestTimer.current);
      suggestTimer.current = null;
    }
    const q = addressQuery.trim();
    if (q.length < 3) {
      setAddressSuggestions([]);
      setShowAddressDropdown(false);
      return;
    }
    suggestTimer.current = window.setTimeout(async () => {
      try {
        const list = await suggestAddresses(q, 5);
        setAddressSuggestions(list);
        setShowAddressDropdown(true);
      } catch (e) {
        console.warn('Address suggest error:', e);
        setAddressSuggestions([]);
        setShowAddressDropdown(false);
      }
    }, 300);
    return () => {
      if (suggestTimer.current) {
        window.clearTimeout(suggestTimer.current);
        suggestTimer.current = null;
      }
    };
  }, [addressQuery, isOpen]);

  const applyAddressSuggestion = (s: AddressSuggestion) => {
    setAddressQuery(s.display);
    setAddressStreet(s.street);
    setAddressCity(s.city);
    setAddressStateCode(s.state);
    setAddressPostcode(s.postcode);
    setShowAddressDropdown(false);
  };

  const handleCalculateTax = async () => {
    setIsCalculatingTax(true);
    setError(null);

    try {
      // Проверяем, что адрес выбран
      if (!addressPostcode && !addressStreet) {
        setError('Please select an address from the suggestions');
        setIsCalculatingTax(false);
        return;
      }

      // Вызов функции расчёта налога по адресу
      const { data, error: taxError } = await supabase.functions.invoke('get-tax-rate', {
        body: {
          subtotal: subtotalAfterDiscount,
          destination: {
            line1: addressStreet,
            city: addressCity,
            state: addressStateCode,
            zip: addressPostcode,
            countryCode: 'US',
          },
          cartId: `cart-${Date.now()}`,
        },
      });

      if (taxError) {
        // Детальная обработка ошибки
        const errorMessage = taxError.message || 'Failed to fetch tax rate';
        let parsedDetails: unknown = (taxError as any).details ?? (taxError as any).context ?? null;

        if (typeof parsedDetails === 'string') {
          try {
            parsedDetails = JSON.parse(parsedDetails);
          } catch {
            // оставляем строку как есть
          }
        }

        console.error('Tax calculation error details:', {
          taxError,
          parsedDetails,
          rawContext: (taxError as any).context ?? null,
        });

        throw new Error(
          parsedDetails
            ? `${errorMessage}: ${typeof parsedDetails === 'string' ? parsedDetails : JSON.stringify(parsedDetails)}`
            : errorMessage,
        );
      }

      // Проверяем структуру ответа
      if (!data) {
        throw new Error('Empty response from tax service');
      }

      const rate =
        typeof (data as any)?.rate === 'number'
          ? (data as any).rate
          : Number.parseFloat((data as any)?.rate ?? '');
      const amount =
        typeof (data as any)?.amount === 'number'
          ? (data as any).amount
          : Number.parseFloat((data as any)?.amount ?? '');

      if (!Number.isFinite(rate) || !Number.isFinite(amount)) {
        console.error('Invalid tax rate response:', data);
        throw new Error(`Invalid tax rate response: ${JSON.stringify(data)}`);
      }

      setTaxRate(rate);
      setTaxAmount(amount);

      // Обновляем итог с налогом (доставка остаётся прежней)
      onTaxCalculated(rate, amount, shippingCost);
    } catch (err) {
      console.error('Tax calculation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate tax');
      setTaxRate(0);
      setTaxAmount(0);
    } finally {
      setIsCalculatingTax(false);
    }
  };

  const handleCalculateShipping = async () => {
    setIsCalculatingShipping(true);
    setError(null);

    try {
      // Проверяем, что адрес выбран
      if (!addressPostcode && !addressStreet) {
        setError('Please select an address from the suggestions');
        setIsCalculatingShipping(false);
        return;
      }

      // Заглушка: всегда возвращает $311
      const shipping = 311;
      setShippingCost(shipping);

      // Обновляем итог с доставкой (налог остаётся прежним)
      onTaxCalculated(taxRate, taxAmount, shipping);
    } catch (err) {
      console.error('Shipping calculation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate shipping');
      setShippingCost(0);
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Сброс при закрытии
    setAddressQuery('');
    setAddressStreet(null);
    setAddressCity(null);
    setAddressStateCode(null);
    setAddressPostcode(null);
    setTaxRate(0);
    setTaxAmount(0);
    setShippingCost(0);
    setError(null);
  };

  if (!isOpen) return null;

  const totalWithTaxAndShipping = subtotalAfterDiscount + taxAmount + shippingCost;

  return (
    <div className="modal-overlay tax-shipping-modal" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          ×
        </button>

        <h2>Calculate Tax & Shipping</h2>

        {/* Address Form */}
        <div className="form-group">
          <label htmlFor="delivery-address">
            Delivery Address (US) <span className="required">*</span>
          </label>
          <div className="address-autocomplete-wrapper">
            <input
              id="delivery-address"
              type="text"
              placeholder="Start typing address..."
              className="zip-input"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              onFocus={() => {
                if (addressSuggestions.length > 0) setShowAddressDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowAddressDropdown(false), 120);
              }}
            />
            {showAddressDropdown && addressSuggestions.length > 0 && (
              <div className="address-suggestions">
                {addressSuggestions.map((s, idx) => (
                  <div
                    key={`${s.display}-${idx}`}
                    className="address-suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyAddressSuggestion(s);
                    }}
                  >
                    {s.display}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {/* Tax & Shipping Summary */}
        {(taxAmount > 0 || shippingCost > 0) && (
          <div className="order-summary">
            <h3>Calculation Results</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Subtotal:</span>
                <span className="value">{formatPrice(subtotalAfterDiscount, configuration.locale)}</span>
              </div>
            {taxAmount > 0 && (
              <div className="summary-item">
                <span className="label">Tax ({Math.round(taxRate * 100)}%):</span>
                <span className="value">{formatPrice(taxAmount, configuration.locale)}</span>
              </div>
            )}
            {shippingCost > 0 && (
              <div className="summary-item">
                <span className="label">Shipping:</span>
                <span className="value">{formatPrice(shippingCost, configuration.locale)}</span>
              </div>
            )}
              <div className="total-price">
                <span>Total:</span>
                <span className="price-amount">{formatPrice(totalWithTaxAndShipping, configuration.locale)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCalculateTax}
            disabled={isCalculatingTax || !addressPostcode}
          >
            {isCalculatingTax ? 'Calculating...' : 'Calculate Tax'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleCalculateShipping}
            disabled={isCalculatingShipping || !addressPostcode}
          >
            {isCalculatingShipping ? 'Calculating...' : 'Calculate Shipping'}
          </button>
        </div>

        {shippingCost > 0 && (
          <p
            style={{
              marginTop: '16px',
              fontSize: '13px',
              color: '#9ca3af',
              fontStyle: 'italic',
            }}
          >
            Shipping calculation is for testing only and does not represent the actual delivery cost.
          </p>
        )}
      </div>
    </div>
  );
}

