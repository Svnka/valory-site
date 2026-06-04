const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'valory123';

const dataDir = path.join(__dirname, 'data');
const productsFile = path.join(dataDir, 'products.json');
const ordersFile = path.join(dataDir, 'orders.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}
function requireAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Mot de passe admin incorrect' });
  next();
}
function cleanProduct(p) {
  return {
    id: Number(p.id),
    name: String(p.name || '').trim(),
    collection: String(p.collection || '').trim(),
    price: Number(p.price || 0),
    stock: Number(p.stock || 0),
    movement: String(p.movement || '').trim(),
    case_size: String(p.case_size || '').trim(),
    material: String(p.material || '').trim(),
    description: String(p.description || '').trim(),
    image: String(p.image || '').trim(),
    accent: String(p.accent || '#c9a35c').trim(),
    reference: String(p.reference || '').trim()
  };
}

app.get('/api/products', async (req, res) => {
  res.json(await readJson(productsFile, []));
});

app.post('/api/orders', async (req, res) => {
  const products = await readJson(productsFile, []);
  const orders = await readJson(ordersFile, []);
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!body.customer_name || !body.email || !body.address || !body.city || !items.length) {
    return res.status(400).json({ error: 'Informations de commande incomplètes' });
  }
  const orderItems = [];
  let total = 0;
  for (const item of items) {
    const product = products.find(p => Number(p.id) === Number(item.id));
    const qty = Math.max(1, Number(item.qty || 1));
    if (!product) return res.status(400).json({ error: 'Produit introuvable' });
    if (product.stock < qty) return res.status(400).json({ error: `Stock insuffisant pour ${product.name}` });
    total += product.price * qty;
    orderItems.push({ id: product.id, name: product.name, price: product.price, qty });
  }
  for (const item of orderItems) {
    const product = products.find(p => Number(p.id) === Number(item.id));
    product.stock -= item.qty;
  }
  const order = {
    id: 'VAL-' + Date.now(),
    created_at: new Date().toISOString(),
    status: 'nouvelle',
    customer_name: String(body.customer_name).trim(),
    email: String(body.email).trim(),
    phone: String(body.phone || '').trim(),
    address: String(body.address).trim(),
    zip: String(body.zip || '').trim(),
    city: String(body.city).trim(),
    country: String(body.country || '').trim(),
    items: orderItems,
    total
  };
  orders.unshift(order);
  await writeJson(productsFile, products);
  await writeJson(ordersFile, orders);
  res.status(201).json({ orderId: order.id, total: order.total });
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  res.json(await readJson(ordersFile, []));
});
app.get('/api/admin/products', requireAdmin, async (req, res) => {
  res.json(await readJson(productsFile, []));
});
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const products = await readJson(productsFile, []);
  const product = cleanProduct(req.body || {});
  if (!product.name || product.price <= 0) return res.status(400).json({ error: 'Nom et prix obligatoires' });
  product.id = products.length ? Math.max(...products.map(p => Number(p.id) || 0)) + 1 : 1;
  products.push(product);
  await writeJson(productsFile, products);
  res.status(201).json(product);
});
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const products = await readJson(productsFile, []);
  const idx = products.findIndex(p => Number(p.id) === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Produit introuvable' });
  const product = cleanProduct({ ...products[idx], ...req.body, id: Number(req.params.id) });
  products[idx] = product;
  await writeJson(productsFile, products);
  res.json(product);
});
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const products = await readJson(productsFile, []);
  const next = products.filter(p => Number(p.id) !== Number(req.params.id));
  await writeJson(productsFile, next);
  res.json({ ok: true });
});
app.put('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const orders = await readJson(ordersFile, []);
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  order.status = String(req.body.status || order.status);
  await writeJson(ordersFile, orders);
  res.json(order);
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: req.body.productName || 'Produit Valory',
          },
          unit_amount: Number(req.body.amount) * 100,
        },
        quantity: 1,
      }],
      success_url: 'https://valory-site-hnxz.onrender.com/success.html',
      cancel_url: 'https://valory-site-hnxz.onrender.com/cancel.html',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.listen(PORT, () => console.log(`VALORY lancé sur http://localhost:${PORT}`));
