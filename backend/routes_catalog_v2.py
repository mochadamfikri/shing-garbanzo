"""Endpoints for structured Master Catalog: Brand -> Model -> Storage/Color and dynamic updates."""
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from auth import require_roles, ROLE_OWNER, ROLE_ADMIN, ROLE_STAF

router = APIRouter(prefix="/api/master-catalog", tags=["master-catalog"])


class NewModelRequest(BaseModel):
    brand: str
    model_name: str
    storages: List[str] = Field(default_factory=list)
    colors: List[str] = Field(default_factory=list)
    ram_options: Optional[List[str]] = Field(default_factory=list)


class NewVariantRequest(BaseModel):
    brand: str
    model_name: str
    storage: Optional[str] = None
    color: Optional[str] = None
    ram: Optional[str] = None


@router.get("")
async def get_catalog(_user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN, ROLE_STAF))):
    from server import db
    from master_catalog import init_master_catalog
    await init_master_catalog(db)
    docs = await db.master_catalog.find({}, {"_id": 0}).sort("brand", 1).to_list(100)
    return {"brands": docs}


@router.post("/model")
async def add_model(
    payload: NewModelRequest,
    _user=Depends(require_roles(ROLE_OWNER, ROLE_ADMIN))
):
    from server import db
    brand = payload.brand.strip()
    model_name = payload.model_name.strip()
    if not brand or not model_name:
        raise HTTPException(400, "Brand dan Nama Model wajib diisi")

    # Check if brand exists
    brand_doc = await db.master_catalog.find_one({"brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"}})
    if not brand_doc:
        # Create new brand with this model
        new_brand = {
            "brand": brand,
            "models": [{
                "name": model_name,
                "storages": payload.storages or ["128GB", "256GB"],
                "colors": payload.colors or ["Black", "White"],
                "ram_options": payload.ram_options or []
            }]
        }
        await db.master_catalog.insert_one(new_brand)
        return {"success": True, "message": f"Brand {brand} dan model {model_name} berhasil ditambahkan"}

    # Brand exists: check if model already exists
    existing_models = [m["name"].lower() for m in brand_doc.get("models", [])]
    if model_name.lower() in existing_models:
        return {"success": True, "message": "Model sudah terdaftar"}

    new_model_obj = {
        "name": model_name,
        "storages": payload.storages or ["128GB", "256GB"],
        "colors": payload.colors or ["Black", "White"],
        "ram_options": payload.ram_options or []
    }
    await db.master_catalog.update_one(
        {"brand": brand_doc["brand"]},
        {"$push": {"models": new_model_obj}}
    )
    return {"success": True, "message": f"Model {model_name} berhasil ditambahkan ke brand {brand_doc['brand']}"}
