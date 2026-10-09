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


class GoogleDriveStorage:
    """Simpan file ke Google Drive via Service Account. Mengembalikan URL publik Drive.
    Perlu: GDRIVE_SERVICE_ACCOUNT_FILE (path JSON) + GDRIVE_FOLDER_ID (folder tujuan dishare)."""

    def __init__(self, folder_id: str, sa_json_path: str):
        self.folder_id = folder_id
        self.sa_json_path = sa_json_path
        self._svc = None

    def _service(self):
        if self._svc is None:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            creds = service_account.Credentials.from_service_account_file(
                self.sa_json_path, scopes=["https://www.googleapis.com/auth/drive"])
            self._svc = build("drive", "v3", credentials=creds, cache_discovery=False)
        return self._svc

    async def save(self, data: bytes, filename: str, content_type: str) -> str:
        import io
        from googleapiclient.http import MediaIoBaseUpload
        svc = self._service()
        ext = Path(filename).suffix.lower()
        meta = {"name": f"{uuid.uuid4().hex}{ext}"}
        if self.folder_id:
            meta["parents"] = [self.folder_id]
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=content_type, resumable=False)
        f = svc.files().create(body=meta, media_body=media, fields="id").execute()
        fid = f["id"]
        svc.permissions().create(fileId=fid, body={"type": "anyone", "role": "reader"}).execute()
        return f"https://drive.google.com/uc?export=view&id={fid}"


def get_storage() -> StorageBackend:
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "local":
        return LocalStorage(
            base_dir=os.environ["STORAGE_LOCAL_DIR"],
            public_prefix=os.environ.get("PUBLIC_UPLOAD_PREFIX", "/api/uploads/files"),
        )
    if backend == "gdrive":
        return GoogleDriveStorage(
            folder_id=os.environ.get("GDRIVE_FOLDER_ID", ""),
            sa_json_path=os.environ["GDRIVE_SERVICE_ACCOUNT_FILE"],
        )
    raise RuntimeError(f"Storage backend '{backend}' belum didukung")
