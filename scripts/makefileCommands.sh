#!/bin/bash
# ==== MAKEFILE COMMANDS REFERENCE ====
# All Makefile targets with their required and optional parameters.
# Run from the project root directory.

# ==== GENERATE SLAs ====

# Generate SLAs for basic users
make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersBasic.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json

# Generate SLAs for premium users
make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/premiumResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersPremium.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-premium.json

# Generate SLAs with multiple keys per user (optional: NUM_KEYS_PER_USER, SLAS_PATH)
make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersBasic.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json \
    NUM_KEYS_PER_USER=2 \
    SLAS_PATH=./specs/slas

# ==== GENERATE NGINX CONFIG ====

# Generate nginx config (default output dir: ./nginxConf)
make create_nginx_config

# Generate nginx config with custom output dir and OAS path
make create_nginx_config \
    NGINX_OUT_DIR=./nginxConf \
    OAS_PATH=./specs/hpc-oas.yaml \
    SLAS_PATH=./specs/slas \
    AUTH_LOCATION=header

# ==== REPLACE NGINX CONFIG (generate + validate + reload container) ====

# Replace nginx config using default container name (sla-proxy)
make replace_nginx_config

# Replace nginx config with all parameters
make replace_nginx_config \
    NGINX_OUT_DIR=./nginxConf \
    OAS_PATH=./specs/hpc-oas.yaml \
    SLAS_PATH=./specs/slas \
    AUTH_LOCATION=header \
    NGINX_CONTAINER=sla-proxy

# ==== CHECK SLAs (run tests against existing nginx.conf) ====

# Check SLAs using default output dir
make check_slas

# Check SLAs with custom output dir
make check_slas NGINX_OUT_DIR=./nginxConf

# ==== CADDY STATUS AND MANAGEMENT ====

make caddy_status
make caddy_current_config
make caddy_reload_config
make caddy_replace_config
make caddy_show_initial_html
make caddy_logs

# ==== NGINX STATUS AND MANAGEMENT ====

make nginx_status
make nginx_current_config
make nginx_reload_config
make nginx_check_config
make nginx_show_initial_html
make nginx_logs

# With custom container name
make nginx_status NGINX_CONTAINER=my-nginx
make nginx_logs NGINX_CONTAINER=my-nginx

# ==== DOCKER STATUS ====

make docker_status

# ==== FULL WORKFLOW EXAMPLES ====

# Workflow 1: Initial setup — generate SLAs and nginx config from scratch
make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersBasic.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json

make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/premiumResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersPremium.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-premium.json

make create_nginx_config \
    NGINX_OUT_DIR=./nginxConf \
    OAS_PATH=./specs/hpc-oas.yaml \
    SLAS_PATH=./specs/slas \
    AUTH_LOCATION=header

# Workflow 2: Update SLAs and reload the running nginx container
make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersBasic.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json

make create_slas_using_template \
    TEMPLATE_PATH=./specs/slaTemplates/premiumResearcher.yaml \
    USERS_CSV_PATH=./specs/csv/usersPremium.csv \
    USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-premium.json

make replace_nginx_config \
    NGINX_OUT_DIR=./nginxConf \
    OAS_PATH=./specs/hpc-oas.yaml \
    SLAS_PATH=./specs/slas \
    AUTH_LOCATION=header \
    NGINX_CONTAINER=sla-proxy
