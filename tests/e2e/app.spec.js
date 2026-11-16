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

  test('botão mostra e oculta a senha', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');
    await page.locator('#password').fill('segredo');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });

  test('participante entra e cai na rodada atual', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');

    await page.locator('#username').fill('ana');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Rodada 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Saldo de WDD Coins/ })).toBeVisible();
    await expect(page.locator('.brand__text small')).toHaveText('Brasileirão 2027');
  });

  test('admin entra direto no painel e não tem carteira', async ({ page, context }) => {
    await installMockSupabase(context);
    await page.goto('/');

    await page.locator('#username').fill('admin');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Painel admin' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Saldo de WDD Coins/ })).toHaveCount(0);
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

  test('palpite de outra rodada continua na barra e é salvo junto', async ({ page, context }) => {
    const state = await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/jogos');
    await expect(page.getByRole('heading', { name: 'Rodada 3' })).toBeVisible();

    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).first().click();
    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).last().click();
    await page.getByRole('button', { name: 'Próxima rodada' }).click();
    await expect(page.getByRole('heading', { name: 'Rodada 4' })).toBeVisible();
    await expect(page.getByText('1 palpite não salvo (1 em outra rodada)')).toBeVisible();

    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).first().click();
    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).last().click();
    await expect(page.getByText('2 palpites não salvos (1 em outra rodada)')).toBeVisible();
    await page.getByRole('button', { name: 'Salvar palpites' }).click();

    await expect(page.getByText(/palpites? não salvos?/)).toHaveCount(0);
    expect(state.savedBets.map((bet) => bet.match_id).sort()).toEqual(['r3m0', 'r4m0']);
  });

  test('pergunta antes de trocar de tela com palpite não salvo', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'u1' });
    await page.goto('/#/jogos');
    await expect(page.getByRole('heading', { name: 'Rodada 3' })).toBeVisible();
    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).first().click();
    await page.locator('.match-row').first().getByRole('button', { name: /^Aumentar gols/ }).last().click();

    const nav = page.getByRole('navigation', { name: 'Navegação principal' }).filter({ visible: true }).first();
    page.once('dialog', (dialog) => dialog.dismiss());
    await nav.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByText('1 palpite não salvo')).toBeVisible();
    await expect(page).toHaveTitle('Jogos · Bolão WDD');

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('1 palpite não salvo');
      return dialog.accept();
    });
    await nav.getByRole('button', { name: 'Ranking' }).click();
    await expect(page.getByRole('heading', { name: 'Ranking', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Ranking · Bolão WDD');
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
  test('cria e ativa a temporada seguinte', async ({ page, context }) => {
    const state = await installMockSupabase(context, { loggedInAs: 'admin' });
    await page.goto('/#/admin');
    await expect(page.getByText('Brasileirão 2027').first()).toBeVisible();

    await page.getByRole('button', { name: 'Temporadas' }).click();
    const list = page.locator('.admin-panel', { has: page.getByRole('heading', { name: 'Temporadas' }) });
    await expect(list.locator('.season-row')).toHaveCount(2);
    await expect(list.locator('.season-row', { hasText: 'Brasileirão 2027' }).getByText('Ativa')).toBeVisible();

    await page.getByLabel('Ano', { exact: true }).fill('2028');
    await page.getByRole('button', { name: 'Criar temporada' }).click();
    await expect(page.getByText('Temporada Brasileirão 2028 criada.')).toBeVisible();
    const row2028 = list.locator('.season-row', { hasText: 'Brasileirão 2028' });
    await expect(row2028).toBeVisible();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Brasileirão 2027 será encerrada hoje');
      return dialog.accept();
    });
    await row2028.getByRole('button', { name: 'Ativar' }).click();

    // Recarrega e passa a mostrar 2028
    await expect(page.locator('.brand__text small')).toHaveText('Brasileirão 2028');
    expect(state.seasons.find((season) => season.is_active).key).toBe('2028');
  });

  test('ano inválido não chega ao banco', async ({ page, context }) => {
    const state = await installMockSupabase(context, { loggedInAs: 'admin' });
    await page.goto('/#/admin');
    await page.getByRole('button', { name: 'Temporadas' }).click();
    await page.getByLabel('Ano', { exact: true }).fill('2027');
    await page.getByRole('button', { name: 'Criar temporada' }).click();
    await expect(page.getByText('A temporada 2027 já existe.')).toBeVisible();
    expect(state.calls.filter((call) => call.endsWith('/rpc/create_season'))).toHaveLength(0);
  });

  test('lista de jogos abre na rodada atual', async ({ page, context }) => {
    await installMockSupabase(context, { loggedInAs: 'admin' });
    await page.goto('/#/admin');

    const panel = page.locator('.admin-panel', { has: page.getByRole('heading', { name: 'Jogos cadastrados' }) });
    await expect(panel.locator('select').first()).toHaveValue('r3');
    await expect(panel.locator('.admin-match-row')).toHaveCount(6);
  });
});
