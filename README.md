# Million List Test Task

Завершений full-stack тестовий проєкт на **Node.js / Express.js + React / Vite**.

Проєкт реалізує роботу з двома пов’язаними списками на базовому наборі з **1 000 000 ID**, із server-side state, чергами змін, batching, deduplication, infinite scroll та синхронізацією frontend ↔ backend.

## Що реалізовано

- два пов’язані списки: `Available` і `Selected`
- базовий діапазон із `1 000 000` ID без створення масиву з мільйона елементів
- server-side state як source of truth
- REST API
- infinite scroll порціями по 20 елементів
- додавання нових ID
- select / unselect
- drag & drop reorder
- збереження вибору та порядку після reload
- синхронізація frontend ↔ backend
- окремі черги змін
- batching і deduplication
- reset серверного стану для демонстрації

## Стек

### Backend
- Node.js
- Express.js

### Frontend
- React
- Vite

## Архітектура

### Backend — source of truth

Backend зберігає:
- базовий діапазон ID
- додані вручну ID
- вибрані ID
- порядок вибраних ID
- черги змін
- службовий state для синхронізації

Frontend не є джерелом істини — він відображає стан, надсилає дії користувача та синхронізується з backend.

## Черги та batching

У проєкті використовуються дві окремі черги.

### addQueue

Використовується для додавання нових ID:
- deduplication за ID
- flush раз на 10 секунд

### mutateQueue

Використовується для:
- select
- unselect
- reorder

Особливості:
- deduplication
- flush раз на 1 секунду

## Робота з 1 000 000 ID

Базовий набір не створюється як масив із мільйона елементів.

Замість цього використовується віртуальний діапазон, а backend повертає тільки потрібний slice через:
- offset
- limit

Це дозволяє не витрачати зайву пам’ять і не передавати великі обсяги даних на frontend.

## Синхронізація frontend ↔ backend

Для відстеження серверного стану використовуються:
- version
- resetCount
- bootId

Frontend може визначити:
- звичайну зміну state
- reset
- рестарт backend
- початок нового server lifecycle

Після цього потрібні дані перечитуються з backend.

## API

### System
- GET /api/health
- GET /api/state
- POST /api/debug/reset

### Items
- GET /api/items/available
- GET /api/items/selected
- GET /api/items/selected-all
- POST /api/items/add
- POST /api/items/select
- POST /api/items/unselect
- POST /api/items/reorder

## Infinite Scroll

Frontend зберігає тільки UI-state прокрутки та paging.

Backend нічого не знає про позицію scroll і повертає лише потрібну порцію даних.

Після звичайних server-side змін уже відкрита глибина списку зберігається.

Після reset або рестарту backend frontend повертається до початкової сторінки.

## Reorder

Drag & drop доступний тільки для Selected.

При активному фільтрі reorder вимкнений, тому що зміна порядку лише видимого піднабору створює неоднозначність щодо глобального порядку.

Це свідоме архітектурне рішення для передбачуваної поведінки системи.

## Локальний запуск

### Backend

`cd backend`  
`npm install`  
`npm run dev`

Backend: `http://localhost:3001`

### Frontend

`cd frontend`  
`npm install`  
`npm run dev`

Frontend: `http://localhost:5173`

## Основна ідея

Frontend = UI + дії користувача

Backend = state + source of truth

## Demo

GitHub: https://github.com/sl8353550/million-list-test-task

