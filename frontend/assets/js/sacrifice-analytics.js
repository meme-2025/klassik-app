/**
 * KASPAHUB SACRIFICE - ANALYTICS & CHARTS
 * Handles data visualization, charts, and leaderboard
 */

// ============================================
// CHART CONFIGURATION
// ============================================

const ChartConfig = {
    defaultColors: {
        kaspaBlue: 'rgba(73, 217, 217, 1)',
        kaspaPurple: 'rgba(123, 79, 255, 1)',
        kaspaPink: 'rgba(255, 73, 217, 1)',
        kaspaGold: 'rgba(255, 215, 0, 1)',
        kaspaSilver: 'rgba(192, 192, 192, 1)',
        kaspaBronze: 'rgba(205, 127, 50, 1)',
        success: 'rgba(0, 255, 136, 1)',
        gradient: [
            'rgba(73, 217, 217, 0.8)',
            'rgba(123, 79, 255, 0.8)',
            'rgba(255, 73, 217, 0.8)'
        ]
    },
    
    defaultOptions: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                labels: {
                    color: '#b0b0c0',
                    font: { family: 'Inter', size: 12 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(20, 20, 35, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#b0b0c0',
                borderColor: 'rgba(73, 217, 217, 0.5)',
                borderWidth: 1,
                padding: 12,
                displayColors: true
            }
        },
        scales: {
            y: {
                ticks: { color: '#707085' },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: {
                ticks: { color: '#707085' },
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
        }
    }
};

// ============================================
// ANALYTICS DATA MANAGER
// ============================================

class AnalyticsDataManager {
    constructor() {
        this.volumeData = [];
        this.participantsData = [];
        this.tierDistribution = { bronze: 0, silver: 0, gold: 0, diamond: 0 };
        this.hourlyActivity = Array(24).fill(0);
        this.leaderboardData = [];
    }
    
    /**
     * Load all analytics data
     */
    async loadAll() {
        await Promise.all([
            this.loadVolumeData(),
            this.loadParticipantsData(),
            this.loadTierDistribution(),
            this.loadHourlyActivity(),
            this.loadLeaderboard()
        ]);
    }
    
    /**
     * Load volume data
     */
    async loadVolumeData(range = '24h') {
        try {
            // Simulate API call
            const response = await this.mockApiCall(`/api/analytics/volume?range=${range}`);
            this.volumeData = response.data;
            return this.volumeData;
        } catch (error) {
            console.error('Error loading volume data:', error);
            return this.generateMockVolumeData(range);
        }
    }
    
    /**
     * Load participants data
     */
    async loadParticipantsData(range = '24h') {
        try {
            const response = await this.mockApiCall(`/api/analytics/participants?range=${range}`);
            this.participantsData = response.data;
            return this.participantsData;
        } catch (error) {
            console.error('Error loading participants data:', error);
            return this.generateMockParticipantsData(range);
        }
    }
    
    /**
     * Load tier distribution
     */
    async loadTierDistribution() {
        try {
            const response = await this.mockApiCall('/api/analytics/tiers');
            this.tierDistribution = response.data;
            return this.tierDistribution;
        } catch (error) {
            console.error('Error loading tier distribution:', error);
            return {
                bronze: Math.floor(Math.random() * 200) + 100,
                silver: Math.floor(Math.random() * 150) + 50,
                gold: Math.floor(Math.random() * 50) + 20,
                diamond: Math.floor(Math.random() * 20) + 5
            };
        }
    }
    
    /**
     * Load hourly activity
     */
    async loadHourlyActivity() {
        try {
            const response = await this.mockApiCall('/api/analytics/hourly');
            this.hourlyActivity = response.data;
            return this.hourlyActivity;
        } catch (error) {
            console.error('Error loading hourly activity:', error);
            return Array(24).fill(0).map(() => Math.floor(Math.random() * 100));
        }
    }
    
    /**
     * Load leaderboard
     */
    async loadLeaderboard(page = 1, limit = 50) {
        try {
            const response = await this.mockApiCall(`/api/leaderboard?page=${page}&limit=${limit}`);
            this.leaderboardData = response.data;
            return this.leaderboardData;
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            return this.generateMockLeaderboard(limit);
        }
    }
    
    /**
     * Mock API call
     */
    async mockApiCall(endpoint) {
        await new Promise(resolve => setTimeout(resolve, 500));
        throw new Error('API not available - using mock data');
    }
    
    /**
     * Generate mock volume data
     */
    generateMockVolumeData(range) {
        const dataPoints = {
            '24h': 24,
            '7d': 7,
            '30d': 30,
            'all': 60
        }[range] || 24;
        
        const data = [];
        let cumulative = 0;
        
        for (let i = 0; i < dataPoints; i++) {
            const value = Math.floor(Math.random() * 50000) + 10000;
            cumulative += value;
            data.push({
                timestamp: Date.now() - (dataPoints - i) * 3600000,
                value: value,
                cumulative: cumulative
            });
        }
        
        return data;
    }
    
    /**
     * Generate mock participants data
     */
    generateMockParticipantsData(range) {
        const dataPoints = {
            '24h': 24,
            '7d': 7,
            '30d': 30,
            'all': 60
        }[range] || 24;
        
        const data = [];
        let cumulative = 100;
        
        for (let i = 0; i < dataPoints; i++) {
            const newUsers = Math.floor(Math.random() * 20) + 5;
            cumulative += newUsers;
            data.push({
                timestamp: Date.now() - (dataPoints - i) * 3600000,
                new: newUsers,
                total: cumulative
            });
        }
        
        return data;
    }
    
    /**
     * Generate mock leaderboard
     */
    generateMockLeaderboard(limit) {
        const leaderboard = [];
        
        for (let i = 0; i < limit; i++) {
            const tier = this.getRandomTier();
            const amount = this.getRandomAmount(tier);
            const points = this.calculatePoints(amount, tier);
            
            leaderboard.push({
                rank: i + 1,
                address: this.generateMockAddress(),
                totalSacrificed: amount,
                points: points,
                transactions: Math.floor(Math.random() * 10) + 1,
                tier: tier,
                lastActive: Date.now() - Math.floor(Math.random() * 86400000)
            });
        }
        
        // Sort by points
        leaderboard.sort((a, b) => b.points - a.points);
        
        // Update ranks
        leaderboard.forEach((entry, index) => {
            entry.rank = index + 1;
        });
        
        return leaderboard;
    }
    
    getRandomTier() {
        const rand = Math.random();
        if (rand < 0.6) return 'bronze';
        if (rand < 0.85) return 'silver';
        if (rand < 0.95) return 'gold';
        return 'diamond';
    }
    
    getRandomAmount(tier) {
        const ranges = {
            bronze: [1000, 9999],
            silver: [10000, 49999],
            gold: [50000, 99999],
            diamond: [100000, 500000]
        };
        
        const [min, max] = ranges[tier];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    calculatePoints(amount, tier) {
        const multipliers = {
            bronze: 2500,
            silver: 3750,
            gold: 4375,
            diamond: 5000
        };
        
        return Math.floor((amount / 1000) * multipliers[tier]);
    }
    
    generateMockAddress() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let address = 'kaspa:qz';
        for (let i = 0; i < 60; i++) {
            address += chars[Math.floor(Math.random() * chars.length)];
        }
        return address;
    }
}

// ============================================
// CHART RENDERER
// ============================================

class ChartRenderer {
    constructor() {
        this.charts = {};
    }
    
    /**
     * Create volume chart
     */
    createVolumeChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
        const values = data.map(d => d.value);
        const cumulative = data.map(d => d.cumulative);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Daily Volume',
                        data: values,
                        borderColor: ChartConfig.defaultColors.kaspaBlue,
                        backgroundColor: 'rgba(73, 217, 217, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Cumulative',
                        data: cumulative,
                        borderColor: ChartConfig.defaultColors.kaspaPurple,
                        backgroundColor: 'rgba(123, 79, 255, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                ...ChartConfig.defaultOptions,
                scales: {
                    y: {
                        ...ChartConfig.defaultOptions.scales.y,
                        ticks: {
                            ...ChartConfig.defaultOptions.scales.y.ticks,
                            callback: (value) => `${(value / 1000).toFixed(0)}K`
                        }
                    },
                    x: ChartConfig.defaultOptions.scales.x
                }
            }
        });
    }
    
    /**
     * Create tier distribution chart
     */
    createTierChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Bronze', 'Silver', 'Gold', 'Diamond'],
                datasets: [{
                    data: [data.bronze, data.silver, data.gold, data.diamond],
                    backgroundColor: [
                        ChartConfig.defaultColors.kaspaBronze,
                        ChartConfig.defaultColors.kaspaSilver,
                        ChartConfig.defaultColors.kaspaGold,
                        ChartConfig.defaultColors.kaspaBlue
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(10, 10, 15, 1)'
                }]
            },
            options: {
                ...ChartConfig.defaultOptions,
                plugins: {
                    ...ChartConfig.defaultOptions.plugins,
                    legend: {
                        display: false
                    }
                }
            }
        });
        
        // Update tier counts
        document.getElementById('bronzeCount').textContent = data.bronze;
        document.getElementById('silverCount').textContent = data.silver;
        document.getElementById('goldCount').textContent = data.gold;
        document.getElementById('diamondCount').textContent = data.diamond;
    }
    
    /**
     * Create participants growth chart
     */
    createParticipantsChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
        const totals = data.map(d => d.total);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Participants',
                    data: totals,
                    borderColor: ChartConfig.defaultColors.success,
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: ChartConfig.defaultOptions
        });
    }
    
    /**
     * Create hourly activity heatmap
     */
    createHeatmapChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Transactions',
                    data: data,
                    backgroundColor: ChartConfig.defaultColors.gradient,
                    borderWidth: 0
                }]
            },
            options: {
                ...ChartConfig.defaultOptions,
                plugins: {
                    ...ChartConfig.defaultOptions.plugins,
                    legend: { display: false }
                }
            }
        });
    }
}

