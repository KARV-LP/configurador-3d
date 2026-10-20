from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".f11-source"
OUTPUT = ROOT / "assets/proposals/sid-tattoo-p4/v1"
MANIFEST = ROOT / "docs/f11/sid-tattoo-p4-assets.json"
MAX_EDGE = 4096
QUALITY = 92

ASSETS = {
    "seat": ("assento.jpg", [600.0, 800.0]),
    "backrest-front": ("encosto-frontal.jpg", [600.0, 400.0]),
    "backrest-side": ("encosto-lateral.jpg", [209.24, 212.112]),
    "backrest-rear": ("encosto-traseiro.jpg", [600.0, 800.0]),
    "side-outer": ("lateral-externa.jpg", [744.1, 476.088]),
    "side-inner": ("lateral-interna.jpg", [499.299, 180.458]),
}
FALLBACK_SURFACES = ["side-rear", "side-top", "piping-seat", "piping-backrest"]

OUTPUT.mkdir(parents=True, exist_ok=True)
records = []
for surface_id, (source_name, physical_size_mm) in ASSETS.items():
    source = SOURCE / source_name
    target = OUTPUT / f"{surface_id}.webp"
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
        source_size = list(image.size)
        if max(image.size) > MAX_EDGE:
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=QUALITY, method=6, exact=True)
        runtime_size = list(image.size)
    payload = target.read_bytes()
    if len(payload) > 16 * 1024 * 1024:
        raise RuntimeError(f"{surface_id}: WebP excede 16 MiB")
    if runtime_size[0] * runtime_size[1] > 16 * 1024 * 1024:
        raise RuntimeError(f"{surface_id}: WebP excede budget de pixels")
    records.append(
        {
            "surface_id": surface_id,
            "source_file": source_name,
            "runtime_file": target.relative_to(ROOT).as_posix(),
            "media_type": "image/webp",
            "sha256": hashlib.sha256(payload).hexdigest(),
            "byte_length": len(payload),
            "source_resolution_px": source_size,
            "runtime_resolution_px": runtime_size,
            "physical_size_mm": physical_size_mm,
            "orientation": "canonical-uv",
            "crop": "none",
            "aspect_ratio_preserved": True,
        }
    )

manifest = {
    "schema": "karv.f11-hybrid-assets/1",
    "proposal_id": "sid-tattoo-p4",
    "geometry_sha256": "878a8b89aa330da1dc7a4be00a5de6c0321ab1273c90c414ed1f22fc851df1bf",
    "conversion": {
        "format": "webp",
        "quality": QUALITY,
        "method": 6,
        "max_edge_px": MAX_EDGE,
        "crop": "none",
        "aspect_ratio_preserved": True,
    },
    "custom_assets": records,
    "official_fallback": {
        "material_id": "fabric-kv-002",
        "reason": "único Revestimento oficial com PBR production no catálogo público auditado",
        "surface_ids": FALLBACK_SURFACES,
    },
    "visual_reference": {
        "file": "KARV-REFERENCIA.webp",
        "use": "visual-only",
        "runtime_asset": False,
    },
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
