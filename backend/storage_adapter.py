"""Storage adapter: Local filesystem untuk Fase 1.
Interface siap untuk migrasi ke Cloudflare R2 / AWS S3 / Google Drive di masa depan."""
import os
import uuid
from pathlib import Path
from typing import Protocol


class StorageBackend(Protocol):
    async def save(self, data: bytes, filename: str, content_type: str) -> str:
        """Simpan dan kembalikan URL publik relatif (e.g. '/api/uploads/xxx.jpg')."""
        ...


class LocalStorage:
    def __init__(self, base_dir: str, public_prefix: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.public_prefix = public_prefix.rstrip("/")

    async def save(self, data: bytes, filename: str, content_type: str) -> str:
        ext = Path(filename).suffix.lower() or ""
        safe_ext = ext if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm"} else ""
        new_name = f"{uuid.uuid4().hex}{safe_ext}"
        path = self.base_dir / new_name
        path.write_bytes(data)
        return f"{self.public_prefix}/{new_name}"


def get_storage() -> StorageBackend:
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "local":
        return LocalStorage(
            base_dir=os.environ["STORAGE_LOCAL_DIR"],
            public_prefix=os.environ.get("PUBLIC_UPLOAD_PREFIX", "/api/uploads/files"),
        )
    raise RuntimeError(f"Storage backend '{backend}' belum didukung")
