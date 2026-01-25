# Kaspa Main Stack - Complete Project Structure

## 📁 Directory Layout

```
kaspa-main-stack/
├── backend/
│   ├── db/
│   │   ├── init.sql              # Database schema & optimizations
│   │   └── postgresql.conf       # PostgreSQL tuning for 10 BPS
│   └── rest-server/
│       ├── Dockerfile            # kaspa-rest-server container
│       ├── config.toml           # REST server configuration
│       └── logs/                 # Application logs
├── middleware/
│   ├── src/
│   │   ├── index.ts             # Main application entry
│   │   ├── config.ts            # Configuration management
│   │   ├── logger.ts            # Winston logging
│   │   ├── cache.ts             # Redis cache layer
│   │   ├── database.ts          # PostgreSQL service
│   │   ├── kaspa.ts             # Kaspa node integration
│   │   ├── websocket.ts         # WebSocket real-time push
│   │   ├── metrics.ts           # Prometheus metrics
│   │   └── routes/
│   │       └── api.ts           # API endpoints
│   ├── Dockerfile               # Node.js middleware container
│   ├── package.json             # Dependencies
│   ├── tsconfig.json            # TypeScript config
│   └── logs/                    # Application logs
├── frontend/
│   ├── Dockerfile               # Next.js frontend (kaspa-explorer)
│   ├── .env.production          # Frontend environment
│   └── README.md                # Frontend documentation
├── nginx/
│   ├── klassik.conf             # Nginx reverse proxy config
│   └── README.md                # Nginx setup guide
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml       # Metrics collection config
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/     # Prometheus datasource
│   │   │   └── dashboards/      # Dashboard provisioning
│   │   └── dashboards/
│   │       └── kaspa-overview.json  # Main dashboard
├── scripts/
│   ├── install_and_test.sh      # Main installation script
│   ├── run_tests.sh             # End-to-end test suite
│   ├── deploy.sh                # Deployment to Ubuntu server
│   ├── backup.sh                # Backup automation
│   └── monitor.sh               # Real-time monitoring
├── docker-compose.yml           # Full stack orchestration
├── .env.example                 # Environment template
└── README.md                    # This file
```

## 🚀 Quick Start

### Local Installation (for testing)

```bash
cd kaspa-main-stack
cp .env.example .env
chmod +x scripts/*.sh
./scripts/install_and_test.sh
```

### Production Deployment to Ubuntu Server

```bash
# From your Windows machine
cd kaspa-main-stack/scripts
./deploy.sh
```

This will:
1. Connect to your Ubuntu server via SSH
2. Transfer all files
3. Install Docker if needed
4. Run the complete installation
5. Start all services
6. Run validation tests

## 🔧 Configuration

### Environment Variables

Edit `.env` file:

```bash
# Kaspad Connection
KASPAD_HOST=192.168.2.148      # Your server IP
KASPAD_RPC_PORT=16110          # kaspad RPC port

# Security
POSTGRES_PASSWORD=<generated>   # Auto-generated
API_KEY=<generated>             # Auto-generated
GRAFANA_PASSWORD=<generated>    # Auto-generated

# Performance
BATCH_SIZE=50                   # Blocks per batch
BATCH_INTERVAL_MS=5000          # 5 seconds
WORKER_THREADS=4                # Parallel workers
```

### Nginx Setup

On your Ubuntu server:

```bash
sudo cp nginx/klassik.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/klassik.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL/TLS (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d klassik.99pace.space
```

## 📊 Monitoring & Observability

### Access Points

- **Grafana Dashboard**: http://your-server:3001
  - Username: `admin`
  - Password: Check `.env` file

- **Prometheus**: http://your-server:9090

- **API Health**: http://your-server:8080/api/health

### Key Metrics

- **Block Processing Rate**: Target 10 BPS
- **API Response Time**: <50ms (p95)
- **WebSocket Latency**: <10ms
- **Cache Hit Rate**: >70%
- **Database Query Time**: <100ms (p95)

## 🧪 Testing

### Run All Tests

```bash
./scripts/run_tests.sh
```

Tests include:
- API latency (100 requests, p50/p95/p99)
- gRPC connection to kaspad
- Database integrity checks
- Block indexing verification
- Cache performance
- WebSocket functionality
- 10 BPS throughput validation
- Monitoring stack health

### Manual Testing

```bash
# API Test (replace API_KEY)
curl -H "x-api-key: YOUR_API_KEY" http://localhost:8080/api/info

# WebSocket Test
wscat -c ws://localhost:8080/ws

# Database Test
docker-compose exec postgres psql -U kaspa_admin -d kaspa_mainnet -c "SELECT COUNT(*) FROM blocks"
```

## 🛠️ Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f middleware
docker-compose logs -f kaspa-rest-server
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart middleware
```

### Stop Everything

```bash
docker-compose down
```

### Backup

```bash
./scripts/backup.sh
```

Backs up:
- PostgreSQL database
- Redis data
- Configuration files
- Grafana dashboards

### Monitor System

```bash
./scripts/monitor.sh
```

Real-time view of:
- Container status
- CPU/Memory usage
- Network I/O
- Recent logs

## 🔒 Security

### API Authentication

All API requests require:

```
Header: x-api-key
Value: <your-api-key-from-env>
```

### Rate Limiting

- API: 100 requests/minute per IP
- WebSocket: 10 connections/second per IP

### Firewall

```bash
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Frontend (or use Nginx proxy)
sudo ufw allow 8080/tcp  # API (or use Nginx proxy)
sudo ufw enable
```

## ⚡ Performance Optimization

### 10 BPS Specific Tuning

1. **Database**: Batch writes (50 blocks/batch)
2. **Redis Cache**: 2GB memory, LRU eviction
3. **gRPC**: Stream compression enabled
4. **API**: Response caching, compression
5. **WebSocket**: 100ms polling for real-time updates

### Scaling

For higher loads:

1. Increase PostgreSQL `shared_buffers` and `work_mem`
2. Add Redis replicas for read scaling
3. Enable PostgreSQL read replicas
4. Use CDN for frontend assets
5. Add load balancer for multiple middleware instances

## 🐛 Troubleshooting

### kaspad Connection Issues

```bash
# Check if kaspad is running
ps aux | grep kaspad

# Test RPC connection
nc -zv 127.0.0.1 16110

# Check REST server logs
docker-compose logs kaspa-rest-server
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d postgres
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart specific service
docker-compose restart <service-name>

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

## 📞 Support & Maintenance

### Regular Maintenance

- **Daily**: Check Grafana dashboards
- **Weekly**: Review logs for errors
- **Monthly**: Run backup script
- **Quarterly**: Update Docker images

### Health Checks

```bash
# Quick health check
curl http://localhost:8080/api/health

# Detailed test suite
./scripts/run_tests.sh
```

## 📝 License

This infrastructure stack is designed for the Kaspa blockchain ecosystem.

---

**Built for 10 BPS Performance | Optimized for Crescendo Network**
