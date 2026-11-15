// Fluxos principais do app contra o Supabase simulado (tests/e2e/support/mockSupabase.js).
const { test, expect } = require('@playwright/test');
const { installMockSupabase, PASSWORD } = require('./support/mockSupabase');

test.describe('login', () => {
  test('senha errada mostra erro em português', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');

    await page.locator('#username').fill('ana');
    await page.locator('#password').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toHaveText('Usuário ou senha incorretos.');
  });

  test('participante entra e cai na rodada atual', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');

    await page.locator('#username').fill('ana');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Rodada 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saldo WDD Coins' })).toBeVisible();
  });

  test('admin entra direto no painel e não tem carteira', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');

    await page.locator('#username').fill('admin');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Painel admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saldo WDD Coins' })).toHaveCount(0);
  });

  test('endereços antigos redirecionam para o app', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/login.html');
    await expect(page.locator('#loginForm')).toBeVisible();
  });
});

test.describe('participante', () => {
  test('salva palpites em lote', async ({ page, context }) => {
    const state = await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/jogos');
    await expect(page.getByRole('heading', { name: 'Rodada 3' })).toBeVisible();

    // Placar vazio: o primeiro toque em + marca 0.
    const firstMatch = page.locator('.match-row').first();
    await firstMatch.getByRole('button', { name: /^Aumentar gols/ }).first().click();
    await firstMatch.getByRole('button', { name: /^Aumentar gols/ }).first().click();
    await firstMatch.getByRole('button', { name: /^Aumentar gols/ }).last().click();

    await expect(page.getByText('1 palpite não salvo')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar palpites' }).click();

    await expect(page.getByText('1 palpite não salvo')).toHaveCount(0);
    expect(state.savedBets).toHaveLength(1);
    expect(state.savedBets[0]).toMatchObject({ user_id: 'u1', match_id: 'r3m0', score_home: 1, score_away: 0, pick: 'home' });
  });

  test('ranking mostra a ordem do banco', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/ranking');
    const podium = page.locator('main');
    await expect(podium.getByText('Bruno').first()).toBeVisible();
    await expect(podium.getByText('96').first()).toBeVisible();
  });

  test('Coins carrega loja e extrato ao abrir, com rótulos em português', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/coins');

    await expect(page.getByText('Selo de perfil · Raro')).toBeVisible();
    await expect(page.getByText('Visual do card de jogo · Épico')).toBeVisible();
    await expect(page.getByText('Saldo inicial da temporada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carregar loja' })).toHaveCount(0);
  });

  test('sair volta para o login', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/perfil');
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.locator('#loginForm')).toBeVisible();
  });
});

test.describe('admin', () => {
  test('lista de jogos abre na rodada atual', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'admin' });
    await page.goto('/#/admin');

    const panel = page.locator('.admin-panel', { has: page.getByRole('heading', { name: 'Jogos cadastrados' }) });
    await expect(panel.locator('select').first()).toHaveValue('r3');
    await expect(panel.locator('.admin-match-row')).toHaveCount(6);
  });
});
