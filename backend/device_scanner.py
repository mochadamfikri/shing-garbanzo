"""Intelligent Device Scanner Engine for iPhone & Android Box Labels and Settings Screenshots.

Pipeline:
1. Image Upload & Preprocessing (Orientation, Deskew, Contrast, Upscaling)
2. Barcode / QR Decoding (UPC, Serial, IMEI, EID, Part Number)
3. Multi-pass OCR (Tesseract PSM modes, localized thresholding)
4. Field Regex Mapping (Part Number, Model Number, EID, Serial, IMEI 1, IMEI 2, UPC, Storage, Color)
5. Validation (Luhn Check, EID 32-digit, Serial Alphanumeric, Brand normalization)
6. Confidence Scoring per field
"""
import re
import cv2
import numpy as np
import pytesseract
from pyzbar.pyzbar import decode as zbar_decode
from PIL import Image, ImageOps
from typing import Dict, Any, List, Optional
from utils import luhn_check, validate_imei

# Known Apple Model Number Mapping (A-numbers to Marketing names)
APPLE_MODEL_MAP = {
    "A3090": ("Apple", "iPhone 15"),
    "A3092": ("Apple", "iPhone 15 Plus"),
    "A3102": ("Apple", "iPhone 15 Pro"),
    "A3106": ("Apple", "iPhone 15 Pro Max"),
    "A2882": ("Apple", "iPhone 14"),
    "A2886": ("Apple", "iPhone 14 Plus"),
    "A2890": ("Apple", "iPhone 14 Pro"),
    "A2894": ("Apple", "iPhone 14 Pro Max"),
    "A2633": ("Apple", "iPhone 13"),
    "A2638": ("Apple", "iPhone 13 Pro"),
    "A2643": ("Apple", "iPhone 13 Pro Max"),
    "A2628": ("Apple", "iPhone 13 mini"),
    "A2403": ("Apple", "iPhone 12"),
    "A2407": ("Apple", "iPhone 12 Pro"),
    "A2411": ("Apple", "iPhone 12 Pro Max"),
    "A2221": ("Apple", "iPhone 11"),
    "A2215": ("Apple", "iPhone 11 Pro"),
    "A2218": ("Apple", "iPhone 11 Pro Max"),
}

STORAGE_PATTERNS = [
    r"\b(16|32|64|128|256|512)\s*(?:GB|G)\b",
    r"\b(1|2)\s*(?:TB|T)\b",
]

COLOR_LIST = [
    "Pink", "Black", "White", "Blue", "Green", "Yellow", "Midnight",
    "Starlight", "Purple", "Red", "(PRODUCT)RED", "Natural Titanium",
    "Blue Titanium", "White Titanium", "Black Titanium", "Desert Titanium",
    "Space Gray", "Silver", "Gold", "Titanium Gray", "Graphite", "Sierra Blue"
]

