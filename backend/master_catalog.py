"""Comprehensive Master Device Catalog for Indonesian Smartphone Market.
Brands: Apple, Samsung, Xiaomi, Oppo, Vivo, Realme, Infinix, Tecno, Poco, Google Pixel, Asus, Huawei.
"""
from typing import List, Dict, Any

COMPREHENSIVE_BRANDS = [
    {
        "brand": "Apple",
        "models": [
            {"name": "iPhone 16 Pro Max", "storages": ["256GB", "512GB", "1TB"], "colors": ["Desert Titanium", "Natural Titanium", "White Titanium", "Black Titanium"]},
            {"name": "iPhone 16 Pro", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Desert Titanium", "Natural Titanium", "White Titanium", "Black Titanium"]},
            {"name": "iPhone 16 Plus", "storages": ["128GB", "256GB", "512GB"], "colors": ["Ultramarine", "Teal", "Pink", "White", "Black"]},
            {"name": "iPhone 16", "storages": ["128GB", "256GB", "512GB"], "colors": ["Ultramarine", "Teal", "Pink", "White", "Black"]},
            {"name": "iPhone 15 Pro Max", "storages": ["256GB", "512GB", "1TB"], "colors": ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"], "model_numbers": ["A3106"]},
            {"name": "iPhone 15 Pro", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"], "model_numbers": ["A3102"]},
            {"name": "iPhone 15 Plus", "storages": ["128GB", "256GB", "512GB"], "colors": ["Pink", "Yellow", "Green", "Blue", "Black"], "model_numbers": ["A3092"]},
            {"name": "iPhone 15", "storages": ["128GB", "256GB", "512GB"], "colors": ["Pink", "Yellow", "Green", "Blue", "Black"], "model_numbers": ["A3090"]},
            {"name": "iPhone 14 Pro Max", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Deep Purple", "Gold", "Silver", "Space Black"], "model_numbers": ["A2894"]},
            {"name": "iPhone 14 Pro", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Deep Purple", "Gold", "Silver", "Space Black"], "model_numbers": ["A2890"]},
            {"name": "iPhone 14 Plus", "storages": ["128GB", "256GB", "512GB"], "colors": ["Midnight", "Starlight", "Blue", "Purple", "Yellow", "(PRODUCT)RED"], "model_numbers": ["A2886"]},
            {"name": "iPhone 14", "storages": ["128GB", "256GB", "512GB"], "colors": ["Midnight", "Starlight", "Blue", "Purple", "Yellow", "(PRODUCT)RED"], "model_numbers": ["A2882"]},
            {"name": "iPhone 13 Pro Max", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Sierra Blue", "Graphite", "Gold", "Silver", "Alpine Green"], "model_numbers": ["A2643"]},
            {"name": "iPhone 13 Pro", "storages": ["128GB", "256GB", "512GB", "1TB"], "colors": ["Sierra Blue", "Graphite", "Gold", "Silver", "Alpine Green"], "model_numbers": ["A2638"]},
            {"name": "iPhone 13", "storages": ["128GB", "256GB", "512GB"], "colors": ["Midnight", "Starlight", "Blue", "Pink", "Green", "(PRODUCT)RED"], "model_numbers": ["A2633"]},
            {"name": "iPhone 13 mini", "storages": ["128GB", "256GB", "512GB"], "colors": ["Midnight", "Starlight", "Blue", "Pink", "Green", "(PRODUCT)RED"], "model_numbers": ["A2628"]},
            {"name": "iPhone 12 Pro Max", "storages": ["128GB", "256GB", "512GB"], "colors": ["Pacific Blue", "Graphite", "Gold", "Silver"], "model_numbers": ["A2411"]},
            {"name": "iPhone 12 Pro", "storages": ["128GB", "256GB", "512GB"], "colors": ["Pacific Blue", "Graphite", "Gold", "Silver"], "model_numbers": ["A2407"]},
            {"name": "iPhone 12", "storages": ["64GB", "128GB", "256GB"], "colors": ["Black", "White", "Blue", "Green", "Purple", "(PRODUCT)RED"], "model_numbers": ["A2403"]},
            {"name": "iPhone 11", "storages": ["64GB", "128GB", "256GB"], "colors": ["Black", "White", "Green", "Yellow", "Purple", "(PRODUCT)RED"], "model_numbers": ["A2221"]},
            {"name": "iPhone XR", "storages": ["64GB", "128GB"], "colors": ["Black", "White", "Blue", "Yellow", "Coral", "(PRODUCT)RED"]}
        ]
    },
    {
        "brand": "Samsung",
        "models": [
            {"name": "Galaxy S24 Ultra", "storages": ["256GB", "512GB", "1TB"], "colors": ["Titanium Gray", "Titanium Black", "Titanium Violet", "Titanium Yellow"], "ram_options": ["12GB"]},
            {"name": "Galaxy S24+", "storages": ["256GB", "512GB"], "colors": ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"], "ram_options": ["12GB"]},
            {"name": "Galaxy S24", "storages": ["128GB", "256GB", "512GB"], "colors": ["Onyx Black", "Marble Gray", "Cobalt Violet", "Amber Yellow"], "ram_options": ["8GB"]},
            {"name": "Galaxy S23 Ultra", "storages": ["256GB", "512GB", "1TB"], "colors": ["Phantom Black", "Cream", "Green", "Lavender"], "ram_options": ["8GB", "12GB"]},
            {"name": "Galaxy S23 FE", "storages": ["128GB", "256GB"], "colors": ["Mint", "Graphite", "Cream", "Purple"], "ram_options": ["8GB"]},
            {"name": "Galaxy Z Fold 6", "storages": ["256GB", "512GB", "1TB"], "colors": ["Silver Shadow", "Navy", "Pink"], "ram_options": ["12GB"]},
            {"name": "Galaxy Z Flip 6", "storages": ["256GB", "512GB"], "colors": ["Blue", "Yellow", "Mint", "Silver Shadow"], "ram_options": ["12GB"]},
            {"name": "Galaxy A55 5G", "storages": ["128GB", "256GB"], "colors": ["Awesome Iceblue", "Awesome Navy", "Awesome Lilac", "Awesome Lemon"], "ram_options": ["8GB", "12GB"]},
            {"name": "Galaxy A35 5G", "storages": ["128GB", "256GB"], "colors": ["Awesome Iceblue", "Awesome Navy", "Awesome Lilac"], "ram_options": ["8GB"]},
            {"name": "Galaxy A15 5G", "storages": ["128GB", "256GB"], "colors": ["Blue Black", "Blue", "Yellow"], "ram_options": ["8GB"]}
        ]
    },
    {
        "brand": "Xiaomi",
        "models": [
            {"name": "Xiaomi 14", "storages": ["256GB", "512GB"], "colors": ["Black", "White", "Jade Green"], "ram_options": ["12GB"]},
            {"name": "Xiaomi 13T", "storages": ["256GB"], "colors": ["Alpine Blue", "Meadow Green", "Black"], "ram_options": ["12GB"]},
            {"name": "Redmi Note 13 Pro+ 5G", "storages": ["256GB", "512GB"], "colors": ["Midnight Black", "Moonlight White", "Aurora Purple"], "ram_options": ["12GB"]},
            {"name": "Redmi Note 13 Pro 5G", "storages": ["256GB", "512GB"], "colors": ["Midnight Black", "Aurora Purple", "Ocean Teal"], "ram_options": ["8GB", "12GB"]},
            {"name": "Redmi Note 13 4G", "storages": ["128GB", "256GB"], "colors": ["Midnight Black", "Mint Green", "Ice Blue"], "ram_options": ["8GB"]},
            {"name": "Redmi 13", "storages": ["128GB", "256GB"], "colors": ["Midnight Black", "Sandy Gold", "Ocean Blue"], "ram_options": ["8GB"]}
        ]
    },
    {
        "brand": "Oppo",
        "models": [
            {"name": "Find N3", "storages": ["512GB"], "colors": ["Classic Black", "Champagne Gold"], "ram_options": ["16GB"]},
            {"name": "Find N3 Flip", "storages": ["256GB"], "colors": ["Sleek Black", "Cream Gold", "Misty Pink"], "ram_options": ["12GB"]},
            {"name": "Reno 12 Pro 5G", "storages": ["512GB"], "colors": ["Nebula Silver", "Space Brown"], "ram_options": ["12GB"]},
            {"name": "Reno 12 5G", "storages": ["256GB"], "colors": ["Astro Silver", "Matte Brown", "Sunset Pink"], "ram_options": ["12GB"]},
            {"name": "Reno 11 Pro 5G", "storages": ["512GB"], "colors": ["Pearl White", "Rock Grey"], "ram_options": ["12GB"]},
            {"name": "Reno 11 5G", "storages": ["256GB"], "colors": ["Wave Green", "Rock Grey"], "ram_options": ["8GB"]},
            {"name": "A79 5G", "storages": ["256GB"], "colors": ["Mystery Black", "Dazzling Purple"], "ram_options": ["8GB"]},
            {"name": "A58", "storages": ["128GB"], "colors": ["Glowing Black", "Dazzling Green"], "ram_options": ["6GB", "8GB"]}
        ]
    },
    {
        "brand": "Vivo",
        "models": [
            {"name": "X100 Pro", "storages": ["512GB"], "colors": ["Asteroid Black", "Sunset Orange"], "ram_options": ["16GB"]},
            {"name": "X100", "storages": ["256GB"], "colors": ["Asteroid Black", "Startrail Blue"], "ram_options": ["12GB", "16GB"]},
            {"name": "V30 Pro 5G", "storages": ["512GB"], "colors": ["Equatorial Green", "Volcanic Black"], "ram_options": ["12GB"]},
            {"name": "V30 5G", "storages": ["256GB", "512GB"], "colors": ["Khatulistiwa Green", "Puspa White", "Volcanic Black"], "ram_options": ["8GB", "12GB"]},
            {"name": "Y100 5G", "storages": ["128GB", "256GB"], "colors": ["Black Onyx", "Purple Orchid"], "ram_options": ["8GB"]},
            {"name": "Y28", "storages": ["128GB", "256GB"], "colors": ["Agate Green", "Gleaming Orange"], "ram_options": ["6GB", "8GB"]}
        ]
    },
    {
        "brand": "Realme",
        "models": [
            {"name": "GT 6", "storages": ["256GB"], "colors": ["Fluid Silver", "Razor Green"], "ram_options": ["12GB"]},
            {"name": "12 Pro+ 5G", "storages": ["256GB", "512GB"], "colors": ["Submarine Blue", "Navigator Beige"], "ram_options": ["8GB", "12GB"]},
            {"name": "12+ 5G", "storages": ["256GB"], "colors": ["Pioneer Green", "Navigator Beige"], "ram_options": ["8GB"]},
            {"name": "C67", "storages": ["128GB", "256GB"], "colors": ["Sunny Oasis", "Black Rock"], "ram_options": ["8GB"]}
        ]
    },
    {
        "brand": "Infinix",
        "models": [
            {"name": "GT 20 Pro", "storages": ["256GB"], "colors": ["Mecha Blue", "Mecha Orange", "Mecha Silver"], "ram_options": ["8GB", "12GB"]},
            {"name": "Note 40 Pro+ 5G", "storages": ["256GB"], "colors": ["Vintage Green", "Obsidian Black"], "ram_options": ["12GB"]},
            {"name": "Note 40 Pro 5G", "storages": ["256GB"], "colors": ["Titan Gold", "Vintage Green"], "ram_options": ["8GB"]},
            {"name": "Note 40", "storages": ["256GB"], "colors": ["Titan Gold", "Obsidian Black"], "ram_options": ["8GB"]},
            {"name": "Hot 40 Pro", "storages": ["256GB"], "colors": ["Horizon Gold", "Starlit Black", "Palm Blue"], "ram_options": ["8GB"]}
        ]
    },
    {
        "brand": "Poco",
        "models": [
            {"name": "F6 Pro", "storages": ["512GB", "1TB"], "colors": ["Black", "White"], "ram_options": ["12GB", "16GB"]},
            {"name": "F6", "storages": ["256GB", "512GB"], "colors": ["Black", "Green", "Titanium"], "ram_options": ["8GB", "12GB"]},
            {"name": "X6 Pro 5G", "storages": ["512GB"], "colors": ["Black", "Yellow", "Grey"], "ram_options": ["12GB"]},
            {"name": "X6 5G", "storages": ["256GB"], "colors": ["Black", "White", "Blue"], "ram_options": ["12GB"]},
            {"name": "M6 Pro", "storages": ["256GB"], "colors": ["Black", "Blue", "Purple"], "ram_options": ["8GB"]}
        ]
    },
    {
        "brand": "Tecno",
        "models": [
            {"name": "Camon 30 Pro 5G", "storages": ["512GB"], "colors": ["Iceland Basaltic Dark", "Alps Snowy Silver"], "ram_options": ["12GB"]},
            {"name": "Camon 30 5G", "storages": ["256GB"], "colors": ["Iceland Basaltic Dark", "Uyuni Salt White"], "ram_options": ["8GB"]},
            {"name": "Pova 6 Pro 5G", "storages": ["256GB"], "colors": ["Comet Green", "Meteorite Grey"], "ram_options": ["12GB"]}
        ]
    },
    {
        "brand": "Google Pixel",
        "models": [
            {"name": "Pixel 9 Pro XL", "storages": ["128GB", "256GB", "512GB"], "colors": ["Obsidian", "Porcelain", "Hazel", "Rose Quartz"], "ram_options": ["16GB"]},
            {"name": "Pixel 9 Pro", "storages": ["128GB", "256GB", "512GB"], "colors": ["Obsidian", "Porcelain", "Hazel", "Rose Quartz"], "ram_options": ["16GB"]},
            {"name": "Pixel 9", "storages": ["128GB", "256GB"], "colors": ["Obsidian", "Porcelain", "Wintergreen", "Peony"], "ram_options": ["12GB"]},
            {"name": "Pixel 8 Pro", "storages": ["128GB", "256GB", "512GB"], "colors": ["Obsidian", "Porcelain", "Bay", "Mint"], "ram_options": ["12GB"]},
            {"name": "Pixel 8", "storages": ["128GB", "256GB"], "colors": ["Obsidian", "Hazel", "Rose", "Mint"], "ram_options": ["8GB"]},
            {"name": "Pixel 7 Pro", "storages": ["128GB", "256GB"], "colors": ["Obsidian", "Snow", "Hazel"], "ram_options": ["12GB"]}
        ]
    },
    {
        "brand": "Asus",
        "models": [
            {"name": "ROG Phone 8 Pro", "storages": ["512GB", "1TB"], "colors": ["Phantom Black"], "ram_options": ["16GB", "24GB"]},
            {"name": "ROG Phone 8", "storages": ["256GB"], "colors": ["Rebel Grey", "Phantom Black"], "ram_options": ["12GB", "16GB"]},
            {"name": "Zenfone 11 Ultra", "storages": ["256GB", "512GB"], "colors": ["Eternal Black", "Skyline Blue", "Misty Grey", "Desert Sand"], "ram_options": ["12GB", "16GB"]}
        ]
    },
    {
        "brand": "Huawei",
        "models": [
            {"name": "Pura 70 Ultra", "storages": ["512GB", "1TB"], "colors": ["Black", "White", "Brown", "Green"], "ram_options": ["16GB"]},
            {"name": "Pura 70 Pro", "storages": ["512GB"], "colors": ["Black", "White"], "ram_options": ["12GB"]},
            {"name": "Mate 60 Pro", "storages": ["256GB", "512GB", "1TB"], "colors": ["Black", "White", "Green", "Purple"], "ram_options": ["12GB"]}
        ]
    }
]

async def init_master_catalog(db):
    """Seed or update master catalog collection with comprehensive brand catalog."""
    await db.master_catalog.delete_many({})
    await db.master_catalog.insert_many(COMPREHENSIVE_BRANDS)
    await db.master_catalog.create_index("brand", unique=True)
