"""
SMS-провайдер для кода подтверждения.

Заглушка: реальная интеграция (SMS.ru / SMSC / Twilio Verify и т.п.)
требует учётных данных провайдера, которых нет в этом окружении.
Код выводится в лог сервера вместо реальной отправки — заменить
`send_sms` на вызов реального провайдера при подключении production-ключей.
"""
import logging
import random
from datetime import datetime, timedelta
from typing import Dict, Tuple

logger = logging.getLogger("sms")

CODE_TTL_MINUTES = 5

# phone -> (code, expires_at)
_codes: Dict[str, Tuple[str, datetime]] = {}


def generate_and_send_code(phone: str) -> None:
    code = f"{random.randint(0, 9999):04d}"
    _codes[phone] = (code, datetime.utcnow() + timedelta(minutes=CODE_TTL_MINUTES))
    send_sms(phone, code)


def send_sms(phone: str, code: str) -> None:
    logger.info("SMS to %s: код подтверждения %s (STUB — реальный провайдер не подключён)", phone, code)


def verify_code(phone: str, code: str) -> bool:
    entry = _codes.get(phone)
    if not entry:
        return False
    stored_code, expires_at = entry
    if datetime.utcnow() > expires_at:
        del _codes[phone]
        return False
    if stored_code != code:
        return False
    del _codes[phone]
    return True
