#!/usr/bin/env bash
# Roda supabase/tests/fase*_check.sql contra o Supabase local do CI.
# Os testes so imprimem OK/FALHOU; aqui qualquer FALHOU, erro de SQL ou
# arquivo sem nenhum OK reprova o job.
set -uo pipefail

# Senha padrao do Supabase local (so existe na maquina/CI, nunca no DEV/PROD).
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-54322}"
# Na maquina local sem psql: PSQL_CONTAINER=supabase_db_bolao-wdd usa o psql do container.
PSQL_CONTAINER="${PSQL_CONTAINER:-}"
if [ -n "$PSQL_CONTAINER" ]; then DB_PORT=5432; fi

# run_sql <usuario> [args do psql]: os testes rodam como postgres; o preparo
# (ci_seed.sql) precisa de supabase_admin para ajustar auth.uid().
run_sql() {
  local url="postgresql://$1:postgres@$DB_HOST:$DB_PORT/postgres"
  shift
  if [ -n "$PSQL_CONTAINER" ]; then
    docker exec -i "$PSQL_CONTAINER" psql "$url" "$@"
  else
    psql "$url" "$@"
  fi
}

if ! run_sql supabase_admin -v ON_ERROR_STOP=1 -q < supabase/tests/ci_seed.sql; then
  echo "::error file=supabase/tests/ci_seed.sql::Falha ao preparar os participantes do CI"
  exit 1
fi

status=0
for file in supabase/tests/fase*_check.sql; do
  echo "::group::$file"
  if ! out=$(run_sql postgres -v ON_ERROR_STOP=1 -P pager=off < "$file" 2>&1); then
    echo "$out"
    echo "::endgroup::"
    echo "::error file=$file::Erro de SQL ao rodar o teste"
    status=1
    continue
  fi
  echo "$out"
  echo "::endgroup::"

  if grep -q 'FALHOU' <<<"$out"; then
    echo "::error file=$file::Pelo menos um teste FALHOU"
    status=1
  elif ! grep -qE '\| OK *$' <<<"$out"; then
    echo "::error file=$file::Nenhum resultado OK encontrado"
    status=1
  else
    echo "$file: $(grep -cE '\| OK *$' <<<"$out") OK"
  fi
done

exit $status
