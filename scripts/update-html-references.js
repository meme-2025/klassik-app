#!/usr/bin/env node

/**
 * Update HTML References to Minified Assets
 * Automatically updates all HTML files to reference .min.css and .min.js files
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const HTML_FILES = [
    'kaspa-explorerv5.21.html',
    'kaspa-explorerv5.html',
    'index.html',
    'api-compact-v2.html'
];

// Asset replacements for production
const REPLACEMENTS = [
    // CSS Files
    { from: 'kaspa-explorer-v4.css', to: 'kaspa-explorer-v4.min.css' },
    { from: 'explorer-compact-v3.css', to: 'explorer-compact-v3.min.css' },
    { from: 'animations.css', to: 'animations.min.css' },
    
    // JS Files
    { from: 'kaspa-explorer.js', to: 'kaspa-explorer.min.js' },
    { from: 'realtime-updates.js', to: 'realtime-updates.min.js' },
    { from: 'bandwidth-monitor.js', to: 'bandwidth-monitor.min.js' },
];

console.log('🔧 Updating HTML files to use minified assets...\n');

let totalUpdates = 0;

HTML_FILES.forEach(fileName => {
    const filePath = path.join(FRONTEND_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${fileName} (not found)`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let updates = 0;
    
    REPLACEMENTS.forEach(({ from, to }) => {
        const regex = new RegExp(from.replace('.', '\\.'), 'g');
        const matches = content.match(regex);
        
        if (matches) {
            content = content.replace(regex, to);
            updates += matches.length;
            console.log(`  ✅ ${fileName}: ${from} → ${to} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
        }
    });
    
    if (updates > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalUpdates += updates;
        console.log(`  📝 Updated ${fileName} (${updates} change${updates > 1 ? 's' : ''})\n`);
    } else {
        console.log(`  ⏭️  ${fileName} - No changes needed\n`);
    }
});

console.log(`\n✅ Complete! ${totalUpdates} total update${totalUpdates !== 1 ? 's' : ''} across ${HTML_FILES.length} file${HTML_FILES.length !== 1 ? 's' : ''}.`);
console.log('\n📦 Production-ready HTML files updated successfully!\n');
