/**
 * KaspaScan - Blockchain Explorer JavaScript
 * Live data fetching and visualization
 */

// Mock Data Generator (in production, fetch from API)
class KaspaExplorer {
    constructor() {
        this.blocks = [];
        this.transactions = [];
        this.init();
    }

    init() {
        this.initEventListeners();
        this.startLiveUpdates();
        this.initCharts();
        this.loadTopAddresses();
    }

    initEventListeners() {
        // Search functionality
        const searchBtn = document.getElementById('mainSearchBtn');
        const searchInput = document.getElementById('mainSearchInput');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.performSearch());
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
        }

        // API endpoint expanders
        window.toggleEndpoint = (button) => {
            const item = button.closest('.endpoint-item');
            const details = item.querySelector('.endpoint-details');
            details.classList.toggle('active');
            button.classList.toggle('active');
        };

        // Copy to clipboard
        window.copyToClipboard = (button) => {
            const codeBlock = button.previousElementSibling;
            const text = codeBlock.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalIcon = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    button.innerHTML = originalIcon;
                }, 2000);
            });
        };

        // Chart period buttons
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.closest('.chart-controls');
                parent.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // In production: reload chart with new period
            });
        });
    }

    performSearch() {
        const searchInput = document.getElementById('mainSearchInput');
        const query = searchInput.value.trim();
        
        if (!query) return;

        // Simulate search
        console.log('Searching for:', query);
        
        // In production: call API and navigate to result page
        if (query.startsWith('kaspa:')) {
            this.showAddressDetails(query);
        } else if (query.startsWith('0x')) {
            this.showTransactionDetails(query);
        } else if (!isNaN(query)) {
            this.showBlockDetails(query);
        }
    }

    showAddressDetails(address) {
        alert(`Address Details:\n${address}\n\n(In production: Navigate to address page)`);
    }

    showTransactionDetails(txHash) {
        alert(`Transaction Details:\n${txHash}\n\n(In production: Navigate to tx page)`);
    }

    showBlockDetails(blockNumber) {
        alert(`Block Details:\n#${blockNumber}\n\n(In production: Navigate to block page)`);
    }

    startLiveUpdates() {
        // Update blocks table
        this.updateBlocksTable();
        setInterval(() => this.updateBlocksTable(), 5000);

        // Update transactions table
        this.updateTransactionsTable();
        setInterval(() => this.updateTransactionsTable(), 3000);

        // Update live stats
        this.updateLiveStats();
        setInterval(() => this.updateLiveStats(), 10000);

        // Update block time
        this.updateBlockTime();
        setInterval(() => this.updateBlockTime(), 1000);
    }

    updateBlocksTable() {
        const tbody = document.getElementById('latestBlocksTable');
        if (!tbody) return;

        // Generate mock blocks
        const blocks = this.generateMockBlocks(10);
        
        tbody.innerHTML = blocks.map(block => `
            <tr>
                <td>
                    <a href="#block/${block.number}" class="hash-link">
                        ${block.number.toLocaleString()}
                    </a>
                </td>
                <td>${block.age}</td>
                <td>${block.txCount}</td>
                <td>
                    <a href="#address/${block.miner}" class="address-link">
                        ${this.shortenAddress(block.miner)}
                    </a>
                </td>
                <td class="amount-positive">${block.reward} KAS</td>
            </tr>
        `).join('');
    }

    updateTransactionsTable() {
        const tbody = document.getElementById('latestTxTable');
        if (!tbody) return;

        // Generate mock transactions
        const transactions = this.generateMockTransactions(10);
        
        tbody.innerHTML = transactions.map(tx => `
            <tr>
                <td>
                    <a href="#tx/${tx.hash}" class="hash-link">
                        ${this.shortenHash(tx.hash)}
                    </a>
                </td>
                <td>${tx.age}</td>
                <td>
                    <a href="#address/${tx.from}" class="address-link">
                        ${this.shortenAddress(tx.from)}
                    </a>
                </td>
                <td>
                    <a href="#address/${tx.to}" class="address-link">
                        ${this.shortenAddress(tx.to)}
                    </a>
                </td>
                <td class="amount-positive">${tx.amount} KAS</td>
            </tr>
        `).join('');
    }

    updateLiveStats() {
        // KAS Price
        const kasPrice = (Math.random() * 0.05 + 0.12).toFixed(4);
        const kasPriceEl = document.getElementById('kasPrice');
        if (kasPriceEl) kasPriceEl.textContent = `$${kasPrice}`;

        // Market Cap
        const marketCap = (parseFloat(kasPrice) * 23.5e9).toFixed(2);
        const marketCapEl = document.getElementById('marketCap');
        if (marketCapEl) marketCapEl.textContent = `$${(marketCap / 1e9).toFixed(2)}B`;

        // TX Count 24h
        const txCount = Math.floor(Math.random() * 100000 + 800000);
        const txCountEl = document.getElementById('txCount24h');
        if (txCountEl) txCountEl.textContent = txCount.toLocaleString();

        // Latest Block
        const blockNum = Math.floor(Math.random() * 1000 + 45890000);
        const blockNumEl = document.getElementById('latestBlockNum');
        if (blockNumEl) blockNumEl.textContent = blockNum.toLocaleString();

        // Hashrate
        const hashrate = (Math.random() * 0.2 + 1.2).toFixed(2);
        const hashrateEl = document.getElementById('hashrate');
        if (hashrateEl) hashrateEl.textContent = `${hashrate} EH/s`;

        // Update live hashrate in hero
        const liveHashrate = document.getElementById('live-hashrate');
        if (liveHashrate) liveHashrate.textContent = `${hashrate} EH/s`;
    }

    updateBlockTime() {
        const blockTimeEl = document.getElementById('blockTime');
        if (!blockTimeEl) return;

        let seconds = parseInt(blockTimeEl.dataset.seconds || '0');
        seconds++;
        
        if (seconds >= 60) {
            blockTimeEl.textContent = `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
        } else {
            blockTimeEl.textContent = `${seconds}s ago`;
        }

        blockTimeEl.dataset.seconds = seconds;

        // Reset every block (simulate 1s block time)
        if (seconds > 10) {
            blockTimeEl.dataset.seconds = '0';
            this.updateLiveStats();
        }
    }

    generateMockBlocks(count) {
        const blocks = [];
        const now = Date.now();
        
        for (let i = 0; i < count; i++) {
            blocks.push({
                number: 45892347 - i,
                age: this.formatAge(now - (i * 1000)),
                txCount: Math.floor(Math.random() * 50 + 10),
                miner: this.generateAddress(),
                reward: (Math.random() * 50 + 200).toFixed(2)
            });
        }
        
        return blocks;
    }

    generateMockTransactions(count) {
        const transactions = [];
        const now = Date.now();
        
        for (let i = 0; i < count; i++) {
            transactions.push({
                hash: this.generateHash(),
                age: this.formatAge(now - (i * 2000)),
                from: this.generateAddress(),
                to: this.generateAddress(),
                amount: (Math.random() * 1000 + 1).toFixed(4)
            });
        }
        
        return transactions;
    }

    generateHash() {
        return '0x' + Array.from({length: 64}, () => 
            Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }

    generateAddress() {
        return 'kaspa:qq' + Array.from({length: 40}, () => 
            Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }

    shortenHash(hash) {
        return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
    }

    shortenAddress(address) {
        return `${address.substring(0, 15)}...${address.substring(address.length - 8)}`;
    }

    formatAge(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    loadTopAddresses() {
        const tbody = document.getElementById('topAddressesTable');
        if (!tbody) return;

        const addresses = Array.from({length: 20}, (_, i) => ({
            rank: i + 1,
            address: this.generateAddress(),
            balance: (Math.random() * 100000000 + 1000000).toFixed(2),
            percentage: (Math.random() * 2 + 0.1).toFixed(4),
            txCount: Math.floor(Math.random() * 10000 + 100)
        }));

        tbody.innerHTML = addresses.map(addr => `
            <tr>
                <td>${addr.rank}</td>
                <td>
                    <a href="#address/${addr.address}" class="address-link">
                        ${this.shortenAddress(addr.address)}
                    </a>
                </td>
                <td class="amount-positive">${parseFloat(addr.balance).toLocaleString()} KAS</td>
                <td>${addr.percentage}%</td>
                <td>${addr.txCount.toLocaleString()}</td>
            </tr>
        `).join('');
    }

    initCharts() {
        this.initTxHistoryChart();
        this.initHashrateChart();
        this.initRewardChart();
    }

    initTxHistoryChart() {
        const canvas = document.getElementById('txHistoryChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Generate mock data
        const labels = Array.from({length: 7}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
        });

        const data = Array.from({length: 7}, () => 
            Math.floor(Math.random() * 200000 + 700000)
        );

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Transactions',
                    data: data,
                    borderColor: '#00D9C5',
                    backgroundColor: 'rgba(0, 217, 197, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#6B9AA3'
                        },
                        grid: {
                            color: 'rgba(0, 217, 197, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#6B9AA3'
                        },
                        grid: {
                            color: 'rgba(0, 217, 197, 0.1)'
                        }
                    }
                }
            }
        });

        // Set canvas height
        canvas.style.height = '300px';
    }

    initHashrateChart() {
        const canvas = document.getElementById('hashrateChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        const labels = Array.from({length: 7}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
        });

        const data = Array.from({length: 7}, () => 
            (Math.random() * 0.3 + 1.0).toFixed(2)
        );

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Hashrate (EH/s)',
                    data: data,
                    backgroundColor: 'rgba(0, 217, 197, 0.6)',
                    borderColor: '#00D9C5',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#6B9AA3',
                            callback: (value) => `${value} EH/s`
                        },
                        grid: {
                            color: 'rgba(0, 217, 197, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#6B9AA3'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        canvas.style.height = '300px';
    }

    initRewardChart() {
        const canvas = document.getElementById('rewardChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        const data = Array.from({length: 24}, () => 
            (Math.random() * 50 + 200).toFixed(2)
        );

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Block Reward (KAS)',
                    data: data,
                    borderColor: '#7B68EE',
                    backgroundColor: 'rgba(123, 104, 238, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#6B9AA3',
                            callback: (value) => `${value} KAS`
                        },
                        grid: {
                            color: 'rgba(0, 217, 197, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#6B9AA3',
                            maxTicksLimit: 12
                        },
                        grid: {
                            color: 'rgba(0, 217, 197, 0.1)'
                        }
                    }
                }
            }
        });

        canvas.style.height = '300px';
    }
}

// Initialize explorer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kaspaExplorer = new KaspaExplorer();
    
    // Animate counters
    if (typeof AnimationHelpers !== 'undefined' && AnimationHelpers.animateCounter) {
        document.querySelectorAll('[data-target]').forEach(el => {
            const target = parseInt(el.getAttribute('data-target'));
            AnimationHelpers.animateCounter(el, target, 2000);
        });
    }
});
