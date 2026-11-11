from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pptx import Presentation
from pptx.util import Inches


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "ppt_4min_editorial"
SLIDE_DIR = OUTPUT_DIR / "slides"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SLIDE_DIR.mkdir(parents=True, exist_ok=True)

PPTX_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩-亮点加强版.pptx"
PDF_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩-亮点加强版.pdf"
SCRIPT_PATH = OUTPUT_DIR / "大数据电商系统-4分钟答辩讲稿-亮点加强版.md"
META_PATH = OUTPUT_DIR / "build-meta.json"
TOTAL_SLIDES = 8

CANVAS = (1600, 900)
MARGIN_X = 86

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

COLORS = {
    "bg_top": (249, 247, 242),
    "bg_bottom": (238, 244, 252),
    "paper": (255, 253, 249),
    "paper_blue": (245, 249, 255),
    "paper_warm": (255, 248, 241),
    "navy": (20, 35, 57),
    "ink": (39, 56, 78),
    "muted": (107, 121, 143),
    "muted_light": (152, 165, 184),
    "blue": (48, 96, 255),
    "sky": (97, 180, 255),
    "orange": (255, 140, 77),
    "orange_soft": (255, 231, 214),
    "green": (42, 178, 123),
    "green_soft": (225, 248, 238),
    "red": (229, 99, 92),
    "red_soft": (252, 232, 229),
    "line": (214, 224, 236),
    "shadow": (34, 57, 89, 26),
}


def rgba(name: str, alpha: int | None = None) -> tuple[int, int, int, int]:
    rgb = COLORS[name]
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
    "hero": load_font(58, bold=True),
    "title": load_font(40, bold=True),
    "section": load_font(28, bold=True),
    "subtitle": load_font(19),
    "body": load_font(21),
    "body_small": load_font(17),
    "body_bold": load_font(21, bold=True),
    "metric": load_font(25, bold=True),
    "chip": load_font(15, bold=True),
    "caption": load_font(14),
}


@dataclass
class SlideSpec:
    index: int
    title: str
    subtitle: str
    speech: str


def draw_vertical_gradient(image: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3))
        draw.line((0, y, width, y), fill=color)


def add_soft_blob(image: Image.Image, bbox: tuple[int, int, int, int], fill: tuple[int, int, int, int], blur: int) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse(bbox, fill=fill)
    overlay = overlay.filter(ImageFilter.GaussianBlur(blur))
    image.alpha_composite(overlay)


def add_dots(image: Image.Image, area: tuple[int, int, int, int], *, step: int = 24, color: tuple[int, int, int, int]) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    x1, y1, x2, y2 = area
    for x in range(x1, x2, step):
        for y in range(y1, y2, step):
            draw.ellipse((x, y, x + 3, y + 3), fill=color)
    image.alpha_composite(overlay)


def make_canvas(variant: int) -> Image.Image:
    image = Image.new("RGBA", CANVAS, rgba("paper"))
    if variant == 1:
        draw_vertical_gradient(image, COLORS["bg_top"], COLORS["bg_bottom"])
        add_soft_blob(image, (990, -60, 1540, 380), (105, 178, 255, 78), 54)
        add_soft_blob(image, (-60, 560, 420, 980), (255, 180, 124, 62), 60)
        add_dots(image, (1210, 120, 1510, 360), color=(48, 96, 255, 34))
    elif variant == 2:
        draw_vertical_gradient(image, (252, 249, 244), (241, 246, 255))
        add_soft_blob(image, (1120, 470, 1620, 980), (93, 163, 255, 62), 64)
        add_soft_blob(image, (980, 40, 1360, 320), (255, 145, 89, 42), 52)
        add_dots(image, (70, 560, 260, 830), color=(255, 140, 77, 34))
    else:
        draw_vertical_gradient(image, (248, 246, 241), (236, 243, 253))
        add_soft_blob(image, (-80, 0, 430, 340), (255, 183, 127, 48), 56)
        add_soft_blob(image, (1120, 80, 1640, 560), (99, 180, 255, 56), 60)
        add_dots(image, (1160, 100, 1490, 350), color=(42, 178, 123, 28))
    return image


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    return draw.textlength(text, font=font)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    if not text:
        return [""]
    lines: list[str] = []
    for paragraph in text.split("\n"):
        piece = paragraph.strip()
        if not piece:
            lines.append("")
            continue
        current = ""
        for char in piece:
            candidate = current + char
            if not current or text_width(draw, candidate, font) <= max_width:
                current = candidate
            else:
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
    current_y = y
    for line in wrap_text(draw, text, font, max_width):
        bbox = draw.textbbox((x, current_y), line, font=font)
        draw.text((x, current_y), line, font=font, fill=fill)
        current_y += (bbox[3] - bbox[1]) + line_gap
    return current_y


