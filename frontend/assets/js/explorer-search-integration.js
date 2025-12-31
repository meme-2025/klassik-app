// Frontend Explorer Search Integration
// File: frontend/assets/js/explorer-search.js

class ExplorerSearchUI {
  constructor() {
    this.searchInput = document.getElementById('main-search');
    this.searchBtn = document.getElementById('search-btn');
    this.resultsContainer = document.getElementById('search-results');
    this.suggestionsContainer = document.getElementById('search-suggestions');
    this.isSearching = false;
    this.searchTimeout = null;
    
    this.setupEventListeners();
    this.createResultsContainer();
  }

  setupEventListeners() {
    if (!this.searchInput || !this.searchBtn) {
      console.warn('Search elements not found');
      return;
    }

    // Search button click
    this.searchBtn.addEventListener('click', () => this.performSearch());
    
    // Enter key press
    this.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });
    
    // Auto-suggestions on input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });
    
    // Clear suggestions on focus out
    this.searchInput.addEventListener('blur', () => {
      setTimeout(() => this.hideSuggestions(), 200);
    });
  }

  createResultsContainer() {
    if (!this.resultsContainer) {
      this.resultsContainer = document.createElement('div');
      this.resultsContainer.id = 'search-results';
      this.resultsContainer.className = 'search-results-container';
      this.resultsContainer.innerHTML = `
        <div class="search-results-header">
          <h3>Search Results</h3>
          <button class="close-results" onclick="this.parentElement.parentElement.style.display='none'">×</button>
        </div>
        <div class="search-results-content"></div>
      `;
      document.body.appendChild(this.resultsContainer);
    }
  }

  async performSearch() {
    const query = this.searchInput.value.trim();
    
    if (!query || query.length < 3) {
      this.showError('Please enter at least 3 characters to search');
      return;
    }

    if (this.isSearching) return;
    
    this.showLoading();
    this.isSearching = true;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        this.displayResults(data);
      } else {
        this.showError(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showError('Search failed. Please try again.');
    } finally {
      this.isSearching = false;
      this.hideLoading();
    }
  }

  async handleSearchInput(value) {
    clearTimeout(this.searchTimeout);
    
    if (value.length < 3) {
      this.hideSuggestions();
      return;
    }

    this.searchTimeout = setTimeout(async () => {
      await this.fetchSuggestions(value);
    }, 300);
  }

  async fetchSuggestions(query) {
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.suggestions && data.suggestions.length > 0) {
        this.showSuggestions(data.suggestions);
      } else {
        this.hideSuggestions();
      }
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  }

  showSuggestions(suggestions) {
    if (!this.suggestionsContainer) {
      this.suggestionsContainer = document.createElement('div');
      this.suggestionsContainer.id = 'search-suggestions';
      this.suggestionsContainer.className = 'search-suggestions';
      this.searchInput.parentElement.appendChild(this.suggestionsContainer);
    }

    const suggestionsHTML = suggestions.map(suggestion => `
      <div class="suggestion-item" onclick="explorerSearch.selectSuggestion('${suggestion.text}')">
        <span class="suggestion-text">${this.highlightMatch(suggestion.text, this.searchInput.value)}</span>
        <span class="suggestion-type">${suggestion.description}</span>
      </div>
    `).join('');

    this.suggestionsContainer.innerHTML = suggestionsHTML;
    this.suggestionsContainer.style.display = 'block';
  }

  hideSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.style.display = 'none';
    }
  }

  selectSuggestion(text) {
    this.searchInput.value = text;
    this.hideSuggestions();
    this.performSearch();
  }

  highlightMatch(text, query) {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    return text.substring(0, index) + 
           '<mark>' + text.substring(index, index + query.length) + '</mark>' + 
           text.substring(index + query.length);
  }

  displayResults(data) {
    const content = this.resultsContainer.querySelector('.search-results-content');
    
    if (data.type === 'address') {
      content.innerHTML = this.renderAddressResult(data);
    } else if (data.type === 'transaction') {
      content.innerHTML = this.renderTransactionResult(data);
    } else if (data.type === 'block') {
      content.innerHTML = this.renderBlockResult(data);
    } else if (data.type === 'multi') {
      content.innerHTML = this.renderMultiResults(data);
    } else {
      content.innerHTML = this.renderNotFound(data);
    }

    this.resultsContainer.style.display = 'block';
    this.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  renderAddressResult(data) {
    return `
      <div class="result-card address-result">
        <h4>📍 Kaspa Address</h4>
        <div class="address-info">
          <div class="address-field">
            <label>Address:</label>
            <code class="copyable" onclick="this.select()">${data.address}</code>
          </div>
          <div class="address-stats">
            <div class="stat">
              <span class="label">Balance:</span>
              <span class="value">${this.formatKAS(data.balance)} KAS</span>
            </div>
            <div class="stat">
              <span class="label">Transactions:</span>
              <span class="value">${data.transactionCount || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Total Received:</span>
              <span class="value">${this.formatKAS(data.totalReceived || 0)} KAS</span>
            </div>
            <div class="stat">
              <span class="label">Total Sent:</span>
              <span class="value">${this.formatKAS(data.totalSent || 0)} KAS</span>
            </div>
          </div>
        </div>
        ${data.transactions && data.transactions.length > 0 ? this.renderTransactionList(data.transactions) : ''}
      </div>
    `;
  }

  renderTransactionResult(data) {
    const tx = data.transaction;
    return `
      <div class="result-card transaction-result">
        <h4>💸 Transaction</h4>
        <div class="transaction-info">
          <div class="tx-field">
            <label>Hash:</label>
            <code class="copyable" onclick="this.select()">${tx.hash}</code>
          </div>
          <div class="tx-stats">
            <div class="stat">
              <span class="label">Inputs:</span>
              <span class="value">${tx.inputCount || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Outputs:</span>
              <span class="value">${tx.outputCount || 0}</span>
            </div>
            <div class="stat">
              <span class="label">Total Value:</span>
              <span class="value">${this.formatKAS(tx.totalOutput || 0)} KAS</span>
            </div>
            <div class="stat">
              <span class="label">Fee:</span>
              <span class="value">${this.formatKAS(tx.fee || 0)} KAS</span>
            </div>
          </div>
          ${tx.timestamp ? `<div class="tx-time">Time: ${new Date(tx.timestamp).toLocaleString()}</div>` : ''}
        </div>
      </div>
    `;
  }

  renderBlockResult(data) {
    const block = data.block;
    return `
      <div class="result-card block-result">
        <h4>🧱 Block</h4>
        <div class="block-info">
          <div class="block-field">
            <label>Hash:</label>
            <code class="copyable" onclick="this.select()">${block.hash}</code>
          </div>
          <div class="block-stats">
            <div class="stat">
              <span class="label">DAA Score:</span>
              <span class="value">${block.daaScore || block.height || 'Unknown'}</span>
            </div>
            <div class="stat">
              <span class="label">Transactions:</span>
              <span class="value">${block.transactionCount || 0}</span>
            </div>
            ${block.timestamp ? `
            <div class="stat">
              <span class="label">Timestamp:</span>
              <span class="value">${new Date(block.timestamp).toLocaleString()}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderMultiResults(data) {
    if (data.results.length === 0) {
      return this.renderNotFound(data);
    }

    return `
      <div class="multi-results">
        <h4>Multiple Results Found:</h4>
        ${data.results.map(result => {
          if (result.type === 'address') return this.renderAddressResult(result);
          if (result.type === 'transaction') return this.renderTransactionResult(result);
          if (result.type === 'block') return this.renderBlockResult(result);
          return '';
        }).join('')}
      </div>
    `;
  }

  renderNotFound(data) {
    return `
      <div class="result-card not-found">
        <h4>❌ Not Found</h4>
        <p>No results found for "${data.query || data.address || data.hash}"</p>
        <div class="search-tips">
          <h5>Search Tips:</h5>
          <ul>
            <li>Enter a full Kaspa address (kaspa:...)</li>
            <li>Enter a transaction hash (64 character hex)</li>
            <li>Enter a block hash (64 character hex)</li>
            <li>Enter a DAA score (block height number)</li>
          </ul>
        </div>
      </div>
    `;
  }

  renderTransactionList(transactions) {
    const recentTxs = transactions.slice(0, 10);
    return `
      <div class="recent-transactions">
        <h5>Recent Transactions:</h5>
        <div class="tx-list">
          ${recentTxs.map(tx => `
            <div class="tx-item">
              <span class="tx-hash" onclick="explorerSearch.searchInput.value='${tx.hash}'; explorerSearch.performSearch()">
                ${tx.hash ? tx.hash.substring(0, 16) + '...' : 'Unknown'}
              </span>
              <span class="tx-value">${this.formatKAS(tx.value || 0)} KAS</span>
              <span class="tx-time">${tx.timestamp ? this.timeAgo(new Date(tx.timestamp)) : 'Unknown'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatKAS(amount) {
    if (typeof amount !== 'number') return '0';
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 8 
    });
  }

  timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  showLoading() {
    this.searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    this.searchBtn.disabled = true;
  }

  hideLoading() {
    this.searchBtn.innerHTML = '<i class="fas fa-search"></i>';
    this.searchBtn.disabled = false;
  }

  showError(message) {
    if (this.resultsContainer) {
      const content = this.resultsContainer.querySelector('.search-results-content');
      content.innerHTML = `
        <div class="result-card error">
          <h4>❌ Error</h4>
          <p>${message}</p>
        </div>
      `;
      this.resultsContainer.style.display = 'block';
    } else {
      alert(message);
    }
  }
}

// CSS Styles for Search UI
const searchStyles = `
.search-results-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  background: var(--bg-color, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  z-index: 1000;
  overflow: hidden;
  display: none;
}

.search-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--header-bg, #2a2a2a);
}

.search-results-content {
  padding: 1rem;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-color, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  display: none;
}

.suggestion-item {
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #333);
  display: flex;
  justify-content: space-between;
}

.suggestion-item:hover {
  background: var(--hover-bg, #2a2a2a);
}

.result-card {
  background: var(--card-bg, #2a2a2a);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.copyable {
  cursor: pointer;
  user-select: all;
  background: var(--code-bg, #333);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.copyable:hover {
  background: var(--code-hover-bg, #444);
}

.address-stats, .tx-stats, .block-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: var(--stat-bg, #333);
  border-radius: 4px;
}

.tx-list {
  max-height: 300px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color, #333);
  cursor: pointer;
}

.tx-item:hover {
  background: var(--hover-bg, #2a2a2a);
}

.close-results {
  background: none;
  border: none;
  color: var(--text-color, #fff);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.close-results:hover {
  background: var(--hover-bg, #333);
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = searchStyles;
document.head.appendChild(styleSheet);

// Initialize search when DOM is loaded
let explorerSearch;
document.addEventListener('DOMContentLoaded', () => {
  explorerSearch = new ExplorerSearchUI();
  console.log('✅ Explorer search initialized');
});