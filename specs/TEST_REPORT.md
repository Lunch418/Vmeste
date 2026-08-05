# TEST_REPORT.md — «Вместе» MVP

Отчёт QA по `backend/` (FastAPI) и `frontend/` (Vite + React + TS).
Источники: `specs/SPEC.md`, `specs/CHANGES.md`, код в `backend/app/` и `frontend/src/` (только чтение).

## Итоги

**Backend** (`backend/.venv/bin/python -m pytest -q`, из `backend/`):
- **70 passed**, 0 failed, 0 skipped (было 12, добавлено 58)
- Новые файлы: `test_auth_edge_cases.py`, `test_events_edge_cases.py`,
  `test_deposits_edge_cases.py`, `test_confirm_edge_cases.py`,
  `test_chat_and_users_edge_cases.py`

**Frontend** (`npm run test` в `frontend/`, Vitest):
- **11 passed**, 0 failed. Было 0 тестов и не было настроено окружение.
- Добавлен `vitest` (devDependency), скрипт `test` в `package.json`,
  `src/api/client.test.ts`, `src/test-setup.ts` (полифилл `localStorage`
  для node-окружения), блок `test` в `vite.config.ts`.
- Покрыт только `src/api/client.ts` (чистая логика: сборка query-строки,
  обработка ошибок fetch, токен в заголовке, 204-ответы, `chatSocketUrl`).
  Компонентные тесты (React-рендеринг экранов) сознательно не добавлялись —
  потребовали бы React Testing Library + jsdom, что несоразмерно объёму
  задачи; `client.ts` — самое ценное место для unit-тестов без этой инфры.

Все тесты (старые и новые) проходят — ни один найденный баг не приводит к
падению/исключению 500, поэтому все репро оформлены как **passing**-тесты,
документирующие фактическое (нежелательное) поведение, с комментарием в коде.

## Найденные баги / пробелы (не исправлялись, только задокументированы)

1. **Фильтры по возрасту и полу не проверяются при `POST /events/{id}/join`.**
   `age_min`/`age_max`/`gender_filter` есть в модели `Event` и в SPEC.md
   (раздел 6), но `events.py::join_event` их не читает и не сверяет с
   профилем джойнера — можно присоединиться, не подходя по возрасту/полу.
   Репро: `test_events_edge_cases.py::test_gender_and_age_filters_not_enforced_on_join`.

2. **Двойной `POST /events/{id}/leave` дважды переводит участие в `cancelled`
   и повторно проходит guard `slots_taken > 0`.** Первый вызов корректно
   уменьшает `slots_taken`; второй вызов на уже отменённом участии не
   отклоняется (нет проверки `participation.status != cancelled`), возвращает
   204 повторно вместо 404. В данном сценарии `slots_taken` не уходит в минус
   только благодаря защите `> 0`, но сама операция должна была быть
   идемпотентной с ошибкой, а не тихим no-op с повторным 204.
   Репро: `test_events_edge_cases.py::test_double_leave_double_decrements_slots_taken`.

3. **`GET /deposits/{id}` не проверяет, что текущий пользователь связан с
   депозитом** (не плательщик, не постер события). Любой аутентифицированный
   пользователь может прочитать сумму и статус эскроу чужого депозита,
   зная/подобрав его id. Репро:
   `test_deposits_edge_cases.py::test_get_deposit_by_unrelated_user_not_forbidden`.

4. **`POST /events/{id}/rate` не проверяет время встречи.** В отличие от
   `confirm/selfie` и `confirm/qr/scan`, которые блокируют действие до
   `event.datetime_`, оценку можно оставить для события, которое ещё не
   наступило. Репро:
   `test_confirm_edge_cases.py::test_rating_before_meeting_time_not_prevented`.

5. **Самооценка не запрещена** — пользователь может поставить рейтинг самому
   себе (`rater_id == rated_id`), что искусственно завышает `rating_avg`.
   Репро: `test_confirm_edge_cases.py::test_self_rating_not_prevented`.

6. **`rated_id` в `POST /events/{id}/rate` не валидируется на существование
   пользователя** — запись `Rating` создаётся даже для несуществующего
   `rated_id`, обновление агрегата просто молча пропускается. Не приводит к
   ошибке, но захламляет таблицу «битыми» оценками.
   Репро: `test_confirm_edge_cases.py::test_rating_for_nonexistent_user_id_does_not_crash`.

7. **Нет серверной валидации формата телефона/SMS-кода** (`schemas.py`:
   `phone: str`, `code: str` без regex/длины) — пустая строка или мусорная
   строка в `phone` проходит как валидный запрос кода. Не критично для MVP
   (заглушка SMS и так не шлёт реальных сообщений), но стоит добавить перед
   подключением реального провайдера. Репро:
   `test_auth_edge_cases.py::test_empty_phone_accepted_without_validation`,
   `test_garbage_phone_accepted_without_validation`.

8. **Нет валидации `deposit_amount >= 0` и `age_min <= age_max`** при создании
   события (`EventCreate`) — отрицательный депозит и перевёрнутый диапазон
   возраста принимаются и сохраняются как есть. Репро:
   `test_events_edge_cases.py::test_create_event_negative_deposit_accepted_without_validation`,
   `test_create_event_age_min_greater_than_age_max_accepted_without_validation`.

9. **`POST /users/{id}/block` — полный no-op на сервере** (закомментировано в
   `users.py` как «MVP: блокировка на фронтенде»). Возвращает 204 для любого
   `user_id`, включая несуществующий, и не имеет наблюдаемого эффекта на
   чат/присоединение. Это не отмечено как заглушка в `CHANGES.md`, хотя
   SPEC.md (раздел 9) описывает кнопку «Заблокировать» как серверную
   функцию — стоит явно задокументировать ограничение в CHANGES.md.
   Репро: `test_chat_and_users_edge_cases.py::test_block_user_endpoint_does_not_persist_anything`.

## Проверка заглушек (из CHANGES.md) — ведут себя предсказуемо

- **SMS-провайдер** (`app/sms.py`): код пишется в лог, не крашится на пустом/
  мусорном номере, TTL и повторное использование кода отрабатывают корректно
  (см. `test_auth_edge_cases.py`).
- **ЮKassa** (`app/payments.py`): `create_payment`/`refund_payment` всегда
  возвращают фиктивные значения без исключений; эскроу-переходы состояний
  (`held → refunded`, `held → released_to_payer/poster`) стабильны и
  повторный вызов (`refund` дважды, `deposit` дважды) корректно отклоняется
  бизнес-логикой, а не падает с 500.
- **AR-селфи** (слайдер лиц вместо MediaPipe): `faces_detected` не имеет
  ограничения `ge=0` на уровне схемы, но отрицательные и нулевые значения
  корректно отклоняются бизнес-проверкой `< 2` без исключений (см.
  `test_confirm_edge_cases.py::test_selfie_confirm_negative_faces_rejected`).

## Не покрыто / вне объёма этой сессии

- WebSocket-чат (`WS /ws/events/{id}/chat`) — не тестировался (нет фикстуры
  под `TestClient.websocket_connect` в этой сессии); REST-часть чата
  (`GET/POST /events/{id}/messages`) покрыта.
- `POST /notifications/subscribe`, `GET /notifications` — не тестировались,
  роутер не читался подробно в рамках этой сессии.
- Frontend: только `api/client.ts`; компоненты/экраны (`screens/*`,
  `AuthContext`) без тестов — см. обоснование выше.
