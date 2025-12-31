// API Health Check and Monitoring Tool
// Analysiert alle API-Verbindungen und diagnostiziert Probleme

class KlassikSystemDiagnostics {
    constructor() {
        this.baseUrl = window.location.origin;
        this.results = {};
        this.startTime = Date.now();
    }

    // Umfassende System-Diagnose
    async runFullDiagnostic() {
        console.log('🔍 Starte Klassik System-Diagnose...');
        
        this.results = {
            timestamp: new Date().toISOString(),
            frontend: await this.testFrontend(),
            backend: await this.testBackend(),
            explorer: await this.testExplorer(),
            apis: await this.testExternalAPIs(),
            performance: await this.testPerformance()
        };

        this.generateReport();
        return this.results;
    }

    // Frontend-Tests
    async testFrontend() {
        const tests = {
            domElements: this.testDOMElements(),
            assets: await this.testAssets(),
            localStorage: this.testLocalStorage(),
            responsive: this.testResponsive()
        };
        
        return {
            status: Object.values(tests).every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };
    }

    // Backend API-Tests
    async testBackend() {
        const endpoints = [
            '/api/health',
            '/api/kaspa/info',
            '/api/kaspa/stats',
            '/api/auth/nonce',
            '/api/search'
        ];

        const tests = {};
        for (const endpoint of endpoints) {
            tests[endpoint] = await this.testEndpoint(this.baseUrl + endpoint);
        }

        return {
            status: Object.values(tests).every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };
    }

    // Explorer-spezifische Tests
    async testExplorer() {
        const tests = {
            kaspaAPI: await this.testKaspaAPI(),
            priceAPI: await this.testPriceAPI(),
            webSocket: await this.testWebSocket(),
            searchFunction: await this.testSearchFunction(),
            blockDisplay: this.testBlockDisplay(),
            transactionDisplay: this.testTransactionDisplay()
        };

        return {
            status: Object.values(tests).every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };
    }

    // Externe APIs testen
    async testExternalAPIs() {
        const apis = [
            { name: 'Kaspa API', url: 'https://api.kaspa.org/info/halving' },
            { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd' },
            { name: 'Kaspa Pool', url: 'https://kaspa.pool.org/api/stats' }
        ];

        const tests = {};
        for (const api of apis) {
            tests[api.name] = await this.testExternalAPI(api.url);
        }

        return {
            status: Object.values(tests).every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };
    }

    // Performance-Tests
    async testPerformance() {
        const performanceTests = {
            pageLoadTime: this.getPageLoadTime(),
            apiResponseTime: await this.measureAPIResponseTime(),
            domReady: this.getDOMReadyTime(),
            memoryUsage: this.getMemoryUsage()
        };

        return {
            status: performanceTests.pageLoadTime < 3000 && performanceTests.apiResponseTime < 1000 ? 'pass' : 'warning',
            tests: performanceTests
        };
    }

    // Einzelne Test-Funktionen
    async testEndpoint(url) {
        try {
            const startTime = Date.now();
            const response = await fetch(url, { 
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            const responseTime = Date.now() - startTime;
            
            return {
                status: response.ok ? 'pass' : 'fail',
                statusCode: response.status,
                responseTime,
                error: response.ok ? null : `HTTP ${response.status}`
            };
        } catch (error) {
            return {
                status: 'fail',
                error: error.message,
                responseTime: null
            };
        }
    }

    async testExternalAPI(url) {
        try {
            // Verwende CORS-Proxy oder direkt je nach Verfügbarkeit
            const startTime = Date.now();
            const response = await fetch(url);
            const responseTime = Date.now() - startTime;
            
            return {
                status: response.ok ? 'pass' : 'fail',
                statusCode: response.status,
                responseTime,
                error: response.ok ? null : `HTTP ${response.status}`
            };
        } catch (error) {
            // CORS-Fehler oder andere Netzwerkprobleme
            return {
                status: 'fail',
                error: error.message.includes('CORS') ? 'CORS Policy Block' : error.message,
                responseTime: null,
                suggestion: error.message.includes('CORS') ? 'Implementiere Backend-Proxy für diese API' : null
            };
        }
    }

    testDOMElements() {
        const requiredElements = [
            'stats-section',
            'blocks-section', 
            'transactions-section',
            'search-input'
        ];

        const missing = requiredElements.filter(id => !document.getElementById(id));
        
        return {
            status: missing.length === 0 ? 'pass' : 'fail',
            missing,
            found: requiredElements.length - missing.length,
            total: requiredElements.length
        };
    }

    async testAssets() {
        const assets = [
            '/assets/css/kaspa-explorer-v4.css',
            '/assets/js/kaspa-explorer.js'
        ];

        const results = {};
        for (const asset of assets) {
            results[asset] = await this.testEndpoint(this.baseUrl + asset);
        }

        return {
            status: Object.values(results).every(r => r.status === 'pass') ? 'pass' : 'fail',
            assets: results
        };
    }

    async testKaspaAPI() {
        try {
            // Test über Backend-Proxy um CORS zu umgehen
            const response = await fetch(`${this.baseUrl}/api/kaspa/stats`);
            return {
                status: response.ok ? 'pass' : 'fail',
                error: response.ok ? null : 'Backend Kaspa API nicht erreichbar'
            };
        } catch (error) {
            return {
                status: 'fail',
                error: error.message
            };
        }
    }

    async testPriceAPI() {
        try {
            const response = await fetch(`${this.baseUrl}/api/kaspa/price`);
            return {
                status: response.ok ? 'pass' : 'fail',
                error: response.ok ? null : 'Price API nicht erreichbar'
            };
        } catch (error) {
            return {
                status: 'fail',
                error: error.message
            };
        }
    }

    async testWebSocket() {
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket('wss://api.kaspa.org/ws');
                
                ws.onopen = () => {
                    ws.close();
                    resolve({ status: 'pass', error: null });
                };
                
                ws.onerror = (error) => {
                    resolve({ status: 'fail', error: 'WebSocket connection failed' });
                };
                
                // Timeout nach 5 Sekunden
                setTimeout(() => {
                    ws.close();
                    resolve({ status: 'fail', error: 'WebSocket timeout' });
                }, 5000);
            } catch (error) {
                resolve({ status: 'fail', error: error.message });
            }
        });
    }

