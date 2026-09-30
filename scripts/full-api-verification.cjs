const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: '60c72b2f9b1d8e001c8e4b8f', role: 'ADMIN', propertyId: '60c72b2f9b1d8e001c8e4b8a' },
  'insecure-development-only-default-secret',
  { expiresIn: '1h' }
);

const endpoints = [
  { method: 'GET', path: '/api/rooms' },
  { method: 'GET', path: '/api/reports/monthly-mis' },
  { method: 'GET', path: '/api/bookings' },
  { method: 'GET', path: '/api/reports/daily-sales' }
];

async function verify() {
  console.log("=== API VERIFICATION START ===");
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 8080,
        path: ep.path,
        method: ep.method,
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const status = res.statusCode >= 200 && res.statusCode < 300 ? 'VERIFIED' : 'FAILED';
          console.log(`[${status}] ${ep.method} ${ep.path} -> ${res.statusCode}`);
          resolve();
        });
      });
      req.on('error', (e) => {
        console.log(`[FAILED] ${ep.method} ${ep.path} -> ${e.message}`);
        resolve();
      });
      req.end();
    });
  }
  console.log("=== API VERIFICATION END ===");
  process.exit(0);
}

verify();
