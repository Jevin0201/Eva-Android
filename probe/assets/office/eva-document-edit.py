"""Scoped, atomic original-format edits. stdlib only; no Office conversion/eval."""
import argparse
import fcntl
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import stat
import tempfile
import uuid
import zipfile
from xml.parsers import expat
from xml.sax.saxutils import escape

WORKSPACE = Path('/root/eva-workspace')
MAX_SOURCE = 64 * 1024 * 1024
MAX_EXPANDED = 128 * 1024 * 1024
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      's': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
KINDS = {'.docx': 'docx', '.pptx': 'pptx', '.xlsx': 'xlsx', '.md': 'md', '.markdown': 'md'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def workspace(value):
    if not isinstance(value, str) or not value or '\0' in value:
        raise ValueError('path must identify an existing workspace file')
    original = Path(value)
    if not original.is_absolute():
        original = WORKSPACE / original
    if original.is_symlink():
        raise ValueError('Editing through a file symlink is unsupported; select the actual workspace file')
    path = original.resolve(strict=True)
    if not path.is_relative_to(WORKSPACE.resolve()) or not path.is_file():
        raise ValueError('File must exist inside the Eva workspace')
    return path


def tag_end(data, start):
    quote = None
    for index in range(start, len(data)):
        char = data[index]
        if quote:
            if char == quote:
                quote = None
        elif char in (34, 39):
            quote = char
        elif char == 62:
            return index + 1
    raise ValueError('Unterminated XML tag')


def xml_nodes(data):
    if re.search(br'encoding\s*=\s*[\'"](?!utf-8[\'"]|UTF-8[\'"])', data[:200]):
        raise ValueError('Only UTF-8 XML parts are editable')
    parser = expat.ParserCreate(namespace_separator='}')
    stack, nodes = [], []
    def forbidden(*args):
        raise ValueError('XML document types and entities are unsupported')
    parser.StartDoctypeDeclHandler = forbidden
    parser.EntityDeclHandler = forbidden
    parser.ExternalEntityRefHandler = forbidden
    def start(name, attrs):
        if len(nodes) >= 300000 or len(stack) >= 128:
            raise ValueError('XML structure exceeds editing limits')
        offset = parser.CurrentByteIndex
        end = tag_end(data, offset)
        raw = data[offset:end]
        node = {'tag': name, 'attrs': attrs, 'start': offset, 'openEnd': end,
                'qname': re.match(br'<([^\s/>]+)', raw)[1].decode('utf-8'),
                'selfClosing': raw.rstrip().endswith(b'/>'), 'text': '', 'children': [],
                'parent': stack[-1] if stack else None}
        if stack:
            stack[-1]['children'].append(node)
        nodes.append(node)
        stack.append(node)
    def end(name):
        node = stack.pop()
        node['end'] = node['openEnd'] if node['selfClosing'] else tag_end(data, parser.CurrentByteIndex)
        node['closeStart'] = node['openEnd'] if node['selfClosing'] else parser.CurrentByteIndex
    def text(value):
        if stack:
            stack[-1]['text'] += value
    parser.StartElementHandler, parser.EndElementHandler, parser.CharacterDataHandler = start, end, text
    parser.Parse(data, True)
    return nodes


def qualified(key, name):
    return NS[key] + '}' + name


def descendants(node):
    for child in node['children']:
        yield child
        yield from descendants(child)


def patch_bytes(data, changes):
    for start, end, value in sorted(changes, reverse=True):
        data = data[:start] + value + data[end:]
    return data


def valid_text(value):
    if not isinstance(value, str) or len(value) > 1000000 or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
        raise ValueError('replacement must be XML-safe text within the editing limit')
    return value


def contexts(locator):
    return locator.get('prefix', locator.get('before', '')), locator.get('suffix', locator.get('after', ''))


def occurrences(text, selected, locator):
    before, after = contexts(locator)
    if not isinstance(before, str) or not isinstance(after, str):
        raise ValueError('Selection context must be text')
    result, start = [], 0
    while True:
        at = text.find(selected, start)
        if at < 0:
            return result
        if text[:at].endswith(before) and text[at + len(selected):].startswith(after):
            result.append(at)
        start = at + 1


def text_part_edit(data, key, selected, replacement, locator):
    nodes = xml_nodes(data)
    matches = []
    for index, paragraph in enumerate(n for n in nodes if n['tag'] == qualified(key, 'p')):
        tokens = [n for n in descendants(paragraph) if n['tag'] in (qualified(key, 't'), qualified(key, 'tab'), qualified(key, 'br'))]
        source = ''.join(n['text'] if n['tag'] == qualified(key, 't') else ('\t' if n['tag'].endswith('}tab') else '\n') for n in tokens)
        for at in occurrences(source, selected, locator):
            matches.append((index + 1, tokens, at, source))
    return matches


def ppt_shape_edit(data, selected, replacement, locator):
    """The direct reader quotes whole shapes by joining their source paragraphs.

    A DOM element number is never used as a source identity. Retain the original
    paragraph/run scaffolding; adding paragraphs would require a richer editor.
    """
    nodes = xml_nodes(data)
    candidates = []
    for shape_index, shape in enumerate(n for n in nodes if n['tag'] == qualified('p', 'sp')):
        bodies = [n for n in shape['children'] if n['tag'] == qualified('p', 'txBody')]
        if len(bodies) != 1:
            continue
        paragraphs = [n for n in bodies[0]['children'] if n['tag'] == qualified('a', 'p')]
        rows = []
        for index, paragraph in enumerate(paragraphs):
            tokens = [n for n in descendants(paragraph) if n['tag'] in (qualified('a', 't'), qualified('a', 'br'))]
            text = ''.join(n['text'] if n['tag'] == qualified('a', 't') else '\n' for n in tokens)
            rows.append((index + 1, tokens, 0, text))
        text = '\n'.join(row[3] for row in rows)
        if text == selected and occurrences(text, selected, locator) == [0]:
            candidates.append((shape_index + 1, rows))
    if len(candidates) != 1:
        raise ValueError('Selected whole PPT shape is missing or ambiguous; select unique paragraph text')
    shape_index, rows = candidates[0]
    values = replacement.replace('\r\n', '\n').split('\n')
    if len(values) > len(rows):
        raise ValueError('Replacement adds PPT paragraphs; use at most the selected shape paragraph count')
    values += [''] * (len(rows) - len(values))
    result = data
    for row, value in reversed(list(zip(rows, values))):
        if not row[3]:
            if value:
                raise ValueError('PPT target paragraph has no text run; select a nonempty paragraph')
            continue
        result, _ = replace_text_match(result, 'a', row, row[3], value)
    xml_nodes(result)
    return result, {'sourceShape': shape_index, 'replacementStyle': 'existing-paragraph-first-run'}


def replace_text_match(data, key, match, selected, replacement):
    paragraph, tokens, at, source = match
    if selected == replacement:
        return data, {'paragraph': paragraph, 'replacementStyle': 'unchanged'}
    if key == 'a' and ('\n' in replacement or '\r' in replacement):
        raise ValueError('Multiline PPT replacement is unsupported; edit one paragraph at a time')
    changes, offset, inserted = [], 0, False
    for node in tokens:
        value = node['text'] if node['tag'] == qualified(key, 't') else ('\t' if node['tag'].endswith('}tab') else '\n')
        left, right = max(at, offset), min(at + len(selected), offset + len(value))
        if left < right:
            if node['tag'] != qualified(key, 't'):
                raise ValueError('Selection crosses an explicit tab or line break; select plain paragraph text')
            new = value[:left - offset] + (replacement if not inserted else '') + value[right - offset:]
            inserted = True
            opening = data[node['start']:node['openEnd']]
            if b'xml:space=' in opening:
                opening = re.sub(br'xml:space\s*=\s*([\'"])[^\'"]*\1', b'xml:space="preserve"', opening)
            else:
                opening = opening[:-1] + b' xml:space="preserve">'
            if key == 'w' and '\n' in new:
                prefix = node['qname'].split(':')[0] + ':' if ':' in node['qname'] else ''
                content = ('</' + node['qname'] + '><' + prefix + 'br/>' + opening.decode('utf-8')).join(escape(segment) for segment in new.replace('\r\n', '\n').split('\n'))
            else:
                content = escape(new)
            changes.append((node['start'], node['end'], opening + content.encode('utf-8') + ('</' + node['qname'] + '>').encode('utf-8')))
        offset += len(value)
    if not inserted:
        raise ValueError('Selection did not identify editable XML text')
    result = patch_bytes(data, changes)
    xml_nodes(result)
    return result, {'paragraph': paragraph, 'replacementStyle': 'first-selected-run'}


def load_package(data):
    archive = zipfile.ZipFile(io.BytesIO(data))
    infos = archive.infolist()
    if len(infos) > 10000 or sum(info.file_size for info in infos) > MAX_EXPANDED:
        raise ValueError('ZIP expansion exceeds editing limits')
    names, payload = set(), {}
    for info in infos:
        name = info.filename
        if name in names or name.startswith('/') or '\\' in name or '..' in name.split('/') or info.flag_bits & 1 or stat.S_ISLNK(info.external_attr >> 16):
            raise ValueError('Unsafe or duplicate ZIP entry')
        names.add(name)
        if name.lower().endswith('vbaproject.bin') or name.lower().startswith(('_xmlsignatures/', 'xl/externallinks/')):
            raise ValueError('Macros, signed packages and external workbook links are not editable')
        if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise ValueError('Unsupported ZIP compression')
        content = archive.read(info)
        if len(content) != info.file_size:
            raise ValueError('ZIP entry size mismatch')
        payload[name] = content
    return archive, infos, payload


def package_output(archive, infos, payload, changed):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as target:
        target.comment = archive.comment
        for info in infos:
            target.writestr(info, changed.get(info.filename, payload[info.filename]))
    result = out.getvalue()
    check, _, new_payload = load_package(result)
    check.close()
    if set(new_payload) != set(payload) or any(new_payload[name] != value for name, value in payload.items() if name not in changed):
        raise RuntimeError('Non-target ZIP content changed')
    for name, value in changed.items():
        if new_payload[name] != value:
            raise RuntimeError('Edited ZIP content failed readback')
    return result


def spreadsheet_edit(payload, locator, replacement, value_type):
    sheet_name, address = locator.get('sheetName'), locator.get('cellRange')
    if not isinstance(sheet_name, str) or not isinstance(address, str) or not re.fullmatch(r'[A-Z]{1,3}[1-9][0-9]{0,6}', address):
        raise ValueError('Excel requires sheetName and one A1 cellRange; ranges are unsupported')
    letters, row = re.fullmatch(r'([A-Z]+)([0-9]+)', address).groups()
    column = sum((ord(c) - 64) * 26 ** i for i, c in enumerate(reversed(letters)))
    if column > 16384 or int(row) > 1048576:
        raise ValueError('Excel cell lies outside worksheet bounds')
    book = xml_nodes(payload['xl/workbook.xml'])
    sheets = [n for n in book if n['tag'] == qualified('s', 'sheet') and n['attrs'].get('name') == sheet_name]
    if len(sheets) != 1:
        raise ValueError('Excel sheetName is missing or ambiguous')
    rel_id = sheets[0]['attrs'].get(qualified('r', 'id'))
    rels = xml_nodes(payload['xl/_rels/workbook.xml.rels'])
    rel = [n for n in rels if n['attrs'].get('Id') == rel_id]
    if len(rel) != 1 or rel[0]['attrs'].get('TargetMode') == 'External':
        raise ValueError('Unsupported worksheet relationship')
    import posixpath
    target = rel[0]['attrs'].get('Target', '')
    part = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'xl/' + target)
    if not part.startswith('xl/worksheets/') or part not in payload:
        raise ValueError('Worksheet relationship escapes its package')
    data = payload[part]
    nodes = xml_nodes(data)
    def coordinates(reference):
        match = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]*)', reference)
        if not match:
            raise ValueError('Unsupported merged/array formula reference')
        return int(match[2]), sum((ord(c) - 64) * 26 ** i for i, c in enumerate(reversed(match[1])))
    point = coordinates(address)
    for node in nodes:
        merged = node['tag'] == qualified('s', 'mergeCell')
        array = node['tag'] == qualified('s', 'f') and node['attrs'].get('t') in ('array', 'dataTable')
        reference = node['attrs'].get('ref') if merged or array else None
        if reference:
            bounds = reference.split(':')
            lower, upper = coordinates(bounds[0]), coordinates(bounds[-1])
            inside = lower[0] <= point[0] <= upper[0] and lower[1] <= point[1] <= upper[1]
            if inside and (array or address != bounds[0]):
                raise ValueError('Select the merged region anchor; array/data-table formula cells require a formula-aware editor')
    prefix = nodes[0]['qname'].split(':')[0] + ':' if ':' in nodes[0]['qname'] else ''
    if value_type == 'text':
        valid_text(replacement)
        body = '<' + prefix + 'is><' + prefix + 't xml:space="preserve">' + escape(replacement) + '</' + prefix + 't></' + prefix + 'is>'
        cell_type = 'inlineStr'
    elif value_type == 'number':
        if isinstance(replacement, bool) or not isinstance(replacement, (int, float, str)) or not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?', str(replacement)) or not math.isfinite(float(replacement)):
            raise ValueError('Explicit number replacement must be finite numeric data')
        body, cell_type = '<' + prefix + 'v>' + str(replacement) + '</' + prefix + 'v>', None
    elif value_type == 'formula':
        formula = valid_text(replacement).removeprefix('=')
        if not formula.strip() or '[' in formula or re.search(r'(?i)\b(?:WEBSERVICE|DDE)\s*\(', formula) or '|' in formula:
            raise ValueError('Formula is empty or uses unsupported external references')
        body, cell_type = '<' + prefix + 'f>' + escape(formula) + '</' + prefix + 'f>', None
    else:
        raise ValueError('valueType must be text, number or formula')
    cells = [n for n in nodes if n['tag'] == qualified('s', 'c') and n['attrs'].get('r') == address]
    if len(cells) > 1:
        raise ValueError('Duplicate worksheet cell')
    if cells:
        cell = cells[0]
        if any(n['tag'] == qualified('s', 'f') and n['attrs'].get('t') in ('shared', 'array', 'dataTable') for n in cell['children']):
            raise ValueError('Shared/array formula cells require a full formula-aware editor')
        opening = data[cell['start']:cell['openEnd']].rstrip()
        opening = re.sub(br'\s+t\s*=\s*([\'"])[^\'"]*\1', b'', opening)
        opening = opening[:-2] if opening.endswith(b'/>') else opening[:-1]
        opening += ((' t="' + cell_type + '"') if cell_type else '').encode() + b'>'
        retained = b''.join(data[n['start']:n['end']] for n in cell['children'] if n['tag'] not in (qualified('s', 'v'), qualified('s', 'f'), qualified('s', 'is')))
        new_cell = opening + body.encode() + retained + ('</' + cell['qname'] + '>').encode()
        result = patch_bytes(data, [(cell['start'], cell['end'], new_cell)])
    else:
        new_cell = ('<' + prefix + 'c r="' + address + '"' + (' t="' + cell_type + '"' if cell_type else '') + '>' + body + '</' + prefix + 'c>').encode()
        rows = [n for n in nodes if n['tag'] == qualified('s', 'row') and n['attrs'].get('r') == row]
        if len(rows) > 1:
            raise ValueError('Duplicate worksheet row')
        if rows:
            parent = rows[0]
            following = [n for n in parent['children'] if n['tag'] == qualified('s', 'c') and re.fullmatch(r'[A-Z]+[0-9]+', n['attrs'].get('r', '')) and (len(re.match(r'[A-Z]+', n['attrs']['r'])[0]), re.match(r'[A-Z]+', n['attrs']['r'])[0]) > (len(letters), letters)]
            if parent['selfClosing']:
                opening = data[parent['start']:parent['openEnd']][:-2] + b'>'
                result = patch_bytes(data, [(parent['start'], parent['end'], opening + new_cell + ('</' + parent['qname'] + '>').encode())])
            else:
                at = following[0]['start'] if following else parent['closeStart']
                result = patch_bytes(data, [(at, at, new_cell)])
        else:
            containers = [n for n in nodes if n['tag'] == qualified('s', 'sheetData')]
            if len(containers) != 1:
                raise ValueError('Unsupported sheetData container')
            parent = containers[0]
            row_xml = ('<' + prefix + 'row r="' + row + '">').encode() + new_cell + ('</' + prefix + 'row>').encode()
            if parent['selfClosing']:
                result = patch_bytes(data, [(parent['start'], parent['end'], data[parent['start']:parent['openEnd']][:-2] + b'>' + row_xml + ('</' + parent['qname'] + '>').encode())])
            else:
                later = [n for n in parent['children'] if n['tag'] == qualified('s', 'row') and int(n['attrs'].get('r', '0')) > int(row)]
                at = later[0]['start'] if later else parent['closeStart']
                result = patch_bytes(data, [(at, at, row_xml)])
    nodes = xml_nodes(result)
    if len([n for n in nodes if n['tag'] == qualified('s', 'c') and n['attrs'].get('r') == address]) != 1:
        raise RuntimeError('Edited Excel cell failed readback')
    return {part: result}, {'sheetName': sheet_name, 'cellRange': address, 'valueType': value_type}


