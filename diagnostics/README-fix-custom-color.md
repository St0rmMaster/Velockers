# Исправление проблемы с Custom Hull Color

## Описание проблемы

При редактировании опции "Custom hull color" в админке изменения не применяются на странице конфигуратора.

### Причина

В базе данных для продукта Custom hull color (type='color', kind='custom') в поле `metadata` хранится **устаревшее поле `priceEur`**, которое имеет приоритет над обновленными данными из-за логики загрузки в `catalogLoader.ts`:

```typescript
const price = Number(metadata.priceUsd ?? metadata.priceEur ?? row.price_usd ?? row.price_eur ?? 0);
```

Когда вы редактируете цену в админке, новое значение сохраняется в `metadata.priceUsd`, но старое `metadata.priceEur` остается, и при определенных условиях может использоваться старое значение.

## Решение

### 1. Обновление кода (✅ Уже выполнено)

Внесены изменения в:
- **`ProductForm.tsx`**: Форма теперь создает чистый metadata объект без deprecated полей
- **`productService.ts`**: Добавлена фильтрация undefined значений перед сохранением metadata

### 2. Очистка существующих данных в базе

Запустите скрипт для удаления deprecated поля `priceEur` из существующих записей:

```bash
cd exce1sior-configurator
node diagnostics/fix-custom-color-metadata.mjs
```

Скрипт выполнит:
- Найдет все записи color products с kind='custom'
- Удалит поле `priceEur` из metadata
- Установит правильное значение в `priceUsd`
- Обновит поле `price_usd` в таблице

### 3. Проверка исправления

После запуска скрипта:

1. Откройте админ-панель
2. Перейдите в раздел **Colours**
3. Найдите "Custom hull color"
4. Измените цену (например, на 350 USD)
5. Сохраните
6. Откройте конфигуратор в новой вкладке (или очистите кеш браузера)
7. Проверьте, что новая цена отображается для Custom hull color

### 4. Очистка кеша (если необходимо)

Если изменения все еще не применяются:

1. Откройте DevTools (F12)
2. Перейдите в Application → Local Storage
3. Найдите ключ `exce1sior.catalog-cache.v1`
4. Удалите его
5. Обновите страницу

Или используйте страницу Dev Settings в админке для очистки кеша.

## Техническая информация

### Структура metadata для custom color

**Правильная структура** (после исправления):
```json
{
  "kind": "custom",
  "code": "custom-color",
  "name": {
    "en": "Custom hull color",
    "ru": "Кастомный цвет корпуса"
  },
  "description": {
    "en": "Choose any color",
    "ru": "Выберите любой цвет"
  },
  "badge": {
    "en": "free ≥3 boats",
    "ru": "бесплатно ≥3 лодок"
  },
  "priceUsd": 300
}
```

**Устаревшая структура** (с проблемой):
```json
{
  "kind": "custom",
  "code": "custom-color",
  "priceEur": 200,  // ❌ DEPRECATED - удалить!
  "priceUsd": 300,
  ...
}
```

### Приоритет загрузки цены в catalogLoader.ts

```typescript
metadata.priceUsd    // Приоритет 1 - используется теперь
?? metadata.priceEur // Приоритет 2 - DEPRECATED, будет удален
?? row.price_usd     // Приоритет 3 - fallback
?? row.price_eur     // Приоритет 4 - legacy fallback
?? 0                 // По умолчанию
```

## Предотвращение проблемы в будущем

После внесенных изменений:
- При редактировании Custom color в админке старые поля больше не будут сохраняться
- Metadata будет содержать только актуальные поля
- Конфигуратор будет корректно загружать обновленные цены

## Проверка данных в базе

Если нужно вручную проверить данные:

```sql
-- Проверить custom color в базе
SELECT 
  id, 
  name, 
  type,
  price_usd,
  metadata->>'kind' as kind,
  metadata->>'priceUsd' as metadata_price_usd,
  metadata->>'priceEur' as metadata_price_eur
FROM products 
WHERE type = 'color' 
  AND metadata->>'kind' = 'custom';
```

Ожидаемый результат после исправления:
- `metadata_price_eur` должен быть `NULL`
- `metadata_price_usd` должен содержать актуальную цену
- `price_usd` должен совпадать с `metadata_price_usd`

