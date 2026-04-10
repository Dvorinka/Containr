# MeiliSearch Search Engine Template

## Overview
MeiliSearch is a fast, typo-tolerant search engine for your applications and websites.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  meilisearch:
    image: getmeili/meilisearch:v1.8
    container_name: meilisearch
    restart: unless-stopped
    ports:
      - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=your-master-key-here
      - MEILI_ENV=production
      - MEILI_DB_ENGINE=rocksdb
      - MEILI_DB_PATH=/meili_data
      - MEILI_HTTP_ADDR=0.0.0.0:7700
      - MEILI_SCHEDULE_SNAPSHOTS_ENABLED=true
      - MEILI_SCHEDULE_SNAPSHOTS_INTERVAL=3600
      - MEILI_SNAPSHOT_DIR=/meili_data/snapshots
    volumes:
      - meilisearch-data:/meili_data
    networks:
      - meilisearch-network

volumes:
  meilisearch-data:

networks:
  meilisearch-network:
    driver: bridge
```

## Environment Variables
- `MEILI_MASTER_KEY`: Master key for API authentication
- `MEILI_ENV`: Environment (development/production)
- `MEILI_DB_ENGINE`: Database engine (rocksdb)
- `MEILI_DB_PATH`: Database storage path
- `MEILI_HTTP_ADDR`: HTTP bind address
- `MEILI_SCHEDULE_SNAPSHOTS_ENABLED`: Enable automatic snapshots
- `MEILI_SCHEDULE_SNAPSHOTS_INTERVAL`: Snapshot interval in seconds

## Setup Guide
1. **Generate Master Key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Deploy**:
   ```bash
   docker-compose up -d
   ```

3. **Verify Installation**:
   ```bash
   curl http://localhost:7700/health
   ```

4. **Access**: Open http://localhost:7700 for basic info

## API Usage

### Index Creation
```bash
# Create an index
curl -X POST 'http://localhost:7700/indexes' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '{
  "uid": "movies",
  "primaryKey": "id"
}'
```

### Document Addition
```bash
# Add documents
curl -X POST 'http://localhost:7700/indexes/movies/documents' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '[
  {
    "id": 1,
    "title": "Carol",
    "poster": "https://image.tmdb.org/t/p/w1280/5KCVsktQcYFzvrxpJ9KsImA3QoI.jpg",
    "overview": "An aspiring photographer develops an intimate relationship with an older woman.",
    "release_date": "2015-11-20"
  },
  {
    "id": 2,
    "title": "Mad Max: Fury Road",
    "poster": "https://image.tmdb.org/t/p/w1280/kqjL17yufvn9OVLyXYpvtyrFfak.jpg",
    "overview": "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler.",
    "release_date": "2015-05-15"
  }
]'
```

### Search
```bash
# Basic search
curl 'http://localhost:7700/indexes/movies/search?q=mad'

# Search with filters
curl 'http://localhost:7700/indexes/movies/search?q=carol&filter=release_date > 2015-01-01'

# Search with ranking
curl 'http://localhost:7700/indexes/movies/search?q=fury&rankingRules=typo,words,proximity,attribute,sort,exactness'
```

## Configuration

### Index Settings
```bash
# Configure search settings
curl -X PATCH 'http://localhost:7700/indexes/movies/settings' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '{
  "searchableAttributes": ["title", "overview"],
  "filterableAttributes": ["release_date"],
  "sortableAttributes": ["title", "release_date"],
  "rankingRules": [
    "typo",
    "words",
    "proximity",
    "attribute",
    "sort",
    "exactness"
  ],
  "stopWords": ["the", "a", "an"],
  "synonyms": {
    "wolverine": ["xmen", "logan"],
    "logan": ["wolverine", "xmen"]
  },
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": 5,
    "disableOnWords": [],
    "disableOnAttributes": []
  }
}'
```

### Searchable Attributes
```bash
# Set searchable attributes
curl -X PATCH 'http://localhost:7700/indexes/movies/settings/searchable-attributes' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '["title", "overview", "genre"]'
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.meilisearch.rule=Host(`search.yourdomain.com`)"
  - "traefik.http.routers.meilisearch.tls=true"
  - "traefik.http.routers.meilisearch.tls.certresolver=letsencrypt"
  - "traefik.http.services.meilisearch.loadbalancer.server.port=7700"
