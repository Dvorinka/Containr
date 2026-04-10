# Glance Dashboard Template

## Overview
Glance is a self-hosted dashboard that puts all your feeds in one place. It's designed to be simple, fast, and easy to use.

## Quick Start
```bash
# Create docker-compose.yml with the content below
docker-compose up -d
```

## Docker Compose
```yaml
version: '3.8'

services:
  glance:
    image: glanceapp/glance:latest
    container_name: glance
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TZ=America/New_York
    volumes:
      - ./glance.yml:/app/glance.yml:ro
      - ./glance-data:/app/data
    networks:
      - glance-network

volumes:
  glance-data:

networks:
  glance-network:
    driver: bridge
```

## Configuration File (glance.yml)
```yaml
server:
  port: 8080
  host: 0.0.0.0

pages:
  - name: Home
    columns: 3
    widgets:
      - type: calendar
        week-start: monday
        time-format: 12h
        show-week-numbers: true
        show-weekdays: true
        locale: en-US
        
      - type: bookmarks
        bookmarks:
          - title: GitHub
            url: https://github.com
            icon: https://github.com/favicon.ico
          - title: Reddit
            url: https://reddit.com
            icon: https://reddit.com/favicon.ico
          - title: YouTube
            url: https://youtube.com
            icon: https://youtube.com/favicon.ico
            
      - type: weather
        location: New York, NY
        units: imperial
        forecast-days: 5
        show-hourly: true
        api-key: your-openweather-api-key
        
      - type: rss
        feeds:
          - title: Tech News
            url: https://techcrunch.com/feed/
            limit: 5
          - title: Hacker News
            url: https://hnrss.org/frontpage
            limit: 5
        refresh-interval: 15m
        
      - type: search
        engines:
          - name: Google
            url: https://www.google.com/search?q=
          - name: DuckDuckGo
            url: https://duckduckgo.com/?q=
          - name: Wikipedia
            url: https://en.wikipedia.org/wiki/
            
      - type: clock
        format: 12h
        show-date: true
        show-seconds: false
        timezone: America/New_York
        
      - type: system
        show-cpu: true
        show-memory: true
        show-disk: true
        show-network: true
        refresh-interval: 5s
        
      - type: docker
        containers:
          - name: pihole
            icon: pi-hole
          - name: nextcloud
            icon: nextcloud
          - name: jellyfin
            icon: jellyfin
        show-status: true
        show-stats: true
        
      - type: iframe
        title: Grafana Dashboard
        url: http://grafana.yourdomain.com/d/overview
        height: 400
        
      - type: html
        title: Custom HTML
        content: |
          <h3>Welcome to Glance!</h3>
          <p>This is your personal dashboard.</p>
          <button onclick="alert('Hello!')">Click me</button>
        height: 200

  - name: Work
    columns: 2
    widgets:
      - type: calendar
        week-start: monday
        time-format: 24h
        locale: en-US
        
      - type: bookmarks
        bookmarks:
          - title: Company Portal
            url: https://portal.company.com
            icon: https://portal.company.com/favicon.ico
          - title: Email
            url: https://mail.company.com
            icon: https://mail.company.com/favicon.ico
          - title: Jira
            url: https://jira.company.com
            icon: https://jira.company.com/favicon.ico
            
      - type: rss
        feeds:
          - title: Company News
            url: https://company.com/news/feed
            limit: 3
          - title: Industry News
            url: https://industry.com/feed
            limit: 3
            
      - type: clock
        format: 24h
        show-date: true
        timezone: America/New_York

  - name: Media
    columns: 2
    widgets:
      - type: bookmarks
        bookmarks:
          - title: Jellyfin
            url: http://jellyfin.yourdomain.com
            icon: http://jellyfin.yourdomain.com/favicon.ico
          - title: Plex
            url: http://plex.yourdomain.com
            icon: http://plex.yourdomain.com/favicon.ico
          - title: Spotify
            url: https://open.spotify.com
            icon: https://open.spotify.com/favicon.ico
            
      - type: weather
        location: Los Angeles, CA
        units: imperial
        forecast-days: 3
        api-key: your-openweather-api-key
        
      - type: rss
        feeds:
          - title: Movie News
            url: https://movieweb.com/feed
            limit: 5
          - title: Music News
            url: https://pitchfork.com/feed
            limit: 5
```

## Widget Types

### Calendar Widget
```yaml
- type: calendar
  week-start: monday        # monday/sunday
  time-format: 12h          # 12h/24h
  show-week-numbers: true   # true/false
  show-weekdays: true       # true/false
  locale: en-US             # Locale code
  timezone: America/New_York # Timezone
```

