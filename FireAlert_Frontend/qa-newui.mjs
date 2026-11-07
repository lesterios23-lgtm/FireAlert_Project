export default async function run(page, ui) {
  const out = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.auth-card', { timeout: 30000 });

  await page.getByPlaceholder('you@example.com').fill('juan@test.com');
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for either portal to mount (up to 15s)
  try {
    await page.waitForSelector('.mobile-app, .admin-dashboard', { timeout: 15000 });
  } catch {
    out.loginStuck = await page.evaluate(() => ({
      error: document.querySelector('.auth-error')?.textContent || null,
      token: !!localStorage.getItem('firealert_token'),
    }));
    await page.screenshot({ path: 'shot-login-stuck.png' });
    return out;
  }

  await page.waitForTimeout(1500);
  out.isResident = !!(await page.$('.mobile-app'));
  out.isAdmin = !!(await page.$('.admin-dashboard'));

  if (out.isResident) {
    await page.screenshot({ path: 'shot-new-resident-home.png' });

    // Report tab via bottom nav "Report" FAB
    await page.evaluate(() => {
      const fab = document.querySelector('.bn-fab') ||
        Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === 'Report'
        );
      fab?.click();
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'shot-new-report.png', fullPage: true });
    out.reportTab = await page.evaluate(() => ({
      safety: !!document.querySelector('.safety-warning'),
      fireSizeButtons: document.querySelectorAll('.fire-size-btn').length,
      mapPin: !!document.querySelector('.map-pin'),
      submitLabel: document.querySelector('.btn-emergency')?.textContent || null,
    }));

    // History tab (2nd bottom nav item)
    await page.evaluate(() => {
      document
        .querySelectorAll('.bottom-nav .bn-item')[1]
        ?.click();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'shot-new-history.png', fullPage: true });
    out.history = await page.evaluate(() => ({
      segments: Array.from(document.querySelectorAll('.segment')).map(
        (s) => s.textContent
      ),
      fab: !!document.querySelector('.fab-report'),
    }));

    await page.evaluate(() => localStorage.clear());
    return out;
  }

  // Admin flow
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shot-new-admin.png' });
  out.admin = await page.evaluate(() => ({
    sidebar: !!document.querySelector('.sidebar'),
    stats: Array.from(document.querySelectorAll('.stat-label')).map(
      (s) => s.textContent
    ),
    feedItems: document.querySelectorAll('.report-item').length,
  }));

  // Incident Records view
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.sidebar-link')).find(
      (b) => b.textContent.includes('Incident Records')
    )?.click();
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shot-new-records.png' });
  out.records = await page.evaluate(() => ({
    table: !!document.querySelector('.records-table'),
    rows: document.querySelectorAll('.records-table tbody tr').length,
    headers: Array.from(document.querySelectorAll('.records-table th')).map(
      (t) => t.textContent
    ),
  }));

  // Dispatch panel from command center
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.sidebar-link')).find(
      (b) => b.textContent.includes('Command Center')
    )?.click();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelector('.report-item')?.click();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'shot-new-dispatch.png' });
  out.dispatch = await page.evaluate(() => ({
    panel: !!document.querySelector('.report-detail-panel'),
    title: document.querySelector('.report-detail-panel h2')?.textContent || null,
    buttons: Array.from(
      document.querySelectorAll('.report-detail-panel .detail-actions-buttons button')
    ).map((b) => b.textContent),
  }));

  await page.evaluate(() => localStorage.clear());
  return out;
}