// ============================================
// LEADERBOARD MANAGER
// ============================================

class LeaderboardManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentPage = 1;
        this.itemsPerPage = 20;
    }
    
    /**
     * Render leaderboard table
     */
    async render(page = 1) {
        this.currentPage = page;
        
        const data = await this.dataManager.loadLeaderboard(page, this.itemsPerPage);
        
        // Update podium (top 3)
        this.updatePodium(data.slice(0, 3));
        
        // Update table
        this.updateTable(data);
        
        // Update pagination
        this.updatePagination();
    }
    
    /**
     * Update podium display
     */
    updatePodium(topThree) {
        if (topThree.length === 0) return;
        
        // First place
        if (topThree[0]) {
            this.updatePodiumPlace(1, topThree[0]);
        }
        
        // Second place
        if (topThree[1]) {
            this.updatePodiumPlace(2, topThree[1]);
        }
        
        // Third place
        if (topThree[2]) {
            this.updatePodiumPlace(3, topThree[2]);
        }
    }
    
    updatePodiumPlace(rank, data) {
        const shortAddress = this.shortenAddress(data.address);
        
        document.getElementById(`rank${rank}Address`).textContent = shortAddress;
        document.getElementById(`rank${rank}Amount`).textContent = `${data.totalSacrificed.toLocaleString()} KAS`;
        document.getElementById(`rank${rank}Points`).textContent = `${data.points.toLocaleString()} pts`;
    }
    
    /**
     * Update leaderboard table
     */
    updateTable(data) {
        const tbody = document.getElementById('leaderboardTableBody');
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="7">No data available</td>
                </tr>
            `;
            return;
        }
        
        data.forEach(entry => {
            const row = document.createElement('tr');
            
            // Highlight user's row
            if (window.SacrificeState && entry.address === window.SacrificeState.walletAddress) {
                row.classList.add('user-row');
            }
            
            row.innerHTML = `
                <td><strong>#${entry.rank}</strong></td>
                <td><code>${this.shortenAddress(entry.address)}</code></td>
                <td><strong>${entry.totalSacrificed.toLocaleString()} KAS</strong></td>
                <td>${entry.points.toLocaleString()}</td>
                <td>${entry.transactions}</td>
                <td><span class="tier-badge-mini ${entry.tier}">${entry.tier.toUpperCase()}</span></td>
                <td>${this.formatTimeAgo(entry.lastActive)}</td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    /**
     * Update pagination
     */
    updatePagination() {
        const totalPages = Math.ceil(this.dataManager.leaderboardData.length / this.itemsPerPage) || 1;
        
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages;
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        prevBtn.disabled = this.currentPage === 1;
        nextBtn.disabled = this.currentPage === totalPages;
    }
    
    /**
     * Change page
     */
    async changePage(direction) {
        const newPage = this.currentPage + direction;
        await this.render(newPage);
    }
    
    /**
     * Utility: Shorten address
     */
    shortenAddress(address) {
        if (!address) return '...';
        return `${address.substring(0, 12)}...${address.substring(address.length - 6)}`;
    }
    
    /**
     * Utility: Format time ago
     */
    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
}

