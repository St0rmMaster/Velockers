import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// Уникальная метка сборки для проверки актуальности деплоя
const BUILD_VERSION = 'send-telegram-notification@2025-11-03-02';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') ?? '';
const TELEGRAM_API_URL = 'https://api.telegram.org';
const TELEGRAM_TOPIC_ID_RAW = Deno.env.get('TELEGRAM_TOPIC_ID') ?? '';
const HAS_TOKEN = !!TELEGRAM_BOT_TOKEN;
const HAS_CHAT = !!TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('send-telegram-notification: TELEGRAM_BOT_TOKEN не настроен – уведомления не будут работать.');
}

if (!TELEGRAM_CHAT_ID) {
  console.warn('send-telegram-notification: TELEGRAM_CHAT_ID не настроен – уведомления не будут работать.');
}

type NotificationPayload = 
  | {
      type: 'order';
      orderId: string;
      customerName: string;
      customerEmail?: string | null;
      customerPhone?: string | null;
      totalPrice: number;
      currency: string;
      comment?: string | null;
      configuration: any;
    }
  | {
      type: 'message';
      messageId: string;
      customerName: string;
      customerEmail?: string | null;
      customerPhone?: string | null;
      message: string;
    };

function escapeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function softDeckLabel(value: string): string {
  const up = String(value).toUpperCase();
  if (up === '#9D622BFF') return 'Sandstone (+ Strips Grey)';
  if (up === '#BCBCBCFF') return 'Soft Grey (+ Strips Grey)';
  if (up === '#95070BFF') return 'Soft Grey (+ Strips Red)';
  // Fallback to raw value
  return value;
}

async function sendTelegramMessage(text: string): Promise<unknown> {
  if (!HAS_TOKEN || !HAS_CHAT) {
    console.error('Telegram не настроен');
    return { skipped: true, reason: 'missing_env', hasToken: HAS_TOKEN, hasChat: HAS_CHAT };
  }

  const url = `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const body: Record<string, unknown> = {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML',
    };

    // Если задан TELEGRAM_TOPIC_ID, отправляем в конкретный топик супергруппы
    const topicId = TELEGRAM_TOPIC_ID_RAW ? Number(TELEGRAM_TOPIC_ID_RAW) : undefined;
    if (typeof topicId === 'number' && !Number.isNaN(topicId)) {
      body.message_thread_id = topicId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Telegram Bot API часто возвращает HTTP 200 даже при ошибке (ok=false)
    const result = await response.json().catch(async () => ({ ok: response.ok, raw: await response.text() }));
    if (!response.ok || (result && (result as any).ok === false)) {
      const description = (result as any)?.description || (result as any)?.raw || 'Unknown Telegram API error';
      throw new Error(`Telegram API error: ${description}`);
    }

    // Возвращаем полезные данные для диагностики
    return (result as any)?.result ?? result;
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error);
    throw error;
  }
}

function formatOrderNotification(data: Extract<NotificationPayload, { type: 'order' }>): string {
  let text = `<b>🛒 Новый заказ #${escapeHtml(data.orderId.substring(0, 8))}</b>\n\n`;
  text += `<b>Клиент:</b> ${escapeHtml(data.customerName)}\n`;
  if (data.customerEmail) text += `<b>Email:</b> ${escapeHtml(data.customerEmail)}\n`;
  if (data.customerPhone) text += `<b>Телефон:</b> ${escapeHtml(String(data.customerPhone))}\n`;
  text += `<b>Сумма:</b> ${data.totalPrice} ${escapeHtml(data.currency)}\n`;
  // Promo code (if present in configuration)
  try {
    const cfgAny: any = data.configuration ?? {};
    const promoCode = cfgAny?.promoCode ? String(cfgAny.promoCode) : '';
    const promoDiscount = cfgAny?.promoDiscount ? Number(cfgAny.promoDiscount) : 0;
    if (promoCode && promoDiscount > 0) {
      text += `<b>Промокод:</b> ${escapeHtml(promoCode)} — скидка ${promoDiscount} ${escapeHtml(data.currency)}\n`;
    }
  } catch {/* ignore promo parsing errors */}
  if (data.comment) text += `<b>Комментарий:</b> ${escapeHtml(data.comment)}\n`;

  // Унифицированный разбор текущей структуры configuration из фронта
  const cfg: any = data.configuration ?? {};
  const modelId = cfg.modelId ?? cfg.model ?? '';
  const materialId = cfg.materialId ?? cfg.material ?? '';
  const colour = cfg.colour ?? cfg.color ?? {};
  const optionIds: string[] = Array.isArray(cfg.optionIds) ? cfg.optionIds : [];
  const softDeckColor = cfg.softDeckColor ?? undefined;

  const materialName = (() => {
    if (materialId === 'fullCarbon') return 'Полный карбон';
    if (materialId === 'fiberglass') return 'Стеклопластик';
    return String(materialId || '').trim() || '—';
  })();

  if (modelId || materialId || colour || optionIds.length) {
    text += `\n<b>Конфигурация:</b>\n`;
    if (modelId) text += `• Модель: ${escapeHtml(String(modelId))}\n`;
    if (materialId) text += `• Материал: ${escapeHtml(materialName)}\n`;

    // Цвет корпуса
    if (colour?.type === 'custom' && colour?.value) {
      text += `• Цвет корпуса: Custom ${escapeHtml(String(colour.value))}\n`;
    } else if (colour?.type === 'palette' && colour?.value) {
      text += `• Цвет корпуса (палитра): ${escapeHtml(String(colour.value))}\n`;
    }

    // Soft Deck
    if (softDeckColor) {
      text += `• Soft Deck: ${escapeHtml(softDeckLabel(String(softDeckColor)))}\n`;
    }

    // Опции (прочие)
    if (optionIds.length > 0) {
      text += `• Опции (${optionIds.length}):\n`;
      text += optionIds.map((id: string) => `  — ${escapeHtml(id)}`).join('\n') + '\n';
    } else {
      text += `• Опции: —\n`;
    }
  }

  return text;
}

function formatMessageNotification(data: Extract<NotificationPayload, { type: 'message' }>): string {
  let text = `<b>💬 Новое сообщение #${escapeHtml(data.messageId.substring(0, 8))}</b>\n\n`;
  text += `<b>От:</b> ${escapeHtml(data.customerName)}\n`;
  if (data.customerEmail) text += `<b>Email:</b> ${escapeHtml(data.customerEmail)}\n`;
  if (data.customerPhone) text += `<b>Телефон:</b> ${escapeHtml(String(data.customerPhone))}\n`;
  text += `\n<b>Сообщение:</b>\n${escapeHtml(data.message)}`;
  return text;
}

serve(async (req) => {
  console.log('[edge] send-telegram-notification version:', BUILD_VERSION);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Только POST запросы поддерживаются' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const payload = (await req.json()) as NotificationPayload;

    if (!payload?.type) {
      return new Response(JSON.stringify({ error: 'Отсутствует поле type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let notificationText: string;

    if (payload.type === 'order') {
      notificationText = formatOrderNotification(payload);
    } else if (payload.type === 'message') {
      notificationText = formatMessageNotification(payload);
    } else {
      return new Response(JSON.stringify({ error: 'Неподдерживаемый тип уведомления' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const telegramResult = await sendTelegramMessage(notificationText);

    return new Response(JSON.stringify({ success: true, version: BUILD_VERSION, telegramResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('send-telegram-notification error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
