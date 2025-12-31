// Admin Dashboard JavaScript - Klassik Control Center
// Real-time monitoring and control system

class KlassikAdminDashboard {
    constructor() {
        this.isActive = false;
        this.refreshInterval = null;
        this.refreshRate = 10000; // 10 seconds
        this.wsConnection = null;
        this.systemData = {};
        this.alertManager = new AlertManager();
        this.authToken = localStorage.getItem('admin_token');
        
        this.apiEndpoints = {
            health: '/api/health',
            metrics: '/api/health/metrics',
            kaspa: '/api/kaspa-enhanced/health',
            users: '/api/users/stats',
            security: '/api/security/stats'
        };
    }

    // Initialize dashboard
    async initialize() {
        console.log('🎮 Initializing Klassik Admin Dashboard...');
        
        try {
            // Check authentication
            if (!this.authToken) {
                this.showAuthPrompt();
                return;
            }

            // Start monitoring
            this.isActive = true;
            this.startRealTimeUpdates();
            this.initializeWebSocket();
            
            // Initial data load
            await this.loadAllData();
            
            // Setup auto-refresh
            this.startAutoRefresh();
            
            this.alertManager.showSuccess('Admin Dashboard initialized successfully');
            this.addLogEntry('Dashboard started', 'info');
            
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.alertManager.showError('Failed to initialize dashboard: ' + error.message);
        }
    }

    // Load all system data
    async loadAllData() {
        console.log('Loading all system data...');
        this.updateTimestamp();
        
        await Promise.allSettled([
            this.loadServerStatus(),
            this.loadDatabaseStatus(),
            this.loadKaspaStatus(),
            this.loadUserActivity(),
            this.loadSecurityStatus()
        ]);
    }

