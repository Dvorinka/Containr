# Home Assistant Template

## Overview
Home Assistant is an open source home automation that puts local control and privacy first.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    environment:
      - TZ=America/New_York
    volumes:
      - ./config:/config
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "8123:8123"
    privileged: true
    network_mode: host
    depends_on:
      - mqtt
      - postgres
    networks:
      - homeassistant-network

  mqtt:
    image: eclipse-mosquitto:2.0
    container_name: homeassistant-mqtt
    restart: unless-stopped
    volumes:
      - ./mqtt/config:/mosquitto/config
      - ./mqtt/data:/mosquitto/data
      - ./mqtt/log:/mosquitto/log
    ports:
      - "1883:1883"
      - "9001:9001"
    networks:
      - homeassistant-network

  postgres:
    image: postgres:15-alpine
    container_name: homeassistant-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=homeassistant
      - POSTGRES_USER=homeassistant
      - POSTGRES_PASSWORD=homeassistant
    volumes:
      - homeassistant-db:/var/lib/postgresql/data
    networks:
      - homeassistant-network

  zigbee2mqtt:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt
    restart: unless-stopped
    environment:
      - TZ=America/New_York
    volumes:
      - ./zigbee2mqtt/data:/app/data
      - /run/udev:/run/udev:ro
    ports:
      - "8080:8080"
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0
    networks:
      - homeassistant-network

volumes:
  homeassistant-db:

networks:
  homeassistant-network:
    driver: bridge
```

## Environment Variables
- `TZ`: Timezone (find yours: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Setup Guide
1. **Create Directories**:
   ```bash
   mkdir -p config mqtt/{config,data,log} zigbee2mqtt/data
   ```

2. **Configure MQTT** (`mqtt/config/mosquitto.conf`):
   ```conf
   listener 1883
   allow_anonymous false
   password_file /mosquitto/config/passwd
   
   listener 9001
   protocol websockets
   ```

3. **Create MQTT Password**:
   ```bash
   docker exec homeassistant-mqtt mosquitto_passwd -c /mosquitto/config/passwd homeassistant
   ```

4. **Configure Zigbee2MQTT** (`zigbee2mqtt/data/configuration.yaml`):
   ```yaml
   homeassistant: true
   permit_join: false
   mqtt:
     base_topic: zigbee2mqtt
     server: mqtt://homeassistant-mqtt:1883
     user: homeassistant
     password: your-mqtt-password
   serial:
     port: /dev/ttyUSB0
   ```

5. **Deploy**:
   ```bash
   docker-compose up -d
   ```

6. **Access**: Open http://localhost:8123

7. **Initial Setup**:
   - Create Home Assistant user account
   - Detect devices and integrations
   - Configure automations

## Configuration Files

### Home Assistant (`config/configuration.yaml`)
```yaml
homeassistant:
  name: Home
  latitude: 40.7128
  longitude: -74.0060
  elevation: 10
  unit_system: metric
  time_zone: America/New_York
  country: US

default_config:

http:
  server_port: 8123

mqtt:
  broker: homeassistant-mqtt
  port: 1883
  username: homeassistant
  password: your-mqtt-password

recorder:
  db_url: postgresql://homeassistant:homeassistant@homeassistant-postgres/homeassistant

logger:
  default: info
```

## Device Integration
- **Zigbee Devices**: Via Zigbee2MQTT
- **WiFi Devices**: Direct integration
- **Z-Wave**: Add Z-Wave integration
- **Cameras**: RTSP/ONVIF support
- **Sensors**: MQTT/HTTP/USB sensors

## Reverse Proxy (Traefik)
```yaml
# Note: Home Assistant works best with host networking
# If using bridge mode, add these labels:
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.homeassistant.rule=Host(`home.yourdomain.com`)"
  - "traefik.http.routers.homeassistant.tls=true"
  - "traefik.http.routers.homeassistant.tls.certresolver=letsencrypt"
  - "traefik.http.services.homeassistant.loadbalancer.server.port=8123"
```

## Backup Strategy
```bash
# Backup Home Assistant config
tar czf homeassistant-backup.tar.gz config/

# Backup database
docker exec homeassistant-postgres pg_dump -U homeassistant homeassistant > ha-db-backup.sql

# Restore database
docker exec -i homeassistant-postgres psql -U homeassistant homeassistant < ha-db-backup.sql
```

## Performance Optimization
```yaml
# For systems with limited resources
environment:
  - WEBSERVER_THREAD_POOL_SIZE=5
  - WEBSERVER_WORKER_TIMEOUT=30

# Resource limits
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## Security
- Change default MQTT password
- Use HTTPS in production
- Network access control
- Regular updates
- Monitor access logs

## Monitoring
- **Logs**: `docker-compose logs -f homeassistant`
- **Performance**: System monitor integration
- **Devices**: Device status dashboard
- **Automations**: Automation execution history

## Troubleshooting
- **Device discovery**: Check network connectivity
- **MQTT issues**: Verify broker configuration
- **Zigbee problems**: Check USB device permissions
- **Performance**: Monitor CPU/memory usage
- **Database errors**: Check PostgreSQL logs

## Hardware Requirements
- **CPU**: 2 cores minimum, 4 recommended
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 32GB minimum (SSD recommended)
- **Network**: Gigabit recommended for multiple devices

## Add-ons
- **HACS**: Home Assistant Community Store
- **Configurator**: Browser-based configuration editor
- **Terminal**: SSH terminal in HA
- **Samba**: File sharing
- **VS Code Server**: Code editor
