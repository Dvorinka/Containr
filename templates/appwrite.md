# Appwrite Backend-as-a-Service Template

## Overview
Appwrite is an open-source backend-as-a-service platform that abstracts and simplifies complex development tasks behind a simple REST API.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  appwrite:
    image: appwrite/appwrite:latest
    container_name: appwrite
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "444:444"
    environment:
      - _APP_ENV=production
      - _APP_OPENSSL_KEY_V1=your-openssl-key-here
      - _APP_DOMAIN=http://localhost
      - _APP_DOMAIN_TARGET=http://localhost
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
      - _APP_DB_HOST=mariadb
      - _APP_DB_PORT=3306
      - _APP_DB_USER=root
      - _APP_DB_PASSWORD=instance-password
      - _APP_DB_SCHEMA=appwrite
      - _APP_INFLUXDB_HOST=influxdb
      - _APP_INFLUXDB_PORT=8086
      - _APP_INFLUXDB_USERNAME=appwrite
      - _APP_INFLUXDB_PASSWORD=your-influx-password
      - _APP_INFLUXDB_DATABASE=appwrite
      - _APP_MESSAGING_HOST=messaging
      - _APP_MESSAGING_PORT=80
      - _APP_EXECUTOR_HOST=executor
      - _APP_EXECUTOR_PORT=80
      - _APP_MAILER_HOST=mailer
      - _APP_MAILER_PORT=80
      - _APP_MAILER_SECURE=false
      - _APP_MAILER_USERNAME=your-email@gmail.com
      - _APP_MAILER_PASSWORD=your-app-password
      - _APP_MAILER_FROM=your-email@gmail.com
      - _APP_FUNCTIONS_ENV=executor
      - _APP_FUNCTIONS_TIMEOUT=900
      - _APP_FUNCTIONS_ASYNC=true
    volumes:
      - appwrite-uploads:/storage/uploads
      - appwrite-cache:/storage/cache
      - appwrite-config:/storage/config
    depends_on:
      - mariadb
      - redis
      - influxdb
      - messaging
      - executor
      - mailer
    networks:
      - appwrite-network

  mariadb:
    image: mariadb:10.6
    container_name: appwrite-mariadb
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=instance-password
      - MYSQL_DATABASE=appwrite
      - MYSQL_USER=appwrite
      - MYSQL_PASSWORD=secretpassword
    volumes:
      - appwrite-db:/var/lib/mysql
    networks:
      - appwrite-network

  redis:
    image: redis:7-alpine
    container_name: appwrite-redis
    restart: unless-stopped
    volumes:
      - appwrite-redis:/data
    networks:
      - appwrite-network

  influxdb:
    image: influxdb:1.8
    container_name: appwrite-influxdb
    restart: unless-stopped
    environment:
      - INFLUXDB_DB=appwrite
      - INFLUXDB_ADMIN_USER=appwrite
      - INFLUXDB_ADMIN_PASSWORD=your-influx-password
    volumes:
      - appwrite-influxdb:/var/lib/influxdb
    networks:
      - appwrite-network

  messaging:
    image: appwrite/messaging:latest
    container_name: appwrite-messaging
    restart: unless-stopped
    environment:
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
    depends_on:
      - redis
    networks:
      - appwrite-network

  executor:
    image: appwrite/executor:latest
    container_name: appwrite-executor
    restart: unless-stopped
    environment:
      - _APP_ENV=production
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
      - _APP_DB_HOST=mariadb
      - _APP_DB_PORT=3306
      - _APP_DB_USER=root
      - _APP_DB_PASSWORD=instance-password
      - _APP_DB_SCHEMA=appwrite
      - _APP_FUNCTIONS_ENV=executor
      - _APP_FUNCTIONS_TIMEOUT=900
      - _APP_FUNCTIONS_ASYNC=true
    volumes:
      - appwrite-functions:/storage/functions
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - mariadb
      - redis
    networks:
      - appwrite-network

  mailer:
    image: appwrite/mailer:latest
    container_name: appwrite-mailer
    restart: unless-stopped
    environment:
      - _APP_MAILER_HOST=mailer
      - _APP_MAILER_PORT=80
      - _APP_MAILER_SECURE=false
      - _APP_MAILER_USERNAME=your-email@gmail.com
      - _APP_MAILER_PASSWORD=your-app-password
      - _APP_MAILER_FROM=your-email@gmail.com
    networks:
      - appwrite-network

