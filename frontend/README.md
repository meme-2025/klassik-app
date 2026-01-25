# Kaspa Explorer - Custom Configuration Overrides

This directory contains the Dockerfile for the Kaspa Explorer frontend.

## Integration with Backend

The frontend is configured to connect to:
- **API**: https://klassik.99pace.space/api
- **WebSocket**: wss://klassik.99pace.space/ws

## Building Locally

```bash
docker build -t kaspa-frontend .
docker run -p 3000:3000 kaspa-frontend
```

## Customization

To customize the explorer:

1. Clone kaspa-explorer locally
2. Modify source files
3. Copy them into the Docker build context
4. Rebuild the image

## Performance Optimizations

- Static asset optimization
- Lazy loading for DAG visualization
- WebSocket connection pooling
- Client-side caching (1000 blocks)
- Incremental static regeneration (ISR)

## Environment Variables

See `.env.production` for all available configuration options.
