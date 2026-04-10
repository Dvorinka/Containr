# Supabase Open Source Firebase Alternative Template

## Overview
Supabase is an open source Firebase alternative that provides a complete backend-as-a-service platform.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  db:
    image: supabase/postgres:15.1.0.117
    container_name: supabase-db
    restart: always
    environment:
      POSTGRES_PASSWORD: your-super-secret-and-long-postgres-password
      POSTGRES_DB: postgres
      POSTGRES_INITDB_ARGS: --auth-host=scram
    volumes:
      - ./volumes/db:/var/lib/postgresql/data
      - ./volumes/db/init:/docker-entrypoint-initdb.d
    ports:
      - "54322:5432"
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - log_min_messages=warning
    networks:
      - supabase-network

  auth:
    image: supabase/gotrue:v2.91.3
    container_name: supabase-auth
    restart: always
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:your-super-secret-and-long-postgres-password@db:5432/auth
      GOTRUE_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_SITE_URL: http://localhost:3000
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_DISABLE_SIGNUP: false
      GOTRUE_EXTERNAL_EMAIL_ENABLED: true
      GOTRUE_MAILER_AUTOCONFIRM: true
      GOTRUE_EXTERNAL_PHONE_ENABLED: true
    ports:
      - "9999:9999"
    depends_on:
      - db
    networks:
      - supabase-network

  rest:
    image: postgrest/postgrest:v12.0.1
    container_name: supabase-rest
    restart: always
    environment:
      PGRST_DB_URI: postgres://authenticator:your-super-secret-and-long-postgres-password@db:5432/postgres
      PGRST_DB_SCHEMA: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_DB_SEARCH_PATH: public
      PGRST_SERVER_HOST: 0.0.0.0
      PGRST_SERVER_PORT: 3000
      PGRST_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
    ports:
      - "3000:3000"
    depends_on:
      - db
      - auth
    networks:
      - supabase-network

  realtime:
    image: supabase/realtime:v2.25.73
    container_name: supabase-realtime
    restart: always
    environment:
      PORT: 4000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: supabase_realtime_admin
      DB_PASSWORD: your-super-secret-and-long-postgres-password
      DB_NAME: postgres
      DB_AFTER_CONNECT_QUERY: 'SET application_name = ''realtime'''
      DB_ENC_KEY: supabaserealtimeprotected-please-replace-this
      API_JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      SECURE_CHANNELS: true
    ports:
      - "4000:4000"
    depends_on:
      - db
    networks:
      - supabase-network

  storage:
    image: supabase/storage:v0.48.0
    container_name: supabase-storage
    restart: always
    environment:
      ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOoJeerx0ntWqyT4DPCXUGSktY8R8Qw2HtWo
      SERVICE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8HdpbfsT3JApj1JNFo
      POSTGRES_PASSWORD: your-super-secret-and-long-postgres-password
      PGOPTIONS: "-c search_path=storage,public"
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      STORAGE_FILE_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
    volumes:
      - ./volumes/storage:/var/lib/storage
    ports:
      - "5000:5000"
    depends_on:
      - db
      - rest
    networks:
      - supabase-network

  meta:
    image: supabase/postgres-meta:v0.74.0
    container_name: supabase-meta
    restart: always
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: your-super-secret-and-long-postgres-password
    ports:
      - "8080:8080"
    depends_on:
      - db
    networks:
      - supabase-network

  functions:
    image: supabase/edge-runtime:v1.47.4
    container_name: supabase-functions
    restart: always
    environment:
      JWT_SECRET: your-super-secret-jwt-token-with-at-least-32-characters-long
      SUPABASE_URL: http://localhost:8000
      SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOoJeerx0ntWqyT4DPCXUGSktY8R8Qw2HtWo
      SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8HdpbfsT3JApj1JNFo
    volumes:
      - ./volumes/functions:/home/deno/functions
    ports:
      - "9000:9000"
    networks:
      - supabase-network

  kong:
    image: kong:3.4
    container_name: supabase-kong
    restart: always
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_ADMIN_GUI_URL: http://localhost:8002
    volumes:
      - ./volumes/kong:/var/lib/kong
      - ./kong.yml:/var/lib/kong/kong.yml
    ports:
      - "8000:8000"
      - "8001:8001"
      - "8002:8002"
    networks:
      - supabase-network

networks:
  supabase-network:
    driver: bridge