volumes:
  appwrite-uploads:
  appwrite-cache:
  appwrite-config:
  appwrite-db:
  appwrite-redis:
  appwrite-influxdb:
  appwrite-functions:

networks:
  appwrite-network:
    driver: bridge
```

## Environment Variables
- `_APP_ENV`: Environment (production/development)
- `_APP_OPENSSL_KEY_V1`: OpenSSL encryption key
- `_APP_DOMAIN`: Your domain URL
- `_APP_DB_*`: Database configuration
- `_APP_REDIS_*`: Redis configuration
- `_APP_INFLUXDB_*`: InfluxDB configuration
- `_APP_MAILER_*`: Email configuration
- `_APP_FUNCTIONS_*`: Cloud functions configuration

## Setup Guide
1. **Generate OpenSSL Key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Generate Database Passwords**:
   ```bash
   openssl rand -base64 16
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost

5. **Initial Setup**:
   - Create admin account
   - Set up first project
   - Generate API keys

## API Usage

### Authentication
```bash
# Create account
curl -X POST http://localhost/v1/account \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password","name":"John Doe"}'

# Login
curl -X POST http://localhost/v1/account/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Database Operations
```bash
# Create collection
curl -X POST http://localhost/v1/database/collections \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"name":"posts","read":["any"],"write":["any"]}'

# Create document
curl -X POST http://localhost/v1/database/collections/posts/documents \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"title":"Hello World","content":"This is my first post"}'

# List documents
curl http://localhost/v1/database/collections/posts/documents \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY"
```

### File Storage
```bash
# Upload file
curl -X POST http://localhost/v1/storage/files \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -F "file=@/path/to/file.jpg"

# Get file
curl http://localhost/v1/storage/files/FILE_ID/download \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID"
```

### Cloud Functions
```bash
# Create function
curl -X POST http://localhost/v1/functions \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"name":"hello-world","runtime":"node-18.0","execute":["any"],"events":[]}'

# Upload function code
curl -X POST http://localhost/v1/functions/FUNCTION_ID/code \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"code":"export default function(req, res) { res.json({message: \"Hello World\"}); }"}'

# Execute function
curl -X POST http://localhost/v1/functions/FUNCTION_ID/executions \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -d '{}'
```

## Client SDKs

### JavaScript/TypeScript
```javascript
import { Client, Account, Databases } from 'appwrite'

const client = new Client()
  .setEndpoint('http://localhost/v1')
  .setProject('YOUR_PROJECT_ID')

const account = new Account(client)
const databases = new Databases(client)

// Authentication
await account.createEmailSession('user@example.com', 'password')

// Database operations
const response = await databases.createDocument(
  'YOUR_DATABASE_ID',
  'YOUR_COLLECTION_ID',
  ID.unique(),
  { title: 'Hello World', content: 'This is my first post' }
)
```

### Python
```python
from appwrite.client import Client
from appwrite.services.account import Account
from appwrite.services.databases import Databases

client = Client()
client.set_endpoint('http://localhost/v1')
client.set_project('YOUR_PROJECT_ID')

account = Account(client)
databases = Databases(client)

# Authentication
account.create_email_session('user@example.com', 'password')

# Database operations
databases.create_document(
    'YOUR_DATABASE_ID',
    'YOUR_COLLECTION_ID',
    ID.unique(),
    { 'title': 'Hello World', 'content': 'This is my first post' }
)
```

### PHP
```php
use Appwrite\Client;
use Appwrite\Services\Account;
use Appwrite\Services\Databases;

$client = new Client();
$client->setEndpoint('http://localhost/v1')
       ->setProject('YOUR_PROJECT_ID');

$account = new Account($client);
$databases = new Databases($client);

// Authentication
$account->createEmailSession('user@example.com', 'password');

// Database operations
$databases->createDocument(
    'YOUR_DATABASE_ID',
    'YOUR_COLLECTION_ID',
    ID::unique(),
    ['title' => 'Hello World', 'content' => 'This is my first post']
);
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.appwrite.rule=Host(`api.yourdomain.com`)"
  - "traefik.http.routers.appwrite.tls=true"
  - "traefik.http.routers.appwrite.tls.certresolver=letsencrypt"
  - "traefik.http.services.appwrite.loadbalancer.server.port=80"
