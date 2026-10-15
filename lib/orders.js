import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const products = { jasmine: { name: 'Jasmine', unitPrice: 17000 }, coffee: { name: 'Kopi', unitPrice: 20000 } };

function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function validateOrder(data) {
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
export async function saveProofLocally(order) {
  if (process.env.VERCEL) return false;
  try {
    await mkdir(path.join(root, 'uploads'), { recursive: true });
    await writeFile(path.join(root, 'uploads', `${order.orderId}.jpg`), Buffer.from(order.proof.data, 'base64'));
    return true;
  } catch { return false; }
}
export async function recordOrder(order) {
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

