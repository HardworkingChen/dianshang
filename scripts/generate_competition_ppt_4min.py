from datetime import date
from pathlib import Path
from shutil import copyfile

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PPTX_PATH = OUT_DIR / "省赛答辩-4分钟重点版.pptx"
PTF_PATH = OUT_DIR / "省赛答辩-4分钟重点版.ptf"


def rgb(hex_code: str) -> RGBColor:
    s = hex_code.replace("#", "").strip()
    return RGBColor(int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


PALETTE = {
    "bg": rgb("#F7FAFF"),
    "white": rgb("#FFFFFF"),
    "title": rgb("#0F172A"),
    "text": rgb("#334155"),
    "muted": rgb("#64748B"),
    "line": rgb("#DCE6F8"),
    "brand": rgb("#2563EB"),
    "brand_dark": rgb("#1E40AF"),
    "accent": rgb("#0EA5E9"),
    "good": rgb("#16A34A"),
    "warn": rgb("#EA580C"),
}


def set_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def set_text(paragraph, text, size=18, bold=False, color=None, align=None, font="Microsoft YaHei"):
    paragraph.text = text
    if not paragraph.runs:
        paragraph.add_run()
    run = paragraph.runs[0]
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color or PALETTE["text"]
    if align is not None:
        paragraph.alignment = align


def add_title(slide, title, subtitle=""):
    bar = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.9))
    bar.fill.solid()
    bar.fill.fore_color.rgb = rgb("#EAF1FF")
    bar.line.fill.background()

    tbox = slide.shapes.add_textbox(Inches(0.7), Inches(0.2), Inches(12.0), Inches(0.45))
    set_text(tbox.text_frame.paragraphs[0], title, size=28, bold=True, color=PALETTE["title"])

    if subtitle:
        sbox = slide.shapes.add_textbox(Inches(0.72), Inches(0.85), Inches(12.0), Inches(0.35))
        set_text(sbox.text_frame.paragraphs[0], subtitle, size=13, color=PALETTE["muted"])


def add_card(slide, x, y, w, h, title, bullets, title_color="brand"):
    box = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = PALETTE["white"]
    box.line.color.rgb = PALETTE["line"]
    tf = box.text_frame
    tf.clear()
    set_text(tf.paragraphs[0], title, size=17, bold=True, color=PALETTE[title_color])
    for b in bullets:
        p = tf.add_paragraph()
        set_text(p, f"• {b}", size=14, color=PALETTE["text"])


def add_footer(slide, idx, total):
    line = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, Inches(0.5), Inches(7.15), Inches(12.3), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = PALETTE["line"]
    line.line.fill.background()
    pbox = slide.shapes.add_textbox(Inches(11.6), Inches(7.17), Inches(1.1), Inches(0.2))
    set_text(pbox.text_frame.paragraphs[0], f"{idx}/{total}", size=10, color=PALETTE["muted"], align=PP_ALIGN.RIGHT)


def add_notes(slide, text):
    # 用户要求分发版不包含备注，保留空实现以复用调用位置。
    return


def add_compare_table(slide):
    table_shape = slide.shapes.add_table(5, 3, Inches(0.8), Inches(1.6), Inches(11.8), Inches(4.8))
    table = table_shape.table
    headers = ["维度", "传统电商", "我们的项目方案"]
    rows = [
        ["推荐方式", "按销量/时间排序，个性化弱", "行为驱动个性化推荐（CF+CB+Hybrid）"],
        ["数据能力", "静态报表，反馈慢", "实时行为聚合 + 离线分析双链路"],
        ["运营能力", "缺少精细化看板", "后台支持画像、分群、推荐分析"],
        ["系统形态", "交易功能为主", "交易闭环 + 推荐闭环 + 数据闭环"],
    ]
    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = rgb("#E8F0FF")
        set_text(cell.text_frame.paragraphs[0], h, size=13, bold=True, color=PALETTE["title"], align=PP_ALIGN.CENTER)
    for r in range(1, 5):
        for c in range(3):
            cell = table.cell(r, c)
            cell.text = rows[r - 1][c]
            set_text(cell.text_frame.paragraphs[0], rows[r - 1][c], size=12, color=PALETTE["text"], align=PP_ALIGN.CENTER)


