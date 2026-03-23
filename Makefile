AUTH_LOCATION ?= header
NUM_KEYS_PER_USER ?= 1
DOCKER_COMPOSE_NGINX ?= ./docker-compose/docker-compose-nginx-hpc.yaml
OAS_PATH ?= ./specs/hpc-oas.yaml
SLAS_PATH ?= ./specs/slas
NGINX_OUT_DIR ?= ./nginxConf
NGINX_CONTAINER ?= sla-proxy
API_URL ?= http://localhost:3000

.DEFAULT_GOAL := help

## Docs stuff

# ===============================
# Help: list all available targets
# ===============================
help:  ## Show this help message with available targets
	@echo "Available Makefile targets:"
	@grep -E '^[a-zA-Z0-9._-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  %-25s %s\n", $$1, $$2}'

list: ## List all available commands
	@grep -oE '^[a-zA-Z0-9._-]+:' Makefile | sed 's/://' | sort | uniq

## Caddy and nginx stuff for high level maintenance

caddy_status:  ## Show the current status of the Caddy service
	@echo "=== Caddy status ==="
	sudo systemctl status caddy --no-pager --lines=15

caddy_current_config:  ## Display the current Caddy configuration
	@echo "=== Current Caddy Configuration ==="
	cat /etc/caddy/Caddyfile

caddy_reload_config: ## Reload Caddy configuration
	@echo "=== Reloading caddy config ==="
	sudo caddy reload --config /etc/caddy/Caddyfile

caddy_replace_config: ## Replace the current Caddy configuration for the new one in ./caddyConfiguration/Caddyfile
	@echo "=== Replacing caddy configuration"
	sudo cp ./caddyConfiguration/Caddyfile /etc/caddy/Caddyfile

caddy_show_initial_html:  ## Display the initial HTML page served by Caddy
	@echo "=== Initial html served by Caddy ==="
	cat /usr/share/caddy/alma.us.es/index.html


caddy_logs:  ## Show the latest 200 lines of Caddy logs
	@echo "=== Caddy Logs ==="
	sudo journalctl -u caddy -n 200 --no-pager

## Nginx stuff

nginx_status: ## Show the current status of the Nginx container
	@echo "=== Nginx status (container: $(NGINX_CONTAINER)) ==="
	docker ps --filter "name=$(NGINX_CONTAINER)"

nginx_current_config:  ## Display the current nginx configuration
	@echo "=== Current nginx config ==="
	docker exec -it sla-proxy cat /etc/nginx/nginx.conf

nginx_reload_config:
	docker exec sla-proxy nginx -s reload

nginx_check_config:  ## Verify nginx configuration syntax
	@echo "Verifying nginx.conf syntax"
	docker exec sla-proxy nginx -t

nginx_show_initial_html: ## Show the initial HTML served by nginx
	@echo "=== Initial HTML served by Nginx ==="
	docker exec $(NGINX_CONTAINER) cat /usr/share/nginx/html/index.html

nginx_logs: ## Show the latest 200 lines of nginx access & error logs
	@echo "=== showing Nginx logs ==="
	docker logs $(NGINX_CONTAINER)


## Docker stuff

docker_status:  ## Show active and all Docker containers
	@echo "=== Active containers ==="
	docker ps
	@echo "\n=== All containers ==="
	docker ps -a
	@echo "\n=== Current downloaded images ==="
	docker images
	@echo "\n=== Current volumes ==="
	docker volume ls
	@echo "\n=== Current networks ==="
	docker network ls

# =====================================================
# Low-level maintenance: SLA generation and nginx config
# =====================================================

create_slas_using_template:  ## Generate or update SLAs using an SLA template and a csv with the users (preserves existing API keys)
	@echo "# Creating/updating SLAs via API..."
	@if [ "${TEMPLATE_PATH}" = "" ]; then \
		echo "No template set. Please specify a template using TEMPLATE_PATH option"; \
		exit 1; \
	fi
	@if [ "${USERS_CSV_PATH}" = "" ]; then \
		echo "No user csv provided. Please enter an user csv using USERS_CSV_PATH option"; \
		exit 1; \
	fi
	@if [ "${USER_KEYS_JSON_PATH}" = "" ]; then \
		echo "Please enter a path for the file containing user-keys correspondence. Use USER_KEYS_JSON_PATH option"; \
		exit 1; \
	fi
	curl -f -X POST "$(API_URL)/slas" \
		-H 'Content-Type: application/json' \
		-d '{"templatePath":"$(abspath $(TEMPLATE_PATH))","csvPath":"$(abspath $(USERS_CSV_PATH))","slasPath":"$(abspath $(SLAS_PATH))","numKeysPerUser":$(NUM_KEYS_PER_USER),"userKeysJsonPath":"$(abspath $(USER_KEYS_JSON_PATH))"}'
	@echo "# SLAs created/updated"

create_nginx_config:  ## Generate nginx.conf + conf.d/ from SLAs and run tests
	@echo "# Generating nginx config via API..."
	curl -f -X POST "$(API_URL)/nginx/config" \
		-H 'Content-Type: application/json' \
		-d '{"outDir":"$(abspath $(NGINX_OUT_DIR))","oasPath":"$(abspath $(OAS_PATH))","slasPath":"$(abspath $(SLAS_PATH))","authLocation":"$(AUTH_LOCATION)"}'
	@echo "# Nginx config generated"
	@echo "# Checking SLAs..."
	cd tests && npx -y cross-env NGINX_FILE_TO_TEST="$(shell wslpath -m $(abspath $(NGINX_OUT_DIR)/nginx.conf) 2>/dev/null || echo $(abspath $(NGINX_OUT_DIR)/nginx.conf))" npm test
	cd ..

replace_nginx_config:  ## Generate nginx config, validate syntax and reload the nginx container
	@echo "# Generating nginx config and reloading via API..."
	curl -f -X POST "$(API_URL)/nginx/config/reload" \
		-H 'Content-Type: application/json' \
		-d '{"outDir":"$(abspath $(NGINX_OUT_DIR))","oasPath":"$(abspath $(OAS_PATH))","slasPath":"$(abspath $(SLAS_PATH))","authLocation":"$(AUTH_LOCATION)","nginxContainer":"$(NGINX_CONTAINER)"}'
	@echo "# Nginx config generated and reloaded"
	@echo "# Checking SLAs..."
	cd tests && npx -y cross-env NGINX_FILE_TO_TEST="$(shell wslpath -m $(abspath $(NGINX_OUT_DIR)/nginx.conf) 2>/dev/null || echo $(abspath $(NGINX_OUT_DIR)/nginx.conf))" npm test
	cd ..

check_slas: ## Run tests to check if the SLAs defined in nginx.conf are valid
	@echo "# Checking SLAs..."
	cd tests && npx -y cross-env NGINX_FILE_TO_TEST="$(shell wslpath -m $(abspath $(NGINX_OUT_DIR)/nginx.conf) 2>/dev/null || echo $(abspath $(NGINX_OUT_DIR)/nginx.conf))" npm test
	cd ..