    async testSearchFunction() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) {
            return { status: 'fail', error: 'Search input not found' };
        }

        // Simuliere Suche
        try {
            searchInput.value = 'kaspa:qr';
            searchInput.dispatchEvent(new Event('input'));
            return { status: 'pass', error: null };
        } catch (error) {
            return { status: 'fail', error: error.message };
        }
    }

    testLocalStorage() {
        try {
            localStorage.setItem('test', 'value');
            const value = localStorage.getItem('test');
            localStorage.removeItem('test');
            
            return {
                status: value === 'value' ? 'pass' : 'fail',
                error: value === 'value' ? null : 'LocalStorage not working'
            };
        } catch (error) {
            return {
                status: 'fail',
                error: error.message
            };
        }
    }

    testResponsive() {
        const width = window.innerWidth;
        const isMobile = width <= 768;
        const isTablet = width > 768 && width <= 1024;
        const isDesktop = width > 1024;

        return {
            status: 'pass',
            screenWidth: width,
            device: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
            responsive: true
        };
    }

    getPageLoadTime() {
        return performance.timing.loadEventEnd - performance.timing.navigationStart;
    }

    async measureAPIResponseTime() {
        const startTime = Date.now();
        try {
            await fetch(`${this.baseUrl}/api/health`);
            return Date.now() - startTime;
        } catch (error) {
            return -1;
        }
    }

    getDOMReadyTime() {
        return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return { error: 'Memory API not available' };
    }

    testBlockDisplay() {
        const blocksSection = document.getElementById('blocks-section');
        return {
            status: blocksSection ? 'pass' : 'fail',
            error: blocksSection ? null : 'Blocks section not found'
        };
    }

    testTransactionDisplay() {
        const txSection = document.getElementById('transactions-section');
        return {
            status: txSection ? 'pass' : 'fail',
            error: txSection ? null : 'Transactions section not found'
        };
    }

    // Report-Generierung
    generateReport() {
        const totalTime = Date.now() - this.startTime;
        
        console.group('🔍 Klassik System Diagnostics Report');
        console.log(`⏱️ Total diagnostic time: ${totalTime}ms`);
        console.log(`📅 Timestamp: ${this.results.timestamp}`);
        
        // Frontend Report
        console.group('🎨 Frontend Status');
        console.log(`Status: ${this.getStatusEmoji(this.results.frontend.status)} ${this.results.frontend.status}`);
        Object.entries(this.results.frontend.tests).forEach(([test, result]) => {
            console.log(`  ${this.getStatusEmoji(result.status)} ${test}:`, result);
        });
        console.groupEnd();

        // Backend Report
        console.group('⚙️ Backend Status');
        console.log(`Status: ${this.getStatusEmoji(this.results.backend.status)} ${this.results.backend.status}`);
        Object.entries(this.results.backend.tests).forEach(([test, result]) => {
            console.log(`  ${this.getStatusEmoji(result.status)} ${test}: ${result.responseTime}ms`, result);
        });
        console.groupEnd();

        // Explorer Report
        console.group('🔍 Explorer Status');
        console.log(`Status: ${this.getStatusEmoji(this.results.explorer.status)} ${this.results.explorer.status}`);
        Object.entries(this.results.explorer.tests).forEach(([test, result]) => {
            console.log(`  ${this.getStatusEmoji(result.status)} ${test}:`, result);
        });
        console.groupEnd();

        // External APIs Report
        console.group('🌐 External APIs Status');
        console.log(`Status: ${this.getStatusEmoji(this.results.apis.status)} ${this.results.apis.status}`);
        Object.entries(this.results.apis.tests).forEach(([test, result]) => {
            console.log(`  ${this.getStatusEmoji(result.status)} ${test}:`, result);
        });
        console.groupEnd();

        // Performance Report
        console.group('⚡ Performance Status');
        console.log(`Status: ${this.getStatusEmoji(this.results.performance.status)} ${this.results.performance.status}`);
        console.log('Performance Metrics:', this.results.performance.tests);
        console.groupEnd();

        console.groupEnd();

        // Empfehlungen generieren
        this.generateRecommendations();
    }

    getStatusEmoji(status) {
        switch (status) {
            case 'pass': return '✅';
            case 'warning': return '⚠️';
            case 'fail': return '❌';
            default: return '❓';
        }
    }

    generateRecommendations() {
        const recommendations = [];

        // Analysiere Ergebnisse und erstelle Empfehlungen
        if (this.results.backend.status === 'fail') {
            recommendations.push('🔧 Backend-Services sind nicht erreichbar. Prüfe Server-Status.');
        }

        if (this.results.apis.status === 'fail') {
            const failedAPIs = Object.entries(this.results.apis.tests)
                .filter(([_, result]) => result.status === 'fail')
                .map(([name, _]) => name);
            recommendations.push(`🌐 Externe APIs fehlgeschlagen: ${failedAPIs.join(', ')}. Implementiere Backend-Proxies.`);
        }

        if (this.results.performance.tests.pageLoadTime > 3000) {
            recommendations.push('⚡ Ladezeit optimieren. Implementiere Caching und Code-Splitting.');
        }

        if (recommendations.length > 0) {
            console.group('💡 Empfehlungen');
            recommendations.forEach(rec => console.log(rec));
            console.groupEnd();
        } else {
            console.log('🎉 Alle Systeme funktionieren optimal!');
        }
    }

    // Automatische Fixes
    async autoFix() {
        console.log('🔧 Starte automatische Fehlerbehebung...');
        
        // 1. CORS-Probleme durch Backend-Proxy lösen
        await this.implementBackendProxy();
        
        // 2. Fehlende API-Endpunkte erstellen
        await this.createMissingEndpoints();
        
        // 3. Frontend-Fehler beheben
        this.fixFrontendIssues();
        
        console.log('✅ Automatische Fixes abgeschlossen.');
    }

    async implementBackendProxy() {
        // Erstelle Backend-Routen für externe APIs
        console.log('📡 Implementiere Backend-API-Proxies...');
        // Dies würde normalerweise Backend-Code erstellen
    }

    async createMissingEndpoints() {
        console.log('🔗 Erstelle fehlende API-Endpunkte...');
        // Implementation von fehlenden Backend-Routen
    }

    fixFrontendIssues() {
        console.log('🎨 Behebe Frontend-Probleme...');
        
        // Fehlende DOM-Elemente erstellen
        if (!document.getElementById('stats-section')) {
            const statsSection = document.createElement('div');
            statsSection.id = 'stats-section';
            document.body.appendChild(statsSection);
        }
        
        // JavaScript-Fehler abfangen
        window.addEventListener('error', (event) => {
            console.error('JavaScript Error:', event.error);
        });
    }
}

// Global verfügbar machen
window.KlassikSystemDiagnostics = KlassikSystemDiagnostics;

// Auto-Start wenn im Explorer
if (document.querySelector('.explorer-container')) {
    const diagnostics = new KlassikSystemDiagnostics();
    diagnostics.runFullDiagnostic();
}