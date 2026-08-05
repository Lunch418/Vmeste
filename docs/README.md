# «Вместе»

Платформа для поиска компании на совместные офлайн-активности: находишь событие,
присоединяешься с денежным депозитом (гарантия явки), подтверждаешь встречу
AR-селфи или QR-кодом, получаешь депозит обратно.

MVP запускается только в Перми (см. `specs/SPEC.md`).

> Старое рабочее название проекта — «Пошли» — использовать не нужно, актуальное
> название — «Вместе».

## Стек

- **Frontend**: React 19 + TypeScript, Vite, PWA (`vite-plugin-pwa`), React Router — `frontend/`
- **Backend**: Python + FastAPI, SQLAlchemy ORM — `backend/`
- **БД**: PostgreSQL (прод, через Docker Compose) / SQLite (по умолчанию для локальной разработки), Redis (заложен под сессии/кэш, в MVP активно не используется)
- **Аутентификация**: JWT (вход по телефону + SMS-код)

## Структура репозитория

```
backend/    FastAPI-приложение (app/), тесты (tests/), Dockerfile
frontend/   Vite + React + TS PWA (src/)
specs/      технические спецификации, дизайн, отчёты (SPEC, COMPONENTS, NAVIGATION, CHANGES, REVIEW, TEST_REPORT)
docs/       этот документ и остальная документация проекта
docker-compose.yml   backend + Postgres + Redis одной командой
```

## Быстрый старт

### Вариант А — Docker Compose (backend + Postgres + Redis)

```bash
docker compose up --build
```

Backend поднимется на `http://localhost:8000` (Postgres на `5432`, Redis на `6379`).
Переменные окружения для контейнера backend заданы прямо в `docker-compose.yml`
(`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) — для локальной демонстрации менять не обязательно,
но `JWT_SECRET` **обязательно** заменить перед любым использованием вне локальной машины.

Frontend в Docker Compose не описан — запускается отдельно (см. ниже).

### Вариант Б — backend вручную (venv)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

По умолчанию (без `.env`) backend использует `sqlite:///./vmeste.db` — файл создастся
в `backend/` автоматически, миграции не требуются (см. «Известные ограничения» ниже).

Тесты:

```bash
cd backend
python -m pytest -q
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev-сервер Vite поднимется на `http://localhost:5173` и обращается к backend по адресу
из `VITE_API_BASE` (по умолчанию `http://localhost:8000`, см. `frontend/src/api/client.ts`).

Прочие команды:

```bash
npm run build     # tsc -b && vite build — прод-сборка
npm run lint       # oxlint
npm run test       # vitest run
npm run preview    # локальный просмотр прод-сборки
```

## Переменные окружения

### Backend (`backend/.env`, читается `app/config.py`, класс `Settings`)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./vmeste.db` | Строка подключения к БД. В Docker Compose переопределена на Postgres |
| `REDIS_URL` | `redis://localhost:6379/0` | Подключение к Redis (заложено, активно не используется в MVP) |
| `JWT_SECRET` | `dev-secret-change-in-production` | Секрет подписи JWT. **Обязательно сменить в любом окружении кроме локальной разработки** — приложение не проверяет и не предупреждает, если используется дефолт (см. `specs/REVIEW.md`, п. 4) |
| `JWT_ALGORITHM` | `HS256` | Алгоритм подписи JWT |
| `JWT_EXPIRE_MINUTES` | `43200` (30 дней) | Срок жизни токена |
| `ALLOWED_CITY` | `Пермь` | Город, по которому фильтруется лента (жёсткое MVP-ограничение по SPEC.md) |
| `MEETING_CONFIRM_WINDOW_MINUTES` | `120` | Окно после начала события, в течение которого доступно подтверждение встречи (AR-селфи/QR) |
| `NO_SHOW_GRACE_MINUTES` | `15` | Ожидание второй стороны перед тем, как разрешить компенсацию за неявку |
| `ARRIVAL_RADIUS_METERS` | `150` | Допустимое расстояние от точки встречи для геоподтверждения явки |
| `CORS_ALLOWED_ORIGINS` | `["http://localhost:5173","http://127.0.0.1:5173"]` | Список источников, которым разрешены credentialed CORS-запросы (JSON-массив строк) |

### Frontend (`.env` в `frontend/`, читается через `import.meta.env`)

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000` | Базовый URL backend API и WS (`frontend/src/api/client.ts`) |

## Известные ограничения MVP (осознанные заглушки)

- **SMS-провайдер** (`backend/app/sms.py`) не подключён к реальному оператору — код
  подтверждения пишется в лог сервера. Нужно подключить SMS.ru/SMSC/Twilio.
- **ЮKassa Split / эскроу** (`backend/app/payments.py`) — заглушка, возвращает фиктивный
  `payment_id`; вебхук не проверяет реальную подпись провайдера. Нужен merchant-аккаунт.
- **Alembic-миграции не подключены** — схема БД создаётся через `Base.metadata.create_all`
  при старте. Перед первым деплоем на постоянный Postgres в проде стоит завести Alembic.
- **AR-селфи**: доступ к камере работает, но распознавание двух лиц (MediaPipe Face Mesh)
  не подключено — количество лиц переключается вручную для демонстрации потока.
- **QR-подтверждение**: работает через реальный backend-эндпоинт, но без сканирования
  камерой — токен вводится текстом.

Список известных, но не исправленных багов backend (не блокирующих демонстрацию MVP) —
см. `specs/TEST_REPORT.md`.
