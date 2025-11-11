# Быстрое исправление проблем

## Проблема 1: Раздел "Сообщения" не отображается ✅ ИСПРАВЛЕНО

**Причина:** Вкладка Messages была добавлена только в ManufacturerAdminPage, а вы используете DealerAdminPage (роут `/admin`).

**Решение:** Добавлена вкладка Messages в DealerAdminPage.

**Теперь в админке будет:**
- Catalog
- Orders
- **Messages** ← новая вкладка
- Configurator
- Visualization

## Проблема 2: Ошибка при отправке заказа

**Ошибка:**
```
Failed to create order: Could not find the 'comment' column of 'orders' in the schema cache
```

**Причина:** Таблица `orders` была создана раньше без колонки `comment`.

**Решение:** Выполните SQL-скрипт для добавления колонки.

### Шаги для исправления:

1. **Откройте Supabase Dashboard**
2. **Перейдите в SQL Editor**
3. **Создайте новый запрос**
4. **Скопируйте и вставьте следующий SQL:**

```sql
-- Fix orders table: Add missing comment column if it doesn't exist

-- Check if comment column exists, if not - add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'comment'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN comment TEXT;
        RAISE NOTICE 'Column "comment" added to orders table';
    ELSE
        RAISE NOTICE 'Column "comment" already exists in orders table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'orders'
ORDER BY ordinal_position;
```

5. **Нажмите Run (или Ctrl+Enter)**

### Ожидаемый результат:

Вы увидите:
- Сообщение: `Column "comment" added to orders table` (или `already exists` если колонка уже была)
- Список всех колонок таблицы orders, включая `comment`

### После выполнения SQL:

1. **Обновите страницу админки** (F5)
2. **Откройте вкладку Messages** - вы увидите все отправленные сообщения
3. **Попробуйте отправить заказ с сайта** - ошибка должна исчезнуть

## Проверка работы

### Проверка Messages:
1. Откройте конфигуратор: `https://your-domain.com/`
2. Нажмите **"Ask a Question"**
3. Заполните форму и отправьте
4. Откройте админку: `https://your-domain.com/admin`
5. Перейдите на вкладку **Messages**
6. Вы должны увидеть ваше сообщение

### Проверка Orders:
1. Откройте конфигуратор
2. Настройте лодку
3. Нажмите **"Place Order"**
4. Заполните форму и отправьте
5. Перейдите в админку → вкладка **Orders**
6. Ваш заказ должен появиться в списке

## Файлы с SQL-скриптами

- `FIX_ORDERS_TABLE.sql` - исправление таблицы orders
- `supabase/migrations/014_create_chat_messages_table.sql` - создание таблицы messages (уже выполнено)

## Поддержка

Если проблемы остались:

1. **Проверьте логи браузера** (F12 → Console)
2. **Проверьте Supabase Logs** (Dashboard → Logs)
3. **Убедитесь, что вы вошли как администратор**
4. **Проверьте, что функция `is_admin()` возвращает true** для вашего пользователя

---

**Статус:** ✅ Исправления готовы  
**Дата:** 2025-10-27  
**Версия:** 1.0.1

