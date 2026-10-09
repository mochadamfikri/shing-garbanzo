"""Endpoint upload foto/video (staff only)."""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, ROLE_PELANGGAN
from storage_adapter import get_storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/image")
async def upload_image(file: UploadFile = File(...),
                       _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF, ROLE_PELANGGAN))):
    """Upload image: diizinkan untuk staf (foto produk) dan pelanggan (bukti bayar)."""
    if file.content_type not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung (JPEG/PNG/WEBP/GIF)")
    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 10MB")
    storage = get_storage()
    url = await storage.save(data, file.filename or "image.jpg", file.content_type)
    return {"url": url, "size": len(data), "content_type": file.content_type}


@router.post("/video")
async def upload_video(file: UploadFile = File(...),
                       _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    if file.content_type not in ALLOWED_VIDEO:
        raise HTTPException(status_code=400, detail="Format video tidak didukung (MP4/MOV/WEBM)")
    data = await file.read()
    if len(data) > MAX_VIDEO_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran video maksimal 100MB")
    storage = get_storage()
    url = await storage.save(data, file.filename or "video.mp4", file.content_type)
    return {"url": url, "size": len(data), "content_type": file.content_type}
