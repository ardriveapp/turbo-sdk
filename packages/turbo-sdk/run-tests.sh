#!/bin/bash

BUNDLER_ARWEAVE_WALLET=$(cat ./tests/wallets/ByQEA5jhJvzlhfI4sFgB23kjGpxDK6OIE0i3sSnmTGU.json)

docker compose pull --quiet
docker compose up --quiet-pull -d

# Dump service logs so a failure is diagnosable from the CI log alone. Without
# this the job output shows only container lifecycle events, which cannot
# distinguish "service was slow to start" from "service started and is broken".
dump_logs() {
  echo "===================== docker compose ps ====================="
  docker compose ps
  for svc in payment-service upload-service; do
    echo "===================== logs: $svc (tail 200) ================"
    docker compose logs --tail=200 "$svc" 2>&1 || true
  done
}

# Block until a service answers its health endpoint. Previously only LocalStack
# was gated, so the suite could start firing at a payment-service that was not
# up yet. Every request then burned the SDK's 5 retries with backoff (~31s per
# call), blowing per-test timeouts and cascading into "test did not finish
# before its parent and was cancelled" across whole suites.
wait_for_health() {
  local name=$1 url=$2 timeout=${3:-180} elapsed=0 interval=5
  echo "Waiting for $name to be ready at $url ..."
  while [ $elapsed -lt $timeout ]; do
    if curl -fs -m 5 "$url" >/dev/null 2>&1; then
      echo "$name is ready (${elapsed}s)"
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  echo "ERROR: timed out after ${timeout}s waiting for $name at $url"
  return 1
}

# Wait for LocalStack to be ready (up to 120 seconds)
timeout=120
interval=5
elapsed=0

echo "Waiting for LocalStack to be ready..."

while [ $elapsed -lt $timeout ]; do
  if curl -s http://localhost:4566/_localstack/health | grep -q '"secretsmanager": "running"'; then
    echo "LocalStack is ready"
    break
  fi
  echo "LocalStack is not ready yet. Waiting..."
  sleep $interval
  elapsed=$((elapsed + interval))
done

if [ $elapsed -ge $timeout ]; then
  echo "Timed out waiting for LocalStack to be ready."
  dump_logs
  docker compose down -v
  exit 1
fi

# The services the integration suite actually talks to. Fail fast and loudly
# here rather than 90 minutes later as a wall of unrelated test timeouts.
if ! wait_for_health "payment-service" "http://localhost:4000/health" 180 \
  || ! wait_for_health "upload-service" "http://localhost:3000/health" 180; then
  dump_logs
  docker compose down -v
  exit 1
fi

# check for arg --only (source copy_repo.sh --only)
if [[ "$@" == *"--only"* ]]; then
  only=true
fi

# Run tests and capture the exit code
if [ "$only" = true ]; then
  yarn dotenv -e .env.test yarn test:only
else
  yarn dotenv -e .env.test yarn test
fi
exit_code=$?

# On failure, surface the service logs alongside the test output.
if [ $exit_code -ne 0 ]; then
  dump_logs
fi

# Tear down the docker-compose setup
docker compose down -v

# Destroy redis data between tests
docker volume rm -f redis-data


# Exit with the captured exit code
exit $exit_code
