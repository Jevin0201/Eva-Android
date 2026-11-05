"""Directory ownership contract only; this is not a rendering engine test."""
import pathlib, runpy, tempfile

module = runpy.run_path('probe/assets/office/eva-render.py', run_name='preview_contract')
render = module['render']
base = pathlib.Path('artifacts/office-preview-contract')
base.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(dir=base) as temporary:
    root = pathlib.Path(temporary).resolve()
    render.__globals__['ROOT'] = root
    render.__globals__['check_cancel'] = lambda: None
    source = root / 'source.txt'
    source.write_text('Not a renderable document', encoding='utf-8')
    before = source.read_bytes()
    destination = root / '.eva-previews' / 'unique-job'
    destination.parent.mkdir(parents=True)
    assert not destination.exists()
    try:
        render(source, destination)
        raise AssertionError('Unsupported source must not report rendering success')
    except ValueError as error:
        assert 'OpenDocument' in str(error), str(error)
    assert destination.is_dir(), 'Renderer owns creation of job directory'
    assert not list(destination.glob('*.pdf'))
    assert source.read_bytes() == before
    try:
        render(source, destination)
        raise AssertionError('Existing destination must be rejected')
    except FileExistsError:
        pass
print('PASS renderer creates new job directory; existing directory rejected; unsupported input is failure, source preserved')
