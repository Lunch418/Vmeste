from collections import defaultdict
from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, event_id: str, ws: WebSocket):
        await ws.accept()
        self.active[event_id].append(ws)

    def disconnect(self, event_id: str, ws: WebSocket):
        if ws in self.active[event_id]:
            self.active[event_id].remove(ws)

    async def broadcast(self, event_id: str, message: dict):
        for ws in list(self.active[event_id]):
            await ws.send_json(message)


manager = ConnectionManager()
