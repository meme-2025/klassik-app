/**
 * ============================================
 * BANDWIDTH MONITOR & UPDATE RATE CONTROLLER
 * ============================================
 * 
 * Features:
 * 1. Bandwidth Monitor - Track data transfer in real-time
 * 2. Update Rate Switcher - Control refresh intervals
 */

class BandwidthMonitor {
    constructor() {
        this.startTime = Date.now();
        this.totalBytes = 0;
        this.lastBytes = 0;
        this.lastTime = Date.now();
        this.currentRate = 0;
        this.averageRate = 0;
        this.samples = [];
        this.maxSamples = 60; // Keep last 60 samples for average
        
        // Intercept fetch to measure bandwidth
        this.originalFetch = window.fetch;
        this.setupFetchInterceptor();
        
        // Update display every second
        this.updateInterval = setInterval(() => this.updateDisplay(), 1000);
    }
    
    setupFetchInterceptor() {
        const self = this;
        
        window.fetch = async function(...args) {
            const startTime = performance.now();
            
            try {
                const response = await self.originalFetch.apply(this, args);
                
                // Clone response to read body size
                const clone = response.clone();
                const blob = await clone.blob();
                const bytes = blob.size;
                
                const endTime = performance.now();
                const duration = (endTime - startTime) / 1000; // Convert to seconds
                
                // Track bandwidth
                self.recordTransfer(bytes, duration);
                
                return response;
            } catch (error) {
                throw error;
            }
        };
    }
    
    recordTransfer(bytes, duration) {
        this.totalBytes += bytes;
        
        const now = Date.now();
        const timeSinceLastSample = (now - this.lastTime) / 1000; // seconds
        
        if (timeSinceLastSample > 0) {
            const bytesSinceLastSample = this.totalBytes - this.lastBytes;
            const rate = bytesSinceLastSample / timeSinceLastSample; // bytes per second
            
            this.samples.push(rate);
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
            }
            
            this.currentRate = rate;
            this.averageRate = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
            
            this.lastBytes = this.totalBytes;
            this.lastTime = now;
        }
    }
    
    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    
    formatRate(bytesPerSecond) {
        if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    }
    
    updateDisplay() {
        const currentEl = document.getElementById('bandwidth-current');
        const totalEl = document.getElementById('bandwidth-total');
        
        if (currentEl && totalEl) {
            // Show average rate instead of instantaneous (smoother)
            currentEl.textContent = this.formatRate(this.averageRate);
            totalEl.textContent = `${this.formatTotal()} total`;
        }
    }
    
    formatTotal() {
        return this.formatBytes(this.totalBytes);
    }
    
    getStats() {
        return {
            totalBytes: this.totalBytes,
            currentRate: this.currentRate,
            averageRate: this.averageRate,
            totalFormatted: this.formatTotal(),
            currentFormatted: this.formatRate(this.currentRate),
            averageFormatted: this.formatRate(this.averageRate)
        };
    }
    
    destroy() {
        clearInterval(this.updateInterval);
        window.fetch = this.originalFetch;
    }
}

// ============================================
// UPDATE RATE CONTROLLER
// ============================================

class UpdateRateController {
    constructor() {
        this.currentRate = 10; // Default: 10 seconds
        this.refreshInterval = null;
        this.refreshCallback = null;
        
        this.setupButtons();
    }
    
    setupButtons() {
        const buttons = document.querySelectorAll('.rate-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rate = btn.dataset.rate;
                this.setRate(rate);
                
                // Update active state
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    
    setRate(rate) {
        console.log(`🔄 Setting update rate to: ${rate}`);
        
        // Stop current interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (rate === 'realtime') {
            // Real-time mode: 100ms (0.1s)
            this.currentRate = 0.1;
            this.startRefresh(100);
            
            // Also enable live mode if realtime-updates.js is available
            if (window.realtimeManager) {
                window.realtimeManager.enableLiveMode();
            }
        } else {
            const seconds = parseInt(rate);
            this.currentRate = seconds;
            this.startRefresh(seconds * 1000);
            
            // Disable live mode for slower rates
            if (window.realtimeManager) {
                window.realtimeManager.disableLiveMode();
            }
            
            // Update the main refresh timer if it exists
            if (typeof startRefreshTimer === 'function') {
                startRefreshTimer();
            }
        }
        
        // Update timer display
        this.updateTimerDisplay();
    }
    
    startRefresh(intervalMs) {
        // Don't create a separate refresh interval - kaspa-explorer.js handles this
        // This just updates the timer and triggers the main timer restart
        // The actual refresh is handled by startRefreshTimer() in kaspa-explorer.js
    }
    
    setCallback(callback) {
        this.refreshCallback = callback;
    }
    
    updateTimerDisplay() {
        // Don't update the timer text - kaspa-explorer.js handles the countdown
        // This function is kept for compatibility but doesn't modify the display
        // The actual countdown is managed by startRefreshTimer() in kaspa-explorer.js
    }
    
    getRate() {
        return this.currentRate;
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// ============================================
// AUTO-INITIALIZE
// ============================================

let bandwidthMonitor = null;
let updateRateController = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Initializing Bandwidth Monitor & Update Rate Controller...');
    
    // Initialize bandwidth monitor
    bandwidthMonitor = new BandwidthMonitor();
    
    // Initialize update rate controller
    updateRateController = new UpdateRateController();
    
    // Set default to 10s (active button)
    updateRateController.setRate('10');
    
    console.log('✅ Monitoring systems initialized');
});

// Export for global access
window.bandwidthMonitor = bandwidthMonitor;
window.updateRateController = updateRateController;
