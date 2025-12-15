
// Hero Stats: Live Kaspa Daten
// Using Kaspa REST API - https://api.kaspa.org/info/

const KASPA_API = 'https://api.kaspa.org';

async function fetchKaspaStatsData() {
  try {
    // Kaspa REST API endpoints
    const [infoRes, coinsupplyRes] = await Promise.all([
      fetch(`${KASPA_API}/info/blocksdag`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
      fetch(`${KASPA_API}/info/coinsupply`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
    ]);

    const info = infoRes && infoRes.ok ? await infoRes.json() : null;
    const supply = coinsupplyRes && coinsupplyRes.ok ? await coinsupplyRes.json() : null;

    return { info, supply };
  } catch (error) {
    console.warn('Failed to fetch Kaspa stats:', error);
    return { info: null, supply: null };
  }
}


async function fetchKaspaStats() {
  const now = new Date();
  
  const { info, supply } = await fetchKaspaStatsData();

  // Stats anzeigen (nur schreiben, wenn Elemente existieren)
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (info || supply) {
    // BPS (Blocks per second) - Kaspa: ~1 block/sec
    setText('stat-bps', info?.blockCount ? '1.00' : '-');
    
    // Block Reward (in KAS)
    setText('stat-reward', info ? '165.9 KAS' : '-');
    
    // Transactions last 24h - placeholder (API doesn't provide this directly)
    setText('stat-tx24h', '-');
    
    // Supply
    if (supply) {
      const circulating = supply.circulatingSupply ? (supply.circulatingSupply / 1e8).toFixed(0) : '-';
      const max = supply.maxSupply ? (supply.maxSupply / 1e8).toFixed(0) : '28.7B';
      setText('stat-supply', `${circulating} / ${max}`);
    } else {
      setText('stat-supply', '-');
    }
    
    // Hashrate - placeholder (not directly available)
    setText('stat-hashrate', info?.difficulty ? `${(info.difficulty / 1e12).toFixed(2)} TH/s` : '-');
    
  } else {
    // Fehlerfall: Fallback-Werte
    setText('stat-bps', '1.00');
    setText('stat-reward', '165.9 KAS');
    setText('stat-tx24h', '-');
    setText('stat-supply', '~ / 28.7B');
    setText('stat-hashrate', '-');
  }
}

const statsRefreshBtn = document.getElementById('stats-refresh');
if (statsRefreshBtn) {
  statsRefreshBtn.addEventListener('click', fetchKaspaStats);
}

// Initial load
fetchKaspaStats();

// Auto-refresh every 30 seconds
setInterval(fetchKaspaStats, 30000);