def draw_card(
    image: Image.Image,
    bbox: tuple[int, int, int, int],
    *,
    fill: tuple[int, int, int, int] | tuple[int, int, int] = (255, 255, 255, 255),
    outline: tuple[int, int, int] | tuple[int, int, int, int] = COLORS["line"],
    radius: int = 28,
    shadow: bool = True,
) -> None:
    if shadow:
        shadow_img = Image.new("RGBA", image.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow_img)
        x1, y1, x2, y2 = bbox
        sd.rounded_rectangle((x1, y1 + 10, x2, y2 + 10), radius=radius, fill=rgba("shadow"))
        shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(16))
        image.alpha_composite(shadow_img)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=2)
    image.alpha_composite(overlay)


def draw_chip(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, *, fill: tuple[int, int, int] | tuple[int, int, int, int], text_fill: tuple[int, int, int] | tuple[int, int, int, int]) -> int:
    font = FONTS["chip"]
    box = draw.textbbox((0, 0), text, font=font)
    width = (box[2] - box[0]) + 30
    height = (box[3] - box[1]) + 18
    draw.rounded_rectangle((x, y, x + width, y + height), radius=18, fill=fill)
    draw.text((x + 15, y + 8), text, font=font, fill=text_fill)
    return width


def draw_bullets(
    draw: ImageDraw.ImageDraw,
    items: Iterable[str],
    *,
    x: int,
    y: int,
    width: int,
    bullet_fill: tuple[int, int, int] | tuple[int, int, int, int],
    font: ImageFont.ImageFont | None = None,
    text_fill: tuple[int, int, int] | tuple[int, int, int, int] | None = None,
) -> int:
    font = font or FONTS["body"]
    text_fill = text_fill or COLORS["ink"]
    current_y = y
    for item in items:
        draw.ellipse((x, current_y + 7, x + 10, current_y + 17), fill=bullet_fill)
        current_y = draw_multiline(
            draw,
            (x + 24, current_y),
            item,
            font=font,
            fill=text_fill,
            max_width=width - 24,
            line_gap=7,
        )
        current_y += 14
    return current_y


def draw_cover_art(image: Image.Image) -> None:
    draw_card(image, (962, 138, 1496, 738), fill=(255, 255, 255, 242), outline=(223, 229, 238), radius=34)
    draw_card(image, (1024, 198, 1298, 618), fill=(245, 249, 255, 255), outline=(201, 220, 245), radius=26)
    draw_card(image, (1060, 238, 1262, 366), fill=(255, 255, 255, 255), outline=(232, 237, 244), radius=22, shadow=False)
    draw_card(image, (1060, 390, 1262, 578), fill=(255, 248, 241, 255), outline=(248, 221, 198), radius=22, shadow=False)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((1096, 272, 1226, 320), radius=20, fill=(48, 96, 255, 38))
    draw.rectangle((1098, 430, 1224, 510), fill=(255, 214, 190))
    draw.line((1132, 480, 1210, 438), fill=COLORS["orange"], width=6)
    draw.line((1110, 532, 1228, 532), fill=COLORS["line"], width=3)
    draw.line((1110, 548, 1204, 548), fill=COLORS["line"], width=3)

    draw_card(image, (1308, 214, 1444, 346), fill=(255, 255, 255, 255), outline=(232, 237, 244), radius=24, shadow=False)
    draw_card(image, (1308, 372, 1444, 540), fill=(245, 249, 255, 255), outline=(204, 220, 242), radius=24, shadow=False)
    draw_card(image, (1308, 564, 1444, 678), fill=(255, 255, 255, 255), outline=(232, 237, 244), radius=24, shadow=False)

    draw.text((1340, 240), "CTR", font=FONTS["caption"], fill=COLORS["muted"])
    draw.text((1338, 272), "12.8%", font=FONTS["metric"], fill=COLORS["navy"])
    draw.line((1338, 430, 1364, 450), fill=COLORS["blue"], width=5)
    draw.line((1364, 450, 1392, 424), fill=COLORS["blue"], width=5)
    draw.line((1392, 424, 1422, 470), fill=COLORS["orange"], width=5)
    for idx, height in enumerate([34, 58, 46, 70]):
        draw.rounded_rectangle((1336 + idx * 22, 618 - height, 1350 + idx * 22, 618), radius=6, fill=COLORS["sky"])

    draw.line((1298, 290, 1308, 280), fill=(213, 224, 236), width=3)
    draw.line((1298, 468, 1308, 448), fill=(213, 224, 236), width=3)
    draw.line((1262, 510, 1308, 594), fill=(213, 224, 236), width=3)


