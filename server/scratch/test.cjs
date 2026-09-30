const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 8080,
  path: '/api/permissions/users/6aba85d3d82a879d918c35d3/effective?propertyId=default',
  method: 'GET'
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
req.on('error', e => console.error(e));
req.end();
