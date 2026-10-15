import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOrder, recordOrder, saveProofLocally } from './lib/orders.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function send(res, status, payload, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(payload) : payload);
}
async function readBody(req, limit = 32000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true });
  if (req.method === 'POST' && pathname === '/api/orders') {
    let data;
    try { data = await readBody(req, 2_500_000); } catch (error) {
      return send(res, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { recorded: false, message: 'Data pesanan tidak dapat dibaca. Silakan coba lagi.' });
    }
    const order = validateOrder(data);
    if (!order) return send(res, 400, { recorded: false, message: 'Lengkapi nama pemesan, pilihan aroma, konfirmasi pembayaran, dan foto bukti pembayaran yang valid.' });
    const result = await recordOrder(order);
    if (!result.recorded) result.proofSaved = await saveProofLocally(order);
    return send(res, result.status || 200, result);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
  let relative;
  try { relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname); } catch { return send(res, 400, 'Bad request', 'text/plain; charset=utf-8'); }
  const target = path.resolve(publicRoot, `.${relative}`);
  if (!target.startsWith(publicRoot + path.sep)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  try {
    const content = await readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    return res.end(content);
  } catch { return send(res, 404, 'Not found', 'text/plain; charset=utf-8'); }
});
server.listen(port, '0.0.0.0', () => console.log(`FRESÈ listening on 0.0.0.0:${port}`));
