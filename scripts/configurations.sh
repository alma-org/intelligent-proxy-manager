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
