#!/bin/bash
docker compose up --quiet-pull -d --pull always

# Run tests and capture the exit code
yarn dotenv -e .env.test -- -- yarn test "$@"
exit_code=$?

# Tear down the docker-compose setup
docker-compose down -v

# Exit with the captured exit code
exit $exit_code
