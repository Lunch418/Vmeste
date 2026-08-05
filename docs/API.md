# API.md — «Вместе»

Справочник REST/WebSocket API backend, составлен по фактическому коду роутеров в
`backend/app/routers/` (не по SPEC.md — там перечень эндпоинтов совпадает, но детали
запросов/ответов уточнены здесь по реализации). Базовый URL — `VITE_API_BASE`
(по умолчанию `http://localhost:8000`), без общего префикса `/api`.

Аутентификация — JWT в заголовке `Authorization: Bearer <token>` (выдаётся
`POST /auth/verify`). В таблицах ниже колонка «Auth» указывает, требуется ли токен.

Формат сумм: `deposit_amount` / `amount` — целое число, копейки.

---

## Auth (`backend/app/routers/auth.py`)

| Метод | Путь | Auth | Тело запроса | Ответ |
|---|---|---|---|---|
| POST | `/auth/phone` | нет | `{ phone: string }` | `204 No Content`. Генерирует код и пишет в лог (`app/sms.py` — заглушка, реальная отправка не подключена) |
| POST | `/auth/verify` | нет | `{ phone: string, code: string }` | `200` `{ access_token, token_type: "bearer" }`. Создаёт пользователя при первом входе. `400`, если код неверный/истёк |

Валидации формата `phone`/`code` на уровне схемы нет (`schemas.py`: `phone: str`,
`code: str`) — известный пробел, см. `specs/TEST_REPORT.md` п. 7.

## Users (`backend/app/routers/users.py`)

| Метод | Путь | Auth | Тело запроса | Ответ |
|---|---|---|---|---|
| GET | `/users/me` | да | — | `200` `UserOut` |
| PATCH | `/users/me` | да | `UserProfileUpdate` (частично: `name, age, city, avatar_url, interests[]`) | `200` `UserOut` |
| GET | `/users/{id}` | нет | — | `200` `UserOut` (публичный профиль). `404`, если не найден |
| POST | `/users/{id}/report` | да | `{ event_id?: string, reason: string }` | `204`. Создаёт запись `Report` |
| POST | `/users/{id}/block` | да | — | `204`, **no-op на сервере** — блокировка реализована только на фронтенде (locally), серверной модели блокировок нет (см. `specs/TEST_REPORT.md` п. 9) |

`UserOut`: `{ id, name, age, city, avatar_url, rating_avg, meetings_count, attendance_rate, interests: string[] }`

## Events (`backend/app/routers/events.py`)

| Метод | Путь | Auth | Запрос | Ответ |
|---|---|---|---|---|
| GET | `/events` | нет | query: `type?, date?, deposit_min?, deposit_max?, city=Пермь` | `200` `EventOut[]`, только `status=active`, отсортировано по `datetime` |
| POST | `/events` | да | `EventCreate` | `201` `EventOut` |
| GET | `/events/{id}` | нет | — | `200` `EventOut`. `404` |
| PATCH | `/events/{id}` | да | `EventUpdate` (частично: `photo_url, datetime, location_address, description`) | `200` `EventOut`. `403`, если не автор |
| DELETE | `/events/{id}` | да | — | `204`, переводит в `status=cancelled`. `403`, если не автор |
| POST | `/events/{id}/join` | да | — | `201` `ParticipationOut`. `400`, если своё событие / нет мест / уже участвует; `404`, если событие неактивно |
| POST | `/events/{id}/leave` | да | — | `204`, переводит участие в `cancelled`, уменьшает `slots_taken`. `404`, если участия нет |

**Известные пробелы** (не блокируют MVP, см. `specs/TEST_REPORT.md`):
- `age_min/age_max/gender_filter` не проверяются при `join` — присоединиться может кто угодно (п. 1).
- Повторный `leave` не идемпотентен, отдаёт `204` вместо `404` (п. 2).
- `EventCreate` не валидирует `deposit_amount >= 0` и `age_min <= age_max` (п. 8).

`EventCreate`/`EventOut`: `{ photo_url?, activity_type, datetime, location_lat?, location_lng?, location_address?, age_min=18, age_max=99, gender_filter: "any"|"male"|"female", slots_total=1, description="", deposit_amount }`.
`EventOut` дополнительно: `{ id, poster_id, slots_taken, status: "active"|"archived"|"cancelled", city }`.

## Deposits (`backend/app/routers/deposits.py`, ЮKassa Split — заглушка `app/payments.py`)

