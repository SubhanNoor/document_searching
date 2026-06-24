import time
import threading
from datetime import datetime, timedelta
import vector_store

_sessions: dict[str, datetime] = {}
_SESSION_TTL = timedelta(minutes=15)
_CLEANUP_INTERVAL = 300  # seconds between cleanup sweeps


def touch(session_id: str) -> None:
    # Resets the inactivity countdown — called on every upload and every question.
    _sessions[session_id] = datetime.utcnow()


def cleanup_expired() -> None:
    now = datetime.utcnow()
    # Iterate a snapshot so we can delete keys from _sessions safely mid-loop.
    for session_id, last_seen in list(_sessions.items()):
        if now - last_seen > _SESSION_TTL:
            try:
                vector_store.delete_session(session_id)
            except RuntimeError as e:
                # Log but don't crash the cleanup loop — other sessions still need cleaning.
                print(f"[session_manager] Could not delete session '{session_id}': {e}")
                continue
            del _sessions[session_id]
            print(f"[cleanup] Session {session_id} expired — chunks deleted")


def start_cleanup_loop() -> None:
    # Daemon=True means this thread dies with the main process — no explicit shutdown needed.
    def _loop():
        while True:
            time.sleep(_CLEANUP_INTERVAL)
            try:
                cleanup_expired()
            except Exception as e:
                # Keep the loop alive even if cleanup fails unexpectedly.
                print(f"[session_manager] Cleanup sweep error: {e}")

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
