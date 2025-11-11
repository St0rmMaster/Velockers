import { supabase } from '../lib/supabaseClient';

export interface ChatMessageFormData {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  message: string;
  admin_response: string | null;
  admin_response_at: string | null;
  admin_id: string | null;
  status: 'new' | 'replied' | 'closed';
}

export interface CreateMessageParams {
  formData: ChatMessageFormData;
}

/**
 * Send Telegram notification for new message
 */
async function sendMessageTelegramNotification(message: ChatMessage): Promise<void> {
  try {
    const response = await supabase.functions.invoke('send-telegram-notification', {
      body: {
        type: 'message',
        messageId: message.id,
        customerName: message.customer_name,
        customerEmail: message.customer_email,
        customerPhone: message.customer_phone,
        message: message.message,
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
 * Create a new chat message
 */
export async function createChatMessage(params: CreateMessageParams): Promise<ChatMessage> {
  const { formData } = params;

  // Validate that at least email or phone is provided
  if (!formData.customer_email && !formData.customer_phone) {
    throw new Error('Either email or phone must be provided');
  }

  const messageData = {
    customer_name: formData.customer_name,
    customer_email: formData.customer_email || null,
    customer_phone: formData.customer_phone || null,
    message: formData.message,
    status: 'new' as const,
  };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error('Error creating chat message:', error);
    throw new Error(`Failed to create message: ${error.message}`);
  }

  const message = data as ChatMessage;

  // Send Telegram notification (non-blocking)
  sendMessageTelegramNotification(message);

  return message;
}

/**
 * Get all chat messages (admin only)
 */
export async function getChatMessages(filters?: {
  status?: string;
  limit?: number;
}): Promise<ChatMessage[]> {
  let query = supabase
    .from('chat_messages')
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
    console.error('Error fetching chat messages:', error);
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return (data || []) as ChatMessage[];
}

/**
 * Get a single chat message by ID (admin only)
 */
export async function getChatMessageById(messageId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching chat message:', error);
    throw new Error(`Failed to fetch message: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Update chat message status (admin only)
 */
export async function updateMessageStatus(
  messageId: string,
  status: ChatMessage['status']
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ status })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    console.error('Error updating message status:', error);
    throw new Error(`Failed to update message status: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Reply to a chat message (admin only)
 */
export async function replyToChatMessage(
  messageId: string,
  response: string,
  adminId: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('chat_messages')
    .update({
      admin_response: response,
      admin_response_at: new Date().toISOString(),
      admin_id: adminId,
      status: 'replied',
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    console.error('Error replying to message:', error);
    throw new Error(`Failed to reply to message: ${error.message}`);
  }

  return data as ChatMessage;
}

/**
 * Delete a chat message (admin only)
 */
export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    console.error('Error deleting chat message:', error);
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}

