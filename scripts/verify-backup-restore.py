"""Verify a local D1 SQL export in an isolated SQLite database. Never uses remote D1."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
from contextlib import closing
import re


def manifest(connection):
    result = {}
    # Wrangler intentionally omits Cloudflare's implementation metadata table.
    tables = connection.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_METADATA' ORDER BY name").fetchall()
    for (table,) in tables:
        escaped = '"' + table.replace('"', '""') + '"'
        rows = connection.execute(f'SELECT * FROM {escaped}').fetchall()
        normalized = []
        for row in rows:
            normalized.append(json.dumps([{'blob': base64.b64encode(v).decode()} if isinstance(v, bytes) else v for v in row], ensure_ascii=False, separators=(',', ':')))
        normalized.sort()
        digest = hashlib.sha256('\n'.join(normalized).encode()).hexdigest()
        result[table] = {'rows': len(rows), 'sha256': digest}
    return result


def verify(source, sql, restored):
    # Source opens read-only; snapshot creation below includes committed WAL data.
    with closing(sqlite3.connect(f'{source.as_uri()}?mode=ro', uri=True)) as original:
        expected = manifest(original)
    with closing(sqlite3.connect(restored)) as target:
        target.executescript(sql.read_text(encoding='utf-8-sig'))
        target.commit()
    # A separate connection verifies persistence after close/reopen.
    with closing(sqlite3.connect(restored)) as target:
        actual = manifest(target)
        integrity = target.execute('PRAGMA integrity_check').fetchone()[0]
        foreign_keys = target.execute('PRAGMA foreign_key_check').fetchall()
    if expected != actual:
        differences = [table for table in sorted(set(expected) | set(actual)) if expected.get(table) != actual.get(table)]
        raise RuntimeError(f'Restored table/count/digest mismatch: {differences}')
    if integrity != 'ok' or foreign_keys:
        raise RuntimeError(f'Restored integrity failure: {integrity}; foreign key violations: {len(foreign_keys)}')
    return {'ok': True, 'scope': 'local-only', 'tableCount': len(actual), 'totalRows': sum(table['rows'] for table in actual.values()), 'tables': actual, 'integrity': integrity, 'reopened': True, 'excludedInternalTables': ['sqlite_*', '_cf_METADATA']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--persist-to', default='.qa-app-db')
    parser.add_argument('--database', default='kaikei-db')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='keirio-local-restore-') as temporary:
        directory = Path(temporary)
        sql = directory / 'export.sql'
        restored = directory / 'restored.sqlite'
        if args.self_test:
            source = directory / 'source.sqlite'
            with closing(sqlite3.connect(source)) as fixture:
                fixture.executescript('CREATE TABLE business(id TEXT PRIMARY KEY); CREATE TABLE evidence(id TEXT, businessId TEXT REFERENCES business(id), bytes BLOB); INSERT INTO business VALUES (\'test\');')
                fixture.execute('INSERT INTO evidence VALUES (?, ?, ?)', ('original', 'test', bytes([0, 255, 10, 13])))
                fixture.commit()
                sql.write_text('\n'.join(fixture.iterdump()), encoding='utf-8')
        else:
            persist = Path(args.persist_to).resolve()
            sources = [p for p in (persist / 'v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name != 'metadata.sqlite']
            if len(sources) != 1:
                raise RuntimeError('Expected exactly one local D1 database; use a dedicated QA persistence directory.')
            original = sources[0]
            snapshot_dir = directory / '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
            snapshot_dir.mkdir(parents=True)
            source = snapshot_dir / original.name
            with closing(sqlite3.connect(f'{original.as_uri()}?mode=ro', uri=True)) as live:
                with closing(sqlite3.connect(source)) as snapshot:
                    live.backup(snapshot)
            # Wrangler export lacks --persist-to. A temporary config makes its
            # default state directory point at our isolated SQLite snapshot.
            config_text = Path('wrangler.toml').read_text(encoding='utf-8')
            database_id = re.search(r'^database_id\s*=\s*"([^"]+)"', config_text, re.MULTILINE)
            if not database_id:
                raise RuntimeError('Cannot determine configured D1 database ID.')
            config = directory / 'wrangler.json'
            config.write_text(json.dumps({'name': 'keirio-restore-check', 'compatibility_date': '2026-08-01', 'd1_databases': [{'binding': 'DB', 'database_name': args.database, 'database_id': database_id.group(1)}]}), encoding='utf-8')
            # Export command is explicitly local. No remote or restore command exists.
            command = ['npx.cmd', '--no-install', 'wrangler', 'd1', 'export', args.database, '--local', '--config', str(config), '--output', str(sql)]
            subprocess.run(command, check=True)
        result = verify(source.resolve(), sql, restored)
        if args.self_test:
            tampered_sql = directory / 'tampered.sql'
            tampered_sql.write_text(sql.read_text(encoding='utf-8') + "\nUPDATE evidence SET bytes = X'01';", encoding='utf-8')
            try:
                verify(source.resolve(), tampered_sql, directory / 'tampered.sqlite')
            except RuntimeError as error:
                if 'digest mismatch' not in str(error):
                    raise
                result['tamperedBytesRejected'] = True
            else:
                raise RuntimeError('Self-test failed: altered evidence bytes were accepted')
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
