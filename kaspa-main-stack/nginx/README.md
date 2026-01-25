# Nginx Configuration Guide for Klassik.99pace.space

## Installation on Ubuntu Server

This configuration is designed to be deployed on your existing Nginx setup.

### Step 1: Copy Configuration

```bash
# On the Ubuntu server
sudo cp klassik.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/klassik.conf /etc/nginx/sites-enabled/
```

### Step 2: Test Configuration

```bash
sudo nginx -t
```

### Step 3: Reload Nginx

```bash
sudo systemctl reload nginx
```

## SSL/TLS Setup (Recommended)

### Using Let's Encrypt (Free)

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx

sudo certbot --nginx -d klassik.99pace.space
```

Certbot will automatically modify the Nginx configuration to enable HTTPS.

### Manual SSL Setup

1. Obtain SSL certificates from your provider
2. Place certificates in `/etc/ssl/`
3. Uncomment the HTTPS server block in `klassik.conf`
4. Update certificate paths
5. Reload Nginx

## API Key Authentication

The middleware handles API key validation. The Nginx layer provides an optional additional check.

To enable Nginx-level API key validation:
1. Uncomment the API key validation block in the `/api` location
2. Update the API key value to match your `.env` configuration

## Rate Limiting

Current limits:
- **API**: 100 requests/minute per IP (burst: 20)
- **WebSocket**: 10 connections/second per IP (burst: 5)

Adjust the `limit_req_zone` directives to change these limits.

## Monitoring Nginx

View access logs:
```bash
sudo tail -f /var/log/nginx/kaspa-access.log
```

View error logs:
```bash
sudo tail -f /var/log/nginx/kaspa-error.log
```

## Firewall Configuration

Ensure ports are open:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## Performance Tuning

For high-traffic scenarios, add to `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 4096;

http {
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
    
    # Timeouts
    keepalive_timeout 65;
    send_timeout 30;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript;
}
```

## Troubleshooting

### Connection Refused
- Ensure Docker containers are running
- Check firewall rules
- Verify upstream server addresses in nginx.conf

### WebSocket Connection Fails
- Ensure Upgrade headers are properly set
- Check WebSocket timeout settings
- Verify middleware is running on correct port

### High Latency
- Enable HTTP/2
- Increase worker_connections
- Add caching for static assets
- Use CDN for global distribution
