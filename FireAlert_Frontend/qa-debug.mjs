export default async function run(page, ui) {
  const out = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.auth-card', { timeout: 20000 });

  await page.getByPlaceholder('you@example.com').fill('resident@test.com');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(4000);
  out.error = await page.evaluate(() =>
    document.querySelector('.auth-error')?.textContent || null
  );
  out.state = await page.evaluate(() => ({
    mobile: !!document.querySelector('.mobile-app'),
    admin: !!document.querySelector('.admin-dashboard'),
    token: !!localStorage.getItem('firealert_token'),
  }));
  await page.screenshot({ path: 'shot-debug-login.png' });
  return out;
}
