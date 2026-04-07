const http = require('http');

// Test backend
const testBackend = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 3000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('✅ Backend OK');
      console.log('Response:', data);
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.log('❌ Backend Error:', err.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.log('❌ Backend Timeout - port 3000 not responding');
    process.exit(1);
  });

  req.end();
};

// Test frontend
const testFrontend = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/',
    method: 'GET',
    timeout: 3000
  };

  const req = http.request(options, (res) => {
    console.log('✅ Frontend OK (status: ' + res.statusCode + ')');
    process.exit(0);
  });

  req.on('error', (err) => {
    console.log('❌ Frontend Error:', err.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.log('❌ Frontend Timeout - port 3001 not responding');
    process.exit(1);
  });

  req.end();
};

console.log('Testing servers...\n');

if (process.argv[2] === 'backend') {
  testBackend();
} else if (process.argv[2] === 'frontend') {
  testFrontend();
} else {
  console.log('Usage: node test.js [backend|frontend]');
}
