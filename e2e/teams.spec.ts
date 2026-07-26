import { test, expect, type Page } from '@playwright/test';
import { collectConsoleErrors, assertConsoleClean } from './helpers';
import { AUTH_FILE } from './seed';

test.use({ storageState: AUTH_FILE });

async function loginAndGoToTeams(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('collabix_cookie_consent', JSON.stringify({ v: 1, analytics: false, ts: Date.now() }));
    localStorage.setItem('collabix_onboarded', '1');
  });
  await page.goto('/#teams', { waitUntil: 'networkidle' });
  await expect(page.locator('#page-teams')).toHaveClass(/active/);
}

test.describe('Teams səhifəsi - TASK-11 E2E', () => {
  test('yüklənir, sıfır konsol xətası və seed məlumatı göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    // Check if the Alpha Team card is visible (seeded in 0015_seed_teams.sql)
    await expect(page.locator('.user-card').filter({ hasText: 'Alpha Team' })).toBeVisible();
    
    assertConsoleClean(errors);
  });

  test('komanda detallarına kliklədikdə düzgün açılır və tablar işləyir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    // Click on Alpha Team
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();

    // Check URL
    await expect(page).toHaveURL(/.*#team\/alpha-team/);
    
    // Verify tabs are visible
    await expect(page.locator('#teamTabs button[data-tab="overview"]')).toBeVisible();
    await expect(page.locator('#teamTabs button[data-tab="members"]')).toBeVisible();
    
    // Click Members tab
    await page.locator('#teamTabs button[data-tab="members"]').click();
    
    // Check if Team Owner is listed in members
    await expect(page.locator('.user-card').filter({ hasText: 'teamowner_123' }).or(page.locator('.user-card').filter({ hasText: 'Team Owner' }))).toBeVisible();

    assertConsoleClean(errors);
  });

  test('yeni layihə yaratmaq mümkündür (Projects Tab)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();
    
    const projectsTabBtn = page.locator('#teamTabs button[data-tab="projects"]');
    await projectsTabBtn.click();

    const createProjBtn = page.locator('#btnCreateProject');
    await expect(createProjBtn).toBeVisible();
    await createProjBtn.click();

    // Modal opens, fill the form
    await page.locator('.modal-card input[type="text"]').first().fill('E2E Test Project');
    await page.locator('.modal-card textarea').fill('This is a project created by E2E tests.');
    
    // Submit button in the modal
    const submitBtn = page.locator('.modal-card .btn-primary');
    await submitBtn.click();

    // Verify the project is in the page
    await expect(page.locator('#teamContent').filter({ hasText: 'E2E Test Project' })).toBeVisible();

    assertConsoleClean(errors);
  });

  test('yeni tapşırıq yaratmaq mümkündür (Tasks Tab)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();
    
    const tasksTabBtn = page.locator('#teamTabs button[data-tab="tasks"]');
    await tasksTabBtn.click();

    const createTaskBtn = page.locator('#btnCreateTask');
    await expect(createTaskBtn).toBeVisible();
    await createTaskBtn.click();

    // Modal opens
    await page.locator('.modal-card input[type="text"]').first().fill('E2E Test Task');
    await page.locator('.modal-card textarea').fill('Do this task for E2E tests.');
    
    const submitBtn = page.locator('.modal-card .btn-primary');
    await submitBtn.click();

    // Verify task is created
    await expect(page.locator('#teamContent').filter({ hasText: 'E2E Test Task' })).toBeVisible();

    assertConsoleClean(errors);
  });

  test('komanda çatı işləyir (Chat Tab)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();
    
    const chatTabBtn = page.locator('#teamTabs button[data-tab="chat"]');
    await chatTabBtn.click();

    const chatInput = page.locator('#teamChatInput');
    await expect(chatInput).toBeVisible();
    
    const uniqueMessage = `Hello from E2E ${Date.now()}`;
    await chatInput.fill(uniqueMessage);
    await chatInput.press('Enter');

    // Message appears
    await expect(page.locator('#teamChatMessages').filter({ hasText: uniqueMessage })).toBeVisible();

    assertConsoleClean(errors);
  });

  test('komanda məlumatlarını yeniləmək mümkündür (Settings Tab)', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();
    
    const settingsTabBtn = page.locator('#teamTabs button[data-tab="settings"]');
    await settingsTabBtn.click();

    const teamNameInput = page.locator('#teamNameInput');
    await expect(teamNameInput).toBeVisible();
    
    await teamNameInput.fill('Alpha Team Updated');
    
    const saveBtn = page.locator('#teamContent .btn-primary').filter({ hasText: 'Yadda saxla' }).or(page.locator('#teamContent .btn-primary').filter({ hasText: 'Save' }));
    await saveBtn.click();

    // Verify the header updated
    await expect(page.locator('#teamHeader').filter({ hasText: 'Alpha Team Updated' })).toBeVisible();

    // Revert it back so we don't break other tests that depend on the original name
    await teamNameInput.fill('Alpha Team');
    await saveBtn.click();

    assertConsoleClean(errors);
  });

  // TASK-11 düzəlişləri: Feed, Files, Activity və Statistics tabları əvvəl
  // ya ümumiyyətlə yox idi, ya da kodu düymələrə bağlanmamışdı.
  test('Feed tabı paylaşım qəbul edir və göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();

    await page.locator('#teamTabs button[data-tab="feed"]').click();
    const input = page.locator('#feedInput');
    await expect(input).toBeVisible();

    const text = `E2E feed ${Date.now()}`;
    await input.fill(text);
    await page.locator('#btnPostFeed').click();

    await expect(page.locator('#feedList')).toContainText(text);
    assertConsoleClean(errors);
  });

  test('Files tabı açılır, kateqoriya filtrləri görünür', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();

    await page.locator('#teamTabs button[data-tab="files"]').click();
    await expect(page.locator('#teamFileList')).toBeVisible();
    await expect(page.locator('#fileCats .team-chip').first()).toBeVisible();
    assertConsoleClean(errors);
  });

  test('Activity tabı hadisə tarixçəsini göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();

    await page.locator('#teamTabs button[data-tab="activity"]').click();
    await expect(page.locator('#teamActivityFull')).toBeVisible();
    assertConsoleClean(errors);
  });

  test('Statistics tabı metrikləri və reputasiyanı göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);
    await page.locator('.user-card').filter({ hasText: 'Alpha Team' }).click();

    await page.locator('#teamTabs button[data-tab="stats"]').click();
    await expect(page.locator('.team-stat-grid')).toBeVisible();
    await expect(page.locator('#teamContent')).toContainText('Reputasiya');
    assertConsoleClean(errors);
  });

  test('Dəvətlər tabı açılır və boş vəziyyəti göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);

    await page.locator('#teamsScopeTabs button[data-scope="invites"]').click();
    await expect(page.locator('#teamsList')).toBeVisible();
    assertConsoleClean(errors);
  });

  test('Kəşf et tabı açıq komandaları göstərir', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await loginAndGoToTeams(page);

    await page.locator('#teamsScopeTabs button[data-scope="discover"]').click();
    await expect(page.locator('#teamsSearchInput')).toBeVisible();
    await expect(page.locator('.user-card').filter({ hasText: 'Gamma Team' })).toBeVisible();
    assertConsoleClean(errors);
  });
});