```

## Kong Configuration (kong.yml)
```yaml
_format_version: "3.0"
_transform: true

services:
- name: auth
  url: http://auth:9999
  routes:
  - name: auth
    paths: ["/auth/v1/*"]
    strip_path: false

- name: rest
  url: http://rest:3000
  routes:
  - name: rest
    paths: ["/rest/v1/*"]
    strip_path: false

- name: realtime
  url: http://realtime:4000/socket.io/
  routes:
  - name: realtime
    paths: ["/realtime/v1/*"]
    strip_path: false

- name: storage
  url: http://storage:5000
  routes:
  - name: storage
    paths: ["/storage/v1/*"]
    strip_path: false

- name: functions
  url: http://functions:9000
  routes:
  - name: functions
    paths: ["/functions/v1/*"]
    strip_path: false

- name: meta
  url: http://meta:8080
  routes:
  - name: meta
    paths: ["/pg-meta/*"]
    strip_path: false

plugins:
- name: cors
  service: auth
  config:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    headers: ["accept", "authorization", "content-type", "apikey", "x-client-info"]
    exposed_headers: ["content-length"]
    max_age: 3600
    credentials: true

- name: cors
  service: rest
  config:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    headers: ["accept", "authorization", "content-type", "apikey", "x-client-info"]
    exposed_headers: ["content-length"]
    max_age: 3600
    credentials: true

- name: cors
  service: storage
  config:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    headers: ["accept", "authorization", "content-type", "apikey", "x-client-info"]
    exposed_headers: ["content-length"]
    max_age: 3600
    credentials: true

- name: cors
  service: functions
  config:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    headers: ["accept", "authorization", "content-type", "apikey", "x-client-info"]
    exposed_headers: ["content-length"]
    max_age: 3600
    credentials: true
```

## Environment Variables Setup
```bash
# Generate secure passwords and tokens
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
DB_ENC_KEY=$(openssl rand -base64 32)

# Replace in docker-compose.yml
sed -i "s/your-super-secret-and-long-postgres-password/$POSTGRES_PASSWORD/g" docker-compose.yml
sed -i "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$JWT_SECRET/g" docker-compose.yml
sed -i "s/supabaserealtimeprotected-please-replace-this/$DB_ENC_KEY/g" docker-compose.yml
```

## Setup Guide
1. **Generate Secrets**:
   ```bash
   # Run the commands above to generate secure passwords
   ```

2. **Create Directories**:
   ```bash
   mkdir -p volumes/{db,storage,functions,kong}
   mkdir -p volumes/db/init
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access Points**:
   - **API Gateway**: http://localhost:8000
   - **Studio**: http://localhost:8000 (via Kong)
   - **Database**: localhost:54322
   - **Kong Admin**: http://localhost:8002

## API Endpoints
- **Auth**: http://localhost:8000/auth/v1/
- **REST**: http://localhost:8000/rest/v1/
- **Realtime**: http://localhost:8000/realtime/v1/
- **Storage**: http://localhost:8000/storage/v1/
- **Functions**: http://localhost:8000/functions/v1/
- **Meta**: http://localhost:8000/pg-meta/

## Database Setup
```sql
-- Create initial schema
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
```

## Client Libraries
```javascript
// JavaScript/TypeScript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:8000',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOoJeerx0ntWqyT4DPCXUGSktY8R8Qw2HtWo'
)

// Example usage
const { data, error } = await supabase
  .from('users')
  .select('*')
```

## Backup Strategy
```bash
# Backup database
docker exec supabase-db pg_dump -U postgres > supabase-backup.sql

# Backup storage
tar czf storage-backup.tar.gz volumes/storage/

# Restore database
docker exec -i supabase-db psql -U postgres < supabase-backup.sql
```

## Performance Optimization
```yaml
# PostgreSQL tuning
environment:
  POSTGRES_SHARED_PRELOAD_LIBRARIES: pg_stat_statements
  POSTGRES_MAX_CONNECTIONS: 200
  POSTGRES_SHARED_BUFFERS: 256MB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
```

## Security
- Change all default passwords
- Use HTTPS in production
- Enable RLS (Row Level Security)
- Regular database backups
- Monitor access logs

## Troubleshooting
- **Connection issues**: Check network and ports
- **Database errors**: Review PostgreSQL logs
- **Auth problems**: Verify JWT configuration
- **Storage failures**: Check disk permissions
