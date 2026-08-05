#!/bin/bash
set -e

# ═══════════════════════════════════════════════
#  КОМАНДА ПРОЕКТА «ВМЕСТЕ»
#  Этапы 1–2: диалог с тобой (план и дизайн)
#  Этапы 3–10: автоматом (код, тесты, ревью, docs)
#  После каждого этапа — коммит и пуш на GitHub
# ═══════════════════════════════════════════════

# ─────────── Проверки ───────────
if [ ! -f specs/TZ_Vmeste.md ]; then
  echo "❌ Ошибка: не найден файл specs/TZ_Vmeste.md"
  exit 1
fi

# ─────────── Git и автопуш ───────────
commit() {
  git add -A
  git commit -m "$1" || true
  git push || true
}

if [ ! -d .git ]; then
  echo "═══ Инициализация git-репозитория ═══"
  git init
  git branch -M main
  printf 'node_modules/\n__pycache__/\n.env\nvenv/\ndist/\n.DS_Store\n' > .gitignore
  git config user.email >/dev/null 2>&1 || {
    git config user.email "team@vmeste.local"
    git config user.name "Vmeste Team"
  }
  commit "init: структура проекта «Вместе»"
fi

# ─────────── ЭТАП 1: ПЛАНИРОВАНИЕ (диалог) ───────────
if [ -f specs/SPEC.md ]; then
  echo "ℹ️  specs/SPEC.md уже есть — планирование пропускаем."
else
  echo "═══ ЭТАП 1: ПЛАНИРОВАНИЕ (оркестратор задаёт вопросы — отвечай) ═══"
  claude "Прочитай .agents/orchestrator.md — это твоя роль.
Затем прочитай specs/TZ_Vmeste.md — это техническое задание.

Проект называется «Вместе». Старое название «Пошли» не используй.
Это PWA-приложение: делается как веб, но на мобилке открывается как обычное приложение. Учитывай это.

Не пиши код. Сначала обсудим план:
1. Перескажи продукт своими словами (5–7 предложений).
2. Покажи границы MVP: что в первую версию, что откладываем.
3. Предложи этапы разработки.
4. Перечисли экраны и главные сценарии пользователя.
5. Задай мне 5–10 уточняющих вопросов.

После моих ответов создай specs/SPEC.md с полной спецификацией проекта «Вместе»."

  echo
  read -p "👉 Диалог закончен и specs/SPEC.md готов? Нажми Enter..."

  if [ ! -f specs/SPEC.md ]; then
    echo "❌ specs/SPEC.md не создан — прерываю."
    exit 1
  fi
  commit "этап 1: планирование — specs/SPEC.md"
fi

# ─────────── ЭТАП 2: ДИЗАЙН (диалог) ───────────
if [ -f specs/COMPONENTS.md ]; then
  echo "ℹ️  specs/COMPONENTS.md уже есть — дизайн пропускаем."
else
  echo "═══ ЭТАП 2: ДИЗАЙН (дизайнер показывает концепцию — утверждай) ═══"
  claude "Прочитай .agents/designer.md — это твоя роль.
Затем прочитай specs/SPEC.md и specs/TZ_Vmeste.md (требования к дизайну — раздел 7).

Проект: «Вместе». Стиль: молодёжный, живой, энергичный — не корпоративный.

Не создавай файлы сразу. Сначала согласуй со мной концепцию:
1. Предложи 2–3 варианта палитры (акцент + фон, с HEX-кодами).
2. Покажи список экранов и переходы между ними.
3. Опиши карточку события: что на ней, как расположена.
4. Опиши wizard создания события (5 шагов, как в сторис).
5. Задай мне вопросы по всему, что неоднозначно.

После моих ответов создай specs/COMPONENTS.md и specs/NAVIGATION.md (Mermaid-диаграммы).
Обязательно: тёмная тема, mobile-first."

  echo
  read -p "👉 Дизайн утверждён и specs/COMPONENTS.md готов? Нажми Enter..."

  if [ ! -f specs/COMPONENTS.md ]; then
    echo "❌ specs/COMPONENTS.md не создан — прерываю."
    exit 1
  fi
  commit "этап 2: дизайн — COMPONENTS.md, NAVIGATION.md"
fi

# ─────────── ЭТАП 3: РАЗРАБОТКА ───────────
echo "═══ ЭТАП 3: РАЗРАБОТКА ═══"
claude -p "$(cat .agents/developer.md)

Прочитай specs/SPEC.md и specs/COMPONENTS.md.
Реализуй MVP: backend (FastAPI), frontend (React + TypeScript, PWA).
Создай specs/CHANGES.md."
commit "этап 3: разработка MVP"

# ─────────── ЭТАП 4: ТЕСТЫ ───────────
echo "═══ ЭТАП 4: ТЕСТЫ ═══"
claude -p "$(cat .agents/tester.md)

Прочитай specs/CHANGES.md, изучи src/.
Напиши и запусти тесты. Создай specs/TEST_REPORT.md."
commit "этап 4: тесты"

if grep -q "Failed" specs/TEST_REPORT.md 2>/dev/null; then
  echo "═══ ЭТАП 5: ИСПРАВЛЕНИЕ БАГОВ ═══"
  claude -p "$(cat .agents/developer.md)

  Прочитай specs/TEST_REPORT.md. Исправь все найденные баги.
  Обнови specs/CHANGES.md."

  echo "═══ ЭТАП 6: ПОВТОРНЫЕ ТЕСТЫ ═══"
  claude -p "$(cat .agents/tester.md)

  Запусти тесты повторно. Обнови specs/TEST_REPORT.md."
  commit "этап 6: исправления после тестов"
fi

# ─────────── ЭТАП 7: КОД-РЕВЬЮ ───────────
echo "═══ ЭТАП 7: КОД-РЕВЬЮ ═══"
claude -p "$(cat .agents/reviewer.md)

Прочитай specs/CHANGES.md, проверь src/. Создай specs/REVIEW.md с вердиктом."
commit "этап 7: код-ревью"

if grep -q "Changes Requested\|Rejected" specs/REVIEW.md 2>/dev/null; then
  echo "═══ ЭТАП 8: ИСПРАВЛЕНИЯ ПО РЕВЬЮ ═══"
  claude -p "$(cat .agents/developer.md)

  Прочитай specs/REVIEW.md. Исправь все замечания Critical и Major.
  Обнови specs/CHANGES.md."

  echo "═══ ЭТАП 9: ПОВТОРНОЕ РЕВЬЮ ═══"
  claude -p "$(cat .agents/reviewer.md)

  Повторно проверь исправления. Обнови specs/REVIEW.md."
  commit "этап 9: исправления после ревью"
fi

# ─────────── ЭТАП 10: ДОКУМЕНТАЦИЯ ───────────
echo "═══ ЭТАП 10: ДОКУМЕНТАЦИЯ ═══"
claude -p "$(cat .agents/docs.md)

Прочитай все файлы в specs/ и src/.
Создай полную документацию в docs/. Язык документации: русский."
commit "этап 10: документация"

echo
echo "✅ ГОТОВО. Проект «Вместе» собран."
echo "📦 История: git log --oneline"
echo
echo "🌐 Если GitHub ещё не подключён (делается один раз):"
echo "   git remote add origin https://github.com/Lunch418/Vmeste.git"
echo "   git push -u origin main"