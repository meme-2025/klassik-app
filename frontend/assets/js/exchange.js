// Exchange JavaScript

// Tab Switching
document.querySelectorAll('.trade-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.trade-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.trade-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(`${tabName}-content`).classList.add('active');
    });
});

// Orderbook Tabs
document.querySelectorAll('.orderbook-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.orderbook-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.orderbook-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.getAttribute('data-tab');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    });
});

// Swap Direction Button
const swapDirectionBtn = document.querySelector('.swap-direction-btn');
if (swapDirectionBtn) {
    swapDirectionBtn.addEventListener('click', () => {
        const fromInput = document.getElementById('from-amount');
        const toInput = document.getElementById('to-amount');
        
        // Swap values
        const temp = fromInput.value;
        fromInput.value = toInput.value;
        toInput.value = temp;
    });
}

// Auto-calculate swap amount
const fromAmountInput = document.getElementById('from-amount');
const toAmountInput = document.getElementById('to-amount');
const currentRate = 0.1843;

if (fromAmountInput) {
    fromAmountInput.addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value) || 0;
        toAmountInput.value = (amount * currentRate).toFixed(4);
    });
}

// MAX button functionality
document.querySelectorAll('.max-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const inputGroup = e.target.closest('.token-input-group');
        const input = inputGroup.querySelector('.amount-input');
        const balanceText = inputGroup.querySelector('.balance-info span').textContent;
        const balance = parseFloat(balanceText.match(/[\d.]+/)[0]);
        
        input.value = balance;
        input.dispatchEvent(new Event('input'));
    });
});

// Trading Chart
const ctx = document.getElementById('tradingChart');
if (ctx) {
    const tradingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: generateTimeLabels(60),
            datasets: [{
                label: 'KAS/USDT',
                data: generatePriceData(60, 0.1843, 0.005),
                borderColor: '#00D9C5',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return null;
                    
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(0, 217, 197, 0.3)');
                    gradient.addColorStop(1, 'rgba(0, 217, 197, 0)');
                    return gradient;
                },
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#00D9C5',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#00D9C5',
                    bodyColor: '#fff',
                    borderColor: '#00D9C5',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(4);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 217, 197, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 217, 197, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        callback: function(value) {
                            return '$' + value.toFixed(4);
                        }
                    },
                    position: 'right'
                }
            }
        }
    });
    
    // Chart period buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update chart data based on period
            const period = btn.textContent;
            let dataPoints;
            switch(period) {
                case '1m': dataPoints = 60; break;
                case '5m': dataPoints = 120; break;
                case '15m': dataPoints = 180; break;
                case '1h': dataPoints = 240; break;
                case '4h': dataPoints = 288; break;
                case '1d': dataPoints = 288; break;
                default: dataPoints = 60;
            }
            
            tradingChart.data.labels = generateTimeLabels(dataPoints);
            tradingChart.data.datasets[0].data = generatePriceData(dataPoints, 0.1843, 0.005);
            tradingChart.update();
        });
    });
}

// Helper Functions
function generateTimeLabels(count) {
    const labels = [];
    const now = new Date();
    for (let i = count; i > 0; i--) {
        const time = new Date(now - i * 60000);
        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }
    return labels;
}

function generatePriceData(count, basePrice, volatility) {
    const data = [];
    let price = basePrice;
    
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.5) * volatility;
        price += change;
        data.push(parseFloat(price.toFixed(4)));
    }
    
    return data;
}

// Live Price Updates (simulated)
function updateLivePrice() {
    const priceValue = document.querySelector('.current-price .price-value');
    if (priceValue) {
        const currentPrice = parseFloat(priceValue.textContent);
        const change = (Math.random() - 0.5) * 0.0002;
        const newPrice = (currentPrice + change).toFixed(4);
        
        priceValue.textContent = newPrice;
        
        // Update stat bar
        const statValue = document.querySelector('.stat-value.positive');
        if (statValue) {
            statValue.textContent = '$' + newPrice;
        }
    }
}

// Update every 3 seconds
setInterval(updateLivePrice, 3000);

// Liquidity Tabs
document.querySelectorAll('.liquidity-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.liquidity-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Limit Order Type
document.querySelectorAll('.limit-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.limit-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

console.log('Exchange app loaded successfully');
