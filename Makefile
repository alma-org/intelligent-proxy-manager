SLA_WIZARD_PATH ?= ../sla-wizard/
AUTH_LOCATION ?= header
NUM_KEYS_PER_USER ?= 1
DOCKER_COMPOSE_NGINX ?= ./docker-compose/docker-compose-nginx-hpc.yaml
OAS_PATH ?= ./specs/hpc-oas.yaml
SLAS_PATH ?=./specs/slas
NGINX_CONF_PATH ?= ./nginx.conf

.DEFAULT_GOAL := help

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

caddy_config:  ## Display the current Caddy configuration
	@echo "=== Current Caddy Configuration ==="
	cat /etc/caddy/Caddyfile


replace_caddy_config: ## Replace the current Caddy configuration for the new one in ./caddyConfiguration/Caddyfile
	@echo "=== Replacing caddy configuration"
	sudo cp ./caddyConfiguration/Caddyfile /etc/caddy/Caddyfile

caddy_initial_html:  ## Display the initial HTML page served by Caddy
	@echo "=== Initial html served by Caddy ==="
	cat /usr/share/caddy/alma.us.es/index.html

docker_status:  ## Show active and all Docker containers
	@echo "=== Active containers ==="
	docker ps
	@echo "\n=== All containers ==="
	docker ps -a

caddy_logs:  ## Show the latest 200 lines of Caddy logs
	@echo "=== Caddy Logs ==="
	sudo journalctl -u caddy -n 200 --no-pager

current_nginx_config:  ## Display the current nginx configuration
	@echo "=== Current nginx config ==="
	cat ../nginxConf/nginx.conf

check_nginx_config:  ## Verify nginx configuration syntax
	echo "Verifying nginx.conf syntax" ; \
	docker exec sla-proxy nginx -t ; \

# =====================================================
# Low-level maintenance: SLA generation and nginx config
# =====================================================

create_slas_using_template:  ## Generate SLAs using an SLA template and a csv with the users
	@ echo "# Creating SLAs with sla-wizard using the given template..." ; \
	if [ "${TEMPLATE_PATH}" = "" ]; then \
	echo "No template set. Please specify a template using TEMPLATE_PATH option"; \
	exit 1; \
	fi
	if [ "${USERS_CSV_PATH}" = "" ]; then \
	echo "No user csv provided. Please enter an user csv using USERS_CSV_PATH option"; \
	exit 1; \
	fi
	if [ "${USER_KEYS_JSON_PATH}" = "" ]; then \
	echo "Please enter a path for the file containing user-keys correspondence. Use USER_KEYS_JSON_PATH option"; \
	exit 1; \
	fi
	node ${SLA_WIZARD_PATH}/src/index.js generate-slas --slaTemplate ${TEMPLATE_PATH} --csv ${USERS_CSV_PATH} --outDir ${SLAS_PATH} --numKeys ${NUM_KEYS_PER_USER} --mappingFile ${USER_KEYS_JSON_PATH} ; \
	@ echo "# SLAs created" ; \

create_nginx_config:  ## Generate nginx.conf file from SLAs
	@ echo "Creating proxy configuration file with sla-wizard for nginx" ; \
	node ${SLA_WIZARD_PATH}/src/index.js config --authLocation ${AUTH_LOCATION} nginx \
		--oas ${OAS_PATH} \
		--sla ${SLAS_PATH} \
		--outFile ${NGINX_CONF_PATH} ; \
	echo "...DONE" ; \
	echo "Replacing localhost:8000 → host.docker.internal:8000" ; \
	sed -i 's|localhost:8000|127.0.0.1:8000|g' ../nginxConf/nginx.conf ; \
	echo "...DONE" ; \
	echo "Ensuring nginx listens on port 8080 instead of 80 ;" \
	sed -i 's|listen 80;|listen 8080;|g' ../nginxConf/nginx.conf ; \
	echo "...DONE" ; \

replace_nginx_config:  ## Its as create_nginx_config but it replaces the current configuration by the new one and reloads nginx proxy to update changes
	@ echo "Creating proxy configuration file with sla-wizard for nginx" ; \
	node ${SLA_WIZARD_PATH}/src/index.js config --authLocation ${AUTH_LOCATION} nginx \
		--oas ${OAS_PATH} \
		--sla ${SLAS_PATH} \
		--outFile ../nginxConf/nginx.conf ; \
	echo "...DONE" ; \
	echo "Replacing localhost:8000 → host.docker.internal:8000" ; \
	sed -i 's|localhost:8000|127.0.0.1:8000|g' ../nginxConf/nginx.conf ; \
	echo "...DONE" ; \
	echo "Ensuring nginx listens on port 8080 instead of 80 ;" \
	sed -i 's|listen 80;|listen 8080;|g' ../nginxConf/nginx.conf ; \
	echo "...DONE" ; \
	echo "Verifying nginx.conf syntax" ; \
	docker exec sla-proxy nginx -t ; \
	echo "Reload nginx service" ; \
	docker exec sla-proxy nginx -s reload ; \
