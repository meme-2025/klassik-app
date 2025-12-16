# 🚀 KASPAHUB SACRIFICE - QUICK START GUIDE

## 🎯 What You Need To Do Before Going Live

### 1️⃣ **CRITICAL: Update the Sacrifice Address**

Open [sacrifice.html](frontend/sacrifice.html) and find line with `SACRIFICE_ADDRESS`:

```javascript
// CURRENT (TEST ADDRESS - BURN ADDRESS):
SACRIFICE_ADDRESS: 'kaspa:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdmwjs8c',

// REPLACE WITH YOUR ACTUAL SACRIFICE ADDRESS:
SACRIFICE_ADDRESS: 'kaspa:YOUR_ACTUAL_SACRIFICE_ADDRESS_HERE',
```

⚠️ **This is the most important step!** This address will receive all sacrificed KAS.

---

### 2️⃣ **Set Your Event End Date**

Update the countdown timer:

```javascript
// CURRENT:
EVENT_END_DATE: new Date('2025-12-31T23:59:59').getTime(),

// CHANGE TO YOUR DATE:
EVENT_END_DATE: new Date('2026-01-31T23:59:59').getTime(),
```

---

### 3️⃣ **Test With Small Amount First**

1. Open `sacrifice.html` in your browser
2. Connect your wallet (KasWare, Kaspium, or Kaspa Desktop)
3. Send a small test amount (1,000 KAS minimum)
4. Verify transaction appears on Kaspa Explorer
5. Check that your address shows in stats

**Test Transaction URL:**
```
https://explorer.kaspa.org/txs/YOUR_TX_ID
```

---

### 4️⃣ **Deploy to Your Website**

#### Option A: Simple Upload
1. Upload `sacrifice.html` to your web server
2. Access via: `https://yourwebsite.com/sacrifice.html`

#### Option B: Rename as Main Page
```bash
mv sacrifice.html index.html
```

#### Option C: GitHub Pages (Free Hosting)
1. Create new repo on GitHub
2. Upload `sacrifice.html`
3. Enable GitHub Pages in repo settings
4. Access via: `https://yourusername.github.io/repo-name/sacrifice.html`

---

## ✅ Pre-Launch Checklist

Before announcing to your community:

- [ ] ✅ Sacrifice address updated to YOUR address
- [ ] ✅ Event end date set correctly
- [ ] ✅ Tested wallet connection (KasWare/Kaspium)
- [ ] ✅ Sent test transaction successfully
- [ ] ✅ Verified TX on Kaspa Explorer
- [ ] ✅ Checked stats update correctly
- [ ] ✅ Tested on mobile device
- [ ] ✅ Read through [SACRIFICE_AUDIT_REPORT.md](SACRIFICE_AUDIT_REPORT.md)

---

## 🔥 How It Works

### For Users:
1. **Connect Wallet** → Click "Connect Wallet" button
2. **Enter Amount** → Type amount or use quick buttons (1K, 5K, 10K, etc.)
3. **Sacrifice** → Click "SACRIFICE NOW" and confirm in wallet
4. **Earn Points** → Points calculated based on tier:
   - Bronze (1K-9.9K): 2,500 pts per 1K KAS + 25% bonus
   - Silver (10K-49.9K): 3,750 pts per 1K KAS + 50% bonus
   - Gold (50K-99.9K): 4,375 pts per 1K KAS + 75% bonus
   - Diamond (100K+): 5,000 pts per 1K KAS + 100% bonus

### Behind the Scenes:
1. KAS is sent to your sacrifice address (permanent burn or your wallet)
2. Transaction recorded on Kaspa blockchain
3. Dashboard scans blockchain every 30 seconds
4. Leaderboard updates automatically
5. Points calculated and displayed
6. User's rank shown in real-time

---

## 🛠️ Technical Features

### ✅ Multi-Wallet Support
- **KasWare** (Browser Extension)
- **Kaspium** (Mobile & Desktop)
- **Kaspa Desktop Wallet**

### ✅ Blockchain Integration
- Live transaction scanning via Kaspa API
- Real-time leaderboard updates
- Automatic stats calculation
- Transaction verification

### ✅ Security
- XSS protection
- Input validation
- No private keys stored
- Double confirmation before sending
- LocalStorage for non-sensitive data only

### ✅ UX Features
- Particle.js animated background
- Rainbow gradient title
- Countdown timer
- Confetti animation on success
- Mobile responsive design
- Toast notifications
- Auto wallet reconnect

---

## 📊 Monitoring Your Sacrifice Event

