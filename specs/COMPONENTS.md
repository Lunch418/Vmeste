# COMPONENTS.md — «Вместе»

Дизайн-спецификация на основе `specs/SPEC.md` и `specs/TZ_Vmeste.md` (раздел 7).

**Обновлено 2026-08-05**: палитра и типографика заменены на дизайн из Claude
Design (`Vmeste.dc.html`, project `f401207d-196f-4fe7-9b07-3da4d4620624`) —
тёплая кремово-терракотовая светлая тема стала основной. Первоначальная
тёмная палитра (см. ниже) сохранена как переключаемая альтернатива
(`data-theme="dark"`, переключатель в `SettingsScreen`) — прежнее решение
«тёмная тема — основная» пересмотрено.

## 1. Цветовая палитра

Светлая тёплая тема — основная. Тёмная — переключаемая опция.

### Светлая тема (основная)

| Роль | Цвет | HEX |
|---|---|---|
| Акцент (primary) | Терракота | `#C67139` |
| Акцент — hover/pressed | Терракота тёмная | `#A8592A` |
| Акцент второго уровня | Олива (успех/подтверждение) | `#7A8A5E` |
| Фон (base) | Тёплый крем | `#F5EAD8` |
| Фон карточек (surface) | `#EBDDC5` |
| Фон карточек — приподнятый | `#FFF8EE` |
| Текст основной | `#201E1D` |
| Текст вторичный | `rgba(32,30,29,0.6)` |
| Разделители/бордеры | `rgba(32,30,29,0.14)` |
| Ошибка / no-show / жалоба | `#B3452F` |
| Депозит / деньги | `#8C491A` на фоне `#FFF2EB` |
| Теги/интересы | `#3D472B` на фоне `#F0FAE1` |

### Тёмная тема (`data-theme="dark"`, опция)

| Роль | Цвет | HEX |
|---|---|---|
| Акцент (primary) | Оранжевый | `#FF5C2B` |
| Акцент — hover/pressed | Оранжевый тёмный | `#E64A1B` |
| Фон (base) | Почти чёрный, тёплый | `#15121A` |
| Фон карточек (surface) | Тёмно-фиолетовый | `#211C29` |
| Фон карточек — приподнятый | `#2B2433` |
| Текст основной | `#F5F1EE` |
| Текст вторичный | `#A79EB0` |
| Разделители/бордеры | `#39323F` |
| Успех (явка / возврат депозита) | `#4ADE80` |
| Ошибка / no-show / жалоба | `#F45B69` |
| Депозит / деньги (акцент второго уровня) | `#FFD166` |

## 1.1. Типографика — шрифты

Caprasimo (display, заголовки/кнопки) + Figtree (body) — самохостятся в
`frontend/public/fonts/` (woff2, только latin/latin-ext — у Google Fonts нет
кириллической версии этих шрифтов). Вся русскоязычная типографика рендерится
системным шрифтом через обычный CSS-фолбэк; реальный эффект кастомных
шрифтов — логотип "Togethr" на экране входа, цифры и латинские фрагменты.

## 2. Типографика

- Шрифт: system-ui / -apple-system стек (без веб-шрифта — скорость загрузки PWA важнее)
- Заголовок экрана (H1): 24px / 700
- Заголовок карточки (H2): 18px / 600
- Основной текст: 15px / 400
- Вторичный текст / метаданные: 13px / 400, цвет "текст вторичный"
- Кнопки: 16px / 600

## 3. Отступы (spacing scale)

`4 / 8 / 12 / 16 / 24 / 32 / 48` px. Базовая единица — 8px.
Экранные поля (margin): 16px по горизонтали на мобильном.

## 4. Иерархия компонентов

```
App
├─ AuthFlow
│  ├─ PhoneInput
│  ├─ SmsCodeInput
│  └─ ProfileSetupForm
├─ TabBar (нижняя навигация: Лента / Создать / Профиль)
├─ FeedScreen
│  ├─ FilterBar
│  ├─ EventCard (список)
│  └─ EmptyState / LoadingSkeleton
├─ EventDetailScreen
│  ├─ EventHero (фото/афиша)
│  ├─ EventInfoBlock
│  ├─ PosterBadge (рейтинг постера)
│  └─ JoinButton → DepositSheet
├─ CreateEventWizard
│  ├─ StepPhoto
│  ├─ StepActivityType
│  ├─ StepDateTimePlace
│  ├─ StepSlotsAgeGender
│  ├─ StepDescriptionDeposit
│  └─ WizardStepper (прогресс-бар)
├─ DepositSheet
│  └─ YukassaWidget
├─ ChatScreen
│  ├─ MessageList
│  └─ MessageInput
├─ ConfirmMeetingScreen
│  ├─ ARSelfieCamera
│  │  └─ FilterFrame
│  └─ QrFallback (генерация / сканирование)
├─ RatingScreen
│  └─ StarRating
├─ ProfileScreen
│  ├─ ProfileHeader
│  ├─ StatsRow (встречи / % явки)
│  └─ MeetingHistoryList
└─ SettingsScreen
   └─ CategorySubscriptionToggle
```

## 5. Ключевые компоненты — props и состояния

### EventCard
**Props:** `photoUrl, activityType, dateTime, location, ageRange, slotsLeft, depositAmount, posterRating`
**Состояния:** `default | full (мест нет, disabled join) | urgent (< 3 часов до встречи — акцентная рамка)`

### CreateEventWizard / WizardStepper
**Props:** `currentStep (1–5), totalSteps=5`
**Состояния:** `filling | validating | error (подсветка невалидного шага) | submitting`
Прогресс — сегментированный бар сверху, как в сторис (5 сегментов, активный заполняется).

### DepositSheet
**Props:** `amount, escrowStatus`
**Состояния:** `idle | processing (виджет ЮKassa) | held (эскроу подтверждён) | error (webhook не пришёл / отказ)`

### ARSelfieCamera
**Props:** `filterName, facesDetected (0/1/2)`
**Состояния:** `waiting (0-1 лицо, кнопка disabled) | ready (2 лица, кнопка активна) | capturing | sent`
Рамка — акцентный оранжевый контур, название фильтра — плашка внизу экрана.

### ChatScreen / MessageList
**Состояния:** `loading | empty (первое сообщение — подсказка "договоритесь о деталях") | live | disconnected (баннер о переподключении WS)`

### StarRating
**Props:** `value (0–5), editable`
**Состояния:** `empty | rated | submitted`

## 6. Responsive-поведение

- **Mobile-first**: базовая вёрстка — 360–430px ширины (основной таргет — PWA на телефоне)
- Нижний TabBar — только на мобильном; на десктопе (≥1024px) превращается в боковую навигацию
- FeedScreen: 1 колонка карточек на мобильном → 2–3 колонки grid на десктопе (≥768px)
- CreateEventWizard: full-screen шаги на мобильном → модальное окно по центру на десктопе
- ARSelfieCamera: требует камеры устройства — на десктопе без камеры показывается сразу QR-fallback
- Safe-area отступы снизу (iOS notch/home indicator) учитываются во всех full-screen экранах

## 7. Анимации и обратная связь (per ТЗ раздел 7)

- Переходы между экранами: slide (мобильный стек-навигатор)
- Переход между шагами wizard: horizontal slide + fade прогресс-бара
- Джойн к событию: кнопка — микро-bounce при успехе
- Тактильная обратная связь (Vibration API) на: успешный join, подтверждение AR-селфи, отправку сообщения
- Skeleton-загрузка вместо спиннеров на FeedScreen и ProfileScreen
