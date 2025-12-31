// Health check endpoint and monitoring
// File: backend/src/controllers/health.js

class HealthController {
    constructor() {
        this.startTime = Date.now();
    }

    // Basic health check
    async getHealth(req, res) {
        try {
            const uptime = Date.now() - this.startTime;
            const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
            const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: {
                    milliseconds: uptime,
                    human: `${uptimeHours}h ${uptimeMinutes}m`
                },
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            };

            res.status(200).json(health);
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    // Detailed health check for monitoring
    async getDetailedHealth(req, res) {
        try {
            const uptime = Date.now() - this.startTime;
            const memUsage = process.memoryUsage();
            
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: {
                    milliseconds: uptime,
                    seconds: Math.floor(uptime / 1000),
                    human: this.formatUptime(uptime)
                },
                memory: {
                    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
                    external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
                },
                process: {
                    pid: process.pid,
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                },
                services: await this.checkServices(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            };

            res.status(200).json(health);
        } catch (error) {
            console.error('Detailed health check error:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Check individual services
    async checkServices() {
        const services = {
            database: await this.checkDatabase(),
            redis: await this.checkRedis(),
            kaspa: await this.checkKaspaNode(),
            websocket: this.checkWebSocket()
        };

        return services;
    }

    // Check database connection
    async checkDatabase() {
        try {
            const db = require('../db');
            const result = await db.query('SELECT 1 as test');
            
            return {
                status: result.rows.length > 0 ? 'healthy' : 'unhealthy',
                latency: 'low',
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    // Check Redis connection
    async checkRedis() {
        try {
            const redis = require('../cache/kaspa-redis-cache');
            const testKey = 'health_check_' + Date.now();
            
            // Test Redis with a simple set/get
            await redis.set(testKey, 'test_value', 5); // 5 second expiry
            const value = await redis.get(testKey);
            
            return {
                status: value === 'test_value' ? 'healthy' : 'unhealthy',
                latency: 'low',
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    // Check Kaspa node connection
    async checkKaspaNode() {
        try {
            const kaspaService = require('../services/kaspa-api-complete');
            const networkInfo = await kaspaService.getNetworkInfo();
            
            return {
                status: networkInfo ? 'healthy' : 'unhealthy',
                blockHeight: networkInfo?.blockHeight || 0,
                difficulty: networkInfo?.difficulty || 0,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    // Check WebSocket server
    checkWebSocket() {
        try {
            // Check if WebSocket server is running
            const wsConnections = global.wsServer ? global.wsServer.engine.clientsCount : 0;
            
            return {
                status: global.wsServer ? 'healthy' : 'unhealthy',
                connections: wsConnections,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    }

    // Format uptime in human readable format
    formatUptime(uptime) {
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Get application metrics
    async getMetrics(req, res) {
        try {
            const uptime = Date.now() - this.startTime;
            const memUsage = process.memoryUsage();
            
            const metrics = {
                timestamp: new Date().toISOString(),
                uptime_seconds: Math.floor(uptime / 1000),
                memory_usage_bytes: memUsage.rss,
                heap_total_bytes: memUsage.heapTotal,
                heap_used_bytes: memUsage.heapUsed,
                cpu_usage: await this.getCPUUsage(),
                websocket_connections: global.wsServer ? global.wsServer.engine.clientsCount : 0,
                environment: process.env.NODE_ENV || 'development'
            };

            res.status(200).json(metrics);
        } catch (error) {
            console.error('Metrics error:', error);
            res.status(500).json({
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Get CPU usage (basic implementation)
    async getCPUUsage() {
        try {
            const startTime = process.hrtime();
            const startCPU = process.cpuUsage();
            
            // Wait 100ms for measurement
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const endTime = process.hrtime(startTime);
            const endCPU = process.cpuUsage(startCPU);
            
            const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3; // microseconds
            const totalCPU = endCPU.user + endCPU.system;
            
            const cpuPercent = (totalCPU / totalTime) * 100;
            return Math.round(cpuPercent * 100) / 100; // Round to 2 decimal places
        } catch (error) {
            return 0;
        }
    }

    // Readiness check for Kubernetes/Docker
    async getReadiness(req, res) {
        try {
            const services = await this.checkServices();
            
            // Check if critical services are healthy
            const critical = ['database', 'kaspa'];
            const isReady = critical.every(service => 
                services[service] && services[service].status === 'healthy'
            );

            if (isReady) {
                res.status(200).json({
                    status: 'ready',
                    timestamp: new Date().toISOString(),
                    services
                });
            } else {
                res.status(503).json({
                    status: 'not ready',
                    timestamp: new Date().toISOString(),
                    services
                });
            }
        } catch (error) {
            console.error('Readiness check error:', error);
            res.status(503).json({
                status: 'not ready',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Liveness check for Kubernetes/Docker
    async getLiveness(req, res) {
        try {
            // Basic liveness - just check if process is running
            res.status(200).json({
                status: 'alive',
                timestamp: new Date().toISOString(),
                uptime: this.formatUptime(Date.now() - this.startTime)
            });
        } catch (error) {
            console.error('Liveness check error:', error);
            res.status(500).json({
                status: 'dead',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new HealthController();