def add_common_header(draw: ImageDraw.ImageDraw, spec: SlideSpec) -> None:
    draw_chip(draw, 86, 48, f"0{spec.index}", fill=COLORS["orange"], text_fill=(255, 255, 255))
    draw.text((176, 48), spec.title, font=FONTS["title"], fill=COLORS["navy"])
    draw.text((86, 110), spec.subtitle, font=FONTS["subtitle"], fill=COLORS["muted"])
    draw.line((86, 146, 1512, 146), fill=COLORS["line"], width=2)


def add_common_footer(draw: ImageDraw.ImageDraw, spec: SlideSpec) -> None:
    draw.line((86, 842, 1514, 842), fill=COLORS["line"], width=2)
    draw.text((86, 856), "大数据电商系统 | 4分钟答辩亮点加强版", font=FONTS["caption"], fill=COLORS["muted_light"])
    draw.text((1466, 856), f"{spec.index}/{TOTAL_SLIDES}", font=FONTS["caption"], fill=COLORS["muted_light"])


def slide_1(spec: SlideSpec) -> Image.Image:
    image = make_canvas(1)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((86, 86, 1520, 814), radius=38, fill=(255, 255, 255, 124), outline=(255, 255, 255, 145), width=2)
    draw.text((126, 148), "大数据电商系统", font=FONTS["hero"], fill=COLORS["navy"])
    draw.rounded_rectangle((128, 242, 458, 292), radius=24, fill=COLORS["orange_soft"])
    draw.text((152, 252), "交易闭环 + 个性化推荐 + 实时数据分析", font=FONTS["body_bold"], fill=COLORS["orange"])
    draw_multiline(
        draw,
        (128, 334),
        "这不是一个只完成商品展示和下单流程的普通商城，而是一套把用户行为、推荐决策、后台运营和实时分析真正打通的智能电商系统。",
        font=FONTS["body"],
        fill=COLORS["ink"],
        max_width=640,
        line_gap=11,
    )

    chip_x = 128
    for text, fill, text_fill in [
        ("适合比赛答辩", COLORS["paper_blue"], COLORS["blue"]),
        ("结构清楚", COLORS["paper_warm"], COLORS["orange"]),
        ("可直接照读", COLORS["green_soft"], COLORS["green"]),
    ]:
        chip_x += draw_chip(draw, chip_x, 470, text, fill=fill, text_fill=text_fill) + 12

    draw_card(image, (128, 552, 760, 722), fill=(255, 255, 255, 248), outline=(226, 233, 242), radius=30)
    draw.text((164, 588), "一句话开场", font=FONTS["section"], fill=COLORS["blue"])
    draw_multiline(
        draw,
        (164, 640),
        "我们的项目解决的是传统电商只有交易功能、却缺少个性化推荐和数据驱动运营能力的问题，核心价值是把“交易 + 推荐 + 分析”做成一个闭环。",
        font=FONTS["body"],
        fill=COLORS["ink"],
        max_width=552,
        line_gap=8,
    )

    draw_cover_art(image)
    add_common_footer(draw, spec)
    return image


