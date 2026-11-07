// direct login probe against the backend
const res = await fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'juan@test.com', password: 'password123' }),
});
console.log('status', res.status);
const text = await res.text();
console.log(text.slice(0, 300));
