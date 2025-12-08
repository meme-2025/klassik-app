
// Hero Stats: Live Kaspa Daten



// Hero Stats: Eigene Node + Kaspa.org Fallback
const MAIN_API = 'https://api.kaspascan.io/v1';
const FALLBACK_API = 'https://api.kaspa.org';

async function fetchStatsFrom(apiBase) {
  // Versuche, die Datenstruktur beider APIs zu unterstützen
  let netStats = null, supplyStats = null, latestBlock = null;
  // Network stats
  try {
    const netRes = await fetch(apiBase + '/stats/network');
    netStats = await netRes.json();
  } catch {}
  // Supply
  try {
    const supplyRes = await fetch(apiBase + '/stats/supply');
    supplyStats = await supplyRes.json();
  } catch {}
  // Latest block
  try {
    const blockRes = await fetch(apiBase + '/blocks/latest?limit=1');
    const blockData = await blockRes.json();
    latestBlock = blockData && blockData.blocks && blockData.blocks[0] ? blockData.blocks[0] : null;
  } catch {}
  return { netStats, supplyStats, latestBlock };
}

async function fetchKaspaStats() {
  let apiStatus = 'offline';
  let source = MAIN_API;
  let now = new Date();
  let stats = null;
  try {
    stats = await fetchStatsFrom(MAIN_API);
    apiStatus = 'online';
    source = MAIN_API;
    // Prüfe ob Daten valide sind, sonst Fallback
    if (!stats.netStats || !stats.supplyStats) throw new Error('Main API liefert keine Daten');
  } catch (e) {
    try {
      stats = await fetchStatsFrom(FALLBACK_API);
      apiStatus = 'online';
      source = FALLBACK_API;
    } catch (e2) {
      stats = null;
      apiStatus = 'offline';
      source = '-';
    }
  }

  // Stats anzeigen (nur schreiben, wenn Elemente existieren)
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (stats && stats.netStats && stats.supplyStats) {
    const { netStats, supplyStats, latestBlock } = stats;
    setText('stat-bps', netStats.block_rate ? netStats.block_rate.toFixed(2) : '-');
    setText('stat-reward', latestBlock && latestBlock.reward ? latestBlock.reward : '-');
    setText('stat-tx24h', netStats.tx_count_24h ? netStats.tx_count_24h.toLocaleString() : '-');
    setText('stat-supply', supplyStats.circulating && supplyStats.total ? `${parseFloat(supplyStats.circulating).toLocaleString()} / ${parseFloat(supplyStats.total).toLocaleString()}` : '-');
    setText('stat-hashrate', netStats.network_hashrate ? `${(netStats.network_hashrate/1e12).toFixed(2)} TH/s` : '-');
    setText('stats-source', 'Quelle: ' + (source === MAIN_API ? 'Eigene Node' : 'Kaspa.org'));
    setText('stats-updated', 'Letztes Update: ' + now.toLocaleTimeString());
    setText('api-status', apiStatus);
  } else {
    // Fehlerfall: alles leeren
    setText('stat-bps', '-');
    setText('stat-reward', '-');
    setText('stat-tx24h', '-');
    setText('stat-supply', '-');
    setText('stat-hashrate', '-');
    setText('stats-source', 'Quelle: -');
    setText('stats-updated', 'Letztes Update: -');
    setText('api-status', 'offline');
  }
}

document.getElementById('stats-refresh').addEventListener('click', fetchKaspaStats);
fetchKaspaStats();
setInterval(fetchKaspaStats, 30000);