### Bookmarks Widget
```yaml
- type: bookmarks
  bookmarks:
    - title: Site Name
      url: https://example.com
      icon: https://example.com/favicon.ico
      description: Optional description
      category: Optional category
```

### Weather Widget
```yaml
- type: weather
  location: "New York, NY"     # City, State or City, Country
  units: imperial             # imperial/metric
  forecast-days: 5           # Number of days (1-7)
  show-hourly: true           # Show hourly forecast
  api-key: your-openweather-api-key
```

### RSS Widget
```yaml
- type: rss
  feeds:
    - title: Feed Name
      url: https://example.com/feed.xml
      limit: 5                # Number of items
      refresh-interval: 15m   # Refresh interval
      show-description: true  # Show item descriptions
      show-thumbnail: true    # Show thumbnails
```

### Search Widget
```yaml
- type: search
  engines:
    - name: Google
      url: https://www.google.com/search?q=
      icon: https://google.com/favicon.ico
    - name: DuckDuckGo
      url: https://duckduckgo.com/?q=
      icon: https://duckduckgo.com/favicon.ico
    - name: Wikipedia
      url: https://en.wikipedia.org/wiki/
      icon: https://wikipedia.org/favicon.ico
```

### Clock Widget
```yaml
- type: clock
  format: 12h                 # 12h/24h
  show-date: true            # true/false
  show-seconds: false        # true/false
  timezone: America/New_York # Timezone
```

### System Widget
```yaml
- type: system
  show-cpu: true             # Show CPU usage
  show-memory: true          # Show memory usage
  show-disk: true            # Show disk usage
  show-network: true         # Show network usage
  refresh-interval: 5s      # Refresh interval
```

### Docker Widget
```yaml
- type: docker
  containers:
    - name: container-name
      icon: icon-name
      status-url: http://container:port/status
  show-status: true          # Show container status
  show-stats: true           # Show container stats
```

### Iframe Widget
```yaml
- type: iframe
  title: Widget Title
  url: https://example.com
  height: 400                # Height in pixels
  width: 100%                # Width in percentage
  border: none               # Border style
```

### HTML Widget
```yaml
- type: html
  title: Widget Title
  content: |
    <h3>Custom HTML Content</h3>
    <p>This can include any HTML content.</p>
    <script>
      // JavaScript code here
      console.log('Hello from Glance!');
    </script>
  height: 200                # Height in pixels
```

## Setup Guide
1. **Create Configuration**:
   ```bash
   # Create glance.yml
   touch glance.yml
   # Copy the example configuration above
   ```

2. **Get Weather API Key**:
   ```bash
   # Get API key from https://openweathermap.org/api
   ```

3. **Deploy**:
   ```bash
   docker-compose up -d
   ```

4. **Access**: Open http://localhost:8080

5. **Customize**: Edit glance.yml to your preferences

## Reverse Proxy (Traefik)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.glance.rule=Host(`glance.yourdomain.com`)"
  - "traefik.http.routers.glance.tls=true"
  - "traefik.http.routers.glance.tls.certresolver=letsencrypt"
  - "traefik.http.services.glance.loadbalancer.server.port=8080"
```

## Backup Strategy
```bash
# Backup configuration
cp glance.yml glance.yml.backup

# Backup data
docker run --rm -v glance-data:/app/data -v $(pwd):/backup alpine tar czf /backup/glance-data-backup.tar.gz -C /app/data .

# Restore data
docker run --rm -v glance-data:/app/data -v $(pwd):/backup alpine tar xzf /backup/glance-data-backup.tar.gz -C /app/data

# Restart after restore
docker-compose restart glance
```

## Performance Optimization
```yaml
# For better performance
environment:
  - TZ=America/New_York

# Resource limits
deploy:
  resources:
    limits:
      memory: 256M
      cpus: '0.5'
    reservations:
      memory: 128M
      cpus: '0.2'
```

## Security
- Use HTTPS in production
- Network access control
- Regular backups
- Monitor access logs

## Customization

### Custom CSS
```yaml
# Add custom CSS to your HTML widget
- type: html
  content: |
    <style>
      .custom-widget {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
      }
    </style>
    <div class="custom-widget">
      <h3>Custom Styled Widget</h3>
    </div>
