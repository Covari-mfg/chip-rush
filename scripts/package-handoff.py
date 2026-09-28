"""Build the complete portable review ZIP, excluding local Site identity."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import shutil

root = Path(__file__).resolve().parents[1]
archive = root / 'CHIP-RUSH-complete.zip'
paths = [root / name for name in ('.gitignore', 'README.md', 'ARNOLDAS-START-HERE.md', 'CONTRIBUTING.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'drizzle.config.ts')]
for folder in ('dist', 'qa', 'scripts', 'db', 'drizzle', 'server'):
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file()
        and not p.is_symlink() and 'downloads' not in p.relative_to(root).parts
        and not (folder == 'dist' and p.relative_to(root / folder).parts[0] in ('client', 'server', '.openai'))
        and p.name != 'offline-syntax.js' and not (folder == 'qa' and p.suffix in ('.png', '.jpg'))
        and p.name != '.DS_Store' and '__pycache__' not in p.parts)
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for source in sorted(paths):
        bundle.write(source, 'chip-rush/' + source.relative_to(root).as_posix())
    bundle.writestr('chip-rush/.openai/hosting.json', json.dumps({'d1': 'DB', 'r2': None}, indent=2) + '\n')
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert json.loads(bundle.read('chip-rush/.openai/hosting.json')) == {'d1': 'DB', 'r2': None}
    for source in paths:
        assert bundle.read('chip-rush/' + source.relative_to(root).as_posix()) == source.read_bytes()
    print(f'Verified {len(bundle.namelist())} handoff files ({archive.stat().st_size:,} bytes).')
(root / 'dist' / 'downloads').mkdir(exist_ok=True)
shutil.copyfile(archive, root / 'dist' / 'downloads' / archive.name)
