const http = require('http');
require('dotenv').config({ path: './.env' });

async function loginAndFetch() {
  // 1. Login
  const loginData = JSON.stringify({ email: 'admin@yeshotels.com', password: 'Admin@123' });
  const loginReq = http.request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Login Response:', res.statusCode, body);
      const parsed = JSON.parse(body);
      if (!parsed.success) return;
      
      const token = parsed.data.token;
      const userId = parsed.data.id;
      
      // 2. Fetch Effective Permissions
      const permReq = http.request({
        hostname: 'localhost',
        port: 8080,
        path: `/api/permissions/users/${userId}/effective?propertyId=default`,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }, permRes => {
        let permBody = '';
        permRes.on('data', chunk => permBody += chunk);
        permRes.on('end', () => {
          console.log('Perm Response:', permRes.statusCode, permBody);
        });
      });
      permReq.end();
    });
  });
  
  loginReq.write(loginData);
  loginReq.end();
}

loginAndFetch();
