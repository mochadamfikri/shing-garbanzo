"""Endpoints for Smart Device Scanning (Box labels and settings screenshots)."""
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import List

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF
from device_scanner import scan_device_image

router = APIRouter(prefix="/api/scan", tags=["device-scan"])
logger = logging.getLogger(__name__)

@router.post("/device-info")
async def scan_single_image(
    file: UploadFile = File(...),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))
):
    """Scan and extract device identifiers from a single box label or screenshot."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="File gambar kosong")
    
    try:
        result = scan_device_image(contents)
        return result
    except Exception as e:
        logger.exception("Error processing device image")
        raise HTTPException(status_code=422, detail=f"Gagal memproses gambar: {str(e)}")


@router.post("/device-info/multi")
async def scan_multiple_images(
    files: List[UploadFile] = File(...),
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))
):
    """Scan multiple photos (e.g. box label + settings screenshot) and merge extracted fields."""
    if not files:
        raise HTTPException(status_code=400, detail="Tidak ada gambar yang diunggah")

    merged_fields = {}
    merged_confidence = {}
    detected_barcodes = set()

    for f in files:
        contents = await f.read()
        if not contents:
            continue
        try:
            res = scan_device_image(contents)
            for k, v in res.get("fields", {}).items():
                conf = res.get("confidence", {}).get(k, 0)
                # Keep the value with higher confidence
                if k not in merged_fields or conf > merged_confidence.get(k, 0):
                    merged_fields[k] = v
                    merged_confidence[k] = conf
            for b in res.get("barcodes_detected", []):
                detected_barcodes.add(b)
        except Exception as e:
            logger.warning(f"Failed processing one of multiple files: {e}")

    return {
        "success": True,
        "fields": merged_fields,
        "confidence": merged_confidence,
        "barcodes_detected": list(detected_barcodes),
        "processed_files_count": len(files)
    }
