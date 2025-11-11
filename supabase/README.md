# Supabase Database Migrations

Эта директория содержит SQL миграции для базы данных Exce1sior Configurator.

## 📋 Порядок выполнения миграций

Выполняйте миграции **строго в указанном порядке**:

### 1️⃣ `001_initial_schema.sql`
**Создает структуру базы данных**:
- Таблицы: manufacturers, dealers, products, dealer_markups, dealer_catalog_filters, dealer_custom_options, orders
- Индексы для оптимизации запросов
- Триггеры для автоматического обновления `updated_at`
- Constraint для обеспечения immutability заказов

### 2️⃣ `002_row_level_security.sql`
**Настраивает Row Level Security (RLS)**:
- Включает RLS на всех таблицах
- Создает политики для изоляции данных по ролям (manufacturer/dealer)
- Добавляет helper функции для проверки ролей

### 3️⃣ `003_seed_data.sql`
**Заполняет тестовыми данными**:
- 1 тестовый производитель (Exce1sior Marine)
- 3 тестовых дилера (Miami, Berlin, Singapore)
- 4 модели лодок (2.9, 2.9E, 3.3, 3.3E)
- 3 материала
- 7 цветов
- 8 опций
- Примеры markup chains для дилеров
- Кастомные опции дилеров

### 4️⃣ `004_fix_auth_user_link.sql`
**Исправляет связь auth пользователей**

### 5️⃣ `005_add_dealer_status.sql`
**Добавляет статусы дилеров**

### 6️⃣ `006_manufacturer_can_update_dealers.sql`
**Разрешает производителям обновлять дилеров**

### 7️⃣ `007_allow_public_dealer_signup.sql`
**Разрешает публичную регистрацию дилеров**

### 8️⃣ `008_register_dealer_profile_function.sql`
**Добавляет RPC функцию для регистрации дилеров**

### 9️⃣ `009_fix_products_rls_policy.sql` ⭐ **ВАЖНО**
**Исправляет RLS политики для products**:
- Разделяет политику FOR ALL на отдельные политики (SELECT, INSERT, UPDATE, DELETE)
- Добавляет WITH CHECK клаузы для INSERT и UPDATE
- Исправляет проблему "Failed to update product"

**⚠️ Эта миграция критична для работы админки!**

---

## 🚀 Как выполнить миграции

### Вариант A: Через Supabase Dashboard (рекомендуется для первого раза)

1. Откройте ваш проект: https://supabase.com/dashboard/project/ttxzvjbwcyhwccumfrxp

2. Перейдите в **SQL Editor** (левое меню)

3. Выполните миграции по порядку:

#### Миграция 001:
```sql
-- Скопируйте весь код из 001_initial_schema.sql
-- Вставьте в SQL Editor
-- Нажмите "Run" (или Ctrl+Enter)
```

#### Миграция 002:
```sql
-- Скопируйте весь код из 002_row_level_security.sql
-- Вставьте в SQL Editor
-- Нажмите "Run"
```

#### Миграция 003:
```sql
-- Скопируйте весь код из 003_seed_data.sql
-- Вставьте в SQL Editor
-- Нажмите "Run"
```

4. Проверьте результат в **Table Editor**

---

### Вариант B: Через Supabase CLI (для продвинутых)

#### Установка CLI:
```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Инициализация:
```bash
# В директории exce1sior-configurator
supabase init
```

#### Линк к проекту:
```bash
supabase link --project-ref ttxzvjbwcyhwccumfrxp
# Введите Database Password когда попросит
```

#### Выполнение миграций:
```bash
# Применить все миграции
supabase db push

# ИЛИ выполнить конкретную миграцию
supabase db execute --file supabase/migrations/001_initial_schema.sql
supabase db execute --file supabase/migrations/002_row_level_security.sql
supabase db execute --file supabase/migrations/003_seed_data.sql
```

---

### Вариант C: Через psql (если предпочитаете командную строку)

```bash
# Подключение к БД
psql "postgresql://postgres:[YOUR_PASSWORD]@db.ttxzvjbwcyhwccumfrxp.supabase.co:5432/postgres"

# Выполнение миграций
\i supabase/migrations/001_initial_schema.sql
\i supabase/migrations/002_row_level_security.sql
\i supabase/migrations/003_seed_data.sql

