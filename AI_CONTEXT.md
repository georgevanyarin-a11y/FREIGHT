# AI_CONTEXT — Перевозчик CRM

Этот файл описывает архитектуру проекта, чтобы любой ИИ-ассистент (или разработчик)
быстро понял структуру и безопасно добавлял новые модули, не ломая ядро.

## 1. Назначение

Ядро CRM-системы для ИП-перевозчика (грузоперевозки). Веб-приложение (PWA).
Текущая версия содержит: авторизацию, макет (боковая панель + шапка) и рабочий
модуль «Заявки». Остальные разделы — заглушки, готовые к наполнению.

## 2. Стек

- **React 18 + Vite** (JSX, без TypeScript)
- **Tailwind CSS** (фирменная палитра в `tailwind.config.js`: `brand.*` — сине-серый, `ink.*` — нейтральные)
- **Supabase** — Auth (email/пароль), PostgreSQL, Storage, Edge Functions (на будущее)
- **react-router-dom v6** — маршрутизация
- **react-icons** (набор `fi`, Feather) — иконки

## 3. Структура каталогов

```
src/
  components/
    ui/        Переиспользуемые компоненты: Button, Input, Textarea, Select,
               Modal, ConfirmDialog, Badge
    layout/    Sidebar, Header, Layout (каркас), ProtectedRoute (гард авторизации)
  pages/
    Login.jsx, Register.jsx        Авторизация (AuthShell экспортируется из Login)
    Placeholder.jsx                Универсальная заглушка модуля
    Orders/
      OrderList.jsx                Таблица + пагинация + удаление + поиск
      OrderForm.jsx                Модальная форма создания/редактирования
    Documents / Counterparties / Finance / Reminders / Settings   Заглушки
  lib/
    supabaseClient.js              Клиент Supabase из VITE_*-переменных
  hooks/
    useAuth.jsx                    AuthProvider + хук useAuth (session, user, signIn/Up/Out)
  App.jsx                          Таблица маршрутов
  main.jsx                         Точка входа: BrowserRouter → AuthProvider → App + регистрация SW
```

## 4. Авторизация

- `AuthProvider` (в `hooks/useAuth.jsx`) хранит `session`/`user`, подписан на
  `supabase.auth.onAuthStateChange`, восстанавливает сессию из localStorage
  (`persistSession: true`) — при F5 пользователь не разлогинивается.
- `ProtectedRoute` показывает спиннер на время проверки и редиректит на `/login`,
  если сессии нет.
- API хука: `signIn(email, password)`, `signUp(email, password)`, `signOut()`.

## 5. Данные: таблица `orders`

Все операции идут напрямую через `supabase` client (без своего бэкенда).
Поля (см. `supabase/schema.sql`):

| Колонка                    | Тип       | Назначение                       |
|----------------------------|-----------|----------------------------------|
| id                         | uuid PK   | идентификатор                    |
| user_id                    | uuid FK   | владелец (auth.users)            |
| order_number               | text      | номер заявки                     |
| order_date                 | date      | дата                             |
| loading_address            | text      | адрес погрузки                   |
| unloading_address          | text      | адрес выгрузки                   |
| loading_contact_name       | text      | контакт погрузки — имя           |
| loading_contact_phone      | text      | контакт погрузки — телефон       |
| unloading_contact_name     | text      | контакт выгрузки — имя           |
| unloading_contact_phone    | text      | контакт выгрузки — телефон       |
| delivery_deadline          | date      | срок доставки                    |
| rate                       | numeric   | ставка, ₽                        |
| status                     | text      | 'active' | 'done'                |
| note                       | text      | примечание                       |
| created_at                 | timestamptz | дата создания (сортировка)     |

**RLS включён**: пользователь видит/меняет только свои строки
(`auth.uid() = user_id`). Поэтому в запросах не нужно вручную фильтровать по
пользователю — это делает база.

## 6. Как добавить новый модуль (паттерн)

1. Создать `src/pages/<Module>/<Module>List.jsx` (и формы при необходимости).
2. Добавить пункт в `NAV_ITEMS` внутри `components/layout/Sidebar.jsx`
   (`{ to, label, icon }`).
3. Добавить `<Route path="/<module>" element={<...>} />` в `App.jsx`
   внутри защищённой зоны.
4. Если нужна таблица в БД — создать миграцию с RLS по образцу `orders`
   (обязательно `user_id` + 4 политики select/insert/update/delete).
5. Переиспользовать `components/ui/*` для единого вида.

## 7. PWA

- `public/manifest.json` — манифест (иконка `public/icon.svg`).
- `public/sw.js` — базовый service worker: кеширует оболочку, Supabase-запросы
  в сеть напрямую (офлайн необязателен на этом этапе). Регистрируется в `main.jsx`.

## 8. Переменные окружения

`.env` (по образцу `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 9. Точки расширения на будущее

- **Документы**: Supabase Storage + генерация PDF (заявка-договор, акт).
- **Контрагенты**: таблица `counterparties`, связь с `orders.counterparty_id`.
- **Финансы**: оплаты по заявкам, дебиторка (поля/таблица `payments`).
- **Напоминания**: Edge Functions + расписание (pg_cron) по `delivery_deadline`.
- **Сканер договоров**: загрузка файла в Storage + распознавание.