// ============================================
// INITIALIZE ANALYTICS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Initializing analytics...');
    
    const dataManager = new AnalyticsDataManager();
    const chartRenderer = new ChartRenderer();
    const leaderboardManager = new LeaderboardManager(dataManager);
    
    try {
        // Load all data
        await dataManager.loadAll();
        
        // Create charts
        chartRenderer.createVolumeChart('volumeChart', dataManager.volumeData);
        chartRenderer.createTierChart('tierChart', dataManager.tierDistribution);
        chartRenderer.createParticipantsChart('participantsChart', dataManager.participantsData);
        chartRenderer.createHeatmapChart('heatmapChart', dataManager.hourlyActivity);
        
        // Render leaderboard
        await leaderboardManager.render();
        
        // Update stats
        updateAdditionalStats(dataManager);
        
        // Store globally
        window.SacrificeState.leaderboard = dataManager.leaderboardData;
        
        console.log('✅ Analytics initialized');
        
    } catch (error) {
        console.error('Analytics initialization error:', error);
    }
    
    // Export managers
    window.analyticsDataManager = dataManager;
    window.chartRenderer = chartRenderer;
    window.leaderboardManager = leaderboardManager;
});

/**
 * Update additional stats
 */
function updateAdditionalStats(dataManager) {
    const totalTx = dataManager.leaderboardData.reduce((sum, entry) => sum + entry.transactions, 0);
    const uniqueWallets = dataManager.leaderboardData.length;
    const avgPerTx = totalTx > 0 ? window.SacrificeState.totalSacrificed / totalTx : 0;
    
    document.getElementById('totalTransactions').textContent = totalTx.toLocaleString();
    document.getElementById('uniqueWallets').textContent = uniqueWallets.toLocaleString();
    document.getElementById('avgPerTx').textContent = `${Math.floor(avgPerTx).toLocaleString()} KAS`;
    document.getElementById('burnRate').textContent = '12.5%';
}

/**
 * Update charts based on time range
 */
async function updateCharts(range) {
    const dataManager = window.analyticsDataManager;
    const chartRenderer = window.chartRenderer;
    
    if (!dataManager || !chartRenderer) return;
    
    const volumeData = await dataManager.loadVolumeData(range);
    const participantsData = await dataManager.loadParticipantsData(range);
    
    chartRenderer.createVolumeChart('volumeChart', volumeData);
    chartRenderer.createParticipantsChart('participantsChart', participantsData);
}

// Export update function
window.updateCharts = updateCharts;

/**
 * Pagination handlers
 */
function changePage(direction) {
    if (window.leaderboardManager) {
        window.leaderboardManager.changePage(direction);
    }
}

window.loadLeaderboardPage = changePage;

console.log('📊 Analytics module loaded');