def prepare(request):
    if not isinstance(request, dict):
        raise ValueError('Request must be an object')
    if set(request) - {'path', 'expectedSha256', 'kind', 'locator', 'selectedText', 'replacement', 'valueType'}:
        raise ValueError('Unknown edit request fields; use the documented request structure')
    source = workspace(request.get('path'))
    if source.stat().st_size > MAX_SOURCE:
        raise ValueError('Source exceeds 64 MiB editing limit')
    kind = request.get('kind')
    if KINDS.get(source.suffix.lower()) != kind:
        raise ValueError('kind must match the original docx/pptx/xlsx/md format')
    original = source.read_bytes()
    expected = request.get('expectedSha256')
    if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', expected) or sha(original) != expected.lower():
        raise ValueError('Stale source SHA-256; reload the original document before editing')
    locator = request.get('locator') or {}
    if not isinstance(locator, dict):
        raise ValueError('locator must be an object')
    replacement = request.get('replacement')
    selected = request.get('selectedText')
    if kind != 'xlsx':
        valid_text(replacement)
        if not isinstance(selected, str) or not selected or len(selected) > 1000000:
            raise ValueError('A nonempty selectedText is required')
    if kind == 'md':
        bom = original.startswith(b'\xef\xbb\xbf')
        text = original.decode('utf-8-sig')
        matches = occurrences(text, selected, locator)
        if len(matches) != 1:
            raise ValueError('Selected source text is missing or ambiguous; refresh selection/context')
        at = matches[0]
        output = (b'\xef\xbb\xbf' if bom else b'') + (text[:at] + replacement + text[at + len(selected):]).encode('utf-8')
        resolved = {'startOffset': at, 'endOffset': at + len(selected)}
    else:
        archive, infos, payload = load_package(original)
        try:
            if kind == 'xlsx':
                changes, resolved = spreadsheet_edit(payload, locator, replacement, request.get('valueType', 'text'))
            else:
                if kind == 'docx':
                    parts = ['word/document.xml']
                else:
                    slide = locator.get('slide')
                    if isinstance(slide, bool) or not isinstance(slide, int) or slide < 1:
                        raise ValueError('PPT requires a 1-based locator.slide')
                    # Presentation order can differ from physical slide filenames.
                    presentation = xml_nodes(payload['ppt/presentation.xml'])
                    ids = [n['attrs'].get(qualified('r', 'id')) for n in presentation if n['tag'] == qualified('p', 'sldId')]
                    if slide > len(ids):
                        raise ValueError('PPT slide is out of range')
                    rels = xml_nodes(payload['ppt/_rels/presentation.xml.rels'])
                    rel = [n for n in rels if n['attrs'].get('Id') == ids[slide - 1]]
                    import posixpath
                    target = rel[0]['attrs'].get('Target', '') if len(rel) == 1 else ''
                    part = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'ppt/' + target)
                    if len(rel) != 1 or rel[0]['attrs'].get('TargetMode') == 'External' or not part.startswith('ppt/slides/'):
                        raise ValueError('Unsupported PPT slide relationship')
                    parts = [part]
                candidates = []
                for part in parts:
                    if part not in payload:
                        raise ValueError('Required original XML part is missing')
                    for match in text_part_edit(payload[part], 'w' if kind == 'docx' else 'a', selected, replacement, locator):
                        candidates.append((part, match))
                if not candidates and kind == 'pptx' and '\n' in selected:
                    part = parts[0]
                    edited, resolved = ppt_shape_edit(payload[part], selected, replacement, locator)
                else:
                    if len(candidates) != 1:
                        raise ValueError('Selected source paragraph text is missing or ambiguous; select unique plain paragraph text, not DOM shape/page indices')
                    part, match = candidates[0]
                    edited, resolved = replace_text_match(payload[part], 'w' if kind == 'docx' else 'a', match, selected, replacement)
                changes = {part: edited}
                resolved['part'] = part
                if kind == 'pptx':
                    resolved['slide'] = locator['slide']
            output = original if all(payload[name] == value for name, value in changes.items()) else package_output(archive, infos, payload, changes)
        finally:
            archive.close()
    return source, original, output, resolved


def execute(request, apply=False):
    source = workspace(request.get('path'))
    # A cooperative lock is on the existing file, with no lock-file side effect.
    with source.open('rb') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        source, original, output, resolved = prepare(request)
        changed = output != original
        report = {'success': True, 'changed': changed if apply else False, 'wouldChange': changed,
                  'path': str(source), 'kind': request['kind'], 'newSHA256': sha(output),
                  'sourceSHA256': sha(original), 'backupPath': None, 'locator': resolved,
                  'applied': False}
        if request['kind'] == 'xlsx':
            report['warnings'] = ['Dependent formula caches are not recalculated by this local cell edit; use a formula-capable original-document engine to recompute.']
        if not apply or not changed:
            return report
        backup_dir = source.parent / '.eva-edit-backups'
        if backup_dir.is_symlink() or (backup_dir.exists() and not backup_dir.is_dir()):
            raise ValueError('Unsafe backup directory; original left unchanged')
        backup_dir.mkdir(mode=0o700, exist_ok=True)
        backup = backup_dir / (uuid.uuid4().hex + '-' + source.name)
        temporary = None
        try:
            with backup.open('xb') as stream:
                os.chmod(backup, 0o600)
                stream.write(original)
                stream.flush()
                os.fsync(stream.fileno())
            if sha(backup.read_bytes()) != sha(original):
                raise RuntimeError('Backup verification failed; original left unchanged')
            handle, temporary = tempfile.mkstemp(prefix='.eva-edit-', suffix=source.suffix, dir=source.parent)
            with os.fdopen(handle, 'wb') as stream:
                stream.write(output)
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary, stat.S_IMODE(source.stat().st_mode))
            if sha(Path(temporary).read_bytes()) != sha(output) or sha(source.read_bytes()) != sha(original):
                raise RuntimeError('Source changed or staged file failed validation; original left unchanged')
            os.replace(temporary, source)
            temporary = None
            report.update(changed=True, applied=True, backupPath=str(backup))
            if sha(source.read_bytes()) != sha(output):
                return dict(report, success=False, errorType='post_commit_verification', error='Source changed after atomic save; backup retained, reload before further edits')
            return report
        except Exception as error:
            if report['applied']:
                return dict(report, success=False, errorType='post_commit_verification', error=str(error))
            raise
        finally:
            if temporary is not None:
                Path(temporary).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['check', 'apply'])
    parser.add_argument('--request', required=True)
    args = parser.parse_args()
    request_path = workspace(args.request)
    if request_path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Edit request exceeds size limit')
    result = execute(json.loads(request_path.read_text(encoding='utf-8')), args.action == 'apply')
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0 if result['success'] else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'success': False, 'changed': False, 'applied': False, 'errorType': 'invalid_or_failed_edit', 'error': str(error)}, ensure_ascii=False), flush=True)
        raise SystemExit(1)
