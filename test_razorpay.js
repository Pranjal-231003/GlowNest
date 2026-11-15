// Razorpay Integration Test Suite for GlowNest
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Pure Node .env loader
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
} catch (_) {}

const createOrderHandler = require('./api/create-order');
const verifyPaymentHandler = require('./api/verify-payment');

// Simple test server to mount the handlers exactly as Vercel does
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/create-order') {
    return createOrderHandler(req, res);
  }
  if (url === '/api/verify-payment') {
    return verifyPaymentHandler(req, res);
  }
  res.writeHead(404);
  res.end('Not Found');
});

async function runTests() {
  await new Promise((resolve) => server.listen(3456, '127.0.0.1', resolve));
  console.log('[TEST SERVER] Listening on http://127.0.0.1:3456');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  async function post(endpoint, data) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const req = http.request(
        `http://127.0.0.1:3456${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(body) });
            } catch (e) {
              resolve({ status: res.statusCode, raw: body });
            }
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  console.log('\n--- TEST SUITE 1: POST /api/create-order ---');

  // Test 1.1: Reject amount < 100 paise
  const res1 = await post('/api/create-order', { amount: 50 });
  assert(res1.status === 400, 'Rejects amount < 100 paise with HTTP 400');
  assert(res1.body?.error && res1.body.error.includes('100 paise'), 'Returns informative error about 100 paise minimum');

  // Test 1.2: Valid order creation calling Razorpay live API
  console.log('  Calling Razorpay API with test credentials...');
  const res2 = await post('/api/create-order', {
    amount: 35000, // 350 INR
    currency: 'INR',
    receipt: 'test_rcpt_' + Date.now()
  });

  assert(res2.status === 200, 'Creates order successfully with HTTP 200');
  assert(res2.body?.order_id && res2.body.order_id.startsWith('order_'), `Returns valid Razorpay order_id (${res2.body?.order_id})`);
  assert(res2.body?.amount === 35000, `Returns matching amount: ${res2.body?.amount} paise`);
  assert(res2.body?.currency === 'INR', 'Returns currency INR');

  const createdOrderId = res2.body?.order_id;

  console.log('\n--- TEST SUITE 2: POST /api/verify-payment ---');

  // Test 2.1: Missing required fields
  const res3 = await post('/api/verify-payment', {
    order_id: createdOrderId
  });
  assert(res3.status === 400, 'Rejects missing payment fields with HTTP 400');
  assert(res3.body?.success === false, 'Returns success: false for missing fields');

  // Test 2.2: Tampered signature rejection
  const fakePaymentId = 'pay_fake_' + Math.random().toString(36).slice(2, 10);
  const fakeSignature = 'bad_sig_0000000000000000000000000000000000000000000000000000000000000000';
  const res4 = await post('/api/verify-payment', {
    order_id: createdOrderId,
    payment_id: fakePaymentId,
    razorpay_signature: fakeSignature
  });
  assert(res4.status === 400, 'Rejects invalid signature with HTTP 400');
  assert(res4.body?.success === false, 'Returns success: false on signature mismatch');

  // Test 2.3: Valid HMAC-SHA256 signature verification
  const validPaymentId = 'pay_test_' + Date.now();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${createdOrderId}|${validPaymentId}`)
    .digest('hex');

  const res5 = await post('/api/verify-payment', {
    order_id: createdOrderId,
    payment_id: validPaymentId,
    razorpay_signature: expectedSig
  });
  assert(res5.status === 200, 'Valid signature verified with HTTP 200');
  assert(res5.body?.success === true, 'Returns success: true for verified payment');
  assert(res5.body?.order_id === createdOrderId, 'Returns matching order_id');

  console.log('\n--- TEST SUITE 3: SECURITY & CREDENTIAL ISOLATION ---');
  const fs = require('fs');
  const configContent = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf-8');
  const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
  const checkoutHtmlContent = fs.readFileSync(path.join(__dirname, 'checkout.html'), 'utf-8');
  const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8');

  assert(!configContent.includes(secret), 'RAZORPAY_KEY_SECRET is NOT leaked in config.js');
  assert(!appJsContent.includes(secret), 'RAZORPAY_KEY_SECRET is NOT leaked in app.js');
  assert(!checkoutHtmlContent.includes(secret), 'RAZORPAY_KEY_SECRET is NOT leaked in checkout.html');
  assert(gitignoreContent.includes('.env'), '.env is strictly gitignored');

  server.close();
  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  server.close();
  process.exit(1);
});
