# Kaspa Full-Stack Infrastructure
## Industrial-Grade 10 BPS Blockchain Explorer System

### 🏗️ Architecture Overview
```
┌──────────────────────────────────────────────────────────────┐
│                    Klassik.99pace.space                       │
│                   (Nginx Reverse Proxy)                       │
└────────────┬─────────────────────────────────┬───────────────┘
             │                                 │
        ┌────▼────┐                      ┌────▼────┐
        │Frontend │                      │   API   │
        │Next.js  │                      │ Gateway │
        │Explorer │                      │         │
        └────┬────┘                      └────┬────┘
             │                                │
        ┌────▼────────────────────────────────▼────┐
        │      High-Performance Middleware          │
        │    (Node.js + WebSocket Push Engine)      │
        └────┬──────────────────────────────────────┘
             │
        ┌────▼──────────────┬──────────────┬────────┐
        │  kaspa-rest-server│  PostgreSQL  │ Redis  │
        │    (Indexer)      │   (Storage)  │(Cache) │
        └────┬──────────────┴──────────────┴────────┘
             │
        ┌────▼────────────┐
        │   kaspad v1.0.1 │
        │  RPC: :16110    │
        │  10 BPS Mode    │
        └─────────────────┘
```

### 🚀 Quick Start
```bash
cd kaspa-main-stack
chmod +x scripts/install_and_test.sh
./scripts/install_and_test.sh
```

### 📊 Monitoring
- Grafana: http://localhost:3001 (admin/kaspa2026)
- Prometheus: http://localhost:9090
- Health API: http://localhost:8080/health

### 🔒 Security
- API Key Authentication
- Rate Limiting (100 req/min)
- SSL/TLS Ready

### ⚡ Performance Targets
- Block Processing: <100ms @ 10 BPS
- API Response: <50ms (p95)
- WebSocket Latency: <10ms
- Database Write: Batch mode (50 blocks/write)

### 📁 Project Structure
```
kaspa-main-stack/
├── backend/              # REST server & indexer
├── middleware/           # Real-time API layer
├── frontend/             # kaspa-explorer
├── nginx/                # Reverse proxy config
├── monitoring/           # Prometheus & Grafana
├── scripts/              # Automation & testing
└── docker-compose.yml    # Orchestration
```

### 🔧 Configuration
All settings in `config/` directory:
- `kaspad.env` - Node connection
- `postgres.env` - Database credentials
- `api-keys.env` - Authentication tokens

### 📝 Requirements
- Docker 24+ & Docker Compose v2
- 8GB RAM minimum (16GB recommended)
- 500GB SSD storage
- kaspad v1.0.1 running on :16110

---
**Built for Crescendo Network @ 10 BPS**
