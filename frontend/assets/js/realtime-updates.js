// ============================================
// ECHTZEIT UPDATES - Schnelle Polling & WebSocket
// ============================================

// Konfiguration für verschiedene Update-Geschwindigkeiten
const REALTIME_CONFIG = {
    // Super-schnelle Updates (100ms) für Live-Ansicht
    FAST_POLL_INTERVAL: 100,
    
    // Normale Updates (10s) für Dashboard
    NORMAL_POLL_INTERVAL: 10000,
    
    // Langsame Updates (30s) für Stats
    SLOW_POLL_INTERVAL: 30000,
    
    // WebSocket Reconnect
    WS_RECONNECT_DELAY: 5000,
    
    // Maximum Blocks/Txs für Live-View
    MAX_LIVE_ITEMS: 50
};

class RealtimeDataManager {
    constructor() {
        this.ws = null;
        this.pollIntervals = {
            fast: null,
            normal: null,
            slow: null
        };
        this.isLiveMode = false;
        this.liveBlocks = [];
        this.liveTxs = [];
    }
    
    // WebSocket Connection (wenn Backend WebSocket hat)
    initWebSocket() {
        const wsUrl = 'wss://klassik.99pace.space/ws'; // Backend WebSocket
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                showUserNotification('Real-time updates connected', 'success');
                
                // Subscribe to channels
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['blocks', 'transactions', 'network']
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealtimeUpdate(data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                showUserNotification('Real-time connection error', 'error');
            };
            
            this.ws.onclose = () => {
                console.warn('⚠️ WebSocket disconnected, reconnecting...');
                setTimeout(() => this.initWebSocket(), REALTIME_CONFIG.WS_RECONNECT_DELAY);
            };
            
        } catch (error) {
            console.error('WebSocket init failed:', error);
            // Fallback zu schnellem Polling
            this.startFastPolling();
        }
    }
    
    // Schnelles Polling für Live-Updates (100ms)
    startFastPolling() {
        console.log('🚀 Starting fast polling (100ms intervals)');
        
        this.pollIntervals.fast = setInterval(async () => {
            if (!this.isLiveMode) return;
            
            try {
                // Fetch nur neueste Blocks (schnell!)
                const response = await fetch(`${API.BACKEND}${API.ENDPOINTS.BLOCKS}/latest?limit=5`);
                if (response.ok) {
                    const blocks = await response.json();
                    this.updateLiveBlocks(blocks);
                }
            } catch (error) {
                console.error('Fast poll error:', error);
            }
        }, REALTIME_CONFIG.FAST_POLL_INTERVAL);
    }
    
    // Normale Updates (10s) - aktueller Timer
    startNormalPolling() {
        // Bereits durch refreshAllData() implementiert
        console.log('✅ Normal polling active (10s)');
    }
    
    // Langsame Updates (30s) für Stats die sich selten ändern
    startSlowPolling() {
        this.pollIntervals.slow = setInterval(async () => {
            try {
                // Nur Stats die sich langsam ändern
                const response = await fetch(`${API.BACKEND}${API.ENDPOINTS.STATS}`);
                if (response.ok) {
                    const stats = await response.json();
                    // Update nur bestimmte Felder
                    if (stats.price) {
                        state.price = {
                            ...state.price,
                            current: stats.price.usd,
                            change24h: stats.price.usd_24h_change,
                            marketCap: stats.marketcap?.usd
                        };
                        updatePriceDisplay();
                    }
                }
            } catch (error) {
                console.error('Slow poll error:', error);
            }
        }, REALTIME_CONFIG.SLOW_POLL_INTERVAL);
    }
    
    // Handle WebSocket Updates
    handleRealtimeUpdate(data) {
        console.log('📡 Realtime update:', data.type);
        
        switch (data.type) {
            case 'new_block':
                this.addLiveBlock(data.block);
                break;
            case 'new_transaction':
                this.addLiveTransaction(data.transaction);
                break;
            case 'network_update':
                this.updateNetworkStats(data.stats);
                break;
        }
    }
    
    // Live Blocks Management
    updateLiveBlocks(blocks) {
        if (!Array.isArray(blocks)) return;
        
        blocks.forEach(block => {
            // Check if block is new
            const exists = this.liveBlocks.some(b => b.hash === block.hash);
            if (!exists) {
                this.addLiveBlock(block);
            }
        });
    }
    
    addLiveBlock(block) {
        // Add to beginning of array
        this.liveBlocks.unshift(block);
        
        // Keep max items
        if (this.liveBlocks.length > REALTIME_CONFIG.MAX_LIVE_ITEMS) {
            this.liveBlocks = this.liveBlocks.slice(0, REALTIME_CONFIG.MAX_LIVE_ITEMS);
        }
        
        // Update main state
        state.blocks = this.liveBlocks.slice(0, 20);
        
        // Visual notification
        showBlockNotification(block);
        
        // Update UI
        updateBlocksList();
    }
    
    addLiveTransaction(tx) {
        this.liveTxs.unshift(tx);
        
        if (this.liveTxs.length > REALTIME_CONFIG.MAX_LIVE_ITEMS) {
            this.liveTxs = this.liveTxs.slice(0, REALTIME_CONFIG.MAX_LIVE_ITEMS);
        }
        
        state.transactions = this.liveTxs.slice(0, 20);
        
        // Visual effect
        showTxNotification(tx);
        updateTransactionsList();
    }
    
    updateNetworkStats(stats) {
        state.network = { ...state.network, ...stats };
        updateNetworkDisplay();
    }
    
    // Live Mode Toggle
    enableLiveMode() {
        this.isLiveMode = true;
        console.log('🔴 LIVE MODE ACTIVATED');
        showUserNotification('Live mode activated - 0.1s updates', 'success');
        
        // Start fast polling
        this.startFastPolling();
        
        // Try WebSocket
        this.initWebSocket();
        
        // Update UI
        const liveModeBtn = document.getElementById('live-mode-toggle');
        if (liveModeBtn) {
            liveModeBtn.textContent = '🔴 LIVE';
            liveModeBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }
    }
    
    disableLiveMode() {
        this.isLiveMode = false;
        console.log('⏸️ Live mode deactivated');
        
        // Stop fast polling
        if (this.pollIntervals.fast) {
            clearInterval(this.pollIntervals.fast);
            this.pollIntervals.fast = null;
        }
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Update UI
        const liveModeBtn = document.getElementById('live-mode-toggle');
        if (liveModeBtn) {
            liveModeBtn.textContent = '▶️ Enable Live Mode';
            liveModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    }
    
    toggleLiveMode() {
        if (this.isLiveMode) {
            this.disableLiveMode();
        } else {
            this.enableLiveMode();
        }
    }
    
    // Cleanup
    destroy() {
        Object.values(this.pollIntervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        if (this.ws) this.ws.close();
    }
}

// Visual Notifications für neue Blocks/Txs
function showBlockNotification(block) {
    // Flash animation im Block-List
    const blocksList = document.getElementById('recent-blocks-list');
    if (blocksList && blocksList.firstChild) {
        const firstItem = blocksList.firstChild;
        firstItem.style.background = 'rgba(16, 185, 129, 0.3)';
        firstItem.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
            firstItem.style.background = '';
            firstItem.style.transform = '';
        }, 500);
    }
    
    // Optional: Sound effect
    playNotificationSound('block');
}

function showTxNotification(tx) {
    const txsList = document.getElementById('recent-txs-list');
    if (txsList && txsList.firstChild) {
        const firstItem = txsList.firstChild;
        firstItem.style.background = 'rgba(59, 130, 246, 0.3)';
        firstItem.style.transform = 'scale(1.02)';
        
        setTimeout(() => {
            firstItem.style.background = '';
            firstItem.style.transform = '';
        }, 500);
    }
    
    playNotificationSound('transaction');
}

function playNotificationSound(type) {
    // Optional: Web Audio API für Sound-Effekte
    if (!window.audioContext) return;
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = type === 'block' ? 800 : 600;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
}

// Initialize Realtime Manager
const realtimeManager = new RealtimeDataManager();

// Export for global access
window.realtimeManager = realtimeManager;

console.log('✅ Realtime data manager loaded');
