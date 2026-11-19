const { test, expect } = require('@playwright/test');

test.use({ baseURL: 'http://localhost:3000' });

test('smoke and custom subject flow', async ({ page }) => {
  await page.goto('/dashboard.html');
  await expect(page.locator('h1')).toContainText('Khách');

  await page.locator('[data-open-modal="createRoomModal"]').click();
  await page.locator('#roomName').fill('QA Browser Room');
  await page.locator('#roomSubject').fill('Sinh học');
  await page.locator('button[form="createRoomForm"]').click();

  await page.goto('/myroom.html');
  await expect(page.locator('.room-card').first()).toContainText('QA Browser Room');
});

test('opening and reopening the same room keeps the last room', async ({ page }) => {
  await page.goto('/dashboard.html');
  const target = page.locator('.room-card', { hasText: 'Phòng học Lập trình' });
  await target.waitFor({ state: 'visible' });
  await target.locator('a.btn').click();
  await expect(page).toHaveURL(/room_mwlo51wb_b067da|room=/);
  await expect(page.locator('#roomName')).toContainText('Phòng học Lập trình');

  await page.goto('/dashboard.html');
  const openLink = page.locator('.side-link', { hasText: 'Phòng đang mở' });
  await openLink.click();
  await expect(page).toHaveURL(/room_mwlo51wb_b067da|room=/);
  await expect(page.locator('#roomName')).toContainText('Phòng học Lập trình');
});
