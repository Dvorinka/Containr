# Pi-hole DNS Ad Blocker Template

## Overview
Pi-hole is a DNS sinkhole that protects your devices from unwanted content without installing any client-side software.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  pihole:
    image: pihole/pihole:latest
    container_name: pihole
    restart: unless-stopped
    hostname: pihole
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "80:80/tcp"
      - "443:443/tcp"
    environment:
      - TZ=America/New_York
      - FTLCONF_webserver_api_password=your-secure-password
      - FTLCONF_dns_listeningMode=ALL
    volumes:
      - pihole-config:/etc/pihole
      - pihole-dnsmasq:/etc/dnsmasq.d
      - pihole-logs:/var/log
    cap_add:
      - NET_ADMIN
      - SYS_TIME
      - SYS_NICE
    networks:
      - pihole-network

volumes:
  pihole-config:
  pihole-dnsmasq:
  pihole-logs:

networks:
  pihole-network:
    driver: bridge
```

## Environment Variables
- `TZ`: Timezone (find yours: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- `FTLCONF_webserver_api_password`: Admin password for web interface
- `FTLCONF_dns_listeningMode`: DNS listening mode ('ALL' for bridge networks)

## Setup Guide
1. **Generate Secure Password**:
   ```bash
   openssl rand -base64 16
   ```

2. **Deploy**:
   ```bash
   docker-compose up -d
   ```

3. **Access**: Open http://localhost/admin

4. **Login**: Use your WEBPASSWORD

5. **Configure DNS Settings**:
   - Set upstream DNS servers
   - Configure local network settings
   - Enable/disable features

## Configuration Files

### Custom DNS Records (`pihole-dnsmasq.d/02-custom.conf`)
```conf
# Custom DNS records
address=/homeserver.lan/192.168.1.100
address=/nas.lan/192.168.1.101
address=/camera.lan/192.168.1.102

# Local domain resolution
local=/lan/
domain=lan
expand-hosts
```

### Custom Blocklists (`pihole-dnsmasq.d/03-blocklist.conf`)
```conf
# Additional blocklists
conf-file=/etc/pihole/custom.list

# Block specific domains
address=/ads.example.com/0.0.0.0
address=/tracker.example.com/0.0.0.0
```

### DHCP Configuration (`pihole-dnsmasq.d/04-dhcp.conf`)
```conf
# DHCP settings (optional)
dhcp-range=192.168.1.50,192.168.1.150,12h
dhcp-option=option:router,192.168.1.1
dhcp-option=option:dns,192.168.1.10
dhcp-option=option:ntp,192.168.1.1

# Static leases
dhcp-host=aa:bb:cc:dd:ee:ff,192.168.1.100,server
```

## Network Configuration

### Router Setup
1. **Disable DHCP on router** (if using Pi-hole for DHCP)
2. **Set DNS on router** to Pi-hole IP (192.168.1.10)
3. **Configure devices** to use router DNS

### Device Configuration
```bash
# Linux
echo "nameserver 192.168.1.10" | sudo tee /etc/resolv.conf

# Windows (PowerShell)
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "192.168.1.10"

# macOS
sudo networksetup -setdnsservers Wi-Fi 192.168.1.10
```

## Blocklist Management

### Default Blocklists
- Steven Black's blocklists
- Firebog blocklists
- Malware domains
- Ad-serving domains

### Custom Blocklists
```bash
# Add custom blocklist
curl -s https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts | sudo tee /etc/pihole/custom.list

# Add specific domains
echo "ads.example.com" | sudo tee -a /etc/pihole/custom.list
```

### Whitelisting
```bash
# Add domain to whitelist
docker exec pihole pihole -w example.com

# Remove from whitelist
docker exec pihole pihole -w -d example.com
```

## Advanced Configuration

### Conditional Forwarding
```yaml
environment:
  - CONDITIONAL_FORWARDING=true
  - CONDITIONAL_FORWARDING_IP=192.168.1.1
  - CONDITIONAL_FORWARDING_DOMAIN=lan
  - CONDITIONAL_FORWARDING_REVERSE=192.168.1.0/24
```

### DNSSEC
```yaml
environment:
  - DNSSEC=true
```

### DNS over TLS
```yaml
environment:
  - PIHOLE_DNS_=1.1.1.1@853#cloudflare-dns.com;1.0.0.1@853#cloudflare-dns.com
  - DNS_FQDN_REQUIRED=true
  - DNSSEC=true
```

## Monitoring and Statistics

### Web Interface
- **Dashboard**: Overview of DNS queries
- **Queries**: Real-time query log
- **Statistics**: Top domains, clients, and queries
- **Blocklists**: Manage blocklists and whitelists

### CLI Commands
```bash
# Check status
docker exec pihole pihole status

