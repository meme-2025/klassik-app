#!/bin/bash

################################################################################
# Monitor Script - Real-time System Monitoring
################################################################################

watch -n 2 'docker-compose ps && echo "" && \
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" && \
echo "" && \
echo "=== Latest Logs ===" && \
docker-compose logs --tail=5 middleware'
