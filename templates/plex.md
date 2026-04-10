# Plex Media Server Template

## Overview
Plex is a media server software that lets you organize and stream your media library.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  plex:
    image: lscr.io/linuxserver/plex:latest
    container_name: plex
    restart: unless-stopped
    network_mode: host
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - PLEX_CLAIM=your-claim-token
      - PLEX_ADVERTISE_IP=http://your-local-ip
      - ALLOWED_NETWORKS=192.168.1.0/24
    volumes:
      - ./config:/config
      - /path/to/movies:/data/movies
      - /path/to/tv:/data/tvshows
      - /path/to/music:/data/music
      - /path/to/photos:/data/photos
      - /path/to/transcode:/transcode

volumes:
  config:
```

## Environment Variables
- `PUID`: User ID for file permissions
- `PGID`: Group ID for file permissions  
- `TZ`: Timezone (find yours: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- `PLEX_CLAIM`: Claim token from https://plex.tv/claim
- `PLEX_ADVERTISE_IP`: Your server's local IP
- `ALLOWED_NETWORKS`: Networks allowed to access Plex

## Setup Guide
1. **Get Claim Token**:
   - Visit https://plex.tv/claim
   - Copy the token (valids for 4 minutes)

2. **Prepare Media Directories**:
   ```bash
   mkdir -p /path/to/movies
   mkdir -p /path/to/tvshows
   mkdir -p /path/to/music
   mkdir -p /path/to/photos
   mkdir -p /path/to/transcode
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://your-local-ip:32400/web

5. **Complete Setup**:
   - Sign in/create Plex account
   - Add media libraries
   - Configure remote access

## Directory Structure
```
/path/to/media/
├── movies/
│   ├── Movie Name (Year)/
│   │   ├── Movie Name (Year).mp4
│   │   └── subtitles/
├── tvshows/
│   ├── Show Name/
│   │   ├── Season 01/
│   │   │   ├── S01E01.mkv
│   │   │   └── S01E02.mkv
│   │   └── Season 02/
├── music/
│   └── Artist Name/
│       └── Album Name/
│           ├── song1.mp3
│           └── song2.mp3
└── photos/
    └── 2024/
        ├── vacation/
        └── family/
```

## Hardware Requirements
- **CPU**: Intel Core i3 or better (for transcoding)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: SSD for OS/apps, HDD for media
- **Network**: Gigabit recommended for 4K streaming

## Performance Optimization
```yaml
# For systems with limited resources
environment:
  - PLEX_TRANSCODER_CACHE_SIZE=200000000
  - PLEX_RAMDISK_SIZE=300000000

# For NVIDIA GPU transcoding
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## Reverse Proxy (Traefik)
```yaml
# Note: Plex works best with host networking, but if using bridge mode:
ports:
  - "32400:32400"
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.plex.rule=Host(`plex.yourdomain.com`)"
  - "traefik.http.routers.plex.tls=true"
  - "traefik.http.routers.plex.tls.certresolver=letsencrypt"
  - "traefik.http.services.plex.loadbalancer.server.port=32400"
```

## Backup
```bash
# Backup Plex config
docker run --rm -v plex_config:/data -v $(pwd):/backup alpine tar czf /backup/plex-config.tar.gz -C /data .

# Restore Plex config
docker run --rm -v plex_config:/data -v $(pwd):/backup alpine tar xzf /backup/plex-config.tar.gz -C /data
```

## Monitoring
- **Logs**: `docker-compose logs -f plex`
- **Status**: Check web dashboard
- **Performance**: Monitor CPU/RAM usage during transcoding

## Security
- Use strong passwords
- Enable secure connections
- Regular updates
- Network segmentation if possible

## Troubleshooting
- **Port conflicts**: Use host networking or change ports
- **Permission issues**: Check PUID/PGID match host user
- **Transcoding**: Ensure sufficient CPU/RAM
- **Remote access**: Configure router port forwarding
