# Checklist de Homologação - Bolão WDD DEV

Use este checklist antes de considerar o ambiente DEV pronto para publicação.

## Preparação

- Confirmar backup recente do banco atual.
- Confirmar que o ambiente em teste é o Supabase DEV `BolaoWDDDEV`.
- Confirmar que a pasta publicada será somente `public/`.
- Confirmar que backups JSON e arquivos SQL não serão publicados (o Netlify publica só `dist/`).

## Validação Técnica

```bash
npm run validate
```

Resultado esperado:

- Todos os testes unitários passando (`npm test`).
- `npm audit` com 0 vulnerabilidades.

## Validação E2E

```bash
npm run test:e2e
```

Resultado esperado: todos os testes passando nos projetos `desktop` e `celular`. Usa Supabase simulado, então não altera dados do DEV.

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

### Fases 5 a 8

- Admin → Temporadas: criar a temporada seguinte (copia premiações e loja) e ativar; o topo passa a mostrar o novo nome.
- Admin → Importar jogos: pré-visualizar e importar um CSV de teste; reimportar com uma data mudada mostra 1 remarcação.
- Jogo adiado (data bem depois da rodada) aparece com a etiqueta **Adiado** e não puxa a rodada atual para trás.
- Admin → Participantes: criar participante, entrar com a senha provisória, gerar nova senha, desativar (login mostra "Conta desativada") e reativar.
- Android (Chrome): Perfil → **Instalar app**; o ícone WDD aparece na tela inicial e abre em tela cheia.
- iPhone (Safari): Compartilhar → **Adicionar à Tela de Início**; o ícone WDD aparece e abre em tela cheia.
- Com o app instalado, publicar um deploy novo: ao voltar para o app aparece "Nova versão do Bolão WDD disponível" e **Atualizar o app** carrega a versão nova.
- Modo avião: o app instalado abre e mostra os últimos dados carregados.

## Segurança

- Acesso anônimo não lista dados nas tabelas `profiles`, `rounds`, `matches`, `bets` e `standings`.
- Cadastro público não aparece no front-end.
- Firebase não aparece nas páginas públicas.
- Chave `service_role` não existe no front-end.
- Edge Function `admin-users` recusa participante comum (403) e quem não está logado (401).
- Service worker não guarda nada do Supabase (`node scripts/test-pwa.mjs` confere).
- Arquivo `supabase_import_data.sql` permanece fora do GitHub.

## Critério de Aceite

- `npm run validate` verde.
- `npm run test:e2e` verde.
- Homologação manual sem erro crítico.
- Backup recente confirmado antes de qualquer publicação.
