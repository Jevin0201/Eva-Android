"""Real LibreOffice round trips. Requires existing python-pptx/openpyxl/Pillow and Poppler."""
import hashlib
import json
import os
import pathlib
import runpy
import shutil
import subprocess
import tempfile
import zipfile
from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Font, PatternFill
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches
from PIL import Image

base = pathlib.Path('artifacts/office-complex').resolve()
base.mkdir(exist_ok=True, parents=True)
root = pathlib.Path(tempfile.mkdtemp(prefix='run-', dir=base))
module = runpy.run_path('probe/assets/office/eva-render.py', run_name='office_complex')
namespace = module['render'].__globals__
namespace['ROOT'] = root
namespace['check_cancel'] = lambda: None
soffice = shutil.which('libreoffice') or shutil.which('soffice')
assert soffice, 'An actual LibreOffice installation is required'

def engine(args, timeout=120):
    args = [soffice if args[0] == 'libreoffice' else args[0], *args[1:]]
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                            env={**os.environ, 'TMPDIR': str(root), 'SAL_USE_VCLPLUGIN': 'svp'})
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout or result.stderr

namespace['run'] = engine
# A genuine DOCX package containing table merges, repeated header, page field and explicit pagination.
word = root / 'complex.docx'
paragraph = lambda text: '<w:p><w:r><w:t>' + text + '</w:t></w:r></w:p>'
with zipfile.ZipFile(word, 'w') as archive:
    archive.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>')
    archive.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    archive.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>')
    archive.writestr('word/header1.xml', '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+paragraph('Repeated header – page field')+'<w:p><w:fldSimple w:instr="PAGE"/></w:p></w:hdr>')
    archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+paragraph('Complex Office 中文验收')+'<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="8"/><w:bottom w:val="single" w:sz="8"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>'+paragraph('Merged table heading')+'</w:tc></w:tr><w:tr><w:tc>'+paragraph('Revenue')+'</w:tc><w:tc>'+paragraph('1234.50')+'</w:tc></w:tr></w:tbl><w:p><w:r><w:br w:type="page"/></w:r></w:p>'+paragraph('Second page – pagination retained')+'<w:sectPr><w:headerReference w:type="default" r:id="header"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720"/></w:sectPr></w:body></w:document>')

book = Workbook()
sheet = book.active
sheet.title = 'Sales'
for row in [['Region','Revenue','Rate'],['East',120,0.1],['West',80,0.2],['East',50,0.3]]:
    sheet.append(row)
formulas = {'B6': '=SUM(B2:B4)', 'B7': '=SUMIF(A2:A4,"East",B2:B4)',
            'B8': '=IFERROR(1/0,99)', 'B9': '=VLOOKUP("West",A2:B4,2,FALSE)'}
for cell, formula in formulas.items():
    sheet[cell] = formula
    sheet[cell].number_format = '$#,##0.00'
sheet.merge_cells('E1:G1')
sheet['E1'] = 'Merged heading 中文'
sheet['E1'].font = Font(bold=True, color='FFFFFF')
sheet['E1'].fill = PatternFill('solid', fgColor='2454A6')
for cell in sheet['C'][1:4]: cell.number_format = '0.0%'
chart = BarChart()
chart.add_data(Reference(sheet, min_col=2, min_row=1, max_row=4), titles_from_data=True)
chart.set_categories(Reference(sheet, min_col=1, min_row=2, max_row=4))
sheet.add_chart(chart, 'E3')
book.create_sheet('Second sheet')['A1'] = '=Sales!B6*2'
sheet.print_options.horizontalCentered = True
sheet.sheet_properties.pageSetUpPr.fitToPage = True
sheet.page_setup.fitToWidth = 1
spreadsheet = root / 'complex.xlsx'
book.save(spreadsheet)

presentation = Presentation()
for index in range(2):
    slide = presentation.slides.add_slide(presentation.slide_layouts[5])
    slide.shapes.title.text = 'Complex chart / table 中文' if not index else 'Second slide'
    data = CategoryChartData()
    data.categories = ['East', 'West']
    data.add_series('Revenue', (120,80))
    slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(1.5), Inches(6), Inches(3), data)
    slide.notes_slide.notes_text_frame.text = 'Presenter notes retained'
slides = root / 'complex.pptx'
presentation.save(slides)

sources = [word, spreadsheet, slides]
hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
reports = {}
for source in sources:
    reports[source.name] = module['render'](source, root/(source.stem+source.suffix+'-render'),
                                            2 if source.suffix in ('.docx','.pptx') else None)
    assert reports[source.name]['pageCount'] >= 1
    for page in reports[source.name]['pages']:
        with Image.open(page) as image:
            assert image.width > 500 and image.height > 500

calculated = module['convert'](spreadsheet, root/'recalculated', 'xlsx')
values = load_workbook(calculated['output'], data_only=True)
assert [values['Sales'][c].value for c in formulas] == [250,170,99,80]
assert values['Second sheet']['A1'].value == 500
roundtrip = load_workbook(calculated['output'], data_only=False)
assert all(roundtrip['Sales'][c].value.startswith('=') for c in formulas)
assert roundtrip['Sales']._charts and 'E1:G1' in roundtrip['Sales'].merged_cells
reports['recalculation'] = calculated
for source, intermediate in [(word,'odt'),(slides,'odp')]:
    first = module['convert'](source, root/(intermediate+'-copy'), intermediate)
    second = module['convert'](pathlib.Path(first['output']), root/(intermediate+'-roundtrip'), source.suffix[1:])
    reports[source.suffix+'-roundtrip'] = second
    with zipfile.ZipFile(second['output']) as archive:
        assert any(name.endswith('document.xml') or name.startswith('ppt/slides/slide') for name in archive.namelist())

assert hashes == {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
try:
    module['convert'](spreadsheet, root/'recalculated', 'xlsx')
    raise AssertionError('Must reject an existing destination')
except FileExistsError:
    pass
for entry in ['xl/externalLinks/externalLink1.xml', 'xl/vbaProject.bin']:
    unsafe = root / ('external.xlsx' if 'external' in entry else 'macro.xlsx')
    shutil.copyfile(spreadsheet, unsafe)
    with zipfile.ZipFile(unsafe, 'a') as archive:
        archive.writestr(entry, b'fixture')
    try:
        module['convert'](unsafe, root/(unsafe.stem+'-rejected'), 'xlsx')
        raise AssertionError('Active content must be rejected')
    except ValueError as error:
        assert '宏' in str(error) or '外部' in str(error)
    unsafe.unlink()
    (root/(unsafe.stem+'-rejected')).rmdir()
reports['sourceHashes'] = hashes
reports['engine'] = engine([soffice,'--version']).strip()
reports['deviceValidation'] = 'pending'
reports['visualReview'] = {'layout':'first DOCX/XLSX/PPTX pages viewed; tables, charts and pagination visible', 'cjk':'host engine omitted CJK glyphs; phone Noto CJK validation required'}
for profile in root.glob('*/office-profile'):
    if profile.is_dir() and not profile.is_symlink() and profile.resolve().is_relative_to(root):
        shutil.rmtree(profile)
(root/'acceptance.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'report':str(root/'acceptance.json'),'pages':{k:v['pageCount'] for k,v in reports.items() if isinstance(v,dict) and 'pageCount' in v}},ensure_ascii=False))