# View query log
docker exec pihole pihole -t

# Show top clients
docker exec pihole pihole -c

# Show top domains
docker exec pihole pihole -t -l

# Flush logs
docker exec pihole pihole -f
```

## API Usage
```bash
# Get stats
curl -s http://localhost/admin/api.php?summary

# Get top items
curl -s http://localhost/admin/api.php?topItems

# Get recent queries
curl -s http://localhost/admin/api.php?recentBlocked

# Add to whitelist
curl -X POST -d "list=whitelist&add=example.com" \
  http://localhost/admin/api.php

# Add to blacklist
curl -X POST -d "list=blacklist&add=ads.example.com" \
  http://localhost/admin/api.php
```

## Backup Strategy
```bash
# Backup Pi-hole configuration
docker run --rm -v pihole-config:/etc/pihole -v $(pwd):/backup alpine tar czf /backup/pihole-config-backup.tar.gz -C /etc/pihole .

# Backup gravity database
docker exec pihole cp /etc/pihole/gravity.db /tmp/gravity.db
docker cp pihole:/tmp/gravity.db ./gravity.db.backup

# Restore configuration
docker run --rm -v pihole-config:/etc/pihole -v $(pwd):/backup alpine tar xzf /backup/pihole-config-backup.tar.gz -C /etc/pihole

# Restart after restore
docker-compose restart pihole
```

## Performance Optimization
```yaml
# For better performance
environment:
  - DNSMASQ_CACHE_SIZE=10000
  - DNSMASQ_NEG_CACHE_TTL=3600
  - DNSMASQ_LOG_QUERIES=false

# Resource limits
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '1.0'
    reservations:
      memory: 256M
      cpus: '0.5'
```

## Security

### Firewall Configuration
```bash
# Allow DNS (port 53)
sudo ufw allow 53/tcp
sudo ufw allow 53/udp

# Allow HTTP (port 80)
sudo ufw allow 80/tcp

# Allow from local network only
sudo ufw allow from 192.168.1.0/24 to any port 53
sudo ufw allow from 192.168.1.0/24 to any port 80
```

### Access Control
```yaml
# Restrict web access
environment:
  - WEBTHEME=default-darker
  - TEMPERATUREUNIT=c
  - WEBUIBOXEDLAYOUT=traditional

# Enable password protection
environment:
  - WEBPASSWORD=your-secure-password
```

## Troubleshooting
- **DNS not working**: Check upstream DNS configuration
- **Web interface inaccessible**: Verify port and firewall settings
- **Performance issues**: Monitor resource usage
- **Blocklist not updating**: Check internet connectivity
- **DHCP conflicts**: Disable router DHCP if using Pi-hole DHCP

## Maintenance
```bash
# Update blocklists
docker exec pihole pihole -g

# Restart DNS service
docker exec pihole pihole restartdns

# Check logs
docker-compose logs -f pihole

# Update image
docker-compose pull && docker-compose up -d

# Clean up old logs
docker exec pihole find /var/log/pihole -name "*.log.*" -mtime +30 -delete
```

## Integration Examples

### Home Assistant
```yaml
# In Home Assistant configuration.yaml
sensor:
  - platform: rest
    resource: http://192.168.1.10/admin/api.php?summary
    name: Pi-hole Stats
    value_template: "{{ value_json.ads_blocked_today }}"
```

### Grafana Dashboard
```bash
# Add to Prometheus scrape config
- job_name: 'pihole'
  static_configs:
    - targets: ['pihole:80']
  metrics_path: /admin/api.php?summaryRaw
```

### Unifi Network
- Set Pi-hole as DNS server in Unifi Controller
- Configure DNS for all networks
- Monitor DNS queries through Unifi

## Advanced Features

### Regex Blocking
```bash
# Add regex blocklist
docker exec pihole pihole -b -adlist.regex "ads.*\.example\.com"
```

### Per-Client Blocking
```bash
# Create group for specific client
docker exec pihole pihole -g add "family" "Family Group"

# Add client to group
docker exec pihole pihole -c add "192.168.1.50" "family"

# Assign blocklist to group
docker exec pihole pihole -g assign "family" "default"
```

### Query Logging
```yaml
# Enable detailed logging
environment:
  - DNSMASQ_LOG_QUERIES=true
  - DNSMASQ_LOG_CACHE=true
```

## Privacy Considerations
- **Local DNS**: All queries processed locally
- **No tracking**: Pi-hole doesn't track users
- **Configurable logging**: Control what gets logged
- **Blocklist choice**: Choose your blocklists
- **Data retention**: Configure log retention policies
