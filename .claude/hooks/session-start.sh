#!/usr/bin/env bash
# Prepara sessões na nuvem para rodar lint, testes e E2E: dependências e Postgres de teste.
# Idempotente e tolerante a falhas (nunca bloqueia a sessão). Só age em sessões remotas.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# 1. Dependências (o postinstall roda `prisma generate`)
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "[session-start] npm ci falhou (siga manualmente)" >&2
fi

# 2. Postgres local de teste (o cluster costuma estar parado em sessões novas)
if command -v pg_ctlcluster >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  CLUSTER=$(pg_lsclusters -h 2>/dev/null | awk 'NR==1{print $1" "$2}')
  if [ -n "$CLUSTER" ]; then
    # shellcheck disable=SC2086
    pg_ctlcluster $CLUSTER start >/dev/null 2>&1
    for _ in 1 2 3 4 5 6 7 8 9 10; do pg_isready -q && break; sleep 1; done
    if pg_isready -q; then
      su postgres -c "psql -qtc \"ALTER USER postgres PASSWORD 'postgres'\"" >/dev/null 2>&1
      su postgres -c "psql -qtc \"SELECT 1 FROM pg_database WHERE datname='climazap_test'\"" 2>/dev/null | grep -q 1 \
        || su postgres -c "psql -qc 'CREATE DATABASE climazap_test'" >/dev/null 2>&1
      echo "[session-start] Postgres de teste pronto (climazap_test). Rode: npm test"
    fi
  fi
fi
exit 0
