export default async function run(page, ui) {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.auth-card', { timeout: 20000 });

  await page.getByPlaceholder('you@example.com').fill('bfp@test.com');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for either the dashboard or an error message
  try {
    await page.waitForSelector('.admin-dashboard, .mobile-app', { timeout: 20000 });
  } catch {
    await page.screenshot({ path: 'admin-stuck.png' });
    return { stuck: true };
  }

  const state = await page.evaluate(() => ({
    hasDashboard: !!document.querySelector('.admin-dashboard'),
    isResident: !!document.querySelector('.mobile-app'),
    hasAuthError: document.querySelector('.auth-error')?.textContent || null,
    role: JSON.parse(localStorage.getItem('firealert_user') || '{}').role || null,
  }));

  if (state.hasDashboard) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'admin-real.png' });

    await page.locator('.report-item').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'admin-real-detail.png' });

    const statValues = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.stat-card')).map((c) => ({
        label: c.querySelector('.stat-label')?.textContent,
        value: c.querySelector('.stat-value')?.textContent,
      }))
    );

    // Records view
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.sidebar-link')).find(
        (b) => b.textContent.includes('Incident Records')
    )?.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'admin-records.png' });
    const records = await page.evaluate(() => ({
      table: !!document.querySelector('.records-table'),
      rows: document.querySelectorAll('.records-table tbody tr').length,
      headers: Array.from(document.querySelectorAll('.records-table th')).map((t) => t.textContent),
    }));

    return { ...state, statValues, records };
  }

  await page.screenshot({ path: 'admin-stuck.png' });
  return state;
}
