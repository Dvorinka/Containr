# Autoscaling with Cloudflare Tunnel

## Overview

This document explains how autoscaling works when using Cloudflare Tunnel with the Containr application.

## Architecture

```
Internet → Cloudflare Edge → Cloudflare Tunnel → Traefik → Backend Services
```

## Autoscaling Considerations

### 1. Cloudflare Tunnel Limitations

**Cloudflare Tunnel itself does NOT provide autoscaling.** It's a secure tunneling service that:
- Creates a persistent connection between your infrastructure and Cloudflare's edge
- Routes traffic through Cloudflare's global network
- Provides DDoS protection and CDN features

### 2. Where Autoscaling Happens

Autoscaling must be implemented at different layers:

#### A. Container Level (Docker Swarm/Kubernetes)
```yaml
# Example with Docker Swarm
backend:
  image: containr-backend
  deploy:
    replicas: 3
    update_config:
      parallelism: 1
      delay: 10s
    restart_policy:
      condition: on-failure
```

#### B. Application Level (Load Balancing)
Traefik automatically load balances between multiple backend instances:
```yaml
# Multiple backend containers
backend-1:
  # ... backend config
  labels:
    - "traefik.http.services.backend.loadbalancer.server.port=8080"

backend-2:
  # ... backend config
  labels:
    - "traefik.http.services.backend.loadbalancer.server.port=8080"
```

#### C. Cloud Level (Cloudflare Load Balancer - Paid Feature)
For true autoscaling, you'd need:
- Multiple deployments in different regions
- Cloudflare Load Balancer ($$$/month)
- Health checks and failover

## Implementation Options

### Option 1: Docker Swarm (Recommended for Single Host)

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy with autoscaling
docker stack deploy -c docker-compose.yml containr
```

### Option 2: Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: containr-backend
        ports:
        - containerPort: 8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Option 3: Manual Scaling with Scripts

```bash
#!/bin/bash
# scale-backend.sh

scale_up() {
    local current=$(docker ps --filter "name=containr-backend" --format "table {{.Names}}" | wc -l)
    local target=$((current + 1))
    
    echo "Scaling backend to $target instances..."
    
    for i in $(seq 1 $target); do
        docker run -d \
            --name containr-backend-$i \
            --network containr_containr-network \
            -e DATABASE_URL="..." \
            -e REDIS_URL="..." \
            containr-backend
    done
}

scale_down() {
    local current=$(docker ps --filter "name=containr-backend" --format "table {{.Names}}" | wc -l)
    local target=$((current - 1))
    
    if [ $target -lt 1 ]; then
        echo "Cannot scale below 1 instance"
        exit 1
    fi
    
    echo "Scaling backend to $target instances..."
    docker stop containr-backend-$target
    docker rm containr-backend-$target
}

case "$1" in
    up) scale_up ;;
    down) scale_down ;;
    *) echo "Usage: $0 [up|down]" ;;
esac
```

## Monitoring and Metrics

### Health Checks
All services include health checks:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### Metrics Collection
Traefik provides Prometheus metrics:
```yaml
# In docker-compose.yml
command:
  - "--metrics.prometheus=true"
  - "--metrics.prometheus.addentrypointslabels=true"
  - "--metrics.prometheus.addserviceslabels=true"
```

### Scaling Triggers
Monitor these metrics for scaling decisions:
- CPU usage (> 70%)
- Memory usage (> 80%)
- Response time (> 500ms)
- Error rate (> 5%)
- Queue depth (if using message queues)

## Production Recommendations

### 1. Use Docker Swarm or Kubernetes
- Better orchestration
- Built-in load balancing
- Health management
- Rolling updates

### 2. Implement Horizontal Pod Autoscaler (HPA)
- Automatic scaling based on metrics
- Min/max replica limits
- Configurable thresholds

### 3. Use Cloudflare Load Balancer (if budget allows)
- Geographic distribution
- Advanced health checks
- Traffic steering
- DDoS protection

### 4. Monitoring and Alerting
- Prometheus + Grafana
- Alertmanager
- Log aggregation (ELK stack)

## Example: Complete Autoscaling Setup

```yaml
# docker-compose.autoscale.yml
version: '3.8'

services:
  traefik:
    image: traefik:v3.2
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.swarmMode=true"
      - "--metrics.prometheus=true"
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager

  backend:
    image: containr-backend
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.http.services.backend.loadbalancer.server.port=8080"
        - "traefik.http.routers.backend.rule=Host(`api.${DOMAIN}`)"
        - "traefik.enable=true"

  prometheus:
    image: prom/prometheus
    deploy:
      replicas: 1
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    deploy:
      replicas: 1
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Summary

1. **Cloudflare Tunnel ≠ Autoscaling** - It's for secure connectivity
2. **Autoscaling happens at container/orchestration level**
3. **Traefik provides load balancing between instances**
4. **Use Docker Swarm or Kubernetes for production autoscaling**
5. **Monitor metrics and implement HPA for automatic scaling**
6. **Consider Cloudflare Load Balancer for multi-region setups**

## Quick Start Commands

```bash
# Start with autoscaling (Docker Swarm)
docker swarm init
docker stack deploy -c docker-compose.autoscale.yml containr

# Scale manually
docker service scale containr_backend=5

# Check status
docker service ls
docker service ps containr_backend

# View logs
docker service logs containr_backend
```
