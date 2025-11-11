import { supabase } from '../lib/supabaseClient';
import type { Configuration } from '../types';

export interface OrderFormData {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  comment?: string;
}

export interface Order {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  comment: string | null;
  configuration: Configuration;
  total_price: number;
  currency: string;
  status: 'new' | 'processing' | 'completed' | 'cancelled';
  webhook_sent_at: string | null;
  webhook_response: any | null;
}

export interface CreateOrderParams {
  formData: OrderFormData;
  configuration: Configuration;
  totalPrice: number;
  currency?: string;
}

/**
 * Send Telegram notification for new order
 */
async function sendOrderTelegramNotification(order: Order): Promise<void> {
  try {
    const response = await supabase.functions.invoke('send-telegram-notification', {
      body: {
        type: 'order',
        orderId: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        totalPrice: order.total_price,
        currency: order.currency,
        comment: order.comment,
        configuration: order.configuration,
      },
    });

    if (response.error) {
      console.error('Failed to send Telegram notification:', response.error);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

/**
 * Create a new order
 */
export async function createOrder(params: CreateOrderParams): Promise<Order> {
  const { formData, configuration, totalPrice, currency = 'USD' } = params;

  // Validate that at least email or phone is provided
  if (!formData.customer_email && !formData.customer_phone) {
    throw new Error('Either email or phone must be provided');
  }

  const orderData = {
    customer_name: formData.customer_name,
    customer_email: formData.customer_email || null,
    customer_phone: formData.customer_phone || null,
    customer_address: formData.customer_address || null,
    comment: formData.comment || null,
    configuration,
    total_price: totalPrice,
    currency,
    status: 'new' as const,
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    throw new Error(`Failed to create order: ${error.message}`);
  }

  const order = data as Order;

  // Send Telegram notification (non-blocking)
  sendOrderTelegramNotification(order);

  return order;
}

/**
 * Get all orders (admin only)
 */
export async function getOrders(filters?: {
  status?: string;
  limit?: number;
}): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching orders:', error);
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return (data || []) as Order[];
}

/**
 * Get a single order by ID (admin only)
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching order:', error);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }

  return data as Order;
}

/**
 * Update order status (admin only)
 */
export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Error updating order status:', error);
    throw new Error(`Failed to update order status: ${error.message}`);
  }

  return data as Order;
}

/**
 * Delete an order (admin only)
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error deleting order:', error);
    throw new Error(`Failed to delete order: ${error.message}`);
  }
}

