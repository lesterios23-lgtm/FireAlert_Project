export default async function run(page, ui) {
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'juan@test.com', password: 'password123' }),
      });
      return { status: res.status, ok: res.ok };
    } catch (e) {
      return { error: String(e) };
    }
  });
  return result;
}