def slide_2(spec: SlideSpec) -> Image.Image:
    image = make_canvas(2)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 186, 634, 760), fill=(255, 255, 255, 248), outline=(236, 222, 214), radius=32)
    draw.text((126, 224), "传统电商的常见痛点", font=FONTS["section"], fill=COLORS["orange"])
    pain_items = [
        "推荐方式偏统一，用户看到的内容容易趋同。",
        "有交易数据，但行为数据没有形成推荐和运营的反馈闭环。",
        "后台更多是静态报表，对热点和兴趣变化反应偏慢。",
        "系统重交易、轻调优，后续很难持续优化用户体验。",
    ]
    y = 292
    for idx, item in enumerate(pain_items, start=1):
        draw_card(image, (124, y, 594, y + 92), fill=(255, 248, 241, 255), outline=(247, 225, 210), radius=24, shadow=False)
        draw.ellipse((148, y + 24, 188, y + 64), fill=COLORS["orange"])
        draw.text((163, y + 31), str(idx), font=FONTS["caption"], fill=(255, 255, 255))
        draw_multiline(draw, (212, y + 22), item, font=FONTS["body_small"], fill=COLORS["ink"], max_width=344, line_gap=5)
        y += 108

    draw_card(image, (678, 186, 1514, 760), fill=(255, 255, 255, 248), outline=(221, 230, 244), radius=32)
    draw.text((718, 224), "我们想做到什么", font=FONTS["section"], fill=COLORS["blue"])
    draw_multiline(
        draw,
        (718, 290),
        "目标不是把商城做得更花，而是让系统既能完成交易，又能理解用户、及时反馈变化，并支持运营人员持续调优。",
        font=FONTS["body"],
        fill=COLORS["ink"],
        max_width=730,
        line_gap=10,
    )
    draw.rounded_rectangle((718, 414, 1468, 506), radius=26, fill=COLORS["paper_blue"], outline=(212, 225, 243), width=2)
    draw.text((754, 442), "从“能交易”升级到“更智能、更可运营”", font=FONTS["section"], fill=COLORS["navy"])

    draw_bullets(
        draw,
        [
            "用用户行为构建推荐依据，而不是只依赖全站热榜。",
            "用实时链路感知变化，用离线分析沉淀长期规律。",
            "把小程序、后台、推荐系统和数据看板放进同一套方案。",
        ],
        x=728,
        y=560,
        width=710,
        bullet_fill=COLORS["blue"],
        text_fill=COLORS["ink"],
    )
    add_common_footer(draw, spec)
    return image


def slide_3(spec: SlideSpec) -> Image.Image:
    image = make_canvas(3)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 188, 1514, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=32)
    draw.text((126, 224), "这一页把项目亮点集中讲出来，评委一眼就能知道我们不是普通商城。", font=FONTS["body_bold"], fill=COLORS["navy"])

    cards = [
        ((126, 294, 474, 496), COLORS["paper_blue"], COLORS["blue"], "推荐算法", "不是简单热榜，而是 CF + CB + Hybrid 混合推荐。"),
        ((520, 294, 868, 496), COLORS["paper_warm"], COLORS["orange"], "用户行为", "浏览、搜索、点击、收藏、加购、下单都会进入画像。"),
        ((914, 294, 1262, 496), COLORS["green_soft"], COLORS["green"], "大数据分析", "Kafka + Flink 做实时聚合，后台看板实时回流。"),
        ((126, 534, 474, 736), (255, 255, 255), COLORS["navy"], "用户分群", "KMeans + 冷启动规则，把人群划分为可运营对象。"),
        ((520, 534, 868, 736), COLORS["paper_blue"], COLORS["blue"], "AI 导购", "结合用户画像、意图识别、商品问答和推荐候选承接。"),
        ((914, 534, 1262, 736), COLORS["paper_warm"], COLORS["orange"], "智能省钱", "结算页自动挑券、给备选方案、支持凑单建议。"),
    ]
    for bbox, fill, accent, title, desc in cards:
        draw.rounded_rectangle(bbox, radius=26, fill=fill, outline=COLORS["line"], width=1)
        x1, y1, _, _ = bbox
        draw.text((x1 + 24, y1 + 24), title, font=FONTS["section"], fill=accent)
        draw_multiline(draw, (x1 + 24, y1 + 90), desc, font=FONTS["body"], fill=COLORS["ink"], max_width=300, line_gap=8)

    draw_card(image, (1300, 294, 1514, 736), fill=(255, 255, 255, 248), outline=(226, 233, 242), radius=30)
    draw.text((1332, 328), "核心判断", font=FONTS["section"], fill=COLORS["blue"])
    draw_multiline(draw, (1332, 404), "我们做的是“交易 + 推荐 + 分析 + AI承接”的一体化电商系统。", font=FONTS["body"], fill=COLORS["navy"], max_width=152, line_gap=8)
    draw.text((1332, 632), "亮点够集中，答辩时更容易抓住重点。", font=FONTS["caption"], fill=COLORS["muted"])

    add_common_footer(draw, spec)
    return image


