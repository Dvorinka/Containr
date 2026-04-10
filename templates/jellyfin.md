# Jellyfin Media Server Template

## Overview
Jellyfin is a free software media system that puts you in control of managing and streaming your media.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    restart: unless-stopped
    ports:
      - "8096:8096"
      - "8920:8920"  # HTTPS
      - "7359:7359/udp"  # Auto discovery
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - JELLYFIN_PublishedServerUrl=https://jellyfin.yourdomain.com
    volumes:
      - jellyfin-config:/config
      - jellyfin-cache:/cache
      - /path/to/media:/media
      - /path/to/movies:/media/movies
      - /path/to/tvshows:/media/tvshows
      - /path/to/music:/media/music
      - /path/to/photos:/media/photos
    devices:
      - /dev/dri:/dev/dri  # Hardware acceleration
    networks:
      - jellyfin-network

volumes:
  jellyfin-config:
  jellyfin-cache:

networks:
  jellyfin-network:
    driver: bridge
```

## Environment Variables
- `PUID`: User ID for file permissions
- `PGID`: Group ID for file permissions
- `TZ`: Timezone (find yours: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- `JELLYFIN_PublishedServerUrl`: Your server URL for external access

## Setup Guide
1. **Create Directories**:
   ```bash
   mkdir -p jellyfin/{config,cache}
   mkdir -p media/{movies,tvshows,music,photos}
   ```

2. **Set Permissions**:
   ```bash
   sudo chown -R 1000:1000 jellyfin media
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:8096

5. **Initial Setup**:
   - Choose language
   - Set up media libraries
   - Configure metadata
   - Set up users

## Media Library Setup

### Movies Library
```
/path/to/movies/
├── Movie Name (Year)/
│   ├── Movie Name (Year).mp4
│   ├── Movie Name (Year).nfo
│   ├── poster.jpg
│   ├── fanart.jpg
│   └── subtitles/
│       ├── en.srt
│       └── es.srt
```

### TV Shows Library
```
/path/to/tvshows/
├── Show Name/
│   ├── Season 01/
│   │   ├── S01E01.mkv
│   │   ├── S01E02.mkv
│   │   └── S01E03.mkv
│   ├── Season 02/
│   │   ├── S02E01.mkv
│   │   └── S02E02.mkv
│   ├── poster.jpg
│   ├── fanart.jpg
│   └── tvshow.nfo
```

### Music Library
```
/path/to/music/
├── Artist Name/
│   ├── Album Name/
│   │   ├── 01 - Song Name.mp3
│   │   ├── 02 - Another Song.mp3
│   │   ├── cover.jpg
│   │   └── album.nfo
│   └── artist.nfo
```

## Hardware Acceleration

### NVIDIA GPU
```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    runtime: nvidia
    environment:
      - JELLYFIN_FFMPEG__hwaccel__nvdec=true
      - JELLYFIN_FFMPEG__hwaccel__vaapi=false
    devices:
      - /dev/dri:/dev/dri
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Intel Quick Sync
```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    environment:
      - JELLYFIN_FFMPEG__hwaccel__vaapi=true
      - JELLYFIN_FFMPEG__hwaccel__nvdec=false
    devices:
      - /dev/dri:/dev/dri
    volumes:
      - /dev/dri:/dev/dri
```

### AMD VAAPI
```yaml
services:
  jellyfin:
    image: jellyfin/jellyfin:latest
    environment:
      - JELLYFIN_FFMPEG__hwaccel__vaapi=true
    devices:
      - /dev/dri:/dev/dri
```

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.jellyfin.rule=Host(`jellyfin.yourdomain.com`)"
  - "traefik.http.routers.jellyfin.tls=true"
  - "traefik.http.routers.jellyfin.tls.certresolver=letsencrypt"
  - "traefik.http.services.jellyfin.loadbalancer.server.port=8096"
```

## Configuration Files

