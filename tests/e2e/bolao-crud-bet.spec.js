const { test, expect } = require('@playwright/test');

const adminUser = process.env.E2E_ADMIN_USER || 'admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const bettorUser = process.env.E2E_BETTOR_USER || 'daniel';
const bettorPassword = process.env.E2E_BETTOR_PASSWORD;
const hasCredentials = Boolean(adminPassword && bettorPassword);

const suffix = `E2E ${Date.now()}`;
const roundName = `${suffix} Rodada`;
const homeTeam = `${suffix} Casa`;
const awayTeam = `${suffix} Fora`;
const editedAwayTeam = `${suffix} Fora Editado`;

async function login(page, username, password, expectedPage) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/index.html');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`**/${expectedPage}`);
}

async function logout(page) {
  await page.locator('#btnLogout').click();
  await page.waitForURL('**/index.html');
}

async function cleanupRound(page) {
  await login(page, adminUser, adminPassword, 'admin.html');

  const roundItem = page.locator('#roundsList .list-group-item', { hasText: roundName }).first();
  if (await roundItem.count()) {
    await roundItem.locator('button').click();
    await expect(roundItem).toHaveCount(0);
  }
}

async function fillNumberInput(locator, value) {
  await locator.fill(value);

  if (await locator.inputValue() !== value) {
    await locator.evaluate((input, nextValue) => {
      input.value = nextValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  await expect(locator).toHaveValue(value);
}

async function waitForListRender(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function dismissWelcomeModal(page) {
  const welcomeButton = page.getByRole('button', { name: 'Entendi, vamos para os palpites' });
  if (await welcomeButton.isVisible().catch(() => false)) {
    await welcomeButton.click();
    await expect(page.locator('#welcomeModal')).toBeHidden();
  }
}

test.describe.serial('Bolao WDD - fluxo E2E CRUD e aposta', () => {
  test.skip(!hasCredentials, 'Configure E2E_ADMIN_PASSWORD e E2E_BETTOR_PASSWORD para rodar os testes E2E.');

  test.beforeEach(async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
  });

  test('admin cria/edita/finaliza/exclui jogo e usuario aposta', async ({ page }) => {
    try {
      await login(page, adminUser, adminPassword, 'admin.html');

      await page.locator('#roundName').fill(roundName);
      await page.locator('#roundForm button[type="submit"]').click();
      await expect(page.locator('#roundsList')).toContainText(roundName);

      await page.locator('#matchRound').selectOption({ label: roundName });
      await page.locator('#filterRound').selectOption({ label: roundName });
      await page.locator('#matchDate').fill('2099-12-31');
      await page.locator('#matchTime').fill('20:30');
      await page.locator('#homeTeam').fill(homeTeam);
      await page.locator('#awayTeam').fill(awayTeam);
      await page.locator('#matchSubmitButton').click();

      await expect(page.locator('#matchesList')).toContainText(homeTeam);
      await expect(page.locator('#matchesList')).toContainText(awayTeam);

      const createdMatchCard = page.locator('#matchesList > .card', { hasText: homeTeam }).first();
      await createdMatchCard.getByRole('button', { name: 'Editar' }).click();
      await expect(page.locator('#matchSubmitButton')).toHaveText('Salvar Alterações');
      await expect(page.locator('#editingMatchId')).not.toHaveValue('');
      await page.locator('#awayTeam').fill(editedAwayTeam);
      await page.locator('#matchSubmitButton').click();
      await expect(page.locator('#matchesList')).toContainText(editedAwayTeam);

      await logout(page);

      await login(page, bettorUser, bettorPassword, 'user.html');
      await dismissWelcomeModal(page);
      await page.locator('#roundFilter').selectOption({ label: roundName });

      const userMatchCard = page.locator('#matchesContainer .card', { hasText: editedAwayTeam }).first();
      await expect(userMatchCard).toBeVisible();
      await fillNumberInput(userMatchCard.locator('input[id^="bet_score_home_"]').first(), '2');
      await fillNumberInput(userMatchCard.locator('input[id^="bet_score_away_"]').first(), '1');
      await userMatchCard.getByRole('button', { name: 'Salvar Palpite' }).click();
      await expect(userMatchCard.locator('input[id^="bet_score_home_"]').first()).toHaveValue('2');

      await logout(page);

      await login(page, adminUser, adminPassword, 'admin.html');
      await page.locator('#filterRound').selectOption({ label: roundName });
      await waitForListRender(page);

      const adminMatchCard = page.locator('#matchesList .card', { hasText: editedAwayTeam }).first();
      await expect(adminMatchCard).toBeVisible();
      const homeScoreInput = page.locator('#matchesList input[id^="score_home_"]').first();
      const awayScoreInput = page.locator('#matchesList input[id^="score_away_"]').first();
      await fillNumberInput(homeScoreInput, '2');
      await fillNumberInput(awayScoreInput, '1');
      await adminMatchCard.getByRole('button', { name: 'Salvar Placar' }).click();
      await expect(page.locator('#matchesList')).toContainText('2 x 1');

      await page.locator('#filterRound').selectOption({ label: roundName });
      await page.locator('#matchesList .card', { hasText: editedAwayTeam }).first().getByRole('button', { name: 'Excluir' }).click();
      await expect(page.locator('#matchesList')).not.toContainText(editedAwayTeam);

      const roundItem = page.locator('#roundsList .list-group-item', { hasText: roundName }).first();
      await roundItem.locator('button').click();
      await expect(page.locator('#roundsList')).not.toContainText(roundName);
    } catch (error) {
      await cleanupRound(page).catch(() => {});
      throw error;
    }
  });
});