def slide_4(spec: SlideSpec) -> Image.Image:
    image = make_canvas(1)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 188, 760, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=32)
    draw.text((126, 224), "用户行为是推荐系统的输入", font=FONTS["section"], fill=COLORS["blue"])
    draw_bullets(
        draw,
        [
            "系统采集浏览、搜索、点击、收藏、加购、购买等行为，形成用户兴趣信号。",
            "这些行为会做加权处理，最后沉淀成用户画像和偏好标签。",
            "所以推荐依据不再只是销量，而是“用户最近真正关心什么”。",
        ],
        x=126,
        y=286,
        width=570,
        bullet_fill=COLORS["blue"],
        text_fill=COLORS["ink"],
    )
    draw.rounded_rectangle((126, 498, 720, 716), radius=26, fill=COLORS["paper_blue"], outline=COLORS["line"], width=1)
    draw.text((156, 528), "行为 -> 画像 -> 推荐", font=FONTS["body_bold"], fill=COLORS["navy"])
    draw.text((156, 588), "浏览 / 搜索 / 点击 / 加购 / 购买", font=FONTS["body_small"], fill=COLORS["muted"])
    draw.line((216, 620, 286, 620), fill=COLORS["sky"], width=4)
    draw.text((300, 606), "形成用户画像", font=FONTS["body_small"], fill=COLORS["ink"])
    draw.line((468, 620, 538, 620), fill=COLORS["sky"], width=4)
    draw.text((552, 606), "进入推荐排序", font=FONTS["body_small"], fill=COLORS["ink"])

    draw_card(image, (800, 188, 1514, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=32)
    draw.text((840, 224), "推荐算法怎么讲", font=FONTS["section"], fill=COLORS["orange"])
    algorithm_cards = [
        ("CF 协同过滤", "用 user-item 加权矩阵和余弦相似度找相似用户，推荐相似用户喜欢但目标用户未看过的商品。", COLORS["paper_warm"], COLORS["orange"]),
        ("CB 内容推荐", "根据商品标签、品类和价格特征，用 Jaccard 相似度和画像匹配候选商品。", COLORS["paper_blue"], COLORS["blue"]),
        ("Hybrid 混合推荐", "把 CF、CB、热度和实时偏好融合排序，再做去重、多样性和冷启动兜底。", COLORS["green_soft"], COLORS["green"]),
    ]
    ay = 294
    for title, desc, fill, accent in algorithm_cards:
        draw.rounded_rectangle((840, ay, 1474, ay + 124), radius=24, fill=fill, outline=COLORS["line"], width=1)
        draw.text((868, ay + 22), title, font=FONTS["body_bold"], fill=accent)
        draw_multiline(draw, (868, ay + 58), desc, font=FONTS["body_small"], fill=COLORS["ink"], max_width=570, line_gap=6)
        ay += 146

    draw.text((840, 710), "和传统电商的核心区别：我们不是按销量堆商品，而是按用户兴趣做个性化推荐。", font=FONTS["caption"], fill=COLORS["muted"])

    add_common_footer(draw, spec)
    return image


def slide_5(spec: SlideSpec) -> Image.Image:
    image = make_canvas(2)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 186, 686, 762), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=32)
    draw.text((126, 224), "大数据分析链路", font=FONTS["section"], fill=COLORS["blue"])
    draw_bullets(
        draw,
        [
            "MySQL 负责核心业务数据存储，Kafka 负责承接行为事件流，Flink 负责实时聚合计算。",
            "实时链路会统计用户行为分布、用户类目偏好、商品实时热度和推荐核心指标。",
            "聚合结果回写 Redis / 后台接口，用于推荐服务和运营看板展示。",
        ],
        x=126,
        y=286,
        width=500,
        bullet_fill=COLORS["blue"],
        text_fill=COLORS["ink"],
    )
    draw.rounded_rectangle((126, 516, 646, 720), radius=26, fill=COLORS["paper_blue"], outline=COLORS["line"], width=1)
    draw.text((154, 548), "数据分工可以这样讲", font=FONTS["body_bold"], fill=COLORS["navy"])
    draw_multiline(draw, (154, 604), "MySQL 负责存，Kafka 负责传，Flink 负责算，Redis 负责快读，Python 负责离线分析。", font=FONTS["body"], fill=COLORS["ink"], max_width=450, line_gap=8)

    draw_card(image, (724, 186, 1514, 762), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=32)
    draw.text((764, 224), "为什么它比传统后台更强", font=FONTS["section"], fill=COLORS["orange"])
    metrics = [
        ("实时行为分布", "看到浏览、点击、加购、下单的比例变化。"),
        ("类目偏好画像", "运营能知道当前用户兴趣往哪些类目偏移。"),
        ("商品热度变化", "热点商品变化更快反馈到后台和推荐。"),
        ("推荐分析与 AB Test", "不只看页面是否能跑，还能看策略效果。"),
    ]
    my = 300
    for idx, (title, desc) in enumerate(metrics):
        fill = COLORS["paper_warm"] if idx % 2 else COLORS["paper_blue"]
        accent = COLORS["orange"] if idx % 2 else COLORS["blue"]
        draw.rounded_rectangle((764, my, 1472, my + 92), radius=22, fill=fill, outline=COLORS["line"], width=1)
        draw.text((792, my + 18), title, font=FONTS["body_bold"], fill=accent)
        draw_multiline(draw, (792, my + 48), desc, font=FONTS["body_small"], fill=COLORS["ink"], max_width=620, line_gap=5)
        my += 108

    draw.text((764, 716), "结论：传统电商更多是静态报表，我们这里是“实时 + 离线 + 可回流”的数据闭环。", font=FONTS["caption"], fill=COLORS["muted"])
    add_common_footer(draw, spec)
    return image


