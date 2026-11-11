from __future__ import annotations

import base64
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pptx import Presentation
from pptx.util import Inches


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "ppt_4min_polished"
SLIDE_DIR = OUTPUT_DIR / "slides"
BG_DIR = OUTPUT_DIR / "backgrounds"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SLIDE_DIR.mkdir(parents=True, exist_ok=True)
BG_DIR.mkdir(parents=True, exist_ok=True)

PPTX_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩-图像版.pptx"
PDF_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩-图像版.pdf"
SCRIPT_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩讲稿.md"
PROMPTS_PATH = OUTPUT_DIR / "image2-prompts.json"
META_PATH = OUTPUT_DIR / "build-meta.json"

CANVAS = (1600, 900)
MARGIN_X = 86
MARGIN_Y = 72

FONT_REGULAR_CANDIDATES = [
    Path("C:/Windows/Fonts/msyh.ttc"),
    Path("C:/Windows/Fonts/simsun.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
]
FONT_BOLD_CANDIDATES = [
    Path("C:/Windows/Fonts/msyhbd.ttc"),
    Path("C:/Windows/Fonts/simhei.ttf"),
    Path("C:/Windows/Fonts/msyh.ttc"),
]

HERO_PATH = ROOT / "management-pc" / "src" / "assets" / "hero.png"

COLORS = {
    "bg_1": (8, 16, 36),
    "bg_2": (17, 30, 61),
    "bg_3": (11, 78, 121),
    "surface": (14, 25, 52, 220),
    "surface_soft": (18, 35, 72, 185),
    "surface_lighter": (30, 48, 90, 225),
    "line": (110, 150, 225, 78),
    "line_soft": (170, 200, 255, 32),
    "white": (245, 248, 255),
    "muted": (179, 194, 226),
    "muted_2": (140, 162, 205),
    "brand": (83, 173, 255),
    "cyan": (76, 222, 234),
    "green": (64, 220, 156),
    "amber": (255, 194, 91),
    "red": (255, 122, 122),
    "shadow": (5, 9, 20, 128),
}


def rgba(name: str, alpha: int | None = None) -> tuple[int, int, int, int]:
    rgb = COLORS[name]
    if len(rgb) == 4:
        if alpha is None:
            return rgb
        return rgb[0], rgb[1], rgb[2], alpha
    return rgb[0], rgb[1], rgb[2], 255 if alpha is None else alpha


def load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = FONT_BOLD_CANDIDATES if bold else FONT_REGULAR_CANDIDATES
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


FONTS = {
    "title": load_font(52, bold=True),
    "title_small": load_font(38, bold=True),
    "section": load_font(28, bold=True),
    "subtitle": load_font(20),
    "body": load_font(22),
    "body_small": load_font(18),
    "body_bold": load_font(22, bold=True),
    "caption": load_font(16),
    "metric": load_font(26, bold=True),
    "chip": load_font(16, bold=True),
}


def draw_vertical_gradient(image: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(image)
    w, h = image.size
    for y in range(h):
        ratio = y / max(h - 1, 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3))
        draw.line((0, y, w, y), fill=color)


def add_blur_glow(image: Image.Image, bbox: tuple[int, int, int, int], color: tuple[int, int, int, int], blur: int) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse(bbox, fill=color)
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    image.alpha_composite(overlay)


def add_grid(image: Image.Image, *, step: int = 72) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = image.size
    for x in range(0, w, step):
        draw.line((x, 0, x, h), fill=rgba("line_soft"))
    for y in range(0, h, step):
        draw.line((0, y, w, y), fill=rgba("line_soft"))
    image.alpha_composite(overlay)


def draw_shadowed_panel(
    image: Image.Image,
    bbox: tuple[int, int, int, int],
    *,
    radius: int = 28,
    fill: tuple[int, int, int, int] = (14, 25, 52, 220),
    outline: tuple[int, int, int, int] = (110, 150, 225, 78),
    shadow_offset: tuple[int, int] = (0, 14),
) -> None:
    x1, y1, x2, y2 = bbox
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sx, sy = shadow_offset
    sd.rounded_rectangle((x1 + sx, y1 + sy, x2 + sx, y2 + sy), radius=radius, fill=rgba("shadow", 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.alpha_composite(shadow)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=2)
    image.alpha_composite(overlay)


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    return draw.textlength(text, font=font)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    if not text:
        return [""]

    lines: list[str] = []
    for raw_paragraph in text.split("\n"):
        paragraph = raw_paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for char in paragraph:
            candidate = current + char
            if not current or text_width(draw, candidate, font) <= max_width:
                current = candidate
                continue
            lines.append(current)
            current = char
        if current:
            lines.append(current)
    return lines


def draw_multiline(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    *,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    max_width: int,
    line_gap: int = 8,
) -> int:
    x, y = position
    lines = wrap_text(draw, text, font, max_width)
    current_y = y
    for line in lines:
        bbox = draw.textbbox((x, current_y), line, font=font)
        draw.text((x, current_y), line, font=font, fill=fill)
        current_y += (bbox[3] - bbox[1]) + line_gap
    return current_y


def draw_chip(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, *, fill=(27, 49, 92, 220), outline=(86, 158, 255, 120)) -> int:
    padding_x = 16
    padding_y = 8
    font = FONTS["chip"]
    text_box = draw.textbbox((0, 0), text, font=font)
    width = (text_box[2] - text_box[0]) + padding_x * 2
    height = (text_box[3] - text_box[1]) + padding_y * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=16, fill=fill, outline=outline, width=1)
    draw.text((x + padding_x, y + padding_y - 1), text, font=font, fill=rgba("white"))
    return width


def draw_bullets(
    draw: ImageDraw.ImageDraw,
    items: Iterable[str],
    *,
    x: int,
    y: int,
    width: int,
    bullet_color: tuple[int, int, int] | tuple[int, int, int, int] = rgba("cyan"),
    text_color: tuple[int, int, int] | tuple[int, int, int, int] = rgba("white"),
    font: ImageFont.ImageFont | None = None,
    bullet_gap: int = 16,
    item_gap: int = 14,
) -> int:
    font = font or FONTS["body"]
    current_y = y
    for item in items:
        draw.text((x, current_y), "●", font=font, fill=bullet_color)
        current_y = draw_multiline(
            draw,
            (x + bullet_gap + 18, current_y),
            item,
            font=font,
            fill=text_color,
            max_width=width - bullet_gap - 18,
            line_gap=7,
        )
        current_y += item_gap
    return current_y


def draw_stage_label(draw: ImageDraw.ImageDraw, x: int, y: int, label: str, hint: str) -> None:
    draw.rounded_rectangle((x, y, x + 314, y + 52), radius=18, fill=(20, 40, 82, 230), outline=(83, 173, 255, 110), width=1)
    draw.text((x + 18, y + 11), label, font=FONTS["body_bold"], fill=rgba("white"))
    draw.text((x + 168, y + 15), hint, font=FONTS["caption"], fill=rgba("muted"))


def paste_hero(image: Image.Image, bbox: tuple[int, int, int, int]) -> None:
    if not HERO_PATH.exists():
        return
    hero = Image.open(HERO_PATH).convert("RGBA")
    x1, y1, x2, y2 = bbox
    width = x2 - x1
    height = y2 - y1
    hero.thumbnail((width, height), Image.Resampling.LANCZOS)
    paste_x = x1 + (width - hero.width) // 2
    paste_y = y1 + (height - hero.height) // 2
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((paste_x - 55, paste_y + hero.height - 40, paste_x + hero.width + 55, paste_y + hero.height + 85), fill=(93, 124, 255, 65))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    image.alpha_composite(glow)
    image.alpha_composite(hero, (paste_x, paste_y))


def build_base_background(variant: int) -> Image.Image:
    image = Image.new("RGBA", CANVAS, rgba("bg_1"))
    if variant == 1:
        draw_vertical_gradient(image, COLORS["bg_1"], COLORS["bg_3"])
        add_blur_glow(image, (1030, 40, 1540, 470), (70, 178, 255, 95), 52)
        add_blur_glow(image, (-70, 520, 540, 980), (79, 224, 234, 66), 58)
    elif variant == 2:
        draw_vertical_gradient(image, (10, 17, 34), (14, 35, 75))
        add_blur_glow(image, (1180, 480, 1710, 980), (78, 222, 234, 76), 60)
        add_blur_glow(image, (850, -80, 1400, 340), (83, 173, 255, 84), 54)
    else:
        draw_vertical_gradient(image, (9, 20, 42), (9, 66, 99))
        add_blur_glow(image, (-100, -70, 510, 410), (83, 173, 255, 72), 56)
        add_blur_glow(image, (1100, 380, 1650, 920), (64, 220, 156, 56), 60)

    add_grid(image, step=74)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.polygon([(960, 0), (1600, 0), (1600, 560), (1240, 740), (900, 420)], fill=(255, 255, 255, 12))
    od.polygon([(0, 600), (290, 460), (470, 900), (0, 900)], fill=(255, 255, 255, 10))
    image.alpha_composite(overlay)
    return image


@dataclass
class SlideSpec:
    index: int
    title: str
    subtitle: str
    speech: str


class Image2Helper:
    def __init__(self) -> None:
        self._client = None
        self._disabled = False
        self._used = False
        self._reason = "not_attempted"
        self._api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AI_API_KEY")

    @property
    def used(self) -> bool:
        return self._used

    @property
    def reason(self) -> str:
        return self._reason

    def _ensure_client(self):
        if self._disabled:
            return None
        if not self._api_key:
            self._reason = "missing_api_key"
            self._disabled = True
            return None
        if self._client is not None:
            return self._client
        try:
            from openai import OpenAI
        except ImportError:
            self._reason = "openai_sdk_missing"
            self._disabled = True
            return None
        try:
            self._client = OpenAI(api_key=self._api_key)
            return self._client
        except Exception:
            self._reason = "client_init_failed"
            self._disabled = True
            return None

    def generate(self, prompt: str, out_path: Path) -> bool:
        client = self._ensure_client()
        if client is None:
            return False
        try:
            result = client.images.generate(
                model="gpt-image-2",
                prompt=prompt,
                size="1536x1024",
                quality="low",
            )
            image_b64 = result.data[0].b64_json
            out_path.write_bytes(base64.b64decode(image_b64))
            self._used = True
            self._reason = "ok"
            return True
        except Exception:
            self._reason = "image2_request_failed"
            self._disabled = True
            return False


def crop_fill(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    src = source.convert("RGBA")
    scale = max(target_w / src.width, target_h / src.height)
    resized = src.resize((int(src.width * scale), int(src.height * scale)), Image.Resampling.LANCZOS)
    left = max((resized.width - target_w) // 2, 0)
    top = max((resized.height - target_h) // 2, 0)
    return resized.crop((left, top, left + target_w, top + target_h))


def ensure_backgrounds() -> tuple[dict[str, Path], Image2Helper]:
    prompts = {
        "cover": (
            "Use case: productivity-visual\n"
            "Asset type: presentation background\n"
            "Primary request: premium abstract illustration for a smart ecommerce system, combining mobile shopping, recommendation engine, analytics dashboard, data streams and layered digital surfaces\n"
            "Style/medium: refined 3D editorial tech illustration, crisp and presentation-friendly\n"
            "Composition/framing: wide 16:9 scene with strong focal cluster on the right and generous empty space on the left for a large title\n"
            "Lighting/mood: confident, modern, high-end\n"
            "Color palette: deep navy, cobalt blue, cyan, subtle teal, white highlights\n"
            "Constraints: no text, no watermark, no logo, no clutter"
        ),
        "compare": (
            "Use case: infographic-diagram\n"
            "Asset type: presentation background\n"
            "Primary request: elegant split-concept background suggesting traditional ecommerce versus data-driven intelligent ecommerce\n"
            "Style/medium: abstract interface illustration with clean business-tech atmosphere\n"
            "Composition/framing: wide 16:9, center space kept calm for tables and comparisons\n"
            "Lighting/mood: clean, analytical, premium\n"
            "Color palette: navy base with blue and teal accents\n"
            "Constraints: no text, no watermark, no logo"
        ),
        "architecture": (
            "Use case: productivity-visual\n"
            "Asset type: presentation background\n"
            "Primary request: layered architecture illustration for ecommerce frontend, backend, data pipeline, streaming analytics and recommendation loop\n"
            "Style/medium: premium abstract system diagram style, not literal code screenshot\n"
            "Composition/framing: wide 16:9 with soft layered blocks and readable negative space in the center\n"
            "Lighting/mood: structured, technical, composed\n"
            "Color palette: dark navy, electric blue, cyan, soft white\n"
            "Constraints: no text, no watermark, no logo"
        ),
    }

    PROMPTS_PATH.write_text(json.dumps(prompts, ensure_ascii=False, indent=2), encoding="utf-8")

    helper = Image2Helper()
    backgrounds: dict[str, Path] = {}
    for name, prompt in prompts.items():
        out_path = BG_DIR / f"{name}.png"
        if helper.generate(prompt, out_path):
            backgrounds[name] = out_path
    return backgrounds, helper


def base_canvas(background: Image.Image | None = None, *, variant: int = 1) -> Image.Image:
    if background is not None:
        return crop_fill(background, CANVAS)
    return build_base_background(variant)


def add_common_header(draw: ImageDraw.ImageDraw, spec: SlideSpec) -> None:
    draw_chip(draw, MARGIN_X, 44, f"0{spec.index}")
    draw.text((MARGIN_X + 98, 46), spec.title, font=FONTS["title_small"], fill=rgba("white"))
    draw.text((MARGIN_X, 102), spec.subtitle, font=FONTS["subtitle"], fill=rgba("muted"))


def add_common_footer(draw: ImageDraw.ImageDraw, spec: SlideSpec) -> None:
    footer_y = 852
    draw.line((MARGIN_X, footer_y, 1514, footer_y), fill=rgba("line"), width=1)
    draw.text((MARGIN_X, footer_y + 10), "大数据电商系统 | 4分钟答辩重点版", font=FONTS["caption"], fill=rgba("muted_2"))
    draw.text((1482, footer_y + 10), f"{spec.index}/7", font=FONTS["caption"], fill=rgba("muted_2"))


def slide_1(spec: SlideSpec, backgrounds: dict[str, Path]) -> Image.Image:
    bg_img = Image.open(backgrounds["cover"]) if "cover" in backgrounds else None
    canvas = base_canvas(bg_img, variant=1)
    draw = ImageDraw.Draw(canvas)

    draw_shadowed_panel(canvas, (74, 78, 858, 760), radius=38, fill=(9, 19, 42, 198), outline=(110, 150, 225, 92))
    draw.text((124, 132), "大数据电商系统", font=FONTS["title"], fill=rgba("white"))
    draw.text((128, 208), "交易闭环 + 个性化推荐 + 实时数据分析", font=FONTS["section"], fill=rgba("brand"))
    draw_multiline(
        draw,
        (128, 274),
        "这不是一个只会完成商品展示和下单流程的普通商城，而是一套把用户行为、推荐决策、后台运营和实时分析真正打通的智能电商系统。",
        font=FONTS["body"],
        fill=rgba("white"),
        max_width=650,
        line_gap=10,
    )

    chip_x = 128
    for text in ["适合省赛答辩", "可直接照读", "突出差异化", "突出解决方案"]:
        chip_x += draw_chip(draw, chip_x, 418, text) + 12

    draw_shadowed_panel(canvas, (128, 492, 808, 710), radius=28, fill=(16, 30, 63, 220), outline=(76, 222, 234, 92))
    draw.text((160, 530), "一句话开场", font=FONTS["body_bold"], fill=rgba("cyan"))
    draw_multiline(
        draw,
        (160, 574),
        "我们的项目解决的是传统电商只有交易功能、却缺少个性化推荐和数据驱动运营能力的问题，核心价值是把“交易 + 推荐 + 分析”做成一个闭环。",
        font=FONTS["body"],
        fill=rgba("white"),
        max_width=610,
        line_gap=8,
    )

    draw_shadowed_panel(canvas, (958, 118, 1512, 744), radius=40, fill=(12, 25, 53, 165), outline=(110, 150, 225, 72))
    paste_hero(canvas, (1030, 200, 1440, 558))
    draw_stage_label(draw, 1024, 576, "交易闭环", "浏览、下单、退款")
    draw_stage_label(draw, 1024, 642, "推荐闭环", "召回、排序、重排")
    draw_stage_label(draw, 1024, 708, "数据闭环", "实时、离线、回流")

    add_common_footer(draw, spec)
    return canvas


def slide_2(spec: SlideSpec) -> Image.Image:
    canvas = base_canvas(variant=2)
    draw = ImageDraw.Draw(canvas)
    add_common_header(draw, spec)

    draw_shadowed_panel(canvas, (82, 170, 646, 754), radius=34, fill=(12, 24, 52, 214), outline=(255, 122, 122, 84))
    draw.text((122, 210), "传统电商的常见问题", font=FONTS["section"], fill=rgba("red"))
    draw_bullets(
        draw,
        [
            "大多数页面以销量或时间排序为主，所有用户看到的内容相似，个性化不足。",
            "交易数据有了，但行为数据没有形成推荐和运营的反馈闭环。",
            "后台多停留在静态报表层面，热点变化和用户偏好变化反馈不够及时。",
            "系统往往只重视下单流程，忽视了推荐效果、运营调优和持续迭代能力。",
        ],
        x=122,
        y=282,
        width=468,
    )

    draw_shadowed_panel(canvas, (712, 170, 1516, 482), radius=34, fill=(14, 31, 69, 224), outline=(76, 222, 234, 88))
    draw.text((760, 214), "我们要解决的核心问题", font=FONTS["section"], fill=rgba("cyan"))
    draw_multiline(
        draw,
        (760, 284),
        "项目目标不是把商城做得更花，而是让系统既能完成交易，又能理解用户、及时反馈变化，并支持运营人员基于数据持续优化。",
        font=FONTS["body"],
        fill=rgba("white"),
        max_width=680,
        line_gap=11,
    )

    draw_shadowed_panel(canvas, (712, 518, 1516, 754), radius=34, fill=(17, 39, 78, 228), outline=(83, 173, 255, 84))
    draw.text((760, 554), "所以我们给出的方向是", font=FONTS["body_bold"], fill=rgba("brand"))
    draw_bullets(
        draw,
        [
            "用用户行为构建推荐依据，而不是只看全站热榜。",
            "用实时链路感知变化，用离线分析沉淀长期规律。",
            "把小程序、管理后台、推荐系统和数据看板放在同一套方案里。 ",
        ],
        x=760,
        y=614,
        width=668,
        bullet_color=rgba("brand"),
    )

    add_common_footer(draw, spec)
    return canvas


def slide_3(spec: SlideSpec, backgrounds: dict[str, Path]) -> Image.Image:
    bg_img = Image.open(backgrounds["compare"]) if "compare" in backgrounds else None
    canvas = base_canvas(bg_img, variant=3)
    draw = ImageDraw.Draw(canvas)
    add_common_header(draw, spec)

    table_x1, table_y1, table_x2, table_y2 = 86, 176, 1120, 760
    draw_shadowed_panel(canvas, (table_x1, table_y1, table_x2, table_y2), radius=34, fill=(10, 22, 48, 210), outline=(110, 150, 225, 82))
    rows = [
        ("推荐方式", "以销量/时间排序为主", "按行为构建个性化推荐，支持召回、排序、重排"),
        ("数据能力", "更多是静态报表", "实时行为聚合 + 离线画像分析双链路"),
        ("运营能力", "缺少精细化调优视角", "看板可看热度、偏好、分群、推荐分析"),
        ("系统定位", "重点是交易流程跑通", "重点是交易闭环 + 推荐闭环 + 数据闭环"),
    ]
    col_x = [118, 338, 602]
    draw.text((118, 212), "维度", font=FONTS["body_bold"], fill=rgba("muted"))
    draw.text((338, 212), "传统电商", font=FONTS["body_bold"], fill=rgba("muted"))
    draw.text((602, 212), "我们的项目方案", font=FONTS["body_bold"], fill=rgba("muted"))
    y = 262
    for label, left, right in rows:
        draw.rounded_rectangle((108, y, 1092, y + 112), radius=22, fill=(18, 33, 69, 150), outline=(110, 150, 225, 45), width=1)
        draw.text((126, y + 18), label, font=FONTS["body_bold"], fill=rgba("amber"))
        draw_multiline(draw, (338, y + 18), left, font=FONTS["body_small"], fill=rgba("white"), max_width=220, line_gap=6)
        draw_multiline(draw, (602, y + 18), right, font=FONTS["body_small"], fill=rgba("white"), max_width=450, line_gap=6)
        y += 126

    draw_shadowed_panel(canvas, (1160, 176, 1518, 760), radius=34, fill=(11, 24, 56, 212), outline=(76, 222, 234, 88))
    draw.text((1204, 220), "核心判断", font=FONTS["section"], fill=rgba("cyan"))
    draw.text((1204, 306), "不是", font=FONTS["body_bold"], fill=rgba("muted"))
    draw_multiline(draw, (1204, 342), "“把页面做完的普通商城”", font=FONTS["metric"], fill=rgba("white"), max_width=250, line_gap=6)
    draw.text((1204, 454), "而是", font=FONTS["body_bold"], fill=rgba("muted"))
    draw_multiline(draw, (1204, 490), "“可运营、可分析、可持续优化的智能电商系统”", font=FONTS["body"], fill=rgba("brand"), max_width=250, line_gap=8)
    draw.text((1204, 650), "这也是比赛答辩时最重要的差异化表达。", font=FONTS["caption"], fill=rgba("muted"))

    add_common_footer(draw, spec)
    return canvas


def slide_4(spec: SlideSpec, backgrounds: dict[str, Path]) -> Image.Image:
    bg_img = Image.open(backgrounds["architecture"]) if "architecture" in backgrounds else None
    canvas = base_canvas(bg_img, variant=1)
    draw = ImageDraw.Draw(canvas)
    add_common_header(draw, spec)

    layers = [
        ("交互层", "微信小程序用户端 + Vue3 管理/商家后台", "负责商品浏览、推荐展示、下单售后，以及运营和数据看板呈现。"),
        ("业务服务层", "Spring Boot + MyBatis-Plus + Security + WebSocket", "负责用户、商品、购物车、订单、退款、评价、消息、推荐、权限和风控等业务接口。"),
        ("数据与计算层", "MySQL + Redis + RabbitMQ + Kafka + Flink + Python", "负责核心数据存储、缓存加速、异步解耦、实时计算、画像分群和效果评估。"),
    ]
    y = 192
    heights = [148, 168, 190]
    colors = [(83, 173, 255, 82), (76, 222, 234, 82), (64, 220, 156, 82)]
    for idx, (title, stack, desc) in enumerate(layers):
        draw_shadowed_panel(canvas, (90, y, 1138, y + heights[idx]), radius=32, fill=(13, 27, 58, 215), outline=colors[idx])
        draw.text((132, y + 22), title, font=FONTS["section"], fill=colors[idx][:3] + (255,))
        draw_multiline(draw, (132, y + 72), stack, font=FONTS["body_bold"], fill=rgba("white"), max_width=930, line_gap=6)
        draw_multiline(draw, (132, y + 110), desc, font=FONTS["body_small"], fill=rgba("muted"), max_width=930, line_gap=6)
        y += heights[idx] + 24

    draw_shadowed_panel(canvas, (1170, 192, 1516, 738), radius=34, fill=(11, 24, 56, 220), outline=(83, 173, 255, 88))
    draw.text((1208, 226), "数据闭环", font=FONTS["section"], fill=rgba("brand"))
    steps = [
        "用户浏览、点击、加购、下单",
        "实时事件进入流式链路",
        "热度、偏好、画像结果沉淀",
        "结果回流推荐接口与后台看板",
    ]
    sy = 306
    for i, step in enumerate(steps, start=1):
        draw.ellipse((1210, sy - 8, 1252, sy + 34), fill=(24, 48, 98, 255), outline=(83, 173, 255, 120), width=2)
        draw.text((1224, sy + 1), str(i), font=FONTS["caption"], fill=rgba("white"))
        draw_multiline(draw, (1270, sy - 8), step, font=FONTS["body_small"], fill=rgba("white"), max_width=208, line_gap=4)
        if i < len(steps):
            draw.line((1230, sy + 38, 1230, sy + 88), fill=rgba("line"), width=2)
        sy += 118

    add_common_footer(draw, spec)
    return canvas


def slide_5(spec: SlideSpec) -> Image.Image:
    canvas = base_canvas(variant=2)
    draw = ImageDraw.Draw(canvas)
    add_common_header(draw, spec)

    draw_shadowed_panel(canvas, (88, 180, 742, 758), radius=34, fill=(12, 24, 53, 220), outline=(83, 173, 255, 90))
    draw.text((128, 216), "方法一：推荐系统怎么做", font=FONTS["section"], fill=rgba("brand"))
    flow_steps = [
        ("行为采集", "浏览、点击、收藏、加购、购买，形成用户兴趣信号。"),
        ("多源召回", "从历史交互、偏好类目、热门商品等来源取候选集。"),
        ("融合排序", "综合协同过滤、内容特征、热度和时效进行排序。"),
        ("重排与兜底", "做去重、多样性控制、冷启动兜底，保证体验稳定。"),
    ]
    fy = 292
    for idx, (name, desc) in enumerate(flow_steps, start=1):
        draw.rounded_rectangle((126, fy, 694, fy + 92), radius=22, fill=(19, 38, 76, 190), outline=(110, 150, 225, 50), width=1)
        draw.ellipse((146, fy + 22, 194, fy + 70), fill=(26, 51, 101, 255), outline=(83, 173, 255, 110), width=2)
        draw.text((164, fy + 32), str(idx), font=FONTS["caption"], fill=rgba("white"))
        draw.text((216, fy + 18), name, font=FONTS["body_bold"], fill=rgba("white"))
        draw_multiline(draw, (216, fy + 48), desc, font=FONTS["body_small"], fill=rgba("muted"), max_width=446, line_gap=4)
        if idx < len(flow_steps):
            draw.line((170, fy + 92, 170, fy + 118), fill=rgba("line"), width=2)
        fy += 118

    draw_shadowed_panel(canvas, (780, 180, 1512, 758), radius=34, fill=(14, 31, 69, 222), outline=(76, 222, 234, 90))
    draw.text((822, 216), "方法二：问题怎么解决", font=FONTS["section"], fill=rgba("cyan"))
    draw_bullets(
        draw,
        [
            "个性化不足：不再只按销量排序，而是把用户行为和兴趣偏好真正用起来。",
            "冷启动问题：先用热门商品兜底，再配合类目平衡和实时热度帮助新用户过渡。",
            "数据滞后问题：通过 Kafka + Flink 做实时聚合，让后台和推荐能更快感知变化。",
            "模块联动复杂：通过模块化拆分和后台分析页面，把问题定位从“黑盒”变成“可观察”。",
        ],
        x=822,
        y=286,
        width=612,
        bullet_color=rgba("cyan"),
    )
    draw_multiline(
        draw,
        (822, 646),
        "一句话说，我们解决的不是单一算法问题，而是“推荐怎么落到业务里、怎么被数据持续优化”的系统问题。",
        font=FONTS["body_small"],
        fill=rgba("brand"),
        max_width=610,
        line_gap=6,
    )

    add_common_footer(draw, spec)
    return canvas


def slide_6(spec: SlideSpec) -> Image.Image:
    canvas = base_canvas(variant=3)
    draw = ImageDraw.Draw(canvas)
    add_common_header(draw, spec)

    draw_shadowed_panel(canvas, (86, 176, 1516, 760), radius=36, fill=(10, 22, 48, 208), outline=(110, 150, 225, 82))
    draw.text((126, 214), "从比赛展示和项目落地角度，这个系统最有价值的地方有四点。", font=FONTS["body_bold"], fill=rgba("white"))

    cards = [
        ("完整交易闭环", "用户能完成浏览、加购、下单、支付、评价、退款等主流程，系统不是停留在演示页。", "green"),
        ("推荐分析可见", "后台不仅能看商品和订单，还能看推荐预览、画像分群、推荐分析和 AB Test。", "brand"),
        ("实时能力突出", "商品热度、行为分布、类目偏好能实时回流，系统更像“可运营平台”而不是静态网站。", "cyan"),
        ("工程扩展明确", "权限、风控、消息、部署、实时链路和 AI 扩展入口都已预留，后续可继续工程化。", "amber"),
    ]
    positions = [(126, 292), (790, 292), (126, 516), (790, 516)]
    for (title, desc, color_name), (x, y) in zip(cards, positions, strict=True):
        outline = rgba(color_name if color_name in COLORS else "brand", 100)
        fill = (17, 34, 70, 188)
        draw.rounded_rectangle((x, y, x + 610, y + 182), radius=28, fill=fill, outline=outline, width=2)
        draw.text((x + 30, y + 26), title, font=FONTS["section"], fill=rgba(color_name if color_name in COLORS else "brand"))
        draw_multiline(draw, (x + 30, y + 82), desc, font=FONTS["body_small"], fill=rgba("white"), max_width=548, line_gap=6)

    add_common_footer(draw, spec)
    return canvas


def slide_7(spec: SlideSpec) -> Image.Image:
    canvas = base_canvas(variant=1)
    draw = ImageDraw.Draw(canvas)

    draw_shadowed_panel(canvas, (76, 108, 1522, 784), radius=42, fill=(8, 19, 43, 196), outline=(110, 150, 225, 84))
    draw.text((118, 152), "总结一句话", font=FONTS["title_small"], fill=rgba("white"))
    draw_multiline(
        draw,
        (118, 226),
        "我们这个项目的重点，不是单纯把商城业务跑通，而是把传统电商中“推荐不够个性化、数据反馈不够及时、运营难以持续优化”的问题真正往前推进了一步。",
        font=FONTS["section"],
        fill=rgba("brand"),
        max_width=1280,
        line_gap=10,
    )

    summary_blocks = [
        ("相比传统电商", "我们增加了个性化推荐、实时分析和后台运营闭环，让系统从“能交易”升级到“更智能、更可运营”。"),
        ("核心解决方法", "用用户行为做推荐依据，用 Kafka/Flink 做实时聚合，用离线分析做画像和分群，再把结果回流给推荐和看板。"),
        ("最终价值", "它既适合课程设计与比赛答辩展示，也具备继续扩展成更完整工程原型的基础。"),
    ]
    y = 420
    for title, content in summary_blocks:
        draw.text((124, y), title, font=FONTS["body_bold"], fill=rgba("cyan"))
        draw_multiline(draw, (298, y - 2), content, font=FONTS["body"], fill=rgba("white"), max_width=1100, line_gap=8)
        y += 108

    draw.text((118, 724), "谢谢各位老师，欢迎提问。", font=FONTS["section"], fill=rgba("white"))
    add_common_footer(draw, spec)
    return canvas


def save_slide(image: Image.Image, path: Path) -> None:
    image.convert("RGB").save(path, format="PNG", optimize=True)


def build_script(slides: list[SlideSpec]) -> None:
    lines = ["# 大数据电商系统 4 分钟答辩讲稿", ""]
    for spec in slides:
        lines.append(f"## 幻灯片 {spec.index}：{spec.title}")
        lines.append(spec.speech)
        lines.append("")
    SCRIPT_PATH.write_text("\n".join(lines), encoding="utf-8")


def build_ppt(slide_paths: list[Path]) -> None:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    for slide_path in slide_paths:
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(str(slide_path), 0, 0, width=prs.slide_width, height=prs.slide_height)
    prs.save(str(PPTX_PATH))


def build_pdf(slide_paths: list[Path]) -> None:
    images = [Image.open(path).convert("RGB") for path in slide_paths]
    if not images:
        return
    first, rest = images[0], images[1:]
    first.save(str(PDF_PATH), save_all=True, append_images=rest)


def main() -> None:
    backgrounds, image2_helper = ensure_backgrounds()
    specs = [
        SlideSpec(
            1,
            "封面",
            "项目名称 + 核心价值 + 汇报主线",
            "各位评委老师好，我们的项目是大数据电商系统。这个项目的核心不是只做一个商城页面，而是把交易闭环、个性化推荐和实时数据分析真正打通。我会用四分钟，重点介绍项目解决了什么问题、它和传统电商有什么本质区别，以及我们用了什么方法把这些问题落地解决。",
        ),
        SlideSpec(
            2,
            "项目目标",
            "先讲痛点，再讲我们为什么要这样做",
            "传统电商的问题并不是不能完成交易，而是推荐结果往往比较同质化，后台也很难及时感知用户兴趣和热点变化。所以我们做这个项目时，目标很明确，就是让系统既能完成浏览、下单、退款等基础业务，也能理解用户、反馈变化，并支持运营人员持续调优。",
        ),
        SlideSpec(
            3,
            "差异化",
            "这页最适合回答“你和普通商城有什么区别”",
            "和传统电商相比，我们最大的不同有四点。第一，推荐方式不是简单按销量排序，而是由用户行为驱动。第二，数据能力不是静态报表，而是实时链路加离线分析。第三，后台不仅管理订单商品，还能看画像、分群和推荐分析。第四，系统定位不是只做交易，而是做交易闭环、推荐闭环和数据闭环的一体化系统。",
        ),
        SlideSpec(
            4,
            "系统架构",
            "从交互层、业务层、数据层把逻辑讲清楚",
            "系统整体采用分层架构。最上层是微信小程序和 Vue3 管理后台，负责用户交易体验和运营展示；中间层是 Spring Boot 业务服务，负责商品、订单、推荐、消息、权限等核心接口；底层是 MySQL、Redis、RabbitMQ、Kafka、Flink 和 Python 分析模块，负责存储、缓存、异步解耦、实时计算和离线分析。这样分层之后，整个系统的职责边界更清晰，也更方便扩展。",
        ),
        SlideSpec(
            5,
            "解决方案",
            "这一页要突出“我们是怎么解决的”",
            "在解决方法上，我们一方面通过浏览、点击、加购和购买等行为构建用户兴趣，然后做多源召回、融合排序和重排，避免推荐结果只有热榜。另一方面，我们把行为数据接入实时链路，通过 Kafka 和 Flink 做聚合，再配合离线画像和分群分析，把结果回流给推荐接口和后台看板。这样推荐就不是一次性的，而是可以持续优化的。",
        ),
        SlideSpec(
            6,
            "项目价值",
            "从比赛展示和落地价值两方面收束",
            "这个项目的价值主要体现在四点：第一，交易主流程完整，不是静态演示；第二，推荐和分析结果可见，能够证明系统不是只把页面做出来了；第三，实时能力让后台更适合运营场景；第四，工程扩展路径明确，后续还可以继续完善 A/B 测试、冷启动优化和监控部署能力。",
        ),
        SlideSpec(
            7,
            "总结",
            "最后用一句话收束全场",
            "最后总结一句话，我们做的不是一个普通商城，而是一套把用户交易、个性化推荐和数据分析真正融合起来的智能电商系统。相比传统电商，它更智能、更可运营，也更能体现系统设计和大数据处理能力。谢谢各位老师，欢迎提问。",
        ),
    ]

    renderers = [
        lambda: slide_1(specs[0], backgrounds),
        lambda: slide_2(specs[1]),
        lambda: slide_3(specs[2], backgrounds),
        lambda: slide_4(specs[3], backgrounds),
        lambda: slide_5(specs[4]),
        lambda: slide_6(specs[5]),
        lambda: slide_7(specs[6]),
    ]

    slide_paths: list[Path] = []
    for idx, render in enumerate(renderers, start=1):
        slide_path = SLIDE_DIR / f"slide-{idx:02d}.png"
        save_slide(render(), slide_path)
        slide_paths.append(slide_path)

    build_script(specs)
    build_ppt(slide_paths)
    build_pdf(slide_paths)

    meta = {
        "pptx": str(PPTX_PATH),
        "pdf": str(PDF_PATH),
        "script": str(SCRIPT_PATH),
        "slide_dir": str(SLIDE_DIR),
        "image2_used": image2_helper.used,
        "image2_status": image2_helper.reason,
        "backgrounds_generated": {key: str(path) for key, path in backgrounds.items()},
    }
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
