"""
Интеграция с ЮKassa Split (эскроу-платежи).

Заглушка: реальный вызов ЮKassa API требует merchant-аккаунта и
shop_id/secret_key, которых нет в этом окружении. Здесь эмулируется
успешное создание платежа и синхронный webhook — заменить `create_payment`
и обработчик `/deposits/{id}/webhook` на реальную интеграцию
(https://yookassa.ru/developers/api) при подключении production-ключей.
"""
import uuid


def create_payment(amount_kopecks: int, description: str) -> str:
    return f"stub_yk_{uuid.uuid4().hex[:12]}"


def refund_payment(yukassa_payment_id: str) -> bool:
    return True
