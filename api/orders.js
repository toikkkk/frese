import { validateOrder, recordOrder } from '../lib/orders.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ recorded: false, message: 'Data pesanan tidak dapat dibaca. Silakan coba lagi.' });
  }
  const order = validateOrder(data);
  if (!order) return res.status(400).json({ recorded: false, message: 'Lengkapi nama pemesan, pilihan aroma, konfirmasi pembayaran, dan foto bukti pembayaran yang valid.' });
  const result = await recordOrder(order);
  return res.status(result.status || 200).json(result);
}
