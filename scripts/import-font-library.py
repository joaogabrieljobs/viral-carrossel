#!/usr/bin/env python3
"""Importa uma pasta de fontes para o catálogo local do Moont.

Uso:
  python3 scripts/import-font-library.py /caminho/para/Fontes

Deduplica formatos da mesma face, cria WOFF2 com o conjunto latino usado pelo
produto e gera CSS + catálogo JS determinísticos.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "fonts" / "library"
CSS_PATH = ROOT / "src" / "styles" / "font-library.css"
CATALOG_PATH = ROOT / "src" / "utils" / "font-library.generated.js"
FONT_EXTENSIONS = {".woff", ".otf", ".ttf"}
FORMAT_PRIORITY = {".woff": 0, ".otf": 1, ".ttf": 2}
APPROVED_FAMILIES = {"Inter", "Roboto"}
WEIGHT_HINTS = (
    ("thin", 100), ("extralight", 200), ("light", 300),
    ("medium", 500), ("semibold", 600), ("extrabold", 800),
    ("bold", 700), ("black", 900),
)

SERIF_HINTS = {"argent", "belgiano", "cloister", "migra", "seagram"}
SANS_HINTS = {
    "aeonik", "aventa", "dream orphans", "inter", "mango grotesque",
    "monument", "neue machina", "oddval", "open sauce", "power grotesk",
    "roboto", "saintregus", "sonar", "stacion", "wagon",
}
BODY_HINTS = SERIF_HINTS | SANS_HINTS
MONO_HINTS = {"pixel countdown"}
EDITORIAL_HINTS = {
    "astral", "authentic", "avelire", "bakpia", "bhineka", "carmela",
    "catfiles", "coffee", "dirtyline", "fair prosper", "hilton", "kelsi",
    "kenfolg", "king", "lemon", "moxa", "nighty", "quentin", "signature",
    "skincake", "super sunshine", "tisk", "yakin", "zinzozo",
}


@dataclass(frozen=True)
class Face:
    source: Path
    family: str
    weight: int
    style: str


def clean_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").strip()
    return re.sub(r"\s+", " ", value)


def font_name(font: TTFont, preferred: int, fallback: int) -> str:
    table = font["name"]
    for name_id in (preferred, fallback):
        records = [record for record in table.names if record.nameID == name_id]
        records.sort(key=lambda record: (record.platformID != 3, record.langID not in (0x409, 0)))
        for record in records:
            try:
                value = clean_name(record.toUnicode())
            except Exception:
                continue
            if value:
                return value
    return ""


def catalog_family(path: Path, source_dir: Path, internal_family: str) -> str:
    folder = clean_name(path.relative_to(source_dir).parts[0])
    aliases = {
        "Argent": "Argent CF",
        "Coffee Cake": "Coffee Cake",
        "Demo_Fonts": "Integral CF",
        "Dirty Line": "Dirtyline",
        "EllenLuff": "Aventa",
        "Power": "Power Grotesk",
        "Sonar": "SaintRegus",
    }
    if folder in {"Open Sauce", "Moxa Bestine"}:
        return internal_family
    return aliases.get(folder, folder)


def inspect(path: Path, source_dir: Path) -> Face | None:
    try:
        font = TTFont(path, lazy=True)
        internal_family = font_name(font, 16, 1)
        family = catalog_family(path, source_dir, internal_family)
        if family not in APPROVED_FAMILIES:
            return None
        if "condensed" in path.stem.lower():
            return None
        subfamily = font_name(font, 17, 2).lower()
        weight = int(getattr(font.get("OS/2"), "usWeightClass", 400) or 400)
        compact_stem = re.sub(r"[^a-z]", "", path.stem.lower())
        weight = next((value for hint, value in WEIGHT_HINTS if hint in compact_stem), weight)
        style = "italic" if ("italic" in subfamily or "oblique" in subfamily) else "normal"
        font.close()
        if not family:
            return None
        return Face(path, family, max(100, min(900, round(weight / 100) * 100)), style)
    except Exception as error:
        print(f"aviso: ignorada {path}: {error}", file=sys.stderr)
        return None


def slug(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "font"


def category(family: str) -> str:
    value = family.lower()
    if any(hint in value for hint in MONO_HINTS):
        return "mono"
    if any(hint in value for hint in SERIF_HINTS):
        return "serif"
    if any(hint in value for hint in SANS_HINTS):
        return "sans"
    if any(hint in value for hint in EDITORIAL_HINTS):
        return "editorial"
    return "display"


def browser_family(family: str) -> str:
    return f"Moont Library {family}"


def fallback(cat: str) -> str:
    return "serif" if cat == "serif" else "monospace" if cat == "mono" else "sans-serif"


def convert_to_woff(face: Face, destination: Path) -> None:
    font = TTFont(face.source)
    font.flavor = "woff"
    font.save(destination, reorderTables=False)
    font.close()


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: import-font-library.py /caminho/para/Fontes", file=sys.stderr)
        return 2
    source_dir = Path(sys.argv[1]).expanduser().resolve()
    if not source_dir.is_dir():
        print(f"pasta não encontrada: {source_dir}", file=sys.stderr)
        return 2

    candidates = sorted(
        (path for path in source_dir.rglob("*") if path.is_file() and path.suffix.lower() in FONT_EXTENSIONS),
        key=lambda path: (len(path.parts), FORMAT_PRIORITY[path.suffix.lower()], str(path).lower()),
    )
    chosen: dict[tuple[str, int, str], Face] = {}
    for path in candidates:
        face = inspect(path, source_dir)
        if not face:
            continue
        key = (face.family.casefold(), face.weight, face.style)
        current = chosen.get(key)
        if current is None or FORMAT_PRIORITY[path.suffix.lower()] < FORMAT_PRIORITY[current.source.suffix.lower()]:
            chosen[key] = face

    shutil.rmtree(OUT_DIR, ignore_errors=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    css_lines = ["/* Gerado por scripts/import-font-library.py. Não editar manualmente. */"]
    families: dict[str, dict] = {}
    imported = 0
    for face in sorted(chosen.values(), key=lambda item: (item.family.casefold(), item.weight, item.style)):
        filename = f"{slug(face.family)}-{face.weight}-{face.style}.woff"
        destination = OUT_DIR / filename
        try:
            convert_to_woff(face, destination)
        except Exception as error:
            print(f"aviso: falhou conversão {face.source}: {error}", file=sys.stderr)
            continue
        imported += 1
        cat = category(face.family)
        family = browser_family(face.family)
        css_lines.extend([
            "@font-face {",
            f"  font-family: {json.dumps(family, ensure_ascii=False)};",
            f"  src: url('/fonts/library/{filename}') format('woff');",
            f"  font-weight: {face.weight};",
            f"  font-style: {face.style};",
            "  font-display: swap;",
            "}",
        ])
        families.setdefault(face.family, {
            "name": face.family,
            "val": f'{json.dumps(family, ensure_ascii=False)}, {fallback(cat)}',
            "cat": cat,
            "local": True,
        })

    entries = sorted(families.values(), key=lambda item: item["name"].casefold())
    body_entries = [item for item in entries if any(hint in item["name"].lower() for hint in BODY_HINTS)]
    CSS_PATH.write_text("\n".join(css_lines) + "\n", encoding="utf-8")
    CATALOG_PATH.write_text(
        "// Gerado por scripts/import-font-library.py. Não editar manualmente.\n"
        f"export const LOCAL_TITLE_FONTS = Object.freeze({json.dumps(entries, ensure_ascii=False, indent=2)});\n\n"
        f"export const LOCAL_BODY_FONTS = Object.freeze({json.dumps(body_entries, ensure_ascii=False, indent=2)});\n\n"
        "export const LOCAL_FONT_FAMILIES = new Set(LOCAL_TITLE_FONTS.map(({ val }) => "
        "val.split(',')[0].trim().replace(/^[\\\"']|[\\\"']$/g, '')));\n",
        encoding="utf-8",
    )
    (OUT_DIR / "README.md").write_text(
        "# Biblioteca de fontes do Moont\n\n"
        "O importador aceita somente as famílias gratuitas aprovadas abaixo e ignora todas as demais.\n\n"
        "- Inter — SIL Open Font License 1.1 — https://github.com/rsms/inter/blob/master/LICENSE.txt\n"
        "- Roboto — Apache License 2.0 — https://github.com/googlefonts/roboto-2-classic/blob/main/LICENSE\n\n"
        "Os arquivos são derivados da pasta fornecida ao projeto. Não inclua trial, demo, personal use "
        "ou qualquer família sem licença comercial comprovada.\n",
        encoding="utf-8",
    )
    print(f"{len(entries)} famílias, {imported} faces, {sum(path.stat().st_size for path in OUT_DIR.glob('*.woff')) / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
