# Supabase Keepalive

Este projeto usa Supabase Free no ambiente DEV/Homologação. Para reduzir o risco de pausa por inatividade, existe um GitHub Actions agendado em:

```text
.github/workflows/supabase-keepalive.yml
```

## Frequência

O workflow roda duas vezes por semana:

```text
Segunda-feira 12:00 UTC
Quinta-feira 12:00 UTC
```

Isso evita excesso de chamadas e mantém o projeto com atividade periódica.

## O Que Ele Faz

O workflow executa uma consulta leve:

```text
GET /rest/v1/rounds?select=id&limit=1
```

Essa chamada usa a chave `anon` e respeita as policies RLS. Ela não altera dados.

## Secrets Necessários

Configure no GitHub:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

Caminho:

```text
GitHub > Repository > Settings > Secrets and variables > Actions > New repository secret
```

Valores atuais podem ser encontrados em:

```text
public/assets/js/supabase-init.js
```

## Como Rodar Manualmente

1. Abrir o repositório no GitHub.
2. Ir em **Actions**.
3. Selecionar **Supabase keepalive**.
4. Clicar em **Run workflow**.

## Observações

- Scheduled workflows só rodam automaticamente na branch padrão do GitHub.
- Depois de aprovar o Pull Request, a branch `main` precisa conter o workflow.
- Se o projeto já estiver pausado, restaure manualmente no Supabase antes de esperar o keepalive funcionar.
- Se a URL ou anon key mudar, atualize os secrets do GitHub.
