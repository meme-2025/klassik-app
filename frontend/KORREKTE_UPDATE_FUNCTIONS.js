// ============================================
// KORREKTE UPDATE FUNKTIONEN - Einfügen in kaspa-explorer.js
// ============================================

function updateQuickStats() {
    // Update Header Price
    const headerPriceValue = document.getElementById('header-price-value');
    const headerPriceChange = document.getElementById('header-price-change');
    if (headerPriceValue && state.price.current > 0) {
        const truncated = truncateDecimals(state.price.current, 2);
        headerPriceValue.textContent = `$${safeToFixed(truncated, 2)}`;
    }
    if (headerPriceChange) {
        const change = state.price.change24h || 0;
        headerPriceChange.textContent = `${change >= 0 ? '+' : ''}${safeToFixed(change, 2)}%`;
        headerPriceChange.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
    
    // 1L: KAS Price with 24h change
    const priceElem = document.getElementById('price-stat');
    const priceChange24hElem = document.getElementById('price-change-24h');
    if (priceElem) {
        if (state.price.current > 0) {
            const truncated = truncateDecimals(state.price.current, 2);
            priceElem.textContent = `$${safeToFixed(truncated, 2)}`;
        } else {
            priceElem.textContent = 'Loading...';
        }
        
        if (priceChange24hElem) {
            const change = state.price.change24h || 0;
            priceChange24hElem.textContent = `${change >= 0 ? '+' : ''}${safeToFixed(change, 2)}%`;
            priceChange24hElem.className = `stats-bar-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    // 2L: Market Cap
    const mcapElem = document.getElementById('mcap-stat');
    if (mcapElem) {
        if (state.price.marketCap > 0) {
            mcapElem.textContent = `$${formatNumber(state.price.marketCap)}`;
        } else {
            mcapElem.textContent = 'Loading...';
        }
    }

    // 3L: Transactions (24h) - ECHTE WERTE
    const totalTxsStatElem = document.getElementById('total-txs-stat');
    if (totalTxsStatElem) {
        const txCount = state.transactions24h || 0;
        if (txCount > 0) {
            totalTxsStatElem.textContent = `${txCount.toLocaleString()}`;
        } else {
            totalTxsStatElem.textContent = 'Loading...';
        }
    }
    
    // 4L: Hashrate - ECHTE WERTE
    const hashrateStatElem = document.getElementById('hashrate-stat');
    if (hashrateStatElem) {
        const hashrate = state.network.hashrate || 0;
        if (hashrate > 0) {
            // Konvertiere zu PH/s (Peta Hashes)
            const hashrateInPH = hashrate / 1e15;
            hashrateStatElem.textContent = `${safeToFixed(hashrateInPH, 2)} PH/s`;
        } else {
            hashrateStatElem.textContent = 'Loading...';
        }
    }
    
    // 5L: Difficulty - ECHTE WERTE
    const difficultyStatElem = document.getElementById('difficulty-stat');
    if (difficultyStatElem) {
        const difficulty = state.network.difficulty || 0;
        if (difficulty > 0) {
            difficultyStatElem.textContent = formatCompact(difficulty);
        } else {
            difficultyStatElem.textContent = 'Loading...';
        }
    }
    
    // 6L: Block Reward - ECHTE WERTE
    const blockRewardStatElem = document.getElementById('block-reward-stat');
    if (blockRewardStatElem) {
        const reward = state.network.blockReward || 0;
        if (reward > 0) {
            blockRewardStatElem.textContent = `${safeToFixed(reward, 2)} KAS`;
        } else {
            blockRewardStatElem.textContent = 'Loading...';
        }
    }
}

// ============================================
// Update Right Column Stats - NEU mit Remaining Supply
// ============================================
function updateRightColumnStats() {
    // 24h Volume
    const volume24hStatElem = document.getElementById('volume-24h-stat');
    if (volume24hStatElem) {
        const volume = state.price?.volume24h || 0;
        if (volume > 0) {
            volume24hStatElem.textContent = `$${formatNumber(volume)}`;
        } else {
            volume24hStatElem.textContent = 'Loading...';
        }
    }
    
    // ATH Price (wird später von CoinGecko geholt)
    const athPriceStatElem = document.getElementById('ath-price-stat');
    if (athPriceStatElem) {
        const currentPrice = state.price?.current || 0;
        if (currentPrice > 0) {
            // Placeholder - sollte von CoinGecko kommen
            athPriceStatElem.textContent = '$0.20 (ATH)';
        } else {
            athPriceStatElem.textContent = 'Loading...';
        }
    }
    
    // REMAINING SUPPLY - NEU!!!
    const totalSupplyStatElem = document.getElementById('total-supply-stat');
    if (totalSupplyStatElem) {
        const remaining = state.network?.remainingSupply || 0;
        const percentage = state.network?.supplyPercentage || 0;
        if (remaining > 0) {
            const remainingKAS = Math.floor(remaining / 1e8);
            totalSupplyStatElem.textContent = `${remainingKAS.toLocaleString()} KAS`;
            totalSupplyStatElem.title = `${percentage}% already mined`;
        } else {
            totalSupplyStatElem.textContent = 'Loading...';
        }
    }
    
    // CIRCULATING SUPPLY mit Prozent
    const circSupplyStatElem = document.getElementById('circ-supply-stat');
    if (circSupplyStatElem) {
        const circ = state.network?.circulatingSupply || 0;
        const percentage = state.network?.supplyPercentage || 0;
        if (circ > 0) {
            const circKAS = Math.floor(circ / 1e8);
            circSupplyStatElem.textContent = `${circKAS.toLocaleString()} KAS (${percentage}%)`;
        } else {
            circSupplyStatElem.textContent = 'Loading...';
        }
    }
    
    // AVERAGE BLOCK TIME - ECHTE BERECHNUNG
    const avgBlockTimeStatElem = document.getElementById('avg-block-time-stat');
    if (avgBlockTimeStatElem) {
        // Berechne aus den letzten Blöcken
        if (state.blocks.length >= 2) {
            const timeDiff = state.blocks[0].timestamp - state.blocks[state.blocks.length - 1].timestamp;
            const avgTime = timeDiff / (state.blocks.length - 1) / 1000; // in Sekunden
            avgBlockTimeStatElem.textContent = `${safeToFixed(avgTime, 2)}s`;
        } else {
            avgBlockTimeStatElem.textContent = '~1.0s';
        }
    }
    
    // Next Halving
    const nextHalvingStatElem = document.getElementById('next-halving-stat');
    if (nextHalvingStatElem) {
        const halvingDate = state.network?.nextHalvingDate;
        if (halvingDate && halvingDate !== 'N/A') {
            try {
                const date = new Date(halvingDate);
                const now = new Date();
                const daysUntil = Math.floor((date - now) / (1000 * 60 * 60 * 24));
                if (daysUntil > 0) {
                    nextHalvingStatElem.textContent = `in ${daysUntil} days`;
                } else {
                    nextHalvingStatElem.textContent = halvingDate;
                }
            } catch (e) {
                nextHalvingStatElem.textContent = halvingDate;
            }
        } else {
            nextHalvingStatElem.textContent = 'Loading...';
        }
    }
}

// ============================================
// Data Blocks Update - ECHTE WERTE
// ============================================
function updateDataBlocks() {
    // Total Supply
    const totalSupplyElem = document.getElementById('total-supply');
    if (totalSupplyElem) {
        const total = state.network?.totalSupply || 0;
        if (total > 0) {
            const totalKAS = Math.floor(total / 1e8);
            totalSupplyElem.textContent = `${totalKAS.toLocaleString()} KAS`;
        } else {
            totalSupplyElem.textContent = 'Loading...';
        }
    }
    
    // Circulating Supply
    const circSupplyElem = document.getElementById('circ-supply');
    if (circSupplyElem) {
        const circ = state.network?.circulatingSupply || 0;
        if (circ > 0) {
            const circKAS = Math.floor(circ / 1e8);
            circSupplyElem.textContent = `${circKAS.toLocaleString()} KAS`;
        } else {
            circSupplyElem.textContent = 'Loading...';
        }
    }
    
    // Mineable Remaining
    const mineableSupplyElem = document.getElementById('mineable-supply');
    if (mineableSupplyElem) {
        const remaining = state.network?.remainingSupply || 0;
        if (remaining > 0) {
            const mineableKAS = Math.floor(remaining / 1e8);
            mineableSupplyElem.textContent = `${mineableKAS.toLocaleString()} KAS`;
        } else {
            mineableSupplyElem.textContent = 'Loading...';
        }
    }
    
    // Avg Block Time - ECHTE BERECHNUNG
    const avgBlocktimeElem = document.getElementById('avg-blocktime');
    if (avgBlocktimeElem) {
        if (state.blocks.length >= 2) {
            const timeDiff = state.blocks[0].timestamp - state.blocks[state.blocks.length - 1].timestamp;
            const avgTime = timeDiff / (state.blocks.length - 1) / 1000;
            avgBlocktimeElem.textContent = `${safeToFixed(avgTime, 2)}s`;
        } else {
            avgBlocktimeElem.textContent = '~1.0s';
        }
    }
    
    // Total Blocks - ECHTE WERTE
    const totalBlocksElem = document.getElementById('total-blocks');
    if (totalBlocksElem) {
        const blockCount = state.network?.blockCount || 0;
        if (blockCount > 0) {
            totalBlocksElem.textContent = formatNumber(blockCount);
        } else {
            totalBlocksElem.textContent = 'Loading...';
        }
    }
    
    // Daily Transactions - ECHTE WERTE
    const dailyTxsElem = document.getElementById('daily-txs');
    if (dailyTxsElem) {
        const txs24h = state.transactions24h || 0;
        if (txs24h > 0) {
            dailyTxsElem.textContent = formatNumber(txs24h);
        } else {
            dailyTxsElem.textContent = 'Loading...';
        }
    }
}
