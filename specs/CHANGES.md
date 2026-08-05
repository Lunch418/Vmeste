# CHANGES.md — «Вместе» MVP

Реализация по `specs/SPEC.md` и `specs/COMPONENTS.md`/`NAVIGATION.md`.
Написано напрямую (без вложенных агентов run_team.sh — см. историю чата: nested `claude -p`
не мог получить разрешение на запись файлов в неинтерактивном режиме и не реализовал ничего).

## Backend (`backend/`, FastAPI + SQLAlchemy)

Полностью рабочие эндпоинты (см. `specs/SPEC.md` раздел 5):

- **Auth**: `POST /auth/phone`, `POST /auth/verify` — выдача JWT
- **Users**: `GET/PATCH /users/me`, `GET /users/{id}`, `POST /users/{id}/report`, `POST /users/{id}/block`
- **Events**: полный CRUD + `join`/`leave`, фильтры (тип, дата, депозит, город)
- **Deposits**: создание, `webhook`, `refund`, эскроу-состояния (`held/released_to_payer/released_to_poster/refunded`)
- **Chat**: REST-история сообщений + `WS /ws/events/{id}/chat` (реалтайм, только для участников события)
- **Meeting confirmation**: `confirm/selfie` (метаданные — количество лиц), `confirm/qr/generate|scan`, `rate`
- **Notifications**: `subscribe`, список уведомлений
- Автоархивирование события через 2 часа после `datetime` (фоновая задача, проверка каждые 5 минут); неподтверждённые участия при архивации переводятся в `no_show`, депозит уходит постеру
- 78 pytest-тестов покрывают auth, события, депозиты, подтверждение встречи, рейтинг, автоархив, блокировки — все проходят (`.venv/bin/python -m pytest`)
- `docker-compose.yml`: backend + Postgres + Redis

### Исправлено после код-ревью и QA (specs/REVIEW.md, specs/TEST_REPORT.md)

- Расчёт эскроу-депозита при подтверждении встречи — теперь по конкретному участию, а не по всем участникам события разом (был критический баг, см. `docs/CHANGELOG.md`)
- WebSocket-чат проверяет `is_banned` при подключении
- `POST /events/{id}/join` проверяет возраст и пол джойнера против `age_min`/`age_max`/`gender_filter` события — только когда эти поля заполнены в профиле (см. `User.gender`, новое поле); блокирует также присоединение при взаимной блокировке (`Block`)
- `POST /events/{id}/leave` идемпотентно отклоняет повторную отмену уже отменённого участия
- `GET /deposits/{id}` — доступ только плательщику или постеру события
- `POST /events/{id}/rate` — проверка времени встречи, запрет самооценки, проверка существования `rated_id`
- `POST /auth/phone`/`verify` — валидация формата телефона (`^\+?\d{10,15}$`) и кода (4 цифры)
- `EventCreate` — `deposit_amount >= 0`, `slots_total >= 1`, `age_min <= age_max`
- `POST /users/{id}/block` — теперь реально сохраняется (таблица `Block`) и учитывается при `join`; **не** enforced в чате/ленте — блокировка ограничивает только присоединение к новым событиям, не задним числом на уже совместных

### Осознанно заглушено (нет реальных внешних учётных данных)

- **SMS-провайдер** (`app/sms.py`): код подтверждения пишется в лог сервера вместо реальной отправки. Подключить SMS.ru/SMSC/Twilio при наличии ключей.
- **ЮKassa Split / эскроу** (`app/payments.py`): `create_payment`/`refund_payment` возвращают фиктивный `payment_id` и `True` вместо реального вызова API ЮKassa. Webhook-эндпоинт есть, но не проверяет подпись реального провайдера. Нужен merchant-аккаунт (shop_id/secret_key).
- Alembic-миграции не подключены — используется `Base.metadata.create_all` при старте (для MVP; на проде — добавить Alembic до первого деплоя на Postgres).

## Frontend (`frontend/`, Vite + React + TypeScript, PWA)

Экраны по `specs/NAVIGATION.md`: AuthFlow, FeedScreen, EventDetailScreen, CreateEventWizard (5 шагов),
ChatScreen (WebSocket), ConfirmMeetingScreen, RatingScreen, ProfileScreen, SettingsScreen, TabBar
(мобильная нижняя навигация / боковая на десктопе).

- Визуальный дизайн реализован по макету из Claude Design (`Vmeste.dc.html`,
  project `f401207d-196f-4fe7-9b07-3da4d4620624`) — тёплая кремово-терракотовая
  палитра, шрифты Caprasimo/Figtree (самохостятся, `public/fonts/`), см.
  обновлённый `specs/COMPONENTS.md`. Вся работа с реальным API/WS/камерой
  сохранена без изменений — менялся только слой представления.
  Старая тёмная палитра доступна через переключатель темы в `SettingsScreen`
  (persist в `localStorage`, `data-theme="dark"` на `<html>`).
- PWA: манифест, service worker (`vite-plugin-pwa`, `registerType: autoUpdate`); иконки-плейсхолдеры (`public/icon-192.png`, `icon-512.png` — залить реальный арт перед релизом)
- `npm run build` и `npm run lint` (oxlint) проходят чисто
- Dev-сервер проверен: страница и `main.tsx` отдаются корректно (200)

### Осознанно упрощено

- **AR-селфи** (`ConfirmMeetingScreen`): реальный доступ к камере через `getUserMedia` работает, но распознавание двух лиц (MediaPipe Face Mesh) не подключено — количество "лиц в кадре" переключается вручную слайдером для демонстрации потока подтверждения и расчёта депозита. Подключить MediaPipe — отдельная задача (модель + тюнинг на устройстве).
- **QR-подтверждение**: работает через реальный backend-эндпоинт, но без камеры — QR-токен показывается и чекерборд-плейсхолдером (визуал по макету), и текстом (нужен для ручного тестирования без второго устройства с камерой). Добавить `jsQR`/`qr-scanner` для реального сканирования.
- **Live-геолокация за 30 минут до встречи** — вне MVP по `specs/SPEC.md` (Этап 2), не реализовано.
- **Карточка события не хранит короткий заголовок** (`Event` в БД — только `activity_type` + `description`, без отдельного `title`, как в макете) — сознательно не добавлялось: потребовало бы миграции схемы бэкенда, вне рамок фронтенд-редизайна. Карточка/детали показывают `activity_type` как заголовок.

## Не входит в это изменение (см. `specs/SPEC.md` раздел 2 — вне MVP)

Live-геолокация, карта города, верификация лица при регистрации, SOS, премиум/монетизация,
нативные приложения, второй город.