| Метод | Путь | Auth | Запрос | Ответ |
|---|---|---|---|---|
| POST | `/deposits` | да | `{ participation_id }` | `201` `DepositOut`, `escrow_status=held`. `403`, если участие чужое; `400`, если депозит уже создан |
| POST | `/deposits/{id}/webhook` | нет | — (коллбек от ЮKassa) | `204`. На заглушке всегда переводит в `held`; подпись провайдера не проверяется |
| POST | `/deposits/{id}/refund` | да | — | `200` `DepositOut`, `escrow_status=refunded`, участие → `cancelled`. `403`, если не плательщик; `400`, если уже обработан |
| GET | `/deposits/{id}` | да | — | `200` `DepositOut`. **Без проверки принадлежности** — любой авторизованный пользователь может прочитать чужой депозит по id (см. `specs/TEST_REPORT.md` п. 3, `specs/REVIEW.md` Suggestion) |

`DepositOut`: `{ id, participation_id, payer_id, amount, escrow_status: "held"|"released_to_payer"|"released_to_poster"|"refunded", yukassa_payment_id }`

## Chat (`backend/app/routers/chat.py`)

| Метод/протокол | Путь | Auth | Запрос | Ответ |
|---|---|---|---|---|
| GET | `/events/{id}/messages` | да | — | `200` `MessageOut[]`, по возрастанию времени. Доступ — только участникам события или постеру |
| POST | `/events/{id}/messages` | да | `{ text }` | `201` `MessageOut` |
| WS | `/ws/events/{id}/chat?token=<jwt>` | да (токен в query-параметре) | JSON `{ text }` | broadcast `{ id, event_id, sender_id, text, created_at }` всем подключённым участникам |

WS-хендшейк проверяет токен и `is_banned` напрямую через `decode_token`, минуя общий
`get_current_user` — функционально эквивалентно REST-проверке (пользователь и его
статус проверяются), но реализовано отдельным кодом, что отмечено в `specs/REVIEW.md`
(п. 3) как дублирование логики, а не как дыра — оба пути отклоняют забаненных.
Токен передаётся в query-строке WS URL — известный компромисс, см. `specs/REVIEW.md` п. 7.

`MessageOut`: `{ id, event_id, sender_id, text, created_at }`

## Meeting confirmation (`backend/app/routers/confirm.py`)

| Метод | Путь | Auth | Запрос | Ответ |
|---|---|---|---|---|
| POST | `/events/{id}/confirm/selfie` | да | `{ faces_detected: int, filter_name?: string }` | `200` `{ status: "confirmed" }`. `400`, если `faces_detected < 2`, событие неактивно/архивировано, вне временного окна встречи или окно (`meeting_confirm_window_minutes`) истекло; `403`, если не участник |
| POST | `/events/{id}/confirm/qr/generate` | да | — | `200` `{ qr_token }`. Только постер (`403` иначе) |
| POST | `/events/{id}/confirm/qr/scan` | да | `{ qr_token }` | `200` `{ status: "confirmed" }`. `400` при неверном/истёкшем токене; те же временные проверки, что у `selfie` |
| POST | `/events/{id}/rate` | да | `{ rated_id, stars: 1..5, comment? }` | `201` `{ status: "rated" }`. Обновляет `rating_avg`/`meetings_count` оцениваемого |

**Расчёт депозита — по каждому участнику отдельно** (`_settle_participation`,
`_get_own_participation`): подтверждение (`selfie`/`qr/scan`) действует только на
собственное участие вызывающего — его депозит переходит в `released_to_payer`, статус
участия — в `confirmed`. Чужие депозиты не затрагиваются. Проверяется окно времени
встречи (`event.datetime_` ... `event.datetime_ + meeting_confirm_window_minutes`) и
что событие ещё `active`. Это исправление критической уязвимости, ранее описанной в
`specs/REVIEW.md` («один участник разблокирует депозиты всех») — на момент актуального
кода `_settle_deposits` из ревью заменён на попарный `_settle_participation`,
верхняя граница окна и статус события проверяются. Не подтверждённые до автоархива
участия переводятся в `no_show`, депозит — в `released_to_poster` (`app/archive.py`).

Известные пробелы `rate`: не проверяется время встречи, самооценка не запрещена,
`rated_id` не валидируется на существование (`specs/TEST_REPORT.md` пп. 4–6).

## Notifications (`backend/app/routers/notifications.py`)

| Метод | Путь | Auth | Запрос | Ответ |
|---|---|---|---|---|
| POST | `/notifications/subscribe` | да | `{ category?: string, push_token?: string }` | `204` |
| GET | `/notifications` | да | — | `200` `NotificationOut[]`, только свои, по убыванию времени |

## Прочее

- `GET /health` — без auth, `{ status: "ok" }`.
- Автоархивирование: фоновая задача `auto_archive_loop` (`app/archive.py`) каждые 5 минут
  архивирует события, у которых прошло более 2 часов с `datetime`, и переводит
  неподтверждённые участия в `no_show` с освобождением депозита постеру.
