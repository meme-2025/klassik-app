# Quick Start Guide

## Prerequisites

- Ubuntu Server 20.04+ (your Venus-Series server)
- Docker 24+
- Docker Compose v2
- kaspad v1.0.1 running on :16110
- 16GB RAM (minimum 8GB)
- 500GB SSD storage

## Installation Steps

### 1. Transfer Files to Server

From your Windows machine:

```powershell
cd C:\Users\TUF-s\Desktop\git\Klassik\kaspa-main-stack\scripts
.\deploy.sh
```

Or manually via SSH:

```bash
scp -i "C:\Users\TUF-s\.ssh\id_ed25519_new" -r kaspa-main-stack admxn@192.168.2.148:~/
```

### 2. Connect to Server

```bash
ssh -i "C:\Users\TUF-s\.ssh\id_ed25519_new" admxn@192.168.2.148
```

### 3. Run Installation

```bash
cd ~/kaspa-main-stack
chmod +x scripts/*.sh
./scripts/install_and_test.sh
```

Installation takes 10-15 minutes and will:
- Check system requirements
- Generate secure passwords
- Build Docker images
- Start all services
- Run validation tests

### 4. Configure Nginx

```bash
sudo cp nginx/klassik.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/klassik.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Setup SSL (Optional but Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d klassik.99pace.space
```

## Access Your Stack

After installation:

- **Frontend**: http://192.168.2.148:3000
- **API**: http://192.168.2.148:8080/api
- **WebSocket**: ws://192.168.2.148:8080/ws
- **Grafana**: http://192.168.2.148:3001
- **Prometheus**: http://192.168.2.148:9090

With Nginx configured:
- **Production Frontend**: https://klassik.99pace.space
- **Production API**: https://klassik.99pace.space/api
- **Production WebSocket**: wss://klassik.99pace.space/ws

## First Steps After Installation

1. **Check logs**:
   ```bash
   docker-compose logs -f middleware
   ```

2. **Verify block indexing**:
   ```bash
   docker-compose exec postgres psql -U kaspa_admin -d kaspa_mainnet -c "SELECT COUNT(*) FROM blocks"
   ```

3. **Test API** (replace API_KEY):
   ```bash
   API_KEY=$(grep API_KEY .env | cut -d'=' -f2)
   curl -H "x-api-key: $API_KEY" http://localhost:8080/api/info
   ```

4. **Open Grafana**:
   - URL: http://192.168.2.148:3001
   - Username: `admin`
   - Password: Check `.env` file

5. **Run tests**:
   ```bash
   ./scripts/run_tests.sh
   ```

## Common Commands

```bash
# View all services
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Run tests
./scripts/run_tests.sh

# Create backup
./scripts/backup.sh

# Monitor system
./scripts/monitor.sh
```

## Troubleshooting

### Services won't start

```bash
# Check Docker
docker --version
docker-compose --version

# Check logs
docker-compose logs

# Restart all
docker-compose down
docker-compose up -d
```

### Can't connect to kaspad

```bash
# Verify kaspad is running
ps aux | grep kaspad

# Check RPC port
nc -zv 127.0.0.1 16110

# Check firewall
sudo ufw status
```

### Database issues

```bash
# Check PostgreSQL
docker-compose exec postgres pg_isready

# View database logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U kaspa_admin -d kaspa_mainnet
```

## Next Steps

1. Monitor the Grafana dashboard for performance metrics
2. Set up automated backups (cron job)
3. Configure SSL/TLS for production
4. Set up log rotation
5. Configure alerting in Grafana

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Run tests: `./scripts/run_tests.sh`
3. Review [README.md](README.md) for detailed documentation
