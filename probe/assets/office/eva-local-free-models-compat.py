#!/usr/bin/env python3
"""Version-pinned compatibility patch for the installed standalone service."""
import hashlib
import os
import pathlib
import tempfile

# Source https://github.com/Ebony-Vinyl/dsh-our-free-model, standalone 2.7.1, MIT.
ORIGINAL = '7f0d6fa748985bda19eb6536d444eea5151ac243a33f6b2883292d249867e1b6'


def patched(text):
    begin = text.index('async function responsesEndpoint(')
    end = text.index('\n}', begin) + 2
    section = text[begin:end]
    if section.count('`msg_${') != 5 or section.count('`fc_${') != 6:
        raise RuntimeError('unsupported Responses conversion layout')
    section = section.replace('`msg_${', '`msg_${id}_${').replace('`fc_${', '`fc_${id}_${')
    section = section.replace("...(outcome.text ? [{ type: 'message', role: 'assistant',", "...(outcome.text ? [{ id: `msg_${id}_0`, type: 'message', role: 'assistant',")
    section = section.replace(".map(call => ({ type: 'function_call', call_id: call.id,", ".map((call, index) => ({ id: `fc_${id}_${index}`, type: 'function_call', call_id: `fc_${id}_${index}`,")
    return text[:begin] + section + text[end:]


def apply(root):
    target = pathlib.Path(root) / 'src/forward.js'
    body = target.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    backup = pathlib.Path(root).parent / 'our-free-model-eva-data/eva-compat' / (ORIGINAL + '-forward.js')
    if digest != ORIGINAL:
        if backup.is_file() and hashlib.sha256(backup.read_bytes()).hexdigest() == ORIGINAL and body == patched(backup.read_text()).encode():
            return digest
        raise RuntimeError('standalone source changed; compatibility patch requires review')
    updated = patched(body.decode()).encode()
    backup.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        if not backup.exists():
            with tempfile.NamedTemporaryFile(dir=backup.parent, prefix='forward-backup-', delete=False) as output:
                temporary = pathlib.Path(output.name)
                output.write(body)
                output.flush()
                os.fsync(output.fileno())
            temporary.replace(backup)
            temporary = None
        if hashlib.sha256(backup.read_bytes()).hexdigest() != ORIGINAL:
            raise RuntimeError('compatibility rollback source is invalid')
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='forward-eva-compat-', delete=False) as output:
            temporary = pathlib.Path(output.name)
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        temporary.chmod(target.stat().st_mode & 0o777)
        if target.read_bytes() != body:
            raise RuntimeError('standalone source changed concurrently')
        temporary.replace(target)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return hashlib.sha256(updated).hexdigest()
