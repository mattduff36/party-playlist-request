const http = require('http');

// Test data from database
const testData = {
  username: 'testuser',
  pin: '7794'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/events/verify-pin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing PIN verification endpoint...\n');
console.log('Request:', testData);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response Body:', data);
    
    try {
      const json = JSON.parse(data);
      console.log('\nParsed Response:', JSON.stringify(json, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ PIN verification PASSED!');
      } else {
        console.log('\n❌ PIN verification FAILED!');
      }
    } catch (e) {
      console.log('\n❌ Invalid JSON response');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(postData);
req.end();