def build():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # Slide 1
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    top = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(1.2), Inches(11.5), Inches(4.7))
    top.fill.solid()
    top.fill.fore_color.rgb = PALETTE["white"]
    top.line.color.rgb = PALETTE["line"]
    tf = s.shapes.add_textbox(Inches(1.3), Inches(2.0), Inches(10.6), Inches(2.3)).text_frame
    set_text(tf.paragraphs[0], "大数据电商系统", size=52, bold=True, color=PALETTE["title"])
    p = tf.add_paragraph()
    set_text(p, "省赛答辩 4 分钟重点汇报版", size=24, color=PALETTE["brand"])
    p = tf.add_paragraph()
    set_text(p, f"日期：{date.today().strftime('%Y-%m-%d')}  |  汇报人：________", size=14, color=PALETTE["muted"])
    add_notes(
        s,
        "各位评委老师好，我们的项目是大数据电商系统。"
        "这次我用4分钟，从项目核心、与传统电商的区别、关键技术与解决方案三个方面进行汇报。"
        "我们的目标不是只做商城页面，而是做交易闭环、推荐闭环和数据闭环一体化系统。"
    )

    # Slide 2
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "1. 项目核心：我们解决了什么问题", "核心关键词：个性化推荐 + 数据驱动运营 + 完整交易闭环")
    add_card(
        s,
        Inches(0.8),
        Inches(1.6),
        Inches(5.7),
        Inches(4.8),
        "传统痛点",
        [
            "推荐结果同质化，用户看到内容趋同",
            "只有交易功能，缺少行为数据反馈闭环",
            "运营侧只能看静态数据，调优滞后",
            "前后端与数据链路割裂，迭代成本高",
        ],
        "warn",
    )
    add_card(
        s,
        Inches(6.8),
        Inches(1.6),
        Inches(5.7),
        Inches(4.8),
        "我们的目标",
        [
            "构建“用户行为 -> 推荐决策 -> 数据回流”闭环",
            "让推荐结果更个性化、更可解释",
            "支持实时看板与离线分析协同",
            "形成可扩展、可演示、可迭代的工程方案",
        ],
        "good",
    )
    add_notes(
        s,
        "这一页先讲问题定义。传统电商通常能完成交易，但推荐和数据运营能力弱。"
        "我们的核心目标是把用户行为、推荐决策和数据回流打通，让系统从可用升级到可优化。"
    )

    # Slide 3
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "2. 与传统电商的区别", "评委最关心：你和普通商城有什么本质不同")
    add_compare_table(s)
    add_notes(
        s,
        "这页是差异化核心。我们不是只做商品列表和订单流程，而是做个性化推荐与数据闭环。"
        "可概括为四点：推荐机制不同、数据链路不同、运营能力不同、系统定位不同。"
    )

    # Slide 4
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "3. 系统架构总览", "用户端 + 后台端 + 业务后端 + 实时/离线分析")
    add_card(
        s,
        Inches(0.8),
        Inches(1.5),
        Inches(12.0),
        Inches(1.3),
        "交互层",
        ["微信小程序用户端（首页/探索/购物车/订单） + Vue3 管理后台（推荐分析、用户画像、运营看板）"],
    )
    add_card(
        s,
        Inches(0.8),
        Inches(3.0),
        Inches(12.0),
        Inches(1.3),
        "业务服务层",
        ["Spring Boot：用户、商品、订单、退款、推荐、消息、权限、风控等业务接口"],
    )
    add_card(
        s,
        Inches(0.8),
        Inches(4.5),
        Inches(12.0),
        Inches(1.9),
        "数据与计算层",
        [
            "MySQL + Redis + RabbitMQ + Kafka + Flink + Python离线分析",
            "支撑实时聚合、推荐特征更新、用户画像构建与效果评估",
        ],
    )
    add_notes(
        s,
        "这页讲架构，不要念技术名词清单。要强调分层职责："
        "前端负责展示交互，后端负责业务逻辑，数据计算层负责实时与离线分析，最终共同服务推荐与运营决策。"
    )

    # Slide 5
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "4. 大数据与中间件技术：用了什么，为什么用", "重点讲“技术-问题-价值”三连")
    add_card(
        s,
        Inches(0.8),
        Inches(1.5),
        Inches(5.8),
        Inches(4.9),
        "技术选型",
        [
            "MySQL：核心业务数据存储",
            "Redis：热点缓存与实时结果承接",
            "RabbitMQ：业务异步解耦",
            "Kafka：高吞吐事件流传输",
            "Flink：实时行为聚合计算",
            "Python：离线分析与分群",
        ],
        "brand_dark",
    )
    add_card(
        s,
        Inches(6.75),
        Inches(1.5),
        Inches(5.75),
        Inches(4.9),
        "为什么这样选",
        [
            "先稳住交易主链路，再增强数据能力",
            "在线业务与实时计算职责分离",
            "实时链路提供“新鲜信号”给推荐服务",
            "离线分析提供画像与策略优化依据",
            "整体架构更符合真实系统的渐进式建设",
        ],
        "good",
    )
    add_notes(
        s,
        "这里一定要答出为什么。我们的思路不是为了堆技术，而是按问题分层："
        "MySQL稳业务，Redis保性能，MQ做异步，Kafka+Flink做实时流，Python做离线分析。"
        "这样系统可维护、可扩展，也符合工程实践。"
    )

    # Slide 6
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "5. 推荐与数据闭环：核心解决方法", "从“统一热榜”升级到“行为驱动个性化”")
    add_card(
        s,
        Inches(0.8),
        Inches(1.5),
        Inches(12.0),
        Inches(2.3),
        "方法一：推荐链路",
        [
            "多源召回：用户历史行为 + 类目偏好 + 热门兜底",
            "融合排序：CF + CB + 热度信号 + 护栏重排（去重与多样性）",
            "冷启动策略：热门兜底 + 类目平衡 + 行为快速回流",
        ],
        "brand",
    )
    add_card(
        s,
        Inches(0.8),
        Inches(4.0),
        Inches(12.0),
        Inches(2.4),
        "方法二：数据闭环",
        [
            "行为采集（浏览/点击/加购/下单） -> Kafka/Flink实时聚合 -> Redis/MySQL沉淀",
            "后台可视化展示 + 离线分析评估 -> 反向优化推荐策略",
            "让推荐从“一次输出”变成“持续迭代系统”",
        ],
        "accent",
    )
    add_notes(
        s,
        "这一页讲解决方法。第一条是推荐方法，强调多源召回、融合排序和冷启动。"
        "第二条是数据闭环，强调行为回流和策略迭代。"
        "要让评委感受到，我们解决的是系统问题，不是单点算法问题。"
    )

    # Slide 7
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "6. 项目价值与可验证结果", "答辩重点：不仅能跑，而且可解释、可评估")
    add_card(
        s,
        Inches(0.8),
        Inches(1.5),
        Inches(5.7),
        Inches(4.9),
        "落地价值",
        [
            "提升用户侧内容匹配度与浏览效率",
            "增强后台运营决策的实时性",
            "支持推荐结果可解释与可追踪",
            "形成可持续演进的系统原型",
        ],
        "good",
    )
    add_card(
        s,
        Inches(6.8),
        Inches(1.5),
        Inches(5.7),
        Inches(4.9),
        "可验证性",
        [
            "交易主流程已跑通：浏览-加购-下单-退款",
            "推荐与分析模块联动可演示",
            "后台可查看行为统计与推荐分析",
            "后续可量化指标：CTR/加购率/转化率",
        ],
        "brand",
    )
    add_notes(
        s,
        "这页回答‘你怎么证明有效’。先说已有结果：流程可跑通、推荐可展示、后台可分析。"
        "再说可量化指标方向：CTR、加购率、转化率。这样回答会更稳。"
    )

    # Slide 8
    s = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(s, PALETTE["bg"])
    add_title(s, "7. 总结与下一步", "一句话总结：交易闭环 + 推荐闭环 + 数据闭环")
    add_card(
        s,
        Inches(0.8),
        Inches(1.7),
        Inches(12.0),
        Inches(3.2),
        "总结",
        [
            "我们项目的核心不是“做一个商城页面”，而是把推荐系统和大数据分析真正融入电商业务",
            "相较传统电商，我们的差异在于个性化推荐、实时分析和可迭代闭环能力",
            "技术路线清晰、工程边界明确，具备继续扩展为更完整平台的基础",
        ],
        "brand_dark",
    )
    thanks = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(5.3), Inches(12.0), Inches(1.1))
    thanks.fill.solid()
    thanks.fill.fore_color.rgb = rgb("#EAF1FF")
    thanks.line.fill.background()
    tf = thanks.text_frame
    tf.clear()
    set_text(tf.paragraphs[0], "谢谢各位评委老师，欢迎提问。", size=28, bold=True, color=PALETTE["brand"], align=PP_ALIGN.CENTER)
    add_notes(
        s,
        "最后总结三句话：第一，我们解决的是传统电商缺少推荐与数据闭环的问题；"
        "第二，我们做到了业务、推荐、分析一体化；第三，系统具备持续优化和工程化扩展能力。"
        "最后请评委提问。"
    )

    total = len(prs.slides)
    for i, slide in enumerate(prs.slides, start=1):
        add_footer(slide, i, total)

    prs.save(PPTX_PATH)
    copyfile(PPTX_PATH, PTF_PATH)
    print(f"slides={total}")
    print(PPTX_PATH)
    print(PTF_PATH)


if __name__ == "__main__":
    build()