```

## Backup Strategy
```bash
# Create snapshot
curl -X POST 'http://localhost:7700/snapshots' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'

# List snapshots
curl 'http://localhost:7700/snapshots' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'

# Restore from snapshot
curl -X POST 'http://localhost:7700/snapshots/restore' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '{ "snapshotPath": "/meili_data/snapshots/snapshot-20231201-123456.ms" }'
```

## Performance Optimization
```yaml
# For better performance
environment:
  - MEILI_MAX_INDEXING_MEMORY=2G
  - MEILI_MAX_INDEXING_THREADS=4
  - MEILI_HTTP_PAYLOAD_SIZE_LIMIT=100MB
  - MEILI_DUMP_BATCH_SIZE=1000

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

## Client Libraries

### JavaScript
```javascript
import { MeiliSearch } from 'meilisearch'

const client = new MeiliSearch({
  host: 'http://localhost:7700',
  apiKey: 'YOUR_MASTER_KEY'
})

// Search
const results = await client.index('movies').search('mad max')

// Add documents
await client.index('movies').addDocuments([
  { id: 1, title: 'Carol', overview: '...' }
])
```

### Python
```python
import meilisearch

client = meilisearch.Client("http://localhost:7700", "YOUR_MASTER_KEY")

# Search
results = client.index("movies").search("mad max")

# Add documents
client.index("movies").add_documents([
  {"id": 1, "title": "Carol", "overview": "..."}
])
```

### PHP
```php
use MeiliSearch\Client;

$client = new Client('http://localhost:7700', 'YOUR_MASTER_KEY');

// Search
$results = $client->index('movies')->search('mad max');

// Add documents
$client->index('movies')->addDocuments([
  ['id' => 1, 'title' => 'Carol', 'overview' => '...']
]);
```

## Use Cases

### E-commerce Search
```bash
# Product search with filters
curl 'http://localhost:7700/indexes/products/search?q=laptop&filter=price < 1000 AND category = "electronics"'
```

### Document Search
```bash
# Full-text document search
curl 'http://localhost:7700/indexes/documents/search?q=machine learning&limit=20'
```

### User Search
```bash
# User directory search
curl 'http://localhost:7700/indexes/users/search?q=john&filter=department = "engineering"'
```

## Security
- Change default master key
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Monitoring
```bash
# Get stats
curl 'http://localhost:7700/stats' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'

# Get index info
curl 'http://localhost:7700/indexes/movies/stats' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'

# Get version
curl 'http://localhost:7700/version'
```

## Troubleshooting
- **Search not working**: Check index configuration
- **Performance issues**: Monitor resource usage
- **Authentication errors**: Verify master key
- **Data loss**: Restore from snapshot

## Maintenance
```bash
# Check logs
docker-compose logs -f meilisearch

# Restart service
docker-compose restart meilisearch

# Update image
docker-compose pull && docker-compose up -d

# Clean up old snapshots
find ./meilisearch-data/snapshots -name "*.ms" -mtime +7 -delete
```

## Advanced Features

### Faceted Search
```bash
# Configure facets
curl -X PATCH 'http://localhost:7700/indexes/movies/settings/faceting' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '{
  "maxValuesPerFacet": 10,
  "facets": ["genre", "release_date"]
}'

# Search with facets
curl 'http://localhost:7700/indexes/movies/search?q=action&facets=genre,release_date'
```

### Geosearch
```bash
# Add geo coordinates
curl -X POST 'http://localhost:7700/indexes/restaurants/documents' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer YOUR_MASTER_KEY' \
--data-binary '[
  {
    "id": 1,
    "name": "Nandos",
    "_geo": { "lat": 51.5064, "lng": -0.0741 }
  }
]'

# Geo search
curl 'http://localhost:7700/indexes/restaurants/search?q=nandos&filter=_geoRadius(51.5064, -0.0741, 2000)'
```

### Search Analytics
```bash
# Get search analytics
curl 'http://localhost:7700/indexes/movies/search?q=test&analytics=true' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'

# Get popular searches
curl 'http://localhost:7700/indexes/movies/searches/popular' \
-H 'Authorization: Bearer YOUR_MASTER_KEY'
```
