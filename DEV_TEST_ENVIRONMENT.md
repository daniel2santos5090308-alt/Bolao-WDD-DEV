# Ambiente DEV/Teste - Bolao WDD

Este documento descreve como manter um ambiente DEV/Teste separado da producao.

## Objetivo

- Producao fica somente com dados reais dos jogadores.
- DEV/Teste recebe testes de cadastro, apostas, regras e layout.
- Cada ambiente usa um projeto Supabase e um site Netlify separados.

## Estrutura recomendada

| Ambiente | Netlify | Supabase | Uso |
| --- | --- | --- | --- |
| PROD | dominio oficial | Bolao WDD PROD | Jogadores reais |
| DEV/Teste | subdominio dev/teste | Bolao WDD DEV | Testes e homologacao |

## Supabase DEV

1. Criar um novo projeto no Supabase, por exemplo `Bolao WDD DEV`.
2. Rodar os mesmos scripts SQL usados na producao:
   - schema base das tabelas;
   - ajustes de RLS;
   - modelo de pontuacao por placar;
   - funcoes RPC necessarias.
3. Criar usuarios de teste no Supabase Auth.
4. Popular dados minimos:
   - 1 ou 2 rodadas de teste;
   - alguns jogos futuros;
   - classificacao opcional;
   - configuracao de pontuacao.
5. Nao importar apostas reais da producao.

## Configuracao local

1. Copiar `.env.example` para `.env.local`.
2. Preencher com as chaves do Supabase DEV:

```env
SUPABASE_URL=https://seu-projeto-dev.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-dev
APP_ENV=dev
```

3. Iniciar localmente:

```bash
npm install
npm start
```

O comando `npm start` gera `public/assets/js/runtime-config.js` a partir das variaveis locais antes de iniciar o servidor.

## Netlify DEV

1. Criar um novo site no Netlify para DEV/Teste.
2. Conectar ao mesmo repositorio GitHub.
3. Usar uma branch propria para DEV, por exemplo `develop` ou `chore/dev-test-environment`.
4. Configurar as variaveis no Netlify:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
APP_ENV=dev
```

5. Build command:

```bash
npm run write-env
```

6. Publish directory:

```text
public
```

## Netlify PROD

Tambem e necessario configurar as variaveis de producao no Netlify PROD antes de publicar esta versao:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
APP_ENV=prod
```

Assim o mesmo codigo pode rodar em DEV e PROD sem alterar arquivos manualmente.

## Fluxo recomendado

1. Desenvolver em branch de feature.
2. Abrir PR para branch DEV/homologacao.
3. Testar no Netlify DEV.
4. Se aprovado, abrir PR para a branch de producao.
5. Deploy de producao somente apos validacao.

## Cuidados

- Nunca testar exclusao ou reset de apostas no Supabase PROD.
- Nunca reaproveitar usuarios reais em testes destrutivos.
- Fazer backup antes de migracoes SQL em producao.
- Manter dados de teste pequenos para respeitar o plano gratuito.
