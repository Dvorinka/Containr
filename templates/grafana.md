# Grafana Monitoring Template

## Overview
Grafana is an open source observability platform for visualizing metrics, logs, and traces.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource,grafana-worldmap-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./provisioning:/etc/grafana/provisioning
    networks:
      - grafana-network
    depends_on:
      - prometheus
      - loki

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    environment:
      - PROMETHEUS_RETENTION_TIME=30d
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    networks:
      - grafana-network

  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - ./loki.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - grafana-network

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    restart: unless-stopped
    volumes:
      - ./promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - grafana-network

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - grafana-network

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:rw
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    privileged: true
    devices:
      - /dev/kmsg
    networks:
      - grafana-network

volumes:
  grafana-data:
  prometheus-data:
  loki-data:

networks:
  grafana-network:
    driver: bridge
```

## Configuration Files

### Prometheus Configuration (`prometheus.yml`)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'grafana'
    static_configs:
      - targets: ['grafana:3000']

  - job_name: 'docker'
    static_configs:
      - targets: ['cadvisor:8080']
```

### Loki Configuration (`loki.yml`)
```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
    heartbeat_period: 15s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

### Promtail Configuration (`promtail.yml`)
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs:
      - json:
          expressions:
            tag:
          source: attrs
      - regex:
          expression: (?P<container_name>(?:[^|]*))\|
          source: tag
      - timestamp:
          format: RFC3339Nano
          source: time
      - labels:
          stream:
          container_name:
      - output:
          source: output

  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*log
```

## Environment Variables
- `GF_SECURITY_ADMIN_USER`: Grafana admin username
- `GF_SECURITY_ADMIN_PASSWORD`: Grafana admin password
- `GF_USERS_ALLOW_SIGN_UP`: Disable public sign-up
- `GF_INSTALL_PLUGINS`: Pre-install plugins

## Setup Guide
1. **Generate Secure Password**:
   ```bash
   openssl rand -base64 32
   ```

2. **Create Directories**:
   ```bash
   mkdir -p provisioning/{datasources,dashboards}
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:3000

5. **Initial Setup**:
   - Login with admin credentials
   - Add data sources
   - Import dashboards

## Data Sources

### Prometheus Data Source
```yaml
# provisioning/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Loki Data Source
```yaml
# provisioning/datasources/loki.yml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

## Dashboards

### System Dashboard
- CPU usage
- Memory usage
- Disk usage
- Network traffic
- Container metrics

### Docker Dashboard
- Container stats
- Image sizes
- Network usage
- Volume usage

### Application Dashboard
- Custom metrics
- Error rates
- Response times
- Request counts

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.grafana.rule=Host(`grafana.yourdomain.com`)"
  - "traefik.http.routers.grafana.tls=true"
  - "traefik.http.routers.grafana.tls.certresolver=letsencrypt"
  - "traefik.http.services.grafana.loadbalancer.server.port=3000"
```

## Backup Strategy
```bash
# Backup Grafana data
docker run --rm -v grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz -C /data .

# Backup Prometheus data
docker run --rm -v prometheus-data:/prometheus -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz -C /prometheus .

# Restore Grafana data
docker run --rm -v grafana-data:/data -v $(pwd):/backup alpine tar xzf /backup/grafana-backup.tar.gz -C /data
```

## Performance Optimization
```yaml
# Grafana performance
environment:
  - GF_LOG_LEVEL=error
  - GF_METRICS_ENABLED=false

# Prometheus performance
environment:
  - PROMETHEUS_STORAGE_TSDB_WAL_COMPRESSION=true
  - PROMETHEUS_WEB_MAX_CONCURRENCY=20
```

## Security
- Change default admin password
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Monitoring Targets
```yaml
# Add to prometheus.yml for additional services
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:9121']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

## Troubleshooting
- **Data source issues**: Check network connectivity
- **Dashboard problems**: Verify data source configuration
- **Performance issues**: Check resource usage
- **Storage problems**: Monitor disk space
- **Authentication errors**: Verify credentials

## Maintenance
```bash
# Check logs
docker-compose logs -f grafana

# Restart services
docker-compose restart

# Update images
docker-compose pull && docker-compose up -d

# Clean up old data
docker exec prometheus curl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
```
