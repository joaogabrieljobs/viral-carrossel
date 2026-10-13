#!/usr/bin/env python3
"""Generate Moont favicon and app icon assets from the Sequencia mark.

The geometry mirrors public/moont-mark.svg. Favicon canvases keep transparent
corners around the Midnight tile; installable app icons use a full Midnight
canvas so operating-system masks never reveal an unintended edge colour.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

MIDNIGHT = "#090A0F"
MOONLIGHT = "#F3F0E7"
ORBITAL_BLUE = "#5B53E8"
AURORA = "#D7FF5A"


def scaled_box(box: tuple[float, float, float, float], scale: float) -> tuple[int, int, int, int]:
    return tuple(round(value * scale) for value in box)


def render_mark(size: int, *, rounded_tile: bool) -> Image.Image:
    supersample = 8 if size <= 64 else 4
    scale = size * supersample / 64
    canvas_size = size * supersample
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if rounded_tile:
        draw.rounded_rectangle(
            (0, 0, canvas_size - 1, canvas_size - 1),
            radius=round(16 * scale),
            fill=MIDNIGHT,
        )
    else:
        draw.rectangle((0, 0, canvas_size, canvas_size), fill=MIDNIGHT)

    squares = (
        ((7, 10, 29, 32), MOONLIGHT),
        ((21, 21, 43, 43), ORBITAL_BLUE),
        ((35, 32, 57, 54), AURORA),
    )
    for box, fill in squares:
        draw.rounded_rectangle(
            scaled_box(box, scale),
            radius=round(5 * scale),
            fill=fill,
        )

    return image.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    assets = (
        ("favicon-32.png", 32, True),
        ("favicon.png", 64, True),
        ("apple-touch-icon.png", 180, False),
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
    )
    for filename, size, rounded_tile in assets:
        output = PUBLIC / filename
        render_mark(size, rounded_tile=rounded_tile).save(output, optimize=True)
        print(f"generated {output.relative_to(ROOT)} ({size}x{size})")


if __name__ == "__main__":
    main()
