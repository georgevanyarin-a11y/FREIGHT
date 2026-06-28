# Перевозчик CRM

Ядро CRM-системы для ИП-перевозчика. React (Vite) + Tailwind + Supabase. PWA.

## Быстрый старт

### 1. Supabase
1. Создайте проект на [supabase.com](https://supabase.com) (New project).
2. **SQL Editor → New query** → вставьте содержимое `supabase/schema.sql` → **Run**.
3. **Project Settings → API** скопируйте:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` ключ → `VITE_SUPABASE_ANON_KEY`
4. (Опционально) **Authentication → Providers → Email**: чтобы входить сразу без
   подтверждения почты, отключите *Confirm email* на время разработки.

### 2. Переменные окружения
Скопируйте `.env.example` → `.env` и подставьте значения из шага 1.

### 3. Запуск
```bash
npm install
npm run dev
```
Откройте адрес из консоли (обычно http://localhost:5173).

## StackBlitz
1. Откройте https://stackblitz.com → новый проект **Vite + React**.
2. Перенесите файлы из этого архива (или загрузите zip кнопкой загрузки проекта).
3. В StackBlitz переменные окружения задаются через файл `.env` в корне —
   создайте его и впишите `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
4. Зависимости (`@supabase/supabase-js`, `react-router-dom`, `react-icons`) уже
   указаны в `package.json` — StackBlitz установит их автоматически.

## Структура
См. `AI_CONTEXT.md` — там подробно описаны архитектура и паттерн добавления модулей.
