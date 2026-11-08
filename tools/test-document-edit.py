#!/usr/bin/env python3
"""Real stdlib OOXML/Markdown local edit transactions, with untouched-entry proofs."""
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'probe/assets/office/eva-document-edit.py'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


class EditTests(unittest.TestCase):
    def setUp(self):
        self.scope = runpy.run_path(str(SCRIPT))
        self.state = self.scope['execute'].__globals__
        self.temp = tempfile.TemporaryDirectory(prefix='document-edit-', dir=ROOT / 'tmp')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.state['WORKSPACE'] = self.base

    def package(self, name, entries):
        path = self.base / name
        with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.comment = b'preserve archive comment'
            for entry, content in entries.items():
                archive.writestr(entry, content)
        return path

    def request(self, path, kind, selected='Hello World', replacement='Changed', locator=None, **extra):
        return {'path': str(path), 'kind': kind, 'expectedSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'selectedText': selected, 'replacement': replacement, 'locator': locator or {}, **extra}

    def contents(self, path):
        with zipfile.ZipFile(path) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def docx(self, text=None):
        xml = text or f'''<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}" xmlns:r="{R}" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"><w:body><w:p w14:paraId="123"><w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>World suffix</w:t></w:r><w:r><w:drawing r:id="picture1"/></w:r></w:p></w:body></w:document>'''
        return self.package('sample.docx', {'word/document.xml': xml, 'word/media/image1.png': b'UNCHANGED_IMAGE_BYTES', 'word/_rels/document.xml.rels': b'<Relationships/>', 'word/styles.xml': b'<styles/>', '[Content_Types].xml': b'<Types/>'})

    def test_docx_cross_run_preserves_namespace_runs_images_other_entries(self):
        path = self.docx()
        before = self.contents(path)
        report = self.scope['execute'](self.request(path, 'docx', locator={'page': 1, 'paragraphStart': 99, 'paragraphEnd': 99, 'startOffset': 0, 'endOffset': 11, 'quote': 'Hello World'}), True)
        self.assertTrue(report['success'] and report['changed'] and report['applied'])
        self.assertEqual(Path(report['backupPath']).read_bytes(), self.contents_bytes_backup(report, before))
        after = self.contents(path)
        self.assertEqual({k: v for k, v in before.items() if k != 'word/document.xml'}, {k: v for k, v in after.items() if k != 'word/document.xml'})
        xml = after['word/document.xml']
        self.assertIn(b'xmlns:w14=', xml)
        self.assertIn(b'mc:Ignorable="w14"', xml)
        self.assertIn(b'<w:rPr><w:b/></w:rPr>', xml)
        self.assertIn(b'<w:rPr><w:i/></w:rPr>', xml)
        self.assertIn(b'<w:drawing r:id="picture1"/>', xml)
        parsed = ET.fromstring(xml)
        self.assertEqual(''.join(n.text or '' for n in parsed.iter('{' + W + '}t')), 'Changed suffix')
        self.assertEqual(report['newSHA256'], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(report['sourceSHA256'], hashlib.sha256(Path(report['backupPath']).read_bytes()).hexdigest())

    def contents_bytes_backup(self, report, before):
        backup = Path(report['backupPath'])
        self.assertEqual(self.contents(backup), before)
        return backup.read_bytes()

    def test_check_is_read_only_and_noop_does_not_backup(self):
        path = self.docx()
        original = path.read_bytes()
        report = self.scope['execute'](self.request(path, 'docx'), False)
        self.assertTrue(report['wouldChange'])
        self.assertFalse(report['changed'] or report['applied'])
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse((self.base / '.eva-edit-backups').exists())
        report = self.scope['execute'](self.request(path, 'docx', replacement='Hello World'), True)
        self.assertFalse(report['changed'])
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse((self.base / '.eva-edit-backups').exists())

    def test_ambiguous_docx_dom_indices_do_not_pick_wrong_occurrence(self):
        path = self.docx(f'<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Hello World</w:t></w:r></w:p><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:body></w:document>')
        original = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            self.scope['execute'](self.request(path, 'docx', locator={'paragraphStart': 1, 'paragraphEnd': 1}), True)
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse((self.base / '.eva-edit-backups').exists())

    def test_word_newline_becomes_real_break_and_xml_spaces_preserved(self):
        path = self.docx()
        self.scope['execute'](self.request(path, 'docx', replacement=' New\nLine '), True)
        xml = self.contents(path)['word/document.xml']
        self.assertIn(b'<w:br/>', xml)
        self.assertIn(b'xml:space="preserve"', xml)
        ET.fromstring(xml)

    def pptx(self, repeated=False):
        paragraph = '<a:p><a:r><a:rPr b="1"/><a:t>Hello </a:t></a:r><a:r><a:t>World</a:t></a:r></a:p>'
        slide = f'<p:sld xmlns:p="{P}" xmlns:a="{A}" xmlns:r="{R}"><p:cSld><p:spTree><p:sp><p:txBody>{paragraph}</p:txBody></p:sp>' + (f'<p:sp><p:txBody>{paragraph}</p:txBody></p:sp>' if repeated else '') + '</p:spTree></p:cSld></p:sld>'
        return self.package('sample.pptx', {'ppt/presentation.xml': f'<p:presentation xmlns:p="{P}" xmlns:r="{R}"><p:sldIdLst><p:sldId id="256" r:id="r1"/></p:sldIdLst></p:presentation>', 'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="r1" Target="slides/slide7.xml"/></Relationships>', 'ppt/slides/slide7.xml': slide, 'ppt/media/picture.png': b'KEEP_PPT_IMAGE', 'ppt/slides/_rels/slide7.xml.rels': b'<Relationships/>'})

    def test_ppt_uses_presentation_order_not_physical_filename_or_dom_shape(self):
        path = self.pptx()
        before = self.contents(path)
        report = self.scope['execute'](self.request(path, 'pptx', locator={'slide': 1, 'shape': 100, 'currentValue': 'Hello World'}), True)
        after = self.contents(path)
        self.assertEqual(report['locator']['part'], 'ppt/slides/slide7.xml')
        self.assertIn(b'Changed', after['ppt/slides/slide7.xml'])
        self.assertEqual({k: v for k, v in before.items() if k != 'ppt/slides/slide7.xml'}, {k: v for k, v in after.items() if k != 'ppt/slides/slide7.xml'})

    def test_ppt_same_quote_in_two_shapes_rejected(self):
        path = self.pptx(True)
        original = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            self.scope['execute'](self.request(path, 'pptx', locator={'slide': 1, 'shape': 0}), True)
        self.assertEqual(path.read_bytes(), original)

    def test_ppt_whole_shape_multiline_keeps_paragraph_formatting(self):
        path = self.pptx()
        before = self.contents(path)
        part = 'ppt/slides/slide7.xml'
        entries = dict(before)
        entries[part] = before[part].replace(b'</p:txBody>', b'<a:p><a:pPr algn="r"/><a:r><a:rPr i="1"/><a:t>Second line</a:t></a:r></a:p></p:txBody>')
        path = self.package('multiline.pptx', entries)
        original = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'adds PPT paragraphs'):
            self.scope['execute'](self.request(path, 'pptx', selected='Hello World\nSecond line', replacement='One\nTwo\nThree', locator={'slide': 1, 'shape': 0}), True)
        self.assertEqual(path.read_bytes(), original)
        self.scope['execute'](self.request(path, 'pptx', selected='Hello World\nSecond line', replacement='First changed\nSecond changed', locator={'slide': 1, 'shape': 500}), True)
        after = self.contents(path)
        self.assertIn(b'<a:pPr algn="r"/>', after[part])
        self.assertIn(b'<a:rPr i="1"/>', after[part])
        self.assertEqual(''.join(n.text or '' for n in ET.fromstring(after[part]).iter('{' + A + '}t')), 'First changedSecond changed')
        self.assertEqual({k: v for k, v in entries.items() if k != part}, {k: v for k, v in after.items() if k != part})

    def xlsx(self):
        return self.package('sample.xlsx', {'xl/workbook.xml': f'<workbook xmlns="{S}" xmlns:r="{R}"><sheets><sheet name="Report" sheetId="1" r:id="r1"/></sheets></workbook>', 'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>', 'xl/worksheets/sheet1.xml': f'<worksheet xmlns="{S}"><sheetData><row r="1"><c r="A1" s="4" t="n"><v>7</v><extLst><keep/></extLst></c></row></sheetData><drawing xmlns:r="{R}" r:id="chart1"/></worksheet>', 'xl/charts/chart1.xml': b'<chart>KEEP_CHART</chart>', 'xl/styles.xml': b'<styles>KEEP_STYLE</styles>', 'xl/worksheets/_rels/sheet1.xml.rels': b'<Relationships/>', 'xl/media/image.png': b'KEEP_IMAGE'})

    def test_excel_text_literal_keeps_style_chart_and_non_target_parts(self):
        path = self.xlsx()
        before = self.contents(path)
        report = self.scope['execute'](self.request(path, 'xlsx', selected='7', replacement='=1+1', locator={'sheetName': 'Report', 'cellRange': 'A1', 'row': 0, 'col': 0, 'currentValue': '7'}), True)
        after = self.contents(path)
        sheet = ET.fromstring(after['xl/worksheets/sheet1.xml'])
        cell = sheet.find('.//{' + S + '}c')
        self.assertEqual(cell.attrib, {'r': 'A1', 's': '4', 't': 'inlineStr'})
        self.assertEqual(cell.find('.//{' + S + '}t').text, '=1+1')
        self.assertIsNotNone(cell.find('{' + S + '}extLst'))
        self.assertEqual({k: v for k, v in before.items() if k != 'xl/worksheets/sheet1.xml'}, {k: v for k, v in after.items() if k != 'xl/worksheets/sheet1.xml'})
        self.assertTrue(report['warnings'])

    def test_excel_explicit_number_formula_and_new_cell(self):
        path = self.xlsx()
        locator = {'sheetName': 'Report', 'cellRange': 'B1'}
        self.scope['execute'](self.request(path, 'xlsx', replacement='1.25', locator=locator, valueType='number'), True)
        sheet = ET.fromstring(self.contents(path)['xl/worksheets/sheet1.xml'])
        self.assertEqual(sheet.find('.//{' + S + '}c[@r="B1"]/{' + S + '}v').text, '1.25')
        locator['cellRange'] = 'C4'
        self.scope['execute'](self.request(path, 'xlsx', replacement='=SUM(A1:B1)', locator=locator, valueType='formula'), True)
        sheet = ET.fromstring(self.contents(path)['xl/worksheets/sheet1.xml'])
        cell = sheet.find('.//{' + S + '}c[@r="C4"]')
        self.assertEqual(cell.find('{' + S + '}f').text, 'SUM(A1:B1)')
        self.assertIsNone(cell.find('{' + S + '}v'))

    def test_excel_range_nonfinite_and_external_formula_fail_unchanged(self):
        path = self.xlsx()
        original = path.read_bytes()
        for request in [self.request(path, 'xlsx', locator={'sheetName': 'Report', 'cellRange': 'A1:B2'}), self.request(path, 'xlsx', replacement='NaN', valueType='number', locator={'sheetName': 'Report', 'cellRange': 'A1'}), self.request(path, 'xlsx', replacement='WEBSERVICE("https://host")', valueType='formula', locator={'sheetName': 'Report', 'cellRange': 'A1'})]:
            with self.assertRaises(ValueError):
                self.scope['execute'](request, True)
            self.assertEqual(path.read_bytes(), original)

    def test_excel_initially_empty_sheet_creates_one_precise_cell(self):
        path = self.xlsx()
        entries = self.contents(path)
        entries['xl/worksheets/sheet1.xml'] = ('<worksheet xmlns="' + S + '"><sheetData/></worksheet>').encode()
        path = self.package('empty.xlsx', entries)
        self.scope['execute'](self.request(path, 'xlsx', selected='', replacement='New cell', locator={'sheetName': 'Report', 'cellRange': 'C5'}), True)
        sheet = ET.fromstring(self.contents(path)['xl/worksheets/sheet1.xml'])
        self.assertEqual(sheet.find('.//{' + S + '}c').attrib['r'], 'C5')
        self.assertEqual(sheet.find('.//{' + S + '}t').text, 'New cell')

    def test_excel_merged_child_rejected_without_hidden_value_creation(self):
        path = self.xlsx()
        entries = self.contents(path)
        entries['xl/worksheets/sheet1.xml'] = entries['xl/worksheets/sheet1.xml'].replace(b'</worksheet>', b'<mergeCells><mergeCell ref="A1:B2"/></mergeCells></worksheet>')
        path = self.package('merged.xlsx', entries)
        original = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'merged region anchor'):
            self.scope['execute'](self.request(path, 'xlsx', locator={'sheetName': 'Report', 'cellRange': 'B2'}), True)
        self.assertEqual(path.read_bytes(), original)

    def test_markdown_context_bom_and_draft_offsets_not_trusted(self):
        path = self.base / 'sample.md'
        path.write_bytes(b'\xef\xbb\xbf# A\r\nleft same right\r\nother same end\r\n')
        request = self.request(path, 'md', selected='same', replacement='new **text**', locator={'before': 'left ', 'after': ' right', 'startOffset': 900, 'endOffset': 999, 'quote': 'same'})
        report = self.scope['execute'](request, True)
        self.assertTrue(report['success'])
        self.assertEqual(path.read_bytes(), b'\xef\xbb\xbf# A\r\nleft new **text** right\r\nother same end\r\n')

    def test_stale_hash_and_empty_selection_fail_before_backup(self):
        path = self.docx()
        original = path.read_bytes()
        for request in [dict(self.request(path, 'docx'), expectedSha256='0' * 64), self.request(path, 'docx', selected='')]:
            with self.assertRaises(ValueError):
                self.scope['execute'](request, True)
        self.assertEqual(path.read_bytes(), original)
        self.assertFalse((self.base / '.eva-edit-backups').exists())

    def test_zip_path_macro_signature_entity_and_limit_safety(self):
        for index, entries in enumerate([{'../escape': b'bad'}, {'word/vbaProject.bin': b'bad'}, {'_xmlsignatures/sig1.xml': b'bad'}, {'word/document.xml': b'<!DOCTYPE x [<!ENTITY p "bad">]><x>&p;</x>'}]):
            path = self.package('unsafe%d.docx' % index, entries)
            original = path.read_bytes()
            with self.assertRaises(ValueError):
                self.scope['execute'](self.request(path, 'docx'), True)
            self.assertEqual(path.read_bytes(), original)
        path = self.docx()
        with patch.dict(self.state, MAX_EXPANDED=1):
            with self.assertRaises(ValueError):
                self.scope['execute'](self.request(path, 'docx'), True)

    def test_failed_atomic_replace_retains_original_and_valid_backup(self):
        path = self.docx()
        original = path.read_bytes()
        with patch.object(self.state['os'], 'replace', side_effect=OSError('fixture disk failure')):
            with self.assertRaises(OSError):
                self.scope['execute'](self.request(path, 'docx'), True)
        self.assertEqual(path.read_bytes(), original)
        backups = list((self.base / '.eva-edit-backups').iterdir())
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), original)
        self.assertEqual(list(self.base.glob('.eva-edit-*')), [self.base / '.eva-edit-backups'])

    def test_workspace_escape_symlink_and_unsafe_backup_rejected(self):
        path = self.docx()
        link = self.base / 'link.docx'
        link.symlink_to(path)
        with self.assertRaises(ValueError):
            self.scope['execute'](self.request(link, 'docx'), True)
        directory = self.base / '.eva-edit-backups'
        directory.symlink_to(self.base, target_is_directory=True)
        original = path.read_bytes()
        with self.assertRaises(ValueError):
            self.scope['execute'](self.request(path, 'docx'), True)
        self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
