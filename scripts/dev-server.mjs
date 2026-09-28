import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetsRoot = path.join(root, 'dist');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.zip': 'application/zip', '.glb': 'model/gltf-binary',
};
const textResponse = (message, status, headers = {}) => new Response(message, {
  status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

/** Minimal D1 surface used by the production Worker, backed by persistent SQLite. */
export function createD1Adapter(database) {
  class Statement {
    constructor(sql, parameters = []) { this.sql = sql; this.parameters = parameters; }
    bind(...parameters) { return new Statement(this.sql, parameters); }
    execute(mode) {
      const start = performance.now();
      const prepared = database.prepare(this.sql);
      if (mode === 'first') return prepared.get(...this.parameters) ?? null;
      const returnsRows = mode !== 'run' && prepared.columns().length > 0;
      const value = returnsRows ? prepared.all(...this.parameters) : prepared.run(...this.parameters);
      return {
        success: true,
        results: returnsRows ? value : [],
        meta: {
          duration: performance.now() - start,
          changes: returnsRows ? 0 : Number(value.changes),
          last_row_id: returnsRows ? 0 : Number(value.lastInsertRowid),
        },
      };
    }
    async first(column) {
      const row = this.execute('first');
      return column === undefined ? row : row?.[column] ?? null;
    }
    async all() { return this.execute('all'); }
    async run() { return this.execute('run'); }
  }
  return {
    prepare(sql) { return new Statement(sql); },
    async batch(statements) {
      if (!Array.isArray(statements) || statements.some(statement => !(statement instanceof Statement))) {
        throw new TypeError('DB.batch expects statements prepared by this database.');
      }
      database.exec('BEGIN IMMEDIATE');
      try {
        // Synchronous execution keeps other requests outside this transaction.
        const results = statements.map(statement => statement.execute('all'));
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export async function applyMigrations(database, directory = path.join(root, 'drizzle')) {
  database.exec('CREATE TABLE IF NOT EXISTS __chip_local_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  let names;
  try { names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn('No drizzle/ migrations found. Generate them before using the community board.');
    return 0;
  }
  let applied = 0;
  for (const name of names) {
    const sql = await readFile(path.join(directory, name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const previous = database.prepare('SELECT hash FROM __chip_local_migrations WHERE name=?').get(name);
    if (previous) {
      if (previous.hash !== hash) throw new Error(`Migration ${name} changed after being applied. Add a new migration to preserve local data.`);
      continue;
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of sql.split(/-->\s*statement-breakpoint\s*/)) if (statement.trim()) database.exec(statement);
      database.prepare('INSERT INTO __chip_local_migrations(name,hash,applied_at) VALUES(?,?,?)').run(name, hash, Date.now());
      database.exec('COMMIT');
      applied++;
      console.log(`Applied migration ${name}`);
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return applied;
}

function safeAssetPath(rawPath) {
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some(segment => segment.startsWith('.') || ['server', 'client'].includes(segment.toLowerCase()))) return null;
  return segments;
}

export function createAssets(directory = assetsRoot) {
  return {
    async fetch(request) {
      if (!['GET', 'HEAD'].includes(request.method)) return textResponse('Method not allowed.', 405, { allow: 'GET, HEAD' });
      const segments = safeAssetPath(new URL(request.url).pathname);
      if (!segments) return textResponse('Forbidden.', 403);
      const requested = path.join(directory, ...(segments.length ? segments : ['index.html']));
      try {
        // Realpath prevents a symlink in the public tree from exposing private files.
        const [base, resolved] = await Promise.all([realpath(directory), realpath(requested)]);
        const relative = path.relative(base, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !safeAssetPath('/' + relative.split(path.sep).join('/'))) return textResponse('Forbidden.', 403);
        const info = await stat(resolved);
        if (!info.isFile()) return textResponse('Not found.', 404);
        const headers = {
          'content-type': mimeTypes[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
          'content-length': String(info.size), 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        };
        return new Response(request.method === 'HEAD' ? null : await readFile(resolved), { headers });
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return textResponse('Not found.', 404);
        throw error;
      }
    },
  };
}

async function main() {
  const port = Number(process.env.PORT ?? 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  await mkdir(path.join(root, '.local'), { recursive: true });
  const database = new DatabaseSync(path.join(root, '.local', 'board.sqlite'));
  database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  try { await applyMigrations(database); } catch (error) { database.close(); throw error; }
  const { default: worker } = await import(pathToFileURL(path.join(root, 'server', 'worker.js')).href);
  const env = { DB: createD1Adapter(database), ASSETS: createAssets() };
  const server = createServer(async (incoming, outgoing) => {
    const abort = new AbortController();
    incoming.once('aborted', () => abort.abort());
    outgoing.once('close', () => { if (!outgoing.writableEnded) abort.abort(); });
    try {
      const target = incoming.url || '/';
      // Check the raw request target before WHATWG URL normalization removes ../.
      if (!target.startsWith('/') || target.startsWith('//') || !safeAssetPath(target.split(/[?#]/, 1)[0])) {
        outgoing.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        outgoing.end('Forbidden.');
        return;
      }
      const origin = new URL(`http://${incoming.headers.host || `127.0.0.1:${port}`}`);
      if (!['127.0.0.1', 'localhost'].includes(origin.hostname) || Number(origin.port || 80) !== port) {
        outgoing.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        outgoing.end('Use the localhost address printed by this server.');
        return;
      }
      const method = incoming.method || 'GET';
      const headers = new Headers();
      for (let index = 0; index < incoming.rawHeaders.length; index += 2) headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
      const request = new Request(new URL(target, origin), {
        method, headers, signal: abort.signal,
        ...(['GET', 'HEAD'].includes(method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
      });
      const response = await worker.fetch(request, env);
      outgoing.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') outgoing.setHeader(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader('set-cookie', cookies);
      if (method === 'HEAD' || !response.body) { await response.body?.cancel(); outgoing.end(); }
      else await pipeline(Readable.fromWeb(response.body), outgoing);
    } catch (error) {
      if (abort.signal.aborted) return;
      console.error('Local request failed:', error.message);
      if (outgoing.headersSent) { outgoing.destroy(); return; }
      outgoing.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      outgoing.end('The local server could not complete this request.');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`CHIP RUSH: http://127.0.0.1:${port}/`);
  console.log('Local community board: .local/board.sqlite (preserved between restarts)');
  console.log('Press Ctrl+C to stop.');
  let stopping = false;
  function stop() {
    if (stopping) return;
    stopping = true;
    server.close(() => { database.close(); process.exitCode = 0; });
    server.closeIdleConnections();
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
