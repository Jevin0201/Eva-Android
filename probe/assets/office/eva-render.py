"""Local document rendering and visual checks for Eva Android. No account required."""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile, zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path('/root/eva-workspace')

def workspace(value, exists=False):
    path = pathlib.Path(value).resolve()
    if not path.is_relative_to(ROOT.resolve()) or (exists and not path.is_file()):
        raise ValueError('文件必须位于 Eva 工作区且实际存在')
    return path

def check_cancel():
    marker = pathlib.Path('/root/.eva-office/cancel')
    if marker.exists():
        marker.unlink(missing_ok=True)
        raise RuntimeError('已取消后续渲染步骤；已生成文件保留')

def run(args, timeout=120):
    env = {**os.environ, 'HOME': '/root', 'TMPDIR': '/tmp', 'SAL_USE_VCLPLUGIN': 'svp'}
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)
    if result.returncode:
        raise RuntimeError('命令失败：' + args[0] + '\n' + (result.stdout + result.stderr)[-3000:])
    return result.stdout or result.stderr

def status():
    result = {}
    for name, args in {'office': ['libreoffice', '--headless', '--version'],
                       'pdf': ['pdfinfo', '-v'], 'pages': ['pdftoppm', '-v'],
                       'html': ['chromium-browser', '--version']}.items():
        try:
            result[name] = {'ready': True, 'version': run(args, 15).strip()[:200]}
        except Exception as error:
            result[name] = {'ready': False, 'error': str(error)[:800]}
    return result

def structure(source):
    if source.suffix.lower() != '.pptx':
        return None
    ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
          'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    rows = []
    with zipfile.ZipFile(source) as archive:
        size = ET.fromstring(archive.read('ppt/presentation.xml')).find('p:sldSz', ns)
        canvas = (int(size.get('cx')), int(size.get('cy')))
        names = sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)),
                       key=lambda n: int(re.search(r'(\d+)\.xml', n)[1]))
        for index, name in enumerate(names, 1):
            tree = ET.fromstring(archive.read(name))
            outside = []
            objects = tree.findall('.//p:sp', ns) + tree.findall('.//p:pic', ns) + tree.findall('.//p:graphicFrame', ns)
            for shape_index, shape in enumerate(objects):
                transform = shape.find('.//a:xfrm', ns)
                if transform is None: transform = shape.find('p:xfrm', ns)
                if transform is None: continue
                offset, extent = transform.find('a:off', ns), transform.find('a:ext', ns)
                if offset is None or extent is None: continue
                x, y, w, h = [int(v) for v in [offset.get('x'), offset.get('y'), extent.get('cx'), extent.get('cy')]]
                if x < -1000 or y < -1000 or x+w > canvas[0]+1000 or y+h > canvas[1]+1000: outside.append(shape_index)
            rows.append({'page': index, 'textRuns': len(tree.findall('.//a:t', ns)),
                         'pictures': len(tree.findall('.//p:pic', ns)), 'objectsOutsideSlide': outside,
                         'objectAnimations': len(tree.findall('.//p:timing', ns)),
                         'transitions': len(tree.findall('.//p:transition', ns))})
    return rows

OFFICE_FILTERS = {
    '.docx': {'pdf':'writer_pdf_Export', 'docx':'Office Open XML Text', 'odt':'writer8'},
    '.xlsx': {'pdf':'calc_pdf_Export', 'xlsx':'Calc MS Excel 2007 XML', 'ods':'calc8'},
    '.pptx': {'pdf':'impress_pdf_Export', 'pptx':'Impress MS PowerPoint 2007 XML', 'odp':'impress8'},
    '.odt': {'pdf':'writer_pdf_Export', 'docx':'Office Open XML Text', 'odt':'writer8'},
    '.ods': {'pdf':'calc_pdf_Export', 'xlsx':'Calc MS Excel 2007 XML', 'ods':'calc8'},
    '.odp': {'pdf':'impress_pdf_Export', 'pptx':'Impress MS PowerPoint 2007 XML', 'odp':'impress8'},
}

def office_input(source):
    if source.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Office 输入超过 64 MiB')
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(row.file_size for row in entries) > 128 * 1024 * 1024:
            raise ValueError('Office 解压内容超过限制')
        for row in entries:
            name = row.filename.lower()
            if name.endswith('vbaproject.bin') or name.startswith('xl/externallinks/'):
                raise ValueError('转换不接受宏或外部工作簿链接，请先制作不含这些内容的副本')

def office_profile(destination):
    profile = destination / 'office-profile'
    profile.mkdir()
    # Isolated profile shared by both PDF and editable conversion paths.
    (profile / 'registrymodifications.xcu').write_text(
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<oor:items xmlns:oor="http://openoffice.org/2001/registry">'
        '<item oor:path="/org.openoffice.Office.Common/Security/Scripting">'
        '<prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>'
        '</oor:items>', encoding='utf-8')
    return profile.as_uri()

def office_convert(source, destination, output_format):
    filters = OFFICE_FILTERS.get(source.suffix.lower(), {})
    if output_format not in filters:
        raise ValueError('此文档类型不支持要求的转换格式')
    office_input(source)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    profile = office_profile(destination)
    run(['libreoffice', '-env:UserInstallation=' + profile, '--headless', '--convert-to',
         output_format + ':' + filters[output_format], '--outdir', str(destination), str(source)])
    result = destination / (source.stem + '.' + output_format)
    if not result.is_file() or result.stat().st_size < 100:
        raise RuntimeError('Office 引擎没有生成有效输出文件')
    if hashlib.sha256(source.read_bytes()).hexdigest() != before:
        raise RuntimeError('源文档在转换期间发生变化，请重新读取')
    if output_format != 'pdf':
        office_input(result)
    return result