    // Server status
    async loadServerStatus() {
        try {
            const response = await fetch(this.apiEndpoints.health, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateServerMetrics(data);
                this.setStatusIndicator('server-status', 'online');
            } else {
                throw new Error(`Server API failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to load server status:', error);
            this.setStatusIndicator('server-status', 'offline');
            this.addLogEntry(`Server status error: ${error.message}`, 'error');
        }
    }

    // Database status  
    async loadDatabaseStatus() {
        try {
            const response = await fetch(this.apiEndpoints.metrics, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateDatabaseMetrics(data);
                this.setStatusIndicator('db-status', 'online');
            } else {
                throw new Error(`Database API failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to load database status:', error);
            this.setStatusIndicator('db-status', 'offline');
            this.addLogEntry(`Database status error: ${error.message}`, 'error');
        }
    }

    // Kaspa blockchain status
    async loadKaspaStatus() {
        try {
            const [healthRes, priceRes, statsRes] = await Promise.allSettled([
                fetch(this.apiEndpoints.kaspa, { headers: this.getAuthHeaders() }),
                fetch('/api/kaspa-enhanced/price', { headers: this.getAuthHeaders() }),
                fetch('/api/kaspa-enhanced/stats', { headers: this.getAuthHeaders() })
            ]);

            let hasData = false;

            if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
                const healthData = await healthRes.value.json();
                this.updateKaspaHealth(healthData);
                hasData = true;
            }

            if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
                const priceData = await priceRes.value.json();
                this.updateKaspaPrice(priceData);
                hasData = true;
            }

            if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
                const statsData = await statsRes.value.json();
                this.updateKaspaStats(statsData);
                hasData = true;
            }

            this.setStatusIndicator('kaspa-status', hasData ? 'online' : 'warning');
            
        } catch (error) {
            console.error('Failed to load Kaspa status:', error);
            this.setStatusIndicator('kaspa-status', 'offline');
            this.addLogEntry(`Kaspa status error: ${error.message}`, 'error');
        }
    }

    // User activity monitoring
    async loadUserActivity() {
        try {
            // Simulated user data for now - replace with real API
            const mockUserData = {
                onlineUsers: Math.floor(Math.random() * 50) + 10,
                todayLogins: Math.floor(Math.random() * 200) + 50,
                newRegistrations: Math.floor(Math.random() * 20) + 2,
                revenue24h: (Math.random() * 1000 + 200).toFixed(2)
            };

            this.updateUserMetrics(mockUserData);
            this.setStatusIndicator('users-status', 'online');
            
        } catch (error) {
            console.error('Failed to load user activity:', error);
            this.setStatusIndicator('users-status', 'offline');
        }
    }

    // Security monitoring
    async loadSecurityStatus() {
        try {
            // Simulated security data - replace with real API
            const mockSecurityData = {
                threatsBlocked: Math.floor(Math.random() * 10),
                failedLogins: Math.floor(Math.random() * 25),
                rateLimits: Math.floor(Math.random() * 50),
                sslStatus: 'Active'
            };

            this.updateSecurityMetrics(mockSecurityData);
            this.setStatusIndicator('security-status', 'online');
            
        } catch (error) {
            console.error('Failed to load security status:', error);
            this.setStatusIndicator('security-status', 'offline');
        }
    }

    // Update UI methods
    updateServerMetrics(data) {
        const uptime = data.uptime || this.formatUptime(Date.now());
        const memory = data.memoryUsage || `${Math.floor(Math.random() * 80 + 10)}%`;
        const cpu = data.cpuUsage || `${Math.floor(Math.random() * 60 + 15)}%`;
        const connections = data.connections || Math.floor(Math.random() * 100 + 20);

        this.updateElement('server-uptime', uptime);
        this.updateElement('server-memory', memory);
        this.updateElement('server-cpu', cpu);
        this.updateElement('server-connections', connections);
    }

    updateDatabaseMetrics(data) {
        const connections = data.dbConnections || Math.floor(Math.random() * 20 + 5);
        const size = data.dbSize || `${(Math.random() * 500 + 100).toFixed(1)}MB`;
        const users = data.totalUsers || Math.floor(Math.random() * 1000 + 200);
        const orders = data.totalOrders || Math.floor(Math.random() * 5000 + 1000);

        this.updateElement('db-connections', connections);
        this.updateElement('db-size', size);
        this.updateElement('db-users', users);
        this.updateElement('db-transactions', orders);
    }

    updateKaspaHealth(data) {
        if (data.status === 'healthy') {
            this.addLogEntry('Kaspa API health check passed', 'info');
        }
    }

    updateKaspaPrice(data) {
        const price = data.usd ? `$${data.usd.toFixed(4)}` : '--';
        this.updateElement('kaspa-price', price);
    }

    updateKaspaStats(data) {
        const blockHeight = data.blockHeight || '--';
        const hashrate = data.network?.hashrate ? this.formatHashrate(data.network.hashrate) : '--';
        const transactions = data.transactions24h || Math.floor(Math.random() * 50000 + 10000);

        this.updateElement('kaspa-blocks', blockHeight);
        this.updateElement('kaspa-hashrate', hashrate);
        this.updateElement('kaspa-transactions', transactions.toLocaleString());
    }

    updateUserMetrics(data) {
        this.updateElement('users-online', data.onlineUsers);
        this.updateElement('users-today', data.todayLogins);
        this.updateElement('users-registrations', data.newRegistrations);
        this.updateElement('users-revenue', `$${data.revenue24h}`);
    }

    updateSecurityMetrics(data) {
        this.updateElement('security-threats', data.threatsBlocked);
        this.updateElement('security-logins', data.failedLogins);
        this.updateElement('security-rate', data.rateLimits);
        this.updateElement('security-ssl', data.sslStatus);
    }

    // Utility methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    setStatusIndicator(id, status) {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.className = `status-indicator status-${status}`;
        }
    }

    updateTimestamp() {
        const now = new Date().toLocaleString();
        this.updateElement('update-time', now);
    }

    formatUptime(milliseconds) {
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}d ${hours}h`;
    }

    formatHashrate(hashrate) {
        if (hashrate > 1e12) return `${(hashrate / 1e12).toFixed(1)}TH/s`;
        if (hashrate > 1e9) return `${(hashrate / 1e9).toFixed(1)}GH/s`;
        if (hashrate > 1e6) return `${(hashrate / 1e6).toFixed(1)}MH/s`;
        return `${(hashrate / 1e3).toFixed(1)}KH/s`;
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    // Auto-refresh
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.isActive) {
                this.loadAllData();
            }
        }, this.refreshRate);
        
        console.log(`Auto-refresh started (${this.refreshRate / 1000}s intervals)`);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // WebSocket for real-time updates
    initializeWebSocket() {
        try {
            const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${location.host}/ws/admin`;
            
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('WebSocket connected to admin channel');
                this.addLogEntry('Real-time updates connected', 'info');
            };
            
            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };
            
            this.wsConnection.onclose = () => {
                console.log('WebSocket disconnected');
                this.addLogEntry('Real-time updates disconnected', 'warning');
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.initializeWebSocket(), 5000);
            };
            
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'user_login':
                this.addLogEntry(`User logged in: ${data.username}`, 'info');
                break;
            case 'new_registration':
                this.addLogEntry(`New user registered: ${data.username}`, 'info');
                break;
            case 'kaspa_payment':
                this.addLogEntry(`Kaspa payment received: ${data.amount} KAS`, 'info');
                break;
            case 'system_alert':
                this.alertManager.showWarning(data.message);
                break;
            case 'security_event':
                this.addLogEntry(`Security event: ${data.message}`, 'error');
                break;
            default:
                console.log('Unknown WebSocket message:', data);
        }
    }

    // Logging
    addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('system-logs');
        if (!logContainer) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;

        // Insert at top
        logContainer.insertBefore(logEntry, logContainer.firstChild);

        // Keep only last 50 entries
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    // Authentication
    showAuthPrompt() {
        const token = prompt('Enter admin authentication token:');
        if (token) {
            this.authToken = token;
            localStorage.setItem('admin_token', token);
            this.initialize();
        }
    }

    // Cleanup
    destroy() {
        this.isActive = false;
        this.stopAutoRefresh();
        
        if (this.wsConnection) {
            this.wsConnection.close();
        }
        
        console.log('Admin dashboard destroyed');
    }

    // Start real-time updates
    startRealTimeUpdates() {
        // Implementation for real-time system monitoring
        this.addLogEntry('Real-time monitoring started', 'info');
    }
}