# Выход
\q
```

---

## ✅ Проверка успешной миграции

### 1. Проверьте таблицы:
```sql
-- В SQL Editor выполните:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Должны видеть:
- dealers
- dealer_catalog_filters
- dealer_custom_options
- dealer_markups
- manufacturers
- orders
- products

### 2. Проверьте данные:
```sql
-- Подсчет записей
SELECT 'Manufacturers' AS type, COUNT(*) AS count FROM manufacturers
UNION ALL
SELECT 'Dealers', COUNT(*) FROM dealers
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Dealer Markups', COUNT(*) FROM dealer_markups;
```

Ожидаемые результаты:
- Manufacturers: 1
- Dealers: 3
- Products: 22 (4 models + 3 materials + 7 colors + 8 options)
- Dealer Markups: 6 (по 2 на каждого дилера)

### 3. Проверьте RLS:
```sql
-- Проверка политик
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Должны видеть несколько политик для каждой таблицы.

---

## 🗑️ Откат миграций (если что-то пошло не так)

### Удалить все данные (но сохранить структуру):
```sql
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE dealer_custom_options CASCADE;
TRUNCATE TABLE dealer_catalog_filters CASCADE;
TRUNCATE TABLE dealer_markups CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE dealers CASCADE;
TRUNCATE TABLE manufacturers CASCADE;
```

### Удалить все таблицы (полный откат):
```sql
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS dealer_custom_options CASCADE;
DROP TABLE IF EXISTS dealer_catalog_filters CASCADE;
DROP TABLE IF EXISTS dealer_markups CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS dealers CASCADE;
DROP TABLE IF EXISTS manufacturers CASCADE;

DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS prevent_order_updates CASCADE;
DROP FUNCTION IF EXISTS is_manufacturer CASCADE;
DROP FUNCTION IF EXISTS is_dealer CASCADE;
DROP FUNCTION IF EXISTS current_dealer_id CASCADE;
```

После отката можете выполнить миграции заново.

---

## 📊 Структура базы данных

```
manufacturers (1)
    ↓
products (N) - models, materials, colors, options
    ↓
dealers (N) - regional distributors
    ↓
    ├── dealer_markups (N) - pricing chain
    ├── dealer_catalog_filters (N) - product visibility
    ├── dealer_custom_options (N) - custom products
    └── orders (N) - customer orders (immutable)
```

---

## 🔒 Роли и доступ

### Manufacturer (Производитель):
- **Чтение**: все таблицы
- **Запись**: products (полный CRUD)
- **Ограничения**: не может изменять orders

### Dealer (Дилер):
- **Чтение**: products (read-only), dealers (own only), dealer_markups (own only), dealer_catalog_filters (own only), dealer_custom_options (own only), orders (own only)
- **Запись**: dealers (own only), dealer_markups (own), dealer_catalog_filters (own), dealer_custom_options (own)
- **Ограничения**: не может изменять products, не может видеть других дилеров

### Public (Пользователи):
- **Чтение**: products (только active)
- **Запись**: orders (INSERT only)
- **Ограничения**: не видят цены, наценки, данные дилеров

---

## 🐛 Troubleshooting

### Ошибка: "relation already exists"
```
Решение: Таблица уже создана. Либо пропустите миграцию, либо выполните DROP TABLE перед повторным запуском.
```

### Ошибка: "permission denied"
```
Решение: Убедитесь что используете Service Role Key, а не Anon Key для миграций.
```

### Ошибка: "violates foreign key constraint"
```
Решение: Выполняйте миграции строго по порядку. 001 → 002 → 003.
```

### Ошибка: "already enabled row level security"
```
Решение: RLS уже включен. Можно игнорировать или закомментировать строки ALTER TABLE ... ENABLE RLS.
```

---

## 📚 Дополнительная информация

- **Документация Supabase**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security

---

## ⏭️ Следующие шаги

После успешного выполнения миграций:

1. ✅ Проверьте данные в Table Editor
2. ✅ Настройте `.env` файл с ключами
3. ✅ Создайте тестовых пользователей (manufacturer и dealer) через Supabase Auth
4. ✅ Запустите dev сервер: `npm run dev`
5. ✅ Проверьте подключение к БД в консоли браузера

---

**Создано**: 2025-10-19  
**Версия**: 1.0.0  
**Статус**: Готово к использованию

