"""
SMS-провайдер для кода подтверждения.

Заглушка: реальная интеграция (SMS.ru / SMSC / Twilio Verify и т.п.)
требует учётных данных провайдера, которых нет в этом окружении.
Код выводится в лог сервера вместо реальной отправки — заменить
`send_sms` на вызов реального провайдера при подключении production-ключей.

Есть базовая защита от подбора/спама: cooldown между запросами кода,
лимит запросов в час и лимит попыток ввода кода на один сгенерированный
код. Это не замена честному rate-limiter'у на уровне инфраструктуры
(nginx/API gateway) для прод-окружения, но закрывает самый очевидный
сценарий — брутфорс 4-значного кода за счёт неограниченных попыток.
"""
import logging
import random
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

logger = logging.getLogger("sms")

CODE_TTL_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 30
MAX_REQUESTS_PER_HOUR = 5
MAX_VERIFY_ATTEMPTS = 5

# phone -> (code, expires_at, attempts_used)
_codes: Dict[str, Tuple[str, datetime, int]] = {}
# phone -> timestamps of recent code requests (for hourly cap)
_request_history: Dict[str, List[datetime]] = {}
# phone -> timestamp of the last request (for cooldown)
_last_sent: Dict[str, datetime] = {}


class RateLimitError(Exception):
    """Слишком частые запросы кода — вернуть 429 на уровне роутера."""


def generate_and_send_code(phone: str) -> None:
    now = datetime.utcnow()

    last = _last_sent.get(phone)
    if last and (now - last).total_seconds() < RESEND_COOLDOWN_SECONDS:
        raise RateLimitError(
            f"Подождите {RESEND_COOLDOWN_SECONDS} секунд перед повторным запросом кода"
        )

    history = [t for t in _request_history.get(phone, []) if now - t < timedelta(hours=1)]
    if len(history) >= MAX_REQUESTS_PER_HOUR:
        raise RateLimitError("Слишком много запросов кода для этого номера, попробуйте позже")

    code = f"{random.randint(0, 9999):04d}"
    _codes[phone] = (code, now + timedelta(minutes=CODE_TTL_MINUTES), 0)
    _last_sent[phone] = now
    history.append(now)
    _request_history[phone] = history
    send_sms(phone, code)


def send_sms(phone: str, code: str) -> None:
    logger.info("SMS to %s: код подтверждения %s (STUB — реальный провайдер не подключён)", phone, code)


def verify_code(phone: str, code: str) -> bool:
    entry = _codes.get(phone)
    if not entry:
        return False
    stored_code, expires_at, attempts_used = entry

    if datetime.utcnow() > expires_at:
        del _codes[phone]
        return False

    if attempts_used >= MAX_VERIFY_ATTEMPTS:
        del _codes[phone]
        return False

    if stored_code != code:
        _codes[phone] = (stored_code, expires_at, attempts_used + 1)
        return False

    del _codes[phone]
    return True
