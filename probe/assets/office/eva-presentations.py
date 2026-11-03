"""Editable presentation layouts for Eva's local skill. Uses installed python-pptx."""
import argparse, json, pathlib, sys
sys.path.insert(0, '/root/.eva-office/lib')
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.oxml.xmlchemy import OxmlElement

THEMES = {
    'editorial': {'paper': 'F7F5EF', 'ink': '183D3B', 'muted': '59736E', 'accent': '087D70', 'card': 'FFFFFF'},
    'midnight': {'paper': '142237', 'ink': 'F3F6FA', 'muted': 'ADBCCF', 'accent': '6DDAB8', 'card': '21334C'},
    'clean': {'paper': 'FFFFFF', 'ink': '222B38', 'muted': '657384', 'accent': '2D66C7', 'card': 'F0F4FA'},
}

def path(value, exists=False):
    p = pathlib.Path(value).resolve()
    if not p.is_relative_to(pathlib.Path('/root/eva-workspace').resolve()) or (exists and not p.is_file()):
        raise ValueError('输入输出必须位于工作区')
    return p

def create(data, output):
    target = path(output)
    if target.exists():
        raise ValueError('输出已存在，请另存新文件')
    theme = THEMES[data.get('theme', 'editorial')]
    presentation = Presentation(); presentation.slide_width = Inches(13.333333); presentation.slide_height = Inches(7.5)
    font = data.get('font', 'Noto Sans CJK SC')

    def box(slide, x, y, w, h, color=None):
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid(); shape.fill.fore_color.rgb = RGBColor.from_string(color or theme['card']); shape.line.fill.background()
        effects = shape._element.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}effectRef')
        if effects is not None: effects.set('idx', '0')
        return shape

    def text(slide, value, x, y, w, h, size=22, bold=False, color=None):
        frame = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)).text_frame
        frame.word_wrap = True; frame.margin_left = frame.margin_right = Inches(.02)
        for index, line in enumerate(str(value).split('\n')):
            paragraph = frame.paragraphs[0] if not index else frame.add_paragraph()
            paragraph.text = line; paragraph.font.name = font; paragraph.font.size = Pt(size)
            paragraph.font.bold = bold; paragraph.font.color.rgb = RGBColor.from_string(color or theme['ink'])
            paragraph.space_after = Pt(10)
        return frame

    for index, item in enumerate(data['slides'], 1):
        slide = presentation.slides.add_slide(presentation.slide_layouts[6])
        slide.background.fill.solid(); slide.background.fill.fore_color.rgb = RGBColor.from_string(theme['paper'])
        layout = item.get('layout', 'split')
        text(slide, data.get('label', 'Eva'), .65, .25, 10, .3, 10, color=theme['muted'])
        text(slide, str(index).zfill(2), 12, .25, .7, .3, 10, color=theme['muted'])
        title_y = 1.45 if layout in ('cover', 'section') else .85
        text(slide, item['title'], .7, title_y, 11.9, 1.7 if layout in ('cover', 'section') else 1.0,
             42 if layout in ('cover', 'section') else 30, True)
        if layout in ('cover', 'section'):
            box(slide, .72, 3.5, .8, .055, theme['accent'])
            text(slide, item.get('subtitle', ''), .7, 4.0, 10.7, 1.6, 23, color=theme['muted'])
        elif layout in ('split', 'cards', 'process'):
            items = item.get('items', [])
            if not 1 <= len(items) <= 4:
                raise ValueError('split/cards/process 需要 1–4 个内容块；请拆页或改用表格')
            width = 11.8 / len(items); gap = .2
            for number, entry in enumerate(items):
                x = .7 + number * width; box(slide, x, 2.3, width-gap, 3.5)
                text(slide, str(number+1).zfill(2), x+.18, 2.5, .8, .45, 18, True, theme['accent'])
                text(slide, entry['title'], x+.18, 3.05, width-.55, .75, 23, True)
                text(slide, entry.get('body', ''), x+.18, 3.9, width-.55, 1.6, 19)
                if layout == 'process' and number < len(items)-1:
                    connector = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,
                        Inches(x+width-.22), Inches(3.5), Inches(x+width-.02), Inches(3.5))
                    connector.line.color.rgb = RGBColor.from_string(theme['accent'])
        elif layout == 'table':
            rows = item['rows']; columns = len(rows[0])
            table = slide.shapes.add_table(len(rows), columns, Inches(.7), Inches(2.25), Inches(11.8), Inches(3.7)).table
            for r, values in enumerate(rows):
                if len(values) != columns:
                    raise ValueError('表格列数不一致')
                for c, value in enumerate(values):
                    cell = table.cell(r, c); cell.text = str(value)
                    cell.fill.solid(); cell.fill.fore_color.rgb = RGBColor.from_string(theme['accent'] if r == 0 else theme['card'])
                    cell.margin_left = cell.margin_right = Inches(.15)
                    cell.margin_top = Inches(.12)
                    for paragraph in cell.text_frame.paragraphs:
                        paragraph.font.name = font; paragraph.font.size = Pt(17)
                        paragraph.font.bold = r == 0
                        paragraph.font.color.rgb = RGBColor.from_string(theme['paper'] if r == 0 else theme['ink'])
        elif layout == 'chart':
            chart_data = CategoryChartData(); chart_data.categories = item['categories']
            for series in item['series']:
                chart_data.add_series(series['name'], series['values'])
            chart = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(.8), Inches(2.1), Inches(11.5), Inches(3.9), chart_data).chart
            chart.has_legend = len(item['series']) > 1
            chart.has_title = False
            for axis in [chart.category_axis, chart.value_axis]:
                axis.tick_labels.font.name = font; axis.tick_labels.font.size = Pt(16)
            for series_index, series in enumerate(chart.series):
                palette = [theme['accent'], 'DF845A', '5B7DB1', '9C74A4']
                series.format.fill.solid(); series.format.fill.fore_color.rgb = RGBColor.from_string(palette[series_index % len(palette)])
                series.format.line.fill.background()
        elif layout == 'image':
            image = path(item['image'], True)
            from PIL import Image
            with Image.open(image) as bitmap:
                ratio = bitmap.width / bitmap.height
            width = min(6.8, 3.6 * ratio); height = width / ratio
            slide.shapes.add_picture(str(image), Inches(.75), Inches(2.1+(3.6-height)/2), width=Inches(width), height=Inches(height))
            text(slide, item.get('caption', ''), 8.1, 2.4, 4.2, 3.0, 21)
        else:
            raise ValueError('未知版式：' + layout)
        if item.get('takeaway'):
            text(slide, item['takeaway'], .75, 6.3, 11.7, .65, 17, color=theme['accent'])
        if item.get('notes'):
            slide.notes_slide.notes_text_frame.text = str(item['notes'])
        if data.get('transition', 'fade') == 'fade':
            transition = OxmlElement('p:transition'); transition.append(OxmlElement('p:fade'))
            slide._element.insert_element_before(transition, 'p:timing', 'p:extLst')
    target.parent.mkdir(parents=True, exist_ok=True)
    presentation.save(target)
    return {'path': str(target), 'slides': len(presentation.slides), 'editable': True,
            'visualValidation': '请使用 eva-render.py 渲染全部页面并检查溢出、空白和内容质量。',
            'animation': '原生页面淡入；不自动将 HTML/SVG 动画转换为 PPT 对象动画。'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--input', required=True); parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(create(json.loads(path(args.input, True).read_text(encoding='utf-8-sig')), args.output), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False)); raise SystemExit(1)
