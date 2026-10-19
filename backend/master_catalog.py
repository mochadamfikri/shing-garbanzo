"""Master Device Catalog: Brand -> Model -> Storage -> Colors."""
from typing import List, Dict, Any

DEFAULT_CATALOG = [
    {
        "brand": "Apple",
        "models": [
            {
                "name": "iPhone 15",
                "storages": ["128GB", "256GB", "512GB"],
                "colors": ["Pink", "Yellow", "Green", "Blue", "Black"],
                "model_numbers": ["A3090"]
            },
            {
                "name": "iPhone 15 Plus",
                "storages": ["128GB", "256GB", "512GB"],
                "colors": ["Pink", "Yellow", "Green", "Blue", "Black"],
                "model_numbers": ["A3092"]
            },
            {
                "name": "iPhone 15 Pro",
                "storages": ["128GB", "256GB", "512GB", "1TB"],
                "colors": ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"],
                "model_numbers": ["A3102"]
            },
            {
                "name": "iPhone 15 Pro Max",
                "storages": ["256GB", "512GB", "1TB"],
                "colors": ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"],
                "model_numbers": ["A3106"]
            },
            {
                "name": "iPhone 14",
                "storages": ["128GB", "256GB", "512GB"],
                "colors": ["Midnight", "Starlight", "Blue", "Purple", "Yellow", "(PRODUCT)RED"],
                "model_numbers": ["A2882"]
            },
            {
                "name": "iPhone 13",
                "storages": ["128GB", "256GB", "512GB"],
                "colors": ["Midnight", "Starlight", "Blue", "Pink", "Green", "(PRODUCT)RED"],
                "model_numbers": ["A2633"]
            },
            {
                "name": "iPhone 12",
                "storages": ["64GB", "128GB", "256GB"],
                "colors": ["Black", "White", "Blue", "Green", "Purple", "(PRODUCT)RED"],
                "model_numbers": ["A2403"]
            },
            {
                "name": "iPhone 11",
                "storages": ["64GB", "128GB", "256GB"],
                "colors": ["Black", "White", "Green", "Yellow", "Purple", "(PRODUCT)RED"],
                "model_numbers": ["A2221"]
            }
        ]
    },
    {
        "brand": "Samsung",
        "models": [
            {
                "name": "Galaxy S24 Ultra",
                "storages": ["256GB", "512GB", "1TB"],
                "colors": ["Titanium Gray", "Titanium Black", "Titanium Violet", "Titanium Yellow"],
                "ram_options": ["12GB"]
            },
            {
                "name": "Galaxy S24+",
                "storages": ["256GB", "512GB"],
                "colors": ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"],
                "ram_options": ["12GB"]
            },
            {
                "name": "Galaxy S24",
                "storages": ["128GB", "256GB", "512GB"],
                "colors": ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"],
                "ram_options": ["8GB"]
            },
            {
                "name": "Galaxy A55 5G",
                "storages": ["128GB", "256GB"],
                "colors": ["Awesome Iceblue", "Awesome Navy", "Awesome Lilac", "Awesome Lemon"],
                "ram_options": ["8GB", "12GB"]
            }
        ]
    },
    {
        "brand": "Xiaomi",
        "models": [
            {
                "name": "Redmi Note 13 Pro 5G",
                "storages": ["256GB", "512GB"],
                "colors": ["Midnight Black", "Aurora Purple", "Ocean Teal"],
                "ram_options": ["8GB", "12GB"]
            },
            {
                "name": "Xiaomi 14",
                "storages": ["256GB", "512GB"],
                "colors": ["Black", "White", "Jade Green"],
                "ram_options": ["12GB"]
            }
        ]
    }
]

async def init_master_catalog(db):
    """Seed or update master catalog collection if empty."""
    count = await db.master_catalog.count_documents({})
    if count == 0:
        await db.master_catalog.insert_many(DEFAULT_CATALOG)
        await db.master_catalog.create_index("brand", unique=True)
