# Intelligent Proxy Manager - Testing Suite

This directory contains the automated test suite for the Intelligent Proxy Manager, covering Caddy, Nginx, and their integration.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Test Structure](#test-structure)
- [How It Works](#how-it-works)
- [Usage](#usage)

## Prerequisites
- **Docker**: All tests use `testcontainers` and require a running Docker daemon.
- **Node.js**: Version 18+ recommended.
- **NPM Dependencies**: Run `npm install` inside the `tests` directory.

## Environment Variables
The test suite can be configured using a `.env` file in this directory.

| Variable | Description | Default/Example |
|----------|-------------|-----------------|
| `TEST_DOMAIN` | Domain for which SSL certificates are generated. | `alma.test` |
| `TEST_TIMEOUT` | Global timeout for Vitest operations (ms). | `60000` |
| `LOG_LEVEL` | Logging verbosity (`info`, `debug`, `silly`). | `info` |
| `NGINX_FILE_TO_TEST` | Path to the Nginx configuration file to be validated. | `../../nginxConf/nginx.conf` |
| `NGINX_PORT` | Port Nginx container will expose. | `8080` |
| `CADDY_REDIRECTION_HOST` | Hostname used by Caddy to reach Nginx/Backend. | `host.testcontainers.internal` |
| `TEST_CADDY_MOCK_BACKEND_PORT` | Port the mock backend listens on. | `5000` |

## Test Structure

### 1. Integration Tests (`tests/integration`)
The flagship test `caddy+nginx.test.js` verifies the complete proxy chain:
**Client** (HTTPS) → **Caddy** (Proxy) → **Nginx** (Auth/Limits) → **Mock API**.
- Validates SSL termination.
- Verifies header forwarding and API key authentication.
- Checks full-stack connectivity using a shared Docker network.

### 2. Nginx Tests (`tests/nginx`)
Isolated tests for Nginx behavior:
- **Rate Limiting**: Verifies `429 Too Many Requests`.
- **Redirection**: Validates custom Nginx redirection logic.
- **Error Handling**: Checks `404 Not Found` and `502 Bad Gateway` behaviors.

### 3. Caddy Tests (`tests/caddy`)
Standalone tests for Caddy's redirection and configuration patching.

## How It Works
- **Dynamic Patching**: To prevent port/file conflicts, tests generate temporary configuration files (`nginx.conf.*`, `Caddyfile.final.*`) with unique suffixes for each run.
- **Automatic SSL**: The suite automatically generates self-signed certificates (`test-cert.pem`, `test-key.pem`) using OpenSSL if they don't exist.
- **Isolated Networks**: Each test run creates a dedicated `testcontainers` network to ensure isolation.
- **Auto-Cleanup**: All temporary files and Docker containers are automatically deleted in the `afterAll` hook, even if tests fail.

## Usage

### Run All Tests
```bash
npm test
```

### Run Specific Test
```bash
npx vitest tests/integration/caddy+nginx.test.js
```

### Run with Verbose Logs
```bash
npm test -- --reporter=verbose
```