### System.xml (`jellyfin-config/system.xml`)
```xml
<?xml version="1.0"?>
<SystemConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <AlbumArtworkMaxWidth>400</AlbumArtworkMaxWidth>
  <AlbumArtworkMaxResolution>480</AlbumArtworkMaxResolution>
  <MaxAlbumArtworkDownloadThreads>4</MaxAlbumArtworkDownloadThreads>
  <ChapterImageResolution>600</ChapterImageResolution>
  <DownloadImagesInAdvance>false</DownloadImagesInAdvance>
  <EnableLocalIpAutoDiscovery>true</EnableLocalIpAutoDiscovery>
  <EnableExternalIpAutoDiscovery>false</EnableExternalIpAutoDiscovery>
  <EnableUPnP>true</EnableUPnP>
  <PublicPort>8096</PublicPort>
  <HttpServerPortNumber>8096</HttpServerPortNumber>
  <HttpsPortNumber>8920</HttpsPortNumber>
  <EnableHttps>false</EnableHttps>
  <RequireHttps>false</RequireHttps>
  <BaseUrl></BaseUrl>
  <UDPPortNumber>7359</UDPPortNumber>
  <EnableIP4>true</EnableIP4>
  <EnableIP6>false</EnableIP6>
  <EnableIPv6Firewall>false</EnableIPv6Firewall>
  <EnableSSDPTracing>true</EnableSSDPTracing>
  <SSDPTracingFilter></SSDPTracingFilter>
  <UPnPCreateHttpPortMapping>true</UPnPCreateHttpPortMapping>
  <UPnPCreateHttpsPortMapping>false</UPnPCreateHttpsPortMapping>
  <BaseHttpPort>8096</BaseHttpPort>
  <BaseHttpsPort>8920</BaseHttpsPort>
  <EnableAutomaticPortMapping>true</EnableAutomaticPortMapping>
  <AutoRunWebApp>false</AutoRunWebApp>
  <DisableAutoWebApp>false</DisableAutoWebApp>
  <LaunchWebBrowserOnStartup>false</LaunchWebBrowserOnStartup>
  <UICulture>en-US</UICulture>
  <SaveMetadataHidden>false</SaveMetadataHidden>
  <MetadataUpdateMode>FullRefresh</MetadataUpdateMode>
  <MetadataSavers>
    <NfoSaver>
      <Enabled>true</Enabled>
      <Path>/config/metadata/Nfo</Path>
      <UserDataPath>/config/metadata/Nfo</UserDataPath>
    </NfoSaver>
  </MetadataSavers>
  <MetadataNetworkPath></MetadataNetworkPath>
  <MetadataPath></MetadataPath>
  <PreferredMetadataLanguage>en</PreferredMetadataLanguage>
  <PreferredMetadataLanguageCode>en</PreferredMetadataLanguageCode>
  <SeasonZeroDisplayName>Specials</SeasonZeroDisplayName>
  <LibraryMonitorDelay>60</LibraryMonitorDelay>
  <ImageSavingConvention>Compatible</ImageSavingConvention>
</SystemConfiguration>
```

### Encoding.xml (`jellyfin-config/encoding.xml`)
```xml
<?xml version="1.0"?>
<EncodingConfiguration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <EncodingThreadCount>0</EncodingThreadCount>
  <MaxMuxingQueueSize>4096</MaxMuxingQueueSize>
  <ThrottleDelaySeconds>0</ThrottleDelaySeconds>
  <EnableHardwareEncoding>true</EnableHardwareEncoding>
  <EnableHardwareDecoding>true</EnableHardwareDecoding>
  <EnableSubtitleExtraction>true</EnableSubtitleExtraction>
  <EnableThrottling>false</EnableThrottling>
  <EnableAudioVbr>true</EnableAudioVbr>
  <DownMixAudioBoost>2</DownMixAudioBoost>
  <MaxAudioChannels>6</MaxAudioChannels>
  <MaxAudioBitrate>128000</MaxAudioBitrate>
  <MaxAudioTranscodingBitrate>384000</MaxAudioTranscodingBitrate>
  <H264Preset>fast</H264Preset>
  <H264Crf>23</H264Crf>
  <H265Preset>fast</H265Preset>
  <H265Crf>23</H265Crf>
  <TonemapPreset>bt2390</TonemapPreset>
  <TonemapRange>auto</TonemapRange>
  <TonemapDesaturation>0</TonemapDesaturation>
  <TonemapPeak>100</TonemapPeak>
  <TonemapGamma>2.2</TonemapGamma>
  <VideoBitrate>4000000</VideoBitrate>
</EncodingConfiguration>
```

## Backup Strategy
```bash
# Backup Jellyfin configuration
docker run --rm -v jellyfin-config:/config -v $(pwd):/backup alpine tar czf /backup/jellyfin-config-backup.tar.gz -C /config .

# Backup cache (optional)
docker run --rm -v jellyfin-cache:/cache -v $(pwd):/backup alpine tar czf /backup/jellyfin-cache-backup.tar.gz -C /cache .

# Restore configuration
docker run --rm -v jellyfin-config:/config -v $(pwd):/backup alpine tar xzf /backup/jellyfin-config-backup.tar.gz -C /config

# Restart after restore
docker-compose restart jellyfin
```

