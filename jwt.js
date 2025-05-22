const jwt = require('jsonwebtoken');

const secretKey = 'super_secret_key';
const payload = { id: 1, email: 'user@example.com', role: 'user' };

const token = jwt.sign(payload, secretKey, { algorithm: 'HS256', expiresIn: '1h' });

console.log('JWT Token:', token);

const decoded = jwt.decode(token);
console.log('Decoded Payload:', decoded);

jwt.verify(token, secretKey, (err, decoded) => {
  if (err) {
    console.error('❌ Invalid token:', err.message);
  } else {
    console.log('✅ Verified token:', decoded);
  }
});
