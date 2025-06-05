#!/bin/bash
docker compose pull --quiet
docker compose up --quiet-pull -d

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
  docker compose down -v
  exit 1
fi

# Run tests and capture the exit code
yarn dotenv -e .env.test yarn test
exit_code=$?

# Tear down the docker-compose setup
docker compose down -v

# Exit with the captured exit code
exit $exit_code