```

## Backup Strategy
```bash
# Backup Appwrite data
docker run --rm -v appwrite-uploads:/storage/uploads -v $(pwd):/backup alpine tar czf /backup/appwrite-uploads.tar.gz -C /storage/uploads .
docker run --rm -v appwrite-cache:/storage/cache -v $(pwd):/backup alpine tar czf /backup/appwrite-cache.tar.gz -C /storage/cache .
docker run --rm -v appwrite-config:/storage/config -v $(pwd):/backup alpine tar czf /backup/appwrite-config.tar.gz -C /storage/config .

# Backup database
docker exec appwrite-mariadb mysqldump -u root -pinstance-password appwrite > appwrite-db-backup.sql

# Restore database
docker exec -i appwrite-mariadb mysql -u root -pinstance-password appwrite < appwrite-db-backup.sql

# Restore Appwrite data
docker run --rm -v appwrite-uploads:/storage/uploads -v $(pwd):/backup alpine tar xzf /backup/appwrite-uploads.tar.gz -C /storage/uploads
docker run --rm -v appwrite-cache:/storage/cache -v $(pwd):/backup alpine tar xzf /backup/appwrite-cache.tar.gz -C /storage/cache
docker run --rm -v appwrite-config:/storage/config -v $(pwd):/backup alpine tar xzf /backup/appwrite-config.tar.gz -C /storage/config

# Restart after restore
docker-compose restart appwrite
```

## Performance Optimization
```yaml
# For better performance
environment:
  - _APP_REDIS_HOST=redis
  - _APP_REDIS_PORT=6379
  - _APP_CACHE_ENABLED=true
  - _APP_CACHE_QUOTA=100

# Resource limits
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2.0'
    reservations:
      memory: 1G
      cpus: '1.0'
```

## Security
- Change default passwords
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Monitoring

### Health Checks
```bash
# Check Appwrite health
curl http://localhost/health

# Check service status
docker-compose ps
```

### Logs
```bash
# View logs
docker-compose logs -f appwrite

# Check specific service logs
docker-compose logs -f mariadb
docker-compose logs -f redis
```

## Troubleshooting
- **Database connection**: Check MariaDB configuration
- **Redis connection**: Verify Redis settings
- **Function execution**: Check executor logs
- **Email issues**: Verify SMTP configuration
- **File uploads**: Check storage permissions

## Maintenance
```bash
# Restart services
docker-compose restart

# Update images
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec appwrite-mariadb mysql -u root -pinstance-password -e "DELETE FROM appwrite.cache WHERE expires < UNIX_TIMESTAMP();"
```

## Advanced Features

### Real-time Subscriptions
```javascript
// Subscribe to document changes
client.subscribe('documents', response => {
  console.log('Document changed:', response.payload)
})
```

### Webhooks
```bash
# Create webhook
curl -X POST http://localhost/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"name":"My Webhook","events":["database.documents.create"],"url":"https://your-domain.com/webhook"}'
```

### Scheduled Tasks
```bash
# Create scheduled task
curl -X POST http://localhost/v1/functions/FUNCTION_ID/schedules \
  -H "Content-Type: application/json" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  -d '{"schedule":"0 9 * * 1","timezone":"America/New_York"}'
```

## Use Cases

### Mobile App Backend
- User authentication
- Data storage
- File uploads
- Push notifications
- Real-time sync

### Web Application
- User management
- Database operations
- File storage
- Cloud functions
- API integration

### IoT Platform
- Device management
- Data collection
- Real-time monitoring
- Alert systems
- Analytics

## Integration Examples

### React App
```javascript
import { useState, useEffect } from 'react'
import { Client, Account } from 'appwrite'

const client = new Client()
  .setEndpoint('http://localhost/v1')
  .setProject('YOUR_PROJECT_ID')

const account = new Account(client)

function App() {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    account.get().then(setUser).catch(console.error)
  }, [])
  
  return <div>{user ? `Hello ${user.name}` : 'Loading...'}</div>
}
```

### Node.js Backend
```javascript
const { Client, Account } = require('appwrite')

const client = new Client()
  .setEndpoint('http://localhost/v1')
  .setProject('YOUR_PROJECT_ID')

const account = new Account(client)

// Server-side authentication
async function authenticateUser(email, password) {
  try {
    const session = await account.createEmailSession(email, password)
    return session
  } catch (error) {
    throw new Error('Authentication failed')
  }
}
```