def convert(source, destination, output_format):
    check_cancel()
    source = workspace(source, True)
    destination = workspace(destination)
    destination.mkdir(parents=True, exist_ok=False)
    output = office_convert(source, destination, output_format)
    check_cancel()
    report = {'output': str(output), 'engine': 'LibreOffice',
              'sourcePreserved': True, 'visualReviewRequired': True,
              'formulaEvaluationEngine': 'LibreOffice Calc' if source.suffix.lower() in ('.xlsx', '.ods') else None,
              'note': 'Calc 重算依赖可用字体和受支持函数；宏及外部工作簿链接被拒绝。'}
    (destination / 'conversion-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report

def render(source, destination, expected=None, editable=False):
    check_cancel()
    source = workspace(source, True)
    destination = workspace(destination)
    destination.mkdir(parents=True, exist_ok=False)
    if source.suffix.lower() in OFFICE_FILTERS:
        office_input(source)
    layout = structure(source)
    if editable and layout and any(not page['textRuns'] for page in layout):
        raise ValueError('存在没有可编辑文字的 PPT 页面；不能作为可编辑 PPT 交付')
    suffix = source.suffix.lower()
    if suffix in ('.html', '.htm'):
        text = source.read_text(encoding='utf-8-sig')
        # Export a derivative. Never screenshot an animation's first transparent frame.
        base = '<base href=' + json.dumps(source.parent.as_uri() + '/') + '>'
        css = '''<style>@page{size:16in 9in;margin:0}@media print{
        *{animation:none!important;transition:none!important}body{margin:0!important}
        .deck{width:16in!important;height:auto!important;overflow:visible!important}
        .slide{display:block!important;position:relative!important;inset:auto!important;
        width:16in!important;height:9in!important;break-inside:avoid;break-after:page;
        opacity:1!important;transform:none!important;overflow:hidden!important}
        .slide:last-child{break-after:auto}.controls{display:none!important}}</style>'''
        copy = destination / 'print-source.html'
        copy.write_text(text.replace('<head>', '<head>' + base, 1) + css, encoding='utf-8')
        pdf = destination / 'document.pdf'
        run(['chromium-browser', '--headless', '--no-sandbox', '--disable-gpu',
             '--disable-dev-shm-usage', '--no-pdf-header-footer',
             '--user-data-dir=' + str(destination / 'browser-profile'),
             '--run-all-compositor-stages-before-draw', '--virtual-time-budget=1500',
             '--print-to-pdf=' + str(pdf), copy.as_uri()])
    elif suffix == '.pdf':
        pdf = destination / source.name
        shutil.copyfile(source, pdf)
    elif suffix in ('.pptx', '.docx', '.xlsx', '.odt', '.odp', '.ods'):
        pdf = office_convert(source, destination, 'pdf')
    else:
        raise ValueError('支持 PPTX、DOCX、XLSX、PDF、HTML 与 OpenDocument')
    if not pdf.is_file() or pdf.stat().st_size < 100:
        raise RuntimeError('渲染器没有生成实际 PDF，未视为成功')
    check_cancel()
    info = run(['pdfinfo', str(pdf)], 20)
    match = re.search(r'^Pages:\s+(\d+)', info, re.M)
    if not match:
        raise RuntimeError('无法确认实际 PDF 页数')
    count = int(match[1])
    if expected is not None and count != expected:
        raise ValueError(f'实际 {count} 页，与要求 {expected} 页不一致')
    run(['pdftoppm', '-scale-to', '1280', '-png', str(pdf), str(destination / 'page')], 180)
    pages = sorted(destination.glob('page-*.png'))
    if len(pages) != count:
        raise RuntimeError('页面图片未完整生成')
    check_cancel()
    from PIL import Image, ImageStat
    blank = []
    for index, page in enumerate(pages, 1):
        with Image.open(page) as image:
            sample = image.convert('RGB').resize((160, 90))
            spread = max(ImageStat.Stat(sample).stddev)
            if spread < 3:
                blank.append(index)
    report = {'pdf': str(pdf), 'pages': [str(p) for p in pages], 'pageCount': count,
              'possibleBlankPages': blank, 'pptStructure': layout,
              'visualReviewRequired': True,
              'note': '图片和结构检查不能替代逐页目视验收，PDF 不验证播放动画。'}
    (destination / 'render-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['status', 'render', 'convert', 'recalculate'])
    parser.add_argument('--input'); parser.add_argument('--output-dir')
    parser.add_argument('--format', choices=['pdf','docx','xlsx','pptx','odt','ods','odp'])
    parser.add_argument('--expect-pages', type=int)
    parser.add_argument('--require-editable', action='store_true')
    args = parser.parse_args()
    if args.action == 'status':
        value = status()
    elif args.action in ('convert', 'recalculate'):
        if args.action == 'recalculate' and pathlib.Path(args.input).suffix.lower() not in ('.xlsx', '.ods'):
            raise ValueError('重算仅支持 XLSX 或 ODS')
        value = convert(args.input, args.output_dir, 'xlsx' if args.action == 'recalculate' else args.format)
    else:
        value = render(args.input, args.output_dir, args.expect_pages, args.require_editable)
    print(json.dumps(value, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False), flush=True)
        raise SystemExit(1)