## Performance Optimization
```yaml
# For better performance
environment:
  - JELLYFIN_CACHE_PATH=/cache
  - JELLYFIN_WEB_PORT=8096
  - JELLYFIN_HTTP_PORT=8096

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
- Change default admin password
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Client Apps

### Official Apps
- **Web**: Built-in web interface
- **Desktop**: Windows, macOS, Linux
- **Mobile**: iOS, Android
- **TV**: Android TV, Fire TV, Roku

### Third-party Apps
- **iOS**: Infuse, nPlayer
- **Android**: VLC, MX Player
- **Desktop**: VLC, MPC-HC

## API Usage

### Get Server Info
```bash
curl -X GET "http://localhost:8096/System/Public" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY"
```

### Get Users
```bash
curl -X GET "http://localhost:8096/Users" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY"
```

### Get Libraries
```bash
curl -X GET "http://localhost:8096/Users/USER_ID/Items" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY"
```

## Plugins

### Popular Plugins
- **Subtitle Downloader**: Automatic subtitle downloads
- **Ombi**: Request system for media
- **TMDb Box Sets**: Automatic box set creation
- **Trakt**: Trakt.tv integration
- **AudioBookshelf**: Audiobook support

### Plugin Installation
```bash
# Download plugin
curl -L "https://github.com/jellyfin/jellyfin-plugin-repo/releases/download/v10/manifest.json" \
  -o /tmp/manifest.json

# Install via web interface or copy to plugins directory
```

## Monitoring

### Health Checks
```bash
# Check if Jellyfin is running
curl http://localhost:8096/health

# Get system info
curl http://localhost:8096/System/Info/Public
```

### Logs
```bash
# View logs
docker-compose logs -f jellyfin

# Check specific logs
docker exec jellyfin cat /config/log/jellyfin.log
```

## Troubleshooting
- **Playback issues**: Check codec support and hardware acceleration
- **Metadata problems**: Verify file naming and permissions
- **Network access**: Check firewall and port configuration
- **Performance issues**: Monitor CPU/memory usage
- **Transcoding failures**: Check ffmpeg configuration

## Maintenance
```bash
# Restart service
docker-compose restart jellyfin

# Update image
docker-compose pull && docker-compose up -d

# Clean up old logs
docker exec jellyfin find /config/log -name "*.log.*" -mtime +30 -delete

# Rebuild library
curl -X POST "http://localhost:8096/Library/Refresh" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY"
```

## Advanced Features

### Live TV
```yaml
# Add TV tuner support
devices:
  - /dev/dvb:/dev/dvb
  - /dev/bus/usb:/dev/bus/usb
```

### Bookmarks
```bash
# Sync bookmarks between devices
curl -X POST "http://localhost:8096/Sync/Users/USER_ID/Data" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY"
```

### Parental Controls
```bash
# Set parental controls via web interface
# Or via API
curl -X POST "http://localhost:8090/Users/USER_ID/Policy" \
  -H "Authorization: MediaBrowser Token=YOUR_API_KEY" \
  -d '{"MaxParentalRating": 18}'
```

## Integration Examples

### Home Assistant
```yaml
# In Home Assistant configuration.yaml
media_player:
  - platform: jellyfin
    host: http://192.168.1.10:8096
    api_key: YOUR_API_KEY
    username: your-username
    password: your-password
```

### Kodi
```bash
# Install Jellyfin Kodi addon
# Configure server URL and credentials
```

### Plex Migration
```bash
# Export Plex library
# Import to Jellyfin using compatible metadata
```

## Hardware Requirements

### Minimum Requirements
- **CPU**: 2 cores (4 recommended for transcoding)
- **RAM**: 2GB (4GB recommended)
- **Storage**: SSD for system, HDD for media
- **Network**: Gigabit recommended for 4K streaming

### Recommended Requirements
- **CPU**: Intel i5/i7 or AMD Ryzen 5/7
- **RAM**: 8GB+ 
- **GPU**: NVIDIA/Intel for hardware acceleration
- **Storage**: NVMe SSD for cache, large HDD for media
- **Network**: 10GbE for multiple 4K streams

## Best Practices
1. **Organize media**: Use proper folder structure
2. **Hardware acceleration**: Enable for better performance
3. **Regular backups**: Backup configuration and metadata
4. **Network optimization**: Use wired connections
5. **Monitor resources**: Keep an eye on CPU/memory usage
