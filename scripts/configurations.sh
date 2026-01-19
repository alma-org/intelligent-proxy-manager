# ==== COMMANDS TO START NGINX SERVERS ====

docker compose -p nginx-test -f docker-compose-testnginx-hpc.yaml up -d
docker compose -p nginx -f docker-compose-nginx-hpc.yaml up -d

# ==== CONFIGURATION TO GENERATE NEW APIKEYS AND START NGINX SERVER ====

# generate slas for basic users
make create_slas_using_template TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml USERS_CSV_PATH=./specs/csv/usersBasic.csv USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json

# generate slas for premium users
make create_slas_using_template TEMPLATE_PATH=./specs/slaTemplates/premiumResearcher.yaml USERS_CSV_PATH=./specs/csv/usersPremium.csv USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-premium.json

# generate nginx configuration for users
make create_nginx_config

# ==== CONFIGURATION TO REPLACE NGINX.CONF ==== 

# generate slas for basic users
make create_slas_using_template TEMPLATE_PATH=./specs/slaTemplates/basicResearcher.yaml USERS_CSV_PATH=./specs/csv/usersBasic.csv USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-basic.json

# generate slas for premium users
make create_slas_using_template TEMPLATE_PATH=./specs/slaTemplates/premiumResearcher.yaml USERS_CSV_PATH=./specs/csv/usersPremium.csv USER_KEYS_JSON_PATH=./specs/trazability/users-to-apikeys-premium.json

# generate nginx configuration for users
make replace_nginx_config

# ==== CREATE NEW NGINX.CONF FROM SLAS ====

# In windows
C:\Strawberry\c\bin\mingw32-make.exe create_nginx_config NGINX_CONF_PATH=test_nginx.conf NGINX_TARGET_CONFIG=test_nginx.conf

# Verify localhost replacement in windows
Get-Content test_nginx.conf | Select-String "listen 8080", "127.0.0.1:8000"

# In linux
make create_nginx_config NGINX_CONF_PATH=test_nginx.conf NGINX_TARGET_CONFIG=test_nginx.conf

# Verify localhost replacement in linux
grep -E "listen 8080|127.0.0.1:8000" test_nginx.conf

# Check SLAs 
make check_slas
# if you need to specify a nginx.conf file use this  
make check_slas NGINX_TARGET_CONFIG=../nginxConf/nginx2.conf