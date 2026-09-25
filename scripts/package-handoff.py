"""Build the complete portable review ZIP, excluding local Site identity."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import shutil

root = Path(__file__).resolve().parents[1]
archive = root / 'CHIP-RUSH-complete.zip'
paths = [root / name for name in ('.gitignore', 'README.md', 'ARNOLDAS-START-HERE.md')]
for folder in ('dist', 'qa', 'scripts'):
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file()
        and not p.is_symlink() and 'downloads' not in p.relative_to(root).parts
        and p.name != 'offline-syntax.js' and p.suffix not in ('.png', '.jpg')
        and p.name != '.DS_Store' and '__pycache__' not in p.parts)
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for source in sorted(paths):
        bundle.write(source, 'chip-rush/' + source.relative_to(root).as_posix())
    bundle.writestr('chip-rush/.openai/hosting.json', json.dumps({'static': {'directory': 'dist'}}, indent=2) + '\n')
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert json.loads(bundle.read('chip-rush/.openai/hosting.json')) == {'static': {'directory': 'dist'}}
    for source in paths:
        assert bundle.read('chip-rush/' + source.relative_to(root).as_posix()) == source.read_bytes()
    print(f'Verified {len(bundle.namelist())} handoff files ({archive.stat().st_size:,} bytes).')
(root / 'dist' / 'downloads').mkdir(exist_ok=True)
shutil.copyfile(archive, root / 'dist' / 'downloads' / archive.name)
