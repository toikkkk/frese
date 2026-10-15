import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const products = { jasmine: { name: 'Jasmine', unitPrice: 17000 }, coffee: { name: 'Kopi', unitPrice: 20000 } };

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
function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validateOrder(data) {
  if (!data || typeof data !== 'object' || !data.customer || !Array.isArray(data.items) || data.items.length < 1 || data.items.length > Object.keys(products).length) return null;
  const customer = { name: clean(data.customer.name, 80) };
  if (!customer.name) return null;
  if (data.payment?.method !== 'qris' || data.payment?.confirmed !== true) return null;
  const items = [];
  const seen = new Set();
  for (const item of data.items) {
    const product = products[item?.id];
    const quantity = Number(item?.quantity);
    if (!product || seen.has(item.id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return null;
    seen.add(item.id);
    items.push({ id: item.id, name: product.name, quantity, unitPrice: product.unitPrice, subtotal: product.unitPrice * quantity });
  }
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (Number(data.total) !== total) return null;
  const proof = data.proof;
  if (!proof || proof.mimeType !== 'image/jpeg' || typeof proof.data !== 'string' || proof.data.length < 100 || proof.data.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(proof.data) || !proof.data.startsWith('/9j/')) return null;
  return {
    proof: { mimeType: 'image/jpeg', data: proof.data },
    orderId: `FR-${randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), currency: 'IDR', customer, items, total,
    payment: { method: 'QRIS', status: 'Sudah dibayar (konfirmasi pelanggan)' },
  };
}
async function saveProofLocally(order) {
  try {
    await mkdir(path.join(root, 'uploads'), { recursive: true });
    await writeFile(path.join(root, 'uploads', `${order.orderId}.jpg`), Buffer.from(order.proof.data, 'base64'));
    return true;
  } catch { return false; }
}
async function recordOrder(order) {
  const base = { recorded: false, orderId: order.orderId };
  const endpoint = process.env.GOOGLE_SHEETS_WEB_APP_URL;
  const token = process.env.GOOGLE_SHEETS_ORDER_TOKEN;
  if (!endpoint || !token) return { ...base, status: 503, message: 'Integrasi spreadsheet belum dihubungkan. Data belum tercatat.' };
  let parsed;
  try { parsed = new URL(endpoint); } catch { return { ...base, status: 503, message: 'Alamat pencatatan spreadsheet belum valid. Data belum tercatat.' }; }
  if (parsed.protocol !== 'https:' || !['script.google.com', 'script.googleusercontent.com'].includes(parsed.hostname)) {
    return { ...base, status: 503, message: 'Alamat pencatatan spreadsheet belum valid. Data belum tercatat.' };
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...order, token }), signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.recorded === true) return { recorded: true, orderId: order.orderId };
    return { ...base, status: 502, message: 'Spreadsheet belum mengonfirmasi pencatatan. Data belum tercatat.' };
  } catch {
    return { ...base, status: 502, message: 'Pencatatan spreadsheet tidak berhasil dihubungi. Data belum tercatat.' };
  }
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
server.listen(port, '0.0.0.0', () => console.log(`FRESE listening on 0.0.0.0:${port}`));
