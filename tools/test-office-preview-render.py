#!/usr/bin/env python3
"""Offline preview transport contracts; actual LibreOffice behavior needs device QA."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'probe/assets/office/eva-render.py'


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.scope = runpy.run_path(str(SCRIPT))
        self.state = self.scope['preview'].__globals__
        self.temporary = tempfile.TemporaryDirectory(prefix='office-preview-', dir=ROOT / 'tmp')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.state['ROOT'] = self.base
        temporary_root = patch.object(self.state['tempfile'], 'tempdir', str(self.base))
        temporary_root.start()
        self.addCleanup(temporary_root.stop)
        tools = patch.object(self.state['shutil'], 'which', lambda name: '/fixture/bin/' + name)
        tools.start()
        self.addCleanup(tools.stop)
        self.files = {}
        self.private_folders = []
        self.final_count = None
        self.fail_extract = False
        self.state['check_cancel'] = lambda: None
        self.state['run'] = self.run_command
        self.calls = []
        self.output_count = None
        self.size = (612, 792)
        self.mutate = False
        self.omit_sizes = False

    def archive(self, name, entries):
        result = self.base / name
        with zipfile.ZipFile(result, 'w') as archive:
            for entry, body in entries.items():
                archive.writestr(entry, body)
        return result

    def xlsx(self, states=('visible', 'visible', 'visible', 'visible')):
        body = ''.join('<sheet name="Sheet%d" sheetId="%d" state="%s"/>' % (i, i, state) for i, state in enumerate(states, 1))
        return self.archive('sample.xlsx', {'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets>' + body + '</sheets></workbook>'})

    def ods(self, styles, sheets):
        return self.archive('sample.ods', {'content.xml': '''<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:automatic-styles>''' + styles + '</office:automatic-styles><office:body><office:spreadsheet>' + sheets + '</office:spreadsheet></office:body></office:document-content>'})

    def run_command(self, args, timeout=120):
        args = list(map(str, args))
        self.calls.append(args)
        if args[0] == 'libreoffice':
            option = args[args.index('--convert-to') + 1]
            source = Path(args[-1])
            destination = Path(args[args.index('--outdir') + 1])
            self.filter = option
            self.count = self.output_count
            if self.count is None:
                self.count = len(self.scope['preview_sheets'](source)) if 'SinglePageSheets' in option else 2
            target = destination / (source.stem + '.pdf')
            target.write_bytes(b'%PDF-1.7\n' + b'fixture' * 30)
            self.files[str(target)] = self.count
            if destination.name.startswith('eva-office-preview-'):
                self.private_folders.append(destination)
                self.assertEqual(destination.stat().st_mode & 0o777, 0o700)
            if self.mutate:
                source.write_bytes(b'externally changed test fixture')
            return 'fixture PDF produced; not actual LibreOffice'
        if args[0] == 'pdfinfo':
            count = self.files.get(args[-1], self.count)
            if '-box' not in args:
                return 'Pages: %d\n' % count
            return '' if self.omit_sizes else '\n'.join('Page %d size: %s x %s pts' % (i, *self.size) for i in range(1, count + 1))
        if args[0] == 'pdfseparate':
            if self.fail_extract:
                raise RuntimeError('fixture page extraction failed')
            index = int(args[args.index('-f') + 1])
            self.assertEqual(str(index), args[args.index('-l') + 1])
            target = Path(args[-1].replace('%d', str(index)))
            target.write_bytes(b'%PDF-1.7\n' + ('VECTOR_PAGE_%d' % index).encode() * 20)
            self.files[str(target)] = 1
            return ''
        if args[0] == 'pdfunite':
            target = Path(args[-1])
            target.write_bytes(b'%PDF-1.7\n' + b''.join(Path(p).read_bytes() for p in args[1:-1]))
            self.files[str(target)] = self.final_count if self.final_count is not None else len(args[1:-1])
            return ''
        raise AssertionError('Unexpected command (PNG generation forbidden): ' + repr(args))

    def test_four_visible_sheets_one_page_each_no_png(self):
        source = self.xlsx()
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        report = self.scope['preview'](source, self.base / 'out')
        options = json.loads(self.filter.split(':', 2)[2])
        self.assertEqual(options, {'SinglePageSheets': {'type': 'boolean', 'value': 'true'}, 'UseLosslessCompression': {'type': 'boolean', 'value': 'true'}, 'ReduceImageResolution': {'type': 'boolean', 'value': 'false'}})
        self.assertEqual(report['pageCount'], 4)
        self.assertEqual(report['visibleSheets'], ['Sheet1', 'Sheet2', 'Sheet3', 'Sheet4'])
        self.assertFalse(report['rasterized'])
        self.assertEqual(digest, hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertFalse(list((self.base / 'out').glob('*.png')))
        self.assertIn('-env:UserInstallation=' + (self.private_folders[0] / 'office-profile').as_uri(), self.calls[0])
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))
        self.assertFalse(any(call[0] in ('pdfseparate', 'pdfunite') for call in self.calls))

    def test_hidden_and_very_hidden_use_original_indices(self):
        source = self.xlsx(('hidden', 'visible', 'veryHidden', 'visible'))
        report = self.scope['preview'](source, self.base / 'out')
        self.assertNotIn('PageRange', json.loads(self.filter.split(':', 2)[2]))
        self.assertEqual([call[call.index('-f') + 1] for call in self.calls if call[0] == 'pdfseparate'], ['2', '4'])
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))
        self.assertNotIn(b'VECTOR_PAGE_1', Path(report['pdf']).read_bytes())
        self.assertNotIn(b'VECTOR_PAGE_3', Path(report['pdf']).read_bytes())
        self.assertEqual(report['visibleSheets'], ['Sheet2', 'Sheet4'])
        self.assertEqual(report['excludedHiddenSheetCount'], 2)
        self.assertEqual(report['pageCount'], 2)

    def test_all_hidden_and_unknown_visibility_fail_before_export(self):
        for i, states in enumerate([('hidden', 'veryHidden'), ('unknown',)]):
            source = self.xlsx(states)
            with self.assertRaises(ValueError):
                self.scope['preview'](source, self.base / ('out' + str(i)))
        self.assertEqual(self.calls, [])

    def test_ods_inherited_hidden_style_and_default_visible(self):
        source = self.ods('<style:style style:name="hidden" style:family="table"><style:table-properties table:display="false"/></style:style><style:style style:name="child" style:family="table" style:parent-style-name="hidden"/>', '<table:table table:name="Private" table:style-name="child"/><table:table table:name="Visible"/>')
        report = self.scope['preview'](source, self.base / 'out')
        self.assertEqual(report['visibleSheets'], ['Visible'])
        self.assertEqual([call[call.index('-f') + 1] for call in self.calls if call[0] == 'pdfseparate'], ['2'])

    def test_ods_unknown_or_cyclic_styles_fail_closed(self):
        for i, (styles, name) in enumerate([('', 'missing'), ('<style:style style:name="loop" style:family="table" style:parent-style-name="loop"/>', 'loop')]):
            source = self.ods(styles, '<table:table table:name="Uncertain" table:style-name="' + name + '"/>')
            with self.assertRaises(ValueError):
                self.scope['preview'](source, self.base / ('out' + str(i)))
        self.assertEqual(self.calls, [])

    def test_raw_page_count_mismatch_fails_and_removes_private_pdf(self):
        source = self.xlsx(('visible', 'hidden', 'visible'))
        self.output_count = 2
        with self.assertRaisesRegex(RuntimeError, '隐藏页映射'):
            self.scope['preview'](source, self.base / 'out')
        self.assertFalse((self.base / 'out/sample.pdf').exists())
        self.assertFalse((self.base / 'out/preview-report.json').exists())
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))

    def test_missing_poppler_reports_dependency_without_exporting_raw(self):
        source = self.xlsx(('visible', 'hidden'))
        with patch.object(self.state['shutil'], 'which', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'poppler-utils'):
                self.scope['preview'](source, self.base / 'out')
        self.assertEqual(self.calls, [])
        self.assertFalse((self.base / 'out/sample.pdf').exists())

    def test_extraction_failure_cleans_private_hidden_pdf(self):
        source = self.xlsx(('hidden', 'visible', 'veryHidden', 'visible'))
        self.fail_extract = True
        with self.assertRaisesRegex(RuntimeError, 'extraction failed'):
            self.scope['preview'](source, self.base / 'out')
        self.assertTrue(self.private_folders)
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))
        self.assertFalse((self.base / 'out/sample.pdf').exists())

    def test_final_page_count_mismatch_cleans_output(self):
        source = self.xlsx(('hidden', 'visible', 'veryHidden', 'visible'))
        self.final_count = 3
        with self.assertRaisesRegex(RuntimeError, '最终可见'):
            self.scope['preview'](source, self.base / 'out')
        self.assertFalse((self.base / 'out/sample.pdf').exists())
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))

    def test_cancel_after_extraction_cleans_private_and_final_files(self):
        source = self.xlsx(('hidden', 'visible', 'veryHidden', 'visible'))
        def cancel_after_first_page():
            if any(call[0] == 'pdfseparate' for call in self.calls):
                raise RuntimeError('fixture cancellation')
        self.state['check_cancel'] = cancel_after_first_page
        with self.assertRaisesRegex(RuntimeError, 'cancellation'):
            self.scope['preview'](source, self.base / 'out')
        self.assertFalse((self.base / 'out/sample.pdf').exists())
        self.assertTrue(all(not folder.exists() for folder in self.private_folders))

    def test_pdf_page_count_and_geometry_limits(self):
        source = self.xlsx(('visible',))
        for i, (count, size) in enumerate([(301, (612, 792)), (1, (200000, 10)), (1, (20000, 20000))]):
            self.output_count, self.size = count, size
            folder = self.base / ('out' + str(i))
            with self.assertRaises(ValueError):
                self.scope['preview'](source, folder)
            self.assertFalse((folder / 'sample.pdf').exists())

    def test_pdf_missing_geometry_fails_closed(self):
        source = self.xlsx(('visible',))
        self.omit_sizes = True
        with self.assertRaisesRegex(ValueError, '逐页尺寸'):
            self.scope['preview'](source, self.base / 'out')
        self.assertFalse((self.base / 'out/sample.pdf').exists())

    def test_source_change_is_not_marked_success(self):
        source = self.xlsx()
        self.mutate = True
        with self.assertRaisesRegex(RuntimeError, '源文档'):
            self.scope['preview'](source, self.base / 'out')
        self.assertFalse((self.base / 'out/sample.pdf').exists())

    def test_macros_external_links_and_old_binary_formats_rejected(self):
        for i, entry in enumerate(['xl/vbaProject.bin', 'xl/externalLinks/externalLink1.xml']):
            source = self.archive('unsafe.xlsx', {entry: 'unsafe'})
            with self.assertRaises(ValueError):
                self.scope['preview'](source, self.base / ('out' + str(i)))
        old = self.base / 'legacy.xls'
        old.write_bytes(b'legacy binary')
        with self.assertRaisesRegex(ValueError, '旧 DOC/XLS/PPT'):
            self.scope['preview'](old, self.base / 'old-out')
        self.assertEqual(self.calls, [])

    def test_writer_preview_preserves_native_pdf_filter(self):
        source = self.archive('sample.docx', {'word/document.xml': '<document/>'})
        result = self.scope['preview'](source, self.base / 'out')
        self.assertEqual(self.filter.split(':', 2)[:2], ['pdf', 'writer_pdf_Export'])
        self.assertEqual(json.loads(self.filter.split(':', 2)[2]), {'UseLosslessCompression': {'type': 'boolean', 'value': 'true'}, 'ReduceImageResolution': {'type': 'boolean', 'value': 'false'}})
        self.assertIsNone(result['spreadsheetMode'])
        self.assertEqual(result['pageCount'], 2)

    def test_existing_convert_keeps_print_layout_without_preview_options(self):
        source = self.xlsx()
        self.scope['convert'](source, self.base / 'out', 'pdf')
        self.assertEqual(self.filter, 'pdf:calc_pdf_Export')
        self.assertNotIn('SinglePageSheets', self.filter)

    def test_cli_routes_preview_without_qa_render(self):
        with patch.dict(self.state, {'preview': lambda source, dest: {'pdf': 'final.pdf', 'pageCount': 4}, 'render': lambda *a: self.fail('QA render called')}), patch('sys.argv', ['eva-render.py', 'preview', '--input', 'file.xlsx', '--output-dir', 'new-folder']):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.scope['main']()
        self.assertEqual(json.loads(output.getvalue())['pageCount'], 4)


if __name__ == '__main__':
    unittest.main(verbosity=2)