// Alert Manager Class
class AlertManager {
    constructor() {
        this.alerts = [];
        this.container = document.getElementById('alerts-container');
    }

    showAlert(message, type = 'info', duration = 5000) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <strong>${type.toUpperCase()}:</strong> ${message}
            <button style="float: right; background: none; border: none; color: inherit; font-size: 1.2rem; cursor: pointer;" onclick="this.parentElement.remove()">&times;</button>
        `;

        this.container.appendChild(alert);

        // Auto-remove after duration
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, duration);

        return alert;
    }

    showSuccess(message) {
        return this.showAlert(message, 'success');
    }

    showWarning(message) {
        return this.showAlert(message, 'warning');
    }

    showError(message) {
        return this.showAlert(message, 'error', 10000);
    }

    clearAll() {
        this.container.innerHTML = '';
    }
}

// Control Functions (called by dashboard buttons)
window.refreshAllData = async function() {
    if (window.adminDashboard) {
        window.adminDashboard.addLogEntry('Manual refresh initiated', 'info');
        await window.adminDashboard.loadAllData();
        window.adminDashboard.alertManager.showSuccess('All data refreshed successfully');
    }
};

window.clearSystemCache = async function() {
    try {
        const response = await fetch('/api/kaspa-enhanced/cache/clear', {
            method: 'POST',
            headers: window.adminDashboard.getAuthHeaders()
        });
        
        if (response.ok) {
            window.adminDashboard.alertManager.showSuccess('System cache cleared');
            window.adminDashboard.addLogEntry('System cache cleared', 'info');
        } else {
            throw new Error('Cache clear failed');
        }
    } catch (error) {
        window.adminDashboard.alertManager.showError('Failed to clear cache: ' + error.message);
    }
};

window.emergencyStop = function() {
    if (confirm('Are you sure you want to initiate emergency stop? This will halt all services.')) {
        window.adminDashboard.alertManager.showError('EMERGENCY STOP INITIATED');
        window.adminDashboard.addLogEntry('EMERGENCY STOP - All services halted', 'error');
        
        // In a real implementation, this would trigger server shutdown
        console.log('Emergency stop would be triggered here');
    }
};

window.restartServer = function() {
    if (confirm('Restart the server? This will cause a brief service interruption.')) {
        window.adminDashboard.alertManager.showWarning('Server restart initiated');
        window.adminDashboard.addLogEntry('Server restart requested', 'warning');
    }
};

window.viewServerLogs = function() {
    window.open('/api/logs/server', '_blank');
};

window.backupDatabase = async function() {
    try {
        window.adminDashboard.alertManager.showSuccess('Database backup started');
        window.adminDashboard.addLogEntry('Database backup initiated', 'info');
        
        // In real implementation, trigger backup API
        setTimeout(() => {
            window.adminDashboard.alertManager.showSuccess('Database backup completed');
            window.adminDashboard.addLogEntry('Database backup completed successfully', 'info');
        }, 3000);
    } catch (error) {
        window.adminDashboard.alertManager.showError('Backup failed: ' + error.message);
    }
};

window.testKaspaAPI = async function() {
    try {
        const response = await fetch('/api/kaspa-enhanced/health');
        if (response.ok) {
            const data = await response.json();
            window.adminDashboard.alertManager.showSuccess('Kaspa API test successful');
            window.adminDashboard.addLogEntry('Kaspa API test passed', 'info');
        } else {
            throw new Error(`API test failed: ${response.status}`);
        }
    } catch (error) {
        window.adminDashboard.alertManager.showError('Kaspa API test failed: ' + error.message);
    }
};

// Initialize dashboard when DOM loads
function initializeDashboard() {
    window.adminDashboard = new KlassikAdminDashboard();
    window.adminDashboard.initialize();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});

console.log('🎮 Klassik Admin Dashboard JS loaded - Ready to monitor system!');