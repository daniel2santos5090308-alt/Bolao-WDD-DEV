# Checklist de Homologação - Bolão WDD DEV

Use este checklist antes de considerar o ambiente DEV pronto para publicação.

## Preparação

- Confirmar backup recente do banco atual.
- Confirmar que o ambiente em teste é o Supabase DEV `BolaoWDDDEV`.
- Confirmar que a pasta publicada será somente `public/`.
- Confirmar que `.env.e2e`, backups JSON e arquivos SQL não serão publicados.

## Validação Técnica

```bash
npm run validate
```

Resultado esperado:

- 9 testes unitários/estáticos passando.
- `npm audit` com 0 vulnerabilidades.

## Validação E2E

Criar `.env.e2e` a partir de `.env.e2e.example` e preencher as senhas locais.

```bash
npm run test:e2e
```

Resultado esperado:

- Login admin realizado.
- Rodada de teste criada.
- Jogo de teste criado e editado.
- Login de usuário realizado.
- Aposta registrada.
- Placar salvo pelo admin.
- Jogo e rodada de teste excluídos.

Para assistir ao navegador:

```bash
npm run test:e2e:headed
```

## Homologação Manual

- Login admin com usuário curto.
- Login usuário com usuário curto.
- Painel admin carrega rodadas, jogos e classificação.
- Painel usuário carrega jogos da última rodada cadastrada.
- Filtro por rodada funciona.
- Filtro por time funciona.
- Ranking geral e ranking da rodada aparecem corretamente.
- Aposta antes do horário do jogo funciona.
- Aposta após horário ou jogo finalizado fica bloqueada.
- Salvar placar atualiza ranking.
- Limpar placar remove resultado do jogo.
- Excluir jogo não quebra ranking nem tela de usuário.
- Logout redireciona para login.

## Segurança

- Acesso anônimo não lista dados nas tabelas `profiles`, `rounds`, `matches`, `bets` e `standings`.
- Cadastro público não aparece no front-end.
- Firebase não aparece nas páginas públicas.
- Chave `service_role` não existe no front-end.
- Arquivo `supabase_import_data.sql` permanece fora do GitHub.

## Critério de Aceite

- `npm run validate` verde.
- `npm run test:e2e` verde.
- Homologação manual sem erro crítico.
- Backup recente confirmado antes de qualquer publicação.