### Check Real-Time Stats:
- **Total Sacrificed:** Shows on dashboard
- **Participants:** Live count
- **Your Points:** Calculated automatically

### Verify Transactions:
1. Open Kaspa Explorer: https://explorer.kaspa.org
2. Search for your sacrifice address
3. View all incoming transactions
4. Verify amounts match dashboard

### Debug Console:
Press `F12` in browser and check Console tab for:
- Connection logs
- Transaction details
- API responses
- Error messages

---

## 🚨 Troubleshooting

### "No Wallet Detected"
**Solution:** Install KasWare, Kaspium, or Kaspa Desktop wallet extension

### "Insufficient Balance"
**Solution:** Ensure user has enough KAS in wallet (minimum 1,000 KAS + transaction fee)

### "Transaction Failed"
**Possible Causes:**
- User rejected transaction in wallet
- Insufficient balance for TX fee
- Network congestion
- Wallet not connected

### Stats Not Updating
**Solution:** 
- Wait 30-60 seconds (auto-refresh interval)
- Check if Kaspa API is online
- Verify sacrifice address is correct
- Check browser console for errors

### Blockchain Scan Not Working
**Fallback:** System uses cached data automatically if API fails

---

## 🎨 Customization Options

### Change Colors:
Edit CSS variables in `<style>` section:
```css
:root {
    --neon-blue: #00f3ff;      /* Primary color */
    --neon-pink: #ff00ff;      /* Secondary color */
    --neon-green: #00ff88;     /* Success color */
    --neon-yellow: #ffff00;    /* Warning color */
}
```

### Change Tier Names:
Edit `CONFIG.TIERS` in JavaScript:
```javascript
TIERS: {
    BRONZE: { name: 'Your Custom Name' },
    // ...
}
```

### Change Minimum Sacrifice:
```javascript
BRONZE: { min: 5000, ... }  // Change from 1000 to 5000
```

---

## 📈 Marketing Tips

### Announcement Template:
```
🔥 SACRIFICE EVENT NOW LIVE! 🔥

Join the KaspaHub revolution and earn exclusive early adopter rewards!

💎 4 TIERS with bonus multipliers
🚀 Higher sacrifice = Higher tier = MORE rewards
⏰ Limited time event ends: [YOUR DATE]

Sacrifice now: [YOUR WEBSITE URL]

Early sacrificers get maximum points for token allocation at TGE!

#Kaspa #KaspaHub #Sacrifice #Crypto
```

### Social Media Posts:
- Share leaderboard top 10
- Highlight big sacrifices
- Show total sacrificed milestone updates
- Create countdown posts
- Share success stories

---

## 🔐 Security Best Practices

### For You:
- ✅ Keep sacrifice address private until launch
- ✅ Use a dedicated wallet for sacrifice collection
- ✅ Backup private keys securely
- ✅ Monitor transactions regularly
- ✅ Have support ready for user questions

### For Users:
- ✅ Only official website link
- ✅ Verify sacrifice address before sending
- ✅ Start with small test amount
- ✅ Never share private keys
- ✅ Double-check transaction details

---

## 📞 Support Resources

### Documentation:
- [SACRIFICE_AUDIT_REPORT.md](SACRIFICE_AUDIT_REPORT.md) - Full audit & test results
- Inline code comments - Technical details
- Console logs - Real-time debugging

### Community Support:
- Create Telegram/Discord support channel
- Prepare FAQ document
- Have wallet connection guide ready
- Create video tutorial (optional)

---

## 🎯 Success Metrics

Track these KPIs:
- Total KAS sacrificed
- Number of unique participants
- Average sacrifice amount
- Tier distribution (Bronze/Silver/Gold/Diamond)
- Transaction success rate
- Website traffic
- Social media engagement

---

## ⚡ Quick Commands

### Test Locally:
```bash
# Open directly in browser:
firefox sacrifice.html
# or
chrome sacrifice.html
```

### Simple HTTP Server:
```bash
# Python 3:
python -m http.server 8000

# Then open: http://localhost:8000/sacrifice.html
```

### Check File:
```bash
# Verify sacrifice address is set:
grep "SACRIFICE_ADDRESS" sacrifice.html
```

---

## 🚀 You're Ready!

1. ✅ Update sacrifice address
2. ✅ Set event date  
3. ✅ Test with small amount
4. ✅ Deploy to website
5. ✅ Announce to community
6. 🔥 **GO LIVE!**

---

**Need Help?** Check the browser console (F12) for detailed logs and error messages.

**Good Luck! 🚀🔥**
