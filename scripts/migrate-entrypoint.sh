#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# SPDX-License-Identifier: MIT
#
# Applies the Active Register migrations from a private migration job.

set -euo pipefail

err() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_environment() {
  local name
  for name in PGHOST PGDATABASE PGUSER PGPASSWORD \
    REGISTER_AUTHENTICATOR_PASSWORD; do
    if [[ -z "${!name:-}" ]]; then
      err "${name} must be set."
    fi
  done
}

main() {
  local migration
  local -a migrations

  require_environment
  export PGSSLMODE='verify-full'
  export PGSSLROOTCERT="${PGSSLROOTCERT:-/etc/ssl/certs/ca-certificates.crt}"
  export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"

  shopt -s nullglob
  migrations=(/migrations/*.sql)
  if (( ${#migrations[@]} == 0 )); then
    err 'No migrations were packaged.'
  fi

  for migration in "${migrations[@]}"; do
    printf 'Applying %s\n' "${migration##*/}"
    psql -X --no-password -v ON_ERROR_STOP=1 -f "${migration}"
  done
  psql -X --no-password -v ON_ERROR_STOP=1 \
    -c "NOTIFY pgrst, 'reload schema';"
  printf 'All migrations applied successfully.\n'
}

main "$@"