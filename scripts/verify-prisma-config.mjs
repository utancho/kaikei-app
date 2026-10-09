import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { deepmerge } from 'deepmerge-ts';

const require = createRequire(import.meta.url);
const { loadConfigFromFile } = require('../server/node_modules/@prisma/config');
const directory = await mkdtemp(join(tmpdir(), 'keirio-prisma-config-'));
try {
  assert.deepEqual(deepmerge({ nested: { first: 1 } }, { nested: { second: 2 } }), { nested: { first: 1, second: 2 } });
  const recursive = { value: 1 };
  recursive.self = recursive;
  const merged = deepmerge(recursive, recursive);
  assert.equal(merged.value, 1);
  await writeFile(join(directory, 'prisma.config.mjs'), `export default ${JSON.stringify({ schema: resolve('server/prisma/schema.prisma'), migrations: { path: resolve('server/migrations') } })};\n`);
  const result = await loadConfigFromFile({ configRoot: directory, configFile: 'prisma.config.mjs' });
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  assert.equal(result.config.schema, resolve('server/prisma/schema.prisma'));
  assert.equal(result.config.migrations.path, resolve('server/migrations'));
  console.log('Prisma config load + deepmerge nested/recursive graph compatibility: PASS');
} finally {
  await rm(directory, { recursive: true, force: true });
}
