# ARCHITECTURE.md — «Вместе»

## 1. Обзор

MVP — классическое клиент-серверное приложение: React PWA обращается к REST/WebSocket
API FastAPI-бэкенда, который хранит данные в PostgreSQL (в Docker Compose) или SQLite
(локальная разработка по умолчанию). Redis заложен в инфраструктуру, но в MVP активно
не используется бизнес-логикой. Фоновая asyncio-задача внутри backend-процесса
периодически архивирует просроченные события.

Внешние интеграции (SMS-провайдер, ЮKassa Split) в MVP — контролируемые заглушки
(`backend/app/sms.py`, `backend/app/payments.py`), готовые к замене на реальные вызовы.

## 2. Компонентная диаграмма

```mermaid
flowchart LR
    subgraph Client["Клиент (браузер / PWA)"]
        UI["React + TS SPA\nfrontend/src"]
        SW["Service Worker\n(vite-plugin-pwa)"]
    end

    subgraph Backend["Backend — FastAPI (backend/app)"]
        API["REST-роутеры\nauth · users · events\ndeposits · chat · confirm\nnotifications"]
        WS["WS-менеджер\nws_manager.py"]
        ARCH["Фоновая задача\narchive.py\n(каждые 5 мин)"]
        SMS["sms.py\n(заглушка)"]
        PAY["payments.py\nЮKassa-заглушка"]
    end

    DB[(PostgreSQL / SQLite)]
    REDIS[(Redis\nзаложен, не используется)]
    YK["ЮKassa Split\n(внешний, не подключён)"]
    SMSP["SMS-провайдер\n(внешний, не подключён)"]

    UI -- "REST (fetch, JWT в Authorization)" --> API
    UI -- "WebSocket ?token=jwt" --> WS
    SW -.кэш статики / офлайн.- UI

    API --> DB
    API --> SMS
    API --> PAY
    WS --> DB
    ARCH --> DB

    SMS -.в MVP: лог сервера, план — подключить.-> SMSP
    PAY -.в MVP: фиктивный payment_id, план — подключить.-> YK
    API -. заложено, не используется .-> REDIS
```

## 3. Поток данных: присоединение к событию с депозитом

```mermaid
sequenceDiagram
    participant U as Джойнер (UI)
    participant A as Backend API
    participant P as payments.py (заглушка ЮKassa)
    participant DB as БД

    U->>A: POST /events/{id}/join
    A->>DB: создать Participation(status=joined)
    A-->>U: 201 ParticipationOut

    U->>A: POST /deposits {participation_id}
    A->>P: create_payment(amount)
    P-->>A: фиктивный yukassa_payment_id
    A->>DB: Deposit(escrow_status=held)
    A-->>U: 201 DepositOut

    Note over A,DB: реальный webhook ЮKassa придёт на<br/>POST /deposits/{id}/webhook (в MVP не проверяет подпись)
```

## 4. Стейт-машина события / участия / депозита

Ключевая бизнес-логика продукта — согласование трёх взаимосвязанных состояний:
`Event.status`, `Participation.status`, `Deposit.escrow_status`. Подтверждение
встречи рассчитывается **по каждому участнику отдельно** (`confirm.py::_settle_participation`),
а не разом на всё событие — это исправленная критическая проблема, ранее описанная в
`specs/REVIEW.md` (там же зафиксирован сам факт бага, для истории).

```mermaid
stateDiagram-v2
    [*] --> active: POST /events

    state active {
        [*] --> joined: POST /events/{id}/join\n(создаётся Deposit: held)
        joined --> confirmed: confirm/selfie (2 лица)\nили confirm/qr/scan\n[в окне встречи, участие своё]\nDeposit -> released_to_payer
        joined --> cancelled: POST /events/{id}/leave\nDeposit -> refunded (через /deposits/{id}/refund)
        joined --> no_show: автоархив, если не подтверждено\nDeposit -> released_to_poster
    }

    active --> cancelled_event: DELETE /events/{id} (только автор)
    active --> archived: авто, датой + 2 часа\n(archive.py, каждые 5 мин)\nнеподтверждённые joined -> no_show

    archived --> [*]
    cancelled_event --> [*]
```

Депозит (`EscrowStatus`) — не отдельная стейт-машина события, а состояние, привязанное
к конкретному `Participation`: `held → released_to_payer` (подтверждена встреча) |
`held → released_to_poster` (no-show / автоархив) | `held → refunded` (участник вышел
до подтверждения через `POST /deposits/{id}/refund`).

## 5. Модель данных (сущности и связи)

```mermaid
erDiagram
    User ||--o{ Event : "poster_id"
    User ||--o{ Participation : "user_id"
    User ||--o{ Deposit : "payer_id"
    User ||--o{ Message : "sender_id"
    User ||--o{ Rating : "rater_id / rated_id"
    User ||--o{ Report : "reporter_id / reported_id"

    Event ||--o{ Participation : "event_id"
    Event ||--o{ Message : "event_id"

    Participation ||--o| Deposit : "deposit_id"

    User {
        string id
        string phone
        string name
        int age
        string city
        float rating_avg
        int meetings_count
        float attendance_rate
        bool is_banned
    }
    Event {
        string id
        string poster_id
        string activity_type
        datetime datetime_
        int age_min
        int age_max
        string gender_filter
        int slots_total
        int slots_taken
        int deposit_amount
        string status
        string city
    }
    Participation {
        string id
        string event_id
        string user_id
        string status
        string deposit_id
    }
    Deposit {
        string id
        string participation_id
        string payer_id
        int amount
        string escrow_status
        string yukassa_payment_id
    }
```

## 6. Frontend-структура

`frontend/src/`:
- `screens/` — экраны по `specs/NAVIGATION.md` (AuthFlow, FeedScreen, EventDetailScreen,
  CreateEventWizard, ChatScreen, ConfirmMeetingScreen, RatingScreen, ProfileScreen,
  SettingsScreen)
- `components/` — переиспользуемые UI-компоненты (карточка события, TabBar и т.д.)
- `api/client.ts` — обёртка над `fetch`/WebSocket, сборка query-строки, обработка ошибок,
  подстановка JWT в заголовок, `chatSocketUrl` для WS
- `context/` — `AuthContext` (хранение токена, состояние пользователя)

## 7. Известные архитектурные ограничения (см. `specs/TEST_REPORT.md`, `specs/REVIEW.md`)

- `GET /deposits/{id}` не проверяет принадлежность депозита текущему пользователю.
- QR-токен подтверждения хранится в памяти процесса backend (`confirm.py: _qr_tokens`) —
  не переживёт рестарт/масштабирование на несколько инстансов; для прода нужен Redis с TTL.
- Alembic не подключён, схема создаётся через `Base.metadata.create_all`.
- Нет проверки на старте, что в проде не используется дефолтный `JWT_SECRET`.
- Фильтры `age_min/age_max/gender_filter` не применяются на `join` (только фильтр ленты).