```

### Custom JavaScript
```yaml
- type: html
  content: |
    <script>
      // Auto-refresh widget
      setInterval(() => {
        fetch('https://api.example.com/data')
          .then(response => response.json())
          .then(data => {
            document.getElementById('data').textContent = data.value;
          });
      }, 5000);
    </script>
    <div id="data">Loading...</div>
```

## Advanced Examples

### Stock Ticker Widget
```yaml
- type: html
  title: Stock Prices
  content: |
    <div id="stocks">
      <div>AAPL: <span id="aapl">Loading...</span></div>
      <div>GOOGL: <span id="googl">Loading...</span></div>
      <div>MSFT: <span id="msft">Loading...</span></div>
    </div>
    <script>
      // Fetch stock prices (you'd need a real API)
      const stocks = ['AAPL', 'GOOGL', 'MSFT'];
      stocks.forEach(stock => {
        fetch(`https://api.example.com/stocks/${stock}`)
          .then(response => response.json())
          .then(data => {
            document.getElementById(stock.toLowerCase()).textContent = data.price;
          });
      });
    </script>
  height: 150
```

### Server Status Widget
```yaml
- type: html
  title: Server Status
  content: |
    <div id="server-status">
      <div>Web Server: <span id="web-status">Checking...</span></div>
      <div>Database: <span id="db-status">Checking...</span></div>
      <div>API: <span id="api-status">Checking...</span></div>
    </div>
    <script>
      const services = [
        { name: 'web', url: 'https://example.com' },
        { name: 'db', url: 'http://localhost:5432' },
        { name: 'api', url: 'https://api.example.com' }
      ];
      
      services.forEach(service => {
        fetch(service.url)
          .then(response => {
            const status = response.ok ? '✅ Online' : '❌ Offline';
            document.getElementById(`${service.name}-status`).textContent = status;
          })
          .catch(() => {
            document.getElementById(`${service.name}-status`).textContent = '❌ Offline';
          });
      });
    </script>
  height: 150
```

### Calendar Integration
```yaml
- type: html
  title: Google Calendar
  content: |
    <iframe src="https://calendar.google.com/calendar/embed?src=your-email@gmail.com" 
            style="border: 0" width="100%" height="300" frameborder="0" scrolling="no">
    </iframe>
  height: 300
```

## Troubleshooting
- **Configuration errors**: Check YAML syntax
- **Widget not loading**: Verify widget configuration
- **Performance issues**: Reduce refresh intervals
- **API errors**: Check API keys and URLs

## Maintenance
```bash
# Restart service
docker-compose restart

# Update image
docker-compose pull && docker-compose up -d

# Check logs
docker-compose logs -f glance

# Validate configuration
docker exec glance glance --validate-config
```

## Best Practices
1. **Keep it simple**: Don't overload your dashboard
2. **Use appropriate refresh intervals**: Don't refresh too frequently
3. **Monitor performance**: Keep an eye on resource usage
4. **Secure your dashboard**: Use authentication in production
5. **Backup regularly**: Save your configuration
6. **Test widgets**: Ensure all widgets work properly
7. **Use HTTPS**: Always use HTTPS in production
8. **Organize pages**: Group related widgets on separate pages

## Mobile Support
- Glance is mobile-responsive
- Use touch-friendly widgets
- Consider mobile data usage
- Test on different screen sizes

## Integration Examples

### Home Assistant Integration
```yaml
- type: html
  title: Home Assistant
  content: |
    <iframe src="http://homeassistant.local:8123/lovelace-dashboard" 
            style="border: 0" width="100%" height="400" frameborder="0">
    </iframe>
  height: 400
```

### Grafana Integration
```yaml
- type: html
  title: System Metrics
  content: |
    <iframe src="http://grafana.local:3000/d-solo/system-overview" 
            style="border: 0" width="100%" height="300" frameborder="0">
    </iframe>
  height: 300
```

### Custom API Integration
```yaml
- type: html
  title: API Status
  content: |
    <div id="api-status">
      <div>API Response Time: <span id="response-time">Checking...</span></div>
      <div>Last Updated: <span id="last-updated">-</span></div>
    </div>
    <script>
      const checkAPI = () => {
        const start = Date.now();
        fetch('https://api.example.com/health')
          .then(response => {
            const responseTime = Date.now() - start;
            document.getElementById('response-time').textContent = `${responseTime}ms`;
            document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
          })
          .catch(() => {
            document.getElementById('response-time').textContent = 'Error';
          });
      };
      
      checkAPI();
      setInterval(checkAPI, 30000); // Check every 30 seconds
    </script>
  height: 100
```
