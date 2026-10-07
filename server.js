// Minimal demo server for the GPG site replica: serves static pages, a REST API and a SOAP API (soap.js).
// No dependencies, so the test suite runs anywhere Node.js is installed.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleSoap } = require('./soap');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'demo-site');

const services = [
  { id: 'signature', name: 'GPG Signature Facial', durationMin: 90, price: 115 },
  { id: 'signature-led', name: 'Signature Facial + LED Light Therapy', durationMin: 105, price: 140 },
  { id: 'teen-glow', name: 'Teen Glow Facial', durationMin: 60, price: 75 },
];

const products = [
  { id: 'soap', name: 'Exfoliating Soap Bar', price: 10, thumb: 'soap' },
  { id: 'brush', name: 'Dry Brushing Set', price: 18, thumb: 'brush' },
  { id: 'honey-mask', name: 'Raw Honey Face Mask', price: 22, thumb: 'honey' },
];

const OPENING_HOURS = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const bookings = new Map(); // key: `${date} ${time}`

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isSunday = (s) => new Date(`${s}T12:00:00Z`).getUTCDay() === 0;
const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function availableSlots(date) {
  if (isSunday(date)) return [];
  return OPENING_HOURS.filter((t) => !bookings.has(`${date} ${t}`));
}

function validateBooking(b) {
  const errors = [];
  if (!services.some((s) => s.id === b.serviceId)) errors.push('serviceId');
  if (!isValidDate(b.date)) errors.push('date');
  if (!OPENING_HOURS.includes(b.time)) errors.push('time');
  if (!b.name || !String(b.name).trim()) errors.push('name');
  if (!isEmail(b.email)) errors.push('email');
  return errors;
}

// Returns { booking } or { error, status } for business-rule failures.
function createBooking(b) {
  if (isSunday(b.date)) return { error: 'Closed on Sundays', status: 422 };
  const key = `${b.date} ${b.time}`;
  if (bookings.has(key)) return { error: 'Slot already booked', status: 409 };
  const booking = { id: `BK-${bookings.size + 1000}`, ...b };
  bookings.set(key, booking);
  return { booking };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); }
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/services') return sendJson(res, 200, services);
  if (req.method === 'GET' && url.pathname === '/api/products') return sendJson(res, 200, products);

  if (req.method === 'GET' && url.pathname === '/api/slots') {
    const date = url.searchParams.get('date');
    if (!isValidDate(date)) return sendJson(res, 400, { error: 'Invalid or missing date (YYYY-MM-DD)' });
    return sendJson(res, 200, { date, slots: availableSlots(date) });
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    const b = await readBody(req);
    if (!b) return sendJson(res, 400, { errors: ['Malformed JSON'] });
    const errors = validateBooking(b);
    if (errors.length) return sendJson(res, 400, { errors });
    const result = createBooking(b);
    if (result.error) return sendJson(res, result.status, { error: result.error });
    return sendJson(res, 201, result.booking);
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    const b = await readBody(req);
    const errors = [];
    if (!b || !b.name || !String(b.name).trim()) errors.push('name');
    if (!b || !isEmail(b.email)) errors.push('email');
    if (!b || !b.message || String(b.message).trim().length < 10) errors.push('message');
    if (errors.length) return sendJson(res, 400, { errors });
    return sendJson(res, 200, { status: 'received' });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/soap/booking') {
    return handleSoap(req, res, url, { services, isValidDate, availableSlots, validateBooking, createBooking });
  }

  const file = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>404 - Page not found</h1>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`GPG demo site running at http://localhost:${PORT}`));
