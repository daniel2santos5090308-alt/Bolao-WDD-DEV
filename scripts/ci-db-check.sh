#!/usr/bin/env bash
# Roda supabase/tests/fase*_check.sql contra o Supabase local do CI.
# Os testes so imprimem OK/FALHOU; aqui qualquer FALHOU, erro de SQL ou
# arquivo sem nenhum OK reprova o job.
set -uo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/ci_seed.sql; then
  echo "::error file=supabase/tests/ci_seed.sql::Falha ao preparar os participantes do CI"
  exit 1
fi

status=0
for file in supabase/tests/fase*_check.sql; do
  echo "::group::$file"
  if ! out=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -f "$file" 2>&1); then
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
