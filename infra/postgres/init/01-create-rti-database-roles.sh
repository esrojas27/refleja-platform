#!/bin/sh
set -eu

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${RTI_MIGRATOR_PASSWORD:?RTI_MIGRATOR_PASSWORD is required}"
: "${RTI_APP_PASSWORD:?RTI_APP_PASSWORD is required}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=database_name="$POSTGRES_DB" \
  --set=migrator_password="$RTI_MIGRATOR_PASSWORD" \
  --set=app_password="$RTI_APP_PASSWORD" <<-'SQL'
CREATE ROLE rti_migrator
    LOGIN
    PASSWORD :'migrator_password'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;

CREATE ROLE rti_app
    LOGIN
    PASSWORD :'app_password'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOREPLICATION
    NOBYPASSRLS;

GRANT CONNECT ON DATABASE :"database_name" TO rti_migrator, rti_app;
CREATE SCHEMA rti AUTHORIZATION rti_migrator;
GRANT USAGE ON SCHEMA rti TO rti_app;
SQL