def preprocess_image(cv_img: np.ndarray) -> List[np.ndarray]:
    """Return multiple preprocessed variants for OCR robustness."""
    variants = []
    
    # Original gray
    if len(cv_img.shape) == 3:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    else:
        gray = cv_img

    variants.append(gray)

    # 1. Scaled up if small
    h, w = gray.shape
    if max(h, w) < 1800:
        scale = 1800.0 / max(h, w)
        scaled = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
        variants.append(scaled)
    else:
        scaled = gray

    # 2. Otsu threshold
    _, otsu = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(otsu)

    # 3. Adaptive threshold
    adaptive = cv2.adaptiveThreshold(scaled, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
    variants.append(adaptive)

    # 4. Inverted Otsu
    variants.append(cv2.bitwise_not(otsu))

    return variants


def extract_barcodes(cv_img: np.ndarray) -> Dict[str, Any]:
    """Scan barcodes and QR codes using pyzbar and OpenCV."""
    results = {}
    barcodes = zbar_decode(cv_img)
    for b in barcodes:
        data = b.data.decode("utf-8", errors="ignore").strip()
        btype = b.type
        
        # Detect EID (32 digits starting with 89)
        if re.fullmatch(r"89\d{30}", data):
            results["eid"] = data
        # Detect IMEI (15 digits)
        elif re.fullmatch(r"\d{15}", data) and luhn_check(data):
            if "imei_1" not in results:
                results["imei_1"] = data
            elif results["imei_1"] != data and "imei_2" not in results:
                results["imei_2"] = data
        # Detect UPC / EAN (12 or 13 digits)
        elif btype in ("UPCA", "EAN13") and re.fullmatch(r"\d{12,13}", data):
            results["upc"] = data
        # Detect Serial Number (alphanumeric 10-12 chars)
        elif re.fullmatch(r"[A-Z0-9]{10,12}", data) and not data.isdigit():
            results["serial_number"] = data
        # Detect Part number (e.g. MTP13SA/A)
        elif re.fullmatch(r"[A-Z0-9]{5,8}/[A-Z0-9]", data):
            results["part_number"] = data

    return results


def parse_device_text(text: str) -> Dict[str, Any]:
    """Extract structured device fields from combined OCR text lines."""
    data: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    full_text = " ".join(lines)

    # 1. Brand & Model Detection
    if re.search(r"\biPhone\b", full_text, re.I) or re.search(r"\bApple\b", full_text, re.I):
        data["merek"] = "Apple"
        confidence["merek"] = 0.95
        # Check specific iPhone models
        m = re.search(r"\biPhone\s*(1[1-6](?:\s*(?:Pro\s*Max|Pro|Plus|mini))?|SE|X[RS]?|[78](?:\s*Plus)?)\b", full_text, re.I)
        if m:
            data["model"] = f"iPhone {m.group(1).strip()}"
            confidence["model"] = 0.90
    elif re.search(r"\bSamsung\b|\bGalaxy\b", full_text, re.I):
        data["merek"] = "Samsung"
        confidence["merek"] = 0.95
        m = re.search(r"\bGalaxy\s*(S2[0-4](?:\s*(?:Ultra|Plus|\+))?|A[0-5][0-9]|Z\s*(?:Fold|Flip)\s*[0-6]?)\b", full_text, re.I)
        if m:
            data["model"] = f"Galaxy {m.group(1).strip()}"
            confidence["model"] = 0.90
    elif re.search(r"\bXiaomi\b|\bRedmi\b", full_text, re.I):
        data["merek"] = "Xiaomi"
        confidence["merek"] = 0.90

    # 2. Part Number (e.g., MTP13SA/A, MLQ63ID/A, ZP/A, LL/A)
    pn_match = re.search(r"(?:Part\s*No\.?|Model|SKU)?\s*([A-Z0-9]{5,8}/[A-Z0-9]{1,2})", full_text)
    if pn_match:
        data["part_number"] = pn_match.group(1).strip()
        confidence["part_number"] = 0.90

    # 3. Model Number (e.g. Model A3090, A2882, SM-S928B)
    mod_match = re.search(r"\bModel\s*(?:No\.?)?\s*(A\d{4}|SM-[A-Z0-9]+)\b", full_text, re.I)
    if mod_match:
        data["model_number"] = mod_match.group(1).upper()
        confidence["model_number"] = 0.92
        # Infer model if not yet detected
        if data["model_number"] in APPLE_MODEL_MAP and "model" not in data:
            data["merek"], data["model"] = APPLE_MODEL_MAP[data["model_number"]]
            confidence["model"] = 0.95

    # 4. Storage (e.g., 128GB, 256 GB, 1TB)
    for sp in STORAGE_PATTERNS:
        st_match = re.search(sp, full_text, re.I)
        if st_match:
            data["penyimpanan"] = f"{st_match.group(1).upper()}GB" if "T" not in st_match.group(0).upper() else f"{st_match.group(1).upper()}TB"
            confidence["penyimpanan"] = 0.88
            break

    # 5. Color Detection
    for c in COLOR_LIST:
        if re.search(r"\b" + re.escape(c) + r"\b", full_text, re.I):
            data["warna"] = c
            confidence["warna"] = 0.85
            break

    # 6. EID (32 numeric digits, starts with 89)
    eid_match = re.search(r"\bEID\b[^\d]*(89\d{30})\b", full_text, re.I) or re.search(r"\b(89\d{30})\b", full_text)
    if eid_match:
        data["eid"] = eid_match.group(1)
        confidence["eid"] = 0.98

    # 7. Serial Number (S / Serial No. / Serial Number / No. Seri)
    sn_match = re.search(r"(?:\(S\)\s*Serial\s*No\.?|Serial\s*Number|Nomor\s*Seri|No\.\s*Seri|Serial\s*No\.?)[^\w]*([A-Z0-9]{8,14})\b", full_text, re.I)
    if sn_match and not sn_match.group(1).isdigit():
        data["serial_number"] = sn_match.group(1).upper()
        confidence["serial_number"] = 0.92

    # 8. IMEI 1 & IMEI 2 Detection
    # Look for labelled IMEI
    imei1_match = re.search(r"(?:IMEI\s*1?|IMEI/MEID\s*1?|Nomor\s*IMEI)[^\d]*(\d{15})\b", full_text, re.I)
    imei2_match = re.search(r"(?:IMEI\s*2|IMEI/MEID\s*2)[^\d]*(\d{15})\b", full_text, re.I)

    # All 15-digit sequences that pass Luhn check
    all_15 = re.findall(r"\b(\d{15})\b", full_text)
    valid_imeis = [num for num in all_15 if luhn_check(num)]

    if imei1_match and luhn_check(imei1_match.group(1)):
        data["imei_1"] = imei1_match.group(1)
        confidence["imei_1"] = 0.98
    elif valid_imeis:
        data["imei_1"] = valid_imeis[0]
        confidence["imei_1"] = 0.85

    if imei2_match and luhn_check(imei2_match.group(1)):
        data["imei_2"] = imei2_match.group(1)
        confidence["imei_2"] = 0.98
    elif len(valid_imeis) > 1 and valid_imeis[1] != data.get("imei_1"):
        data["imei_2"] = valid_imeis[1]
        confidence["imei_2"] = 0.85

    # 9. UPC / Barcode (12-13 digits)
    upc_match = re.search(r"\bUPC[^\d]*(\d{12})\b", full_text, re.I) or re.search(r"\b(\d{12})\b", full_text)
    if upc_match:
        data["upc"] = upc_match.group(1)
        confidence["upc"] = 0.85

    return {"fields": data, "confidence": confidence, "raw_text_snippet": full_text[:400]}


def scan_device_image(image_bytes: bytes) -> Dict[str, Any]:
    """Process an uploaded device box or settings photo."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if cv_img is None:
        raise ValueError("Gambar tidak valid atau format tidak didukung")

    # Step 1: Decode Barcodes directly from original image
    barcode_data = extract_barcodes(cv_img)

    # Step 2: Multi-pass OCR
    variants = preprocess_image(cv_img)
    collected_text = []

    # Run Tesseract with PSM 6 (uniform block of text) and PSM 11 (sparse text)
    configs = [r"--oem 3 --psm 6", r"--oem 3 --psm 11", r"--oem 3 --psm 4"]
    for img_variant in variants[:3]:
        for cfg in configs[:2]:
            try:
                t = pytesseract.image_to_string(img_variant, config=cfg)
                if t.strip():
                    collected_text.append(t)
            except Exception:
                pass

    merged_text = "\n".join(collected_text)

    # Step 3: Parse device text
    parsed = parse_device_text(merged_text)

    # Step 4: Merge Barcode results (Barcodes have 100% confidence)
    fields = parsed["fields"]
    confidence = parsed["confidence"]

    for k, v in barcode_data.items():
        if k not in fields or confidence.get(k, 0) < 0.95:
            fields[k] = v
            confidence[k] = 1.0

    return {
        "success": True,
        "fields": fields,
        "confidence": confidence,
        "barcodes_detected": list(barcode_data.keys()),
    }