def slide_6(spec: SlideSpec) -> Image.Image:
    image = make_canvas(3)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 188, 724, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=34)
    draw.text((126, 224), "用户画像与分群", font=FONTS["section"], fill=COLORS["blue"])
    draw_bullets(
        draw,
        [
            "项目里不仅有 RFM 分群，还有 KMeans 分群页面，强调“画像 + 分群 + 推荐联动”。",
            "KMeans 会结合订单、行为、注册时长等特征，先标准化，再按距离聚类。",
            "冷启动用户不会硬塞进聚类，而是单独放进观察人群，避免画像失真。",
        ],
        x=126,
        y=286,
        width=534,
        bullet_fill=COLORS["blue"],
        text_fill=COLORS["ink"],
    )
    draw.rounded_rectangle((126, 520, 684, 718), radius=26, fill=COLORS["paper_blue"], outline=COLORS["line"], width=1)
    draw.text((156, 552), "分群逻辑一句话", font=FONTS["body_bold"], fill=COLORS["navy"])
    draw_multiline(draw, (156, 608), "先识别冷启动，再对活跃用户做标准化 + KMeans 聚类，最后把分群结果回流给推荐和优惠券策略。", font=FONTS["body"], fill=COLORS["ink"], max_width=490, line_gap=8)

    draw_card(image, (766, 188, 1514, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=34)
    draw.text((804, 224), "能讲出来的人群类型", font=FONTS["section"], fill=COLORS["orange"])
    segments = [
        ("高价值活跃用户", "成交频率和金额都高，是优先维护与复购人群。"),
        ("高意向待转化用户", "浏览、收藏、加购多，但成交偏低，适合重点促转化。"),
        ("沉睡低活跃用户", "近期行为和订单都弱，需要召回策略。"),
        ("稳定消费用户", "是平台中位用户，适合常规推荐和日常营销。"),
        ("冷启动观察用户", "行为少、订单少，先用热度兜底和类目平衡承接。"),
    ]
    sy = 286
    for idx, (title, desc) in enumerate(segments):
        fill = COLORS["paper_warm"] if idx % 2 else COLORS["paper_blue"]
        accent = COLORS["orange"] if idx % 2 else COLORS["blue"]
        draw.rounded_rectangle((804, sy, 1474, sy + 82), radius=22, fill=fill, outline=COLORS["line"], width=1)
        draw.text((828, sy + 16), title, font=FONTS["body_bold"], fill=accent)
        draw_multiline(draw, (828, sy + 44), desc, font=FONTS["body_small"], fill=COLORS["ink"], max_width=610, line_gap=5)
        sy += 92

    draw.text((804, 742), "分群的价值不只是看图，而是能直接联动推荐、优惠券和召回动作。", font=FONTS["caption"], fill=COLORS["muted"])
    add_common_footer(draw, spec)
    return image


def slide_7(spec: SlideSpec) -> Image.Image:
    image = make_canvas(1)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 188, 734, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=34)
    draw.text((126, 224), "AI 导购与评论总结", font=FONTS["section"], fill=COLORS["blue"])
    draw_bullets(
        draw,
        [
            "AI 导购不是单纯聊天，而是结合用户画像、意图识别和推荐候选来承接购物决策。",
            "系统里有“画像偏好承接”“意图驱动导购”等导购策略标签，能根据用户输入给出不同推荐方式。",
            "还支持商品评价智能摘要和商品问答，帮助用户更快理解商品口碑和风险点。",
        ],
        x=126,
        y=286,
        width=548,
        bullet_fill=COLORS["blue"],
        text_fill=COLORS["ink"],
    )
    draw.rounded_rectangle((126, 540, 694, 718), radius=26, fill=COLORS["paper_blue"], outline=COLORS["line"], width=1)
    draw.text((156, 572), "这部分和传统电商的区别", font=FONTS["body_bold"], fill=COLORS["navy"])
    draw_multiline(draw, (156, 624), "传统电商更多是搜索和筛选，我们这里把推荐、问答、评论总结和导购建议融合到一个入口里。", font=FONTS["body"], fill=COLORS["ink"], max_width=500, line_gap=8)

    draw_card(image, (774, 188, 1514, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=34)
    draw.text((812, 224), "智能省钱怎么讲", font=FONTS["section"], fill=COLORS["orange"])
    smart_items = [
        ("最省方案", "结算页会自动计算当前最佳优惠券，直接显示可省多少钱。"),
        ("备选方案", "除了最优券，还会给出其他可用方案，方便用户对比。"),
        ("凑单建议", "如果差一点门槛，系统会提示还差多少钱，是否值得凑单。"),
        ("AI 话术承接", "后端会生成 2-3 句结算建议，让“省钱逻辑”更容易理解。"),
    ]
    sy = 292
    for idx, (title, desc) in enumerate(smart_items):
        fill = COLORS["paper_warm"] if idx % 2 == 0 else COLORS["paper_blue"]
        accent = COLORS["orange"] if idx % 2 == 0 else COLORS["blue"]
        draw.rounded_rectangle((812, sy, 1478, sy + 92), radius=22, fill=fill, outline=COLORS["line"], width=1)
        draw.text((836, sy + 18), title, font=FONTS["body_bold"], fill=accent)
        draw_multiline(draw, (836, sy + 48), desc, font=FONTS["body_small"], fill=COLORS["ink"], max_width=604, line_gap=5)
        sy += 106

    draw.text((812, 726), "这个功能很适合展示“AI 不只是聊天，还能直接服务下单转化”。", font=FONTS["caption"], fill=COLORS["muted"])
    add_common_footer(draw, spec)
    return image


def slide_8(spec: SlideSpec) -> Image.Image:
    image = make_canvas(2)
    draw = ImageDraw.Draw(image)
    add_common_header(draw, spec)

    draw_card(image, (86, 188, 1514, 758), fill=(255, 255, 255, 248), outline=(222, 230, 241), radius=34)
    draw.text((126, 224), "最后一页专门回答三个问题：我们解决了什么、效果体现在哪、为什么比传统电商更进一步。", font=FONTS["body_bold"], fill=COLORS["navy"])

    blocks = [
        ("解决的问题", "传统电商能交易，但推荐不够个性化、数据反馈不够及时、运营难以持续优化。", COLORS["orange"]),
        ("我们的解决方案", "用用户行为做推荐依据，用 Kafka/Flink 做实时聚合，用画像和分群做策略优化，再用 AI 导购和智能省钱把结果承接到前台。", COLORS["blue"]),
        ("效果体现", "前台能看到更贴近兴趣的推荐、结算页能看到省钱方案，后台能看到热度、偏好、分群和推荐分析。", COLORS["green"]),
        ("和传统电商的区别", "传统电商更偏交易系统，我们更像一个“交易 + 推荐 + 分析 + AI 服务”的智能电商系统。", COLORS["navy"]),
    ]
    y = 304
    for title, desc, accent in blocks:
        draw.rounded_rectangle((126, y, 1474, y + 92), radius=24, fill=COLORS["paper"], outline=COLORS["line"], width=1)
        draw.rounded_rectangle((150, y + 20, 336, y + 62), radius=18, fill=accent)
        draw.text((174, y + 30), title, font=FONTS["body_bold"], fill=(255, 255, 255))
        draw_multiline(draw, (370, y + 22), desc, font=FONTS["body"], fill=COLORS["ink"], max_width=1064, line_gap=8)
        y += 108

    draw_multiline(
        draw,
        (126, 732),
        "总结一句话：我们做的不是一个普通商城，而是一套能理解用户、能分析数据、还能给出智能承接的电商系统。",
        font=FONTS["body_bold"],
        fill=COLORS["blue"],
        max_width=1320,
        line_gap=6,
    )
    add_common_footer(draw, spec)
    return image


def save_slide(image: Image.Image, path: Path) -> None:
    image.convert("RGB").save(path, format="PNG", optimize=True)


def build_script(slides: list[SlideSpec]) -> None:
    lines = ["# 大数据电商系统 4 分钟答辩讲稿（亮点加强版）", ""]
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
    head, tail = images[0], images[1:]
    head.save(str(PDF_PATH), save_all=True, append_images=tail)


def main() -> None:
    specs = [
        SlideSpec(
            1,
            "封面",
            "项目名称 + 核心价值 + 汇报主线",
            "各位评委老师好，我们的项目是大数据电商系统。这个项目不是只做商城页面，而是把交易闭环、个性化推荐、数据分析和 AI 承接真正打通。下面我会用四分钟，重点介绍它解决了什么问题、和传统电商有什么区别，以及亮点体现在哪里。",
        ),
        SlideSpec(
            2,
            "项目目标",
            "先讲痛点，再讲我们为什么要这样做",
            "传统电商通常能完成交易，但推荐比较同质化，后台也很难及时感知用户兴趣和热点变化。所以我们做这个项目时，目标很明确，就是让系统既能完成基础交易，也能理解用户、反馈变化，并支持持续优化。",
        ),
        SlideSpec(
            3,
            "核心亮点",
            "把项目优势一次讲清楚",
            "这一页我会把亮点集中概括出来。我们的项目不是普通商城，而是把推荐算法、用户行为、大数据分析、用户分群、AI 导购和智能省钱这些能力放到同一条业务主线里，形成一个完整的智能电商系统。",
        ),
        SlideSpec(
            4,
            "推荐算法",
            "讲算法时只说到“业务能听懂”的层级",
            "在推荐部分，我们不是简单按销量排序，而是用用户行为做依据。系统一方面用协同过滤找相似用户喜欢的商品，另一方面用内容推荐匹配标签和品类，最后再做混合推荐，让结果更贴近用户兴趣，也更稳定。",
        ),
        SlideSpec(
            5,
            "大数据分析",
            "说明数据链路为什么是亮点",
            "在数据分析部分，我们把行为数据接入实时链路，通过 Kafka 和 Flink 做聚合，再结合 Redis 和离线分析，把热度、偏好和推荐效果回流到后台看板和推荐服务里。这样系统不是一次性输出，而是可以持续更新和优化。",
        ),
        SlideSpec(
            6,
            "用户分群",
            "说明画像和分群怎么服务运营",
            "除了推荐，我们还做了用户画像和用户分群。系统会把用户划分为高价值、待转化、沉睡、稳定和冷启动等不同人群，然后把这些结果回流给推荐和优惠券策略，让运营动作更有针对性。",
        ),
        SlideSpec(
            7,
            "AI 承接",
            "AI 导购、评论总结和智能省钱一起讲",
            "在 AI 能力上，我们不只是放了一个聊天入口，而是让 AI 真正参与购物决策。它可以结合用户画像做导购，帮用户总结评论、回答商品问题，还能在结算页自动给出最省方案、备选方案和凑单建议。",
        ),
        SlideSpec(
            8,
            "总结",
            "最后一页收束差异化、解决方案和效果",
            "最后总结一下。传统电商更偏交易系统，而我们的项目进一步把推荐、分析、分群和 AI 服务整合进来了。效果上，前台能看到更贴近兴趣的推荐和更省钱的结算方案，后台能看到更实时、更可运营的数据结果。所以它更像一个智能电商系统，而不只是一个普通商城。谢谢各位老师。",
        ),
    ]

    renderers = [
        lambda: slide_1(specs[0]),
        lambda: slide_2(specs[1]),
        lambda: slide_3(specs[2]),
        lambda: slide_4(specs[3]),
        lambda: slide_5(specs[4]),
        lambda: slide_6(specs[5]),
        lambda: slide_7(specs[6]),
        lambda: slide_8(specs[7]),
    ]

    slide_paths: list[Path] = []
    for idx, render in enumerate(renderers, start=1):
        out = SLIDE_DIR / f"slide-{idx:02d}.png"
        save_slide(render(), out)
        slide_paths.append(out)

    build_script(specs)
    build_ppt(slide_paths)
    build_pdf(slide_paths)

    META_PATH.write_text(
        json.dumps(
            {
                "style": "editorial-light",
                "pptx": str(PPTX_PATH),
                "pdf": str(PDF_PATH),
                "script": str(SCRIPT_PATH),
                "slide_dir": str(SLIDE_DIR),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
