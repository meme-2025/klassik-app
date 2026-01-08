#!/bin/bash
# PM2 Setup und Neustart-Script für Klassik Backend

set -e

echo "🚀 Klassik PM2 Setup und Restart"
echo "================================"

# 1. Erstelle notwendige Verzeichnisse
echo "📁 Erstelle Log-Verzeichnisse..."
sudo mkdir -p /var/log/klassik
sudo chown -R $USER:$USER /var/log/klassik
sudo chmod 755 /var/log/klassik

# 2. Erstelle Config-Verzeichnis falls nicht vorhanden
echo "📁 Prüfe Config-Verzeichnis..."
sudo mkdir -p /etc/klassik
sudo chmod 755 /etc/klassik

# 3. Prüfe ob .env existiert
if [ ! -f "/etc/klassik/klassik1.env" ]; then
    echo "❌ FEHLER: /etc/klassik/klassik1.env nicht gefunden!"
    echo "Bitte erstelle die Datei mit:"
    echo "sudo nano /etc/klassik/klassik1.env"
    exit 1
fi

# 4. Prüfe .env Berechtigungen
echo "🔐 Prüfe .env Berechtigungen..."
sudo chmod 600 /etc/klassik/klassik1.env
sudo chown $USER:$USER /etc/klassik/klassik1.env

# 5. Prüfe ob Backend-Verzeichnis existiert
if [ ! -d "/opt/klassik/backend" ]; then
    echo "❌ FEHLER: /opt/klassik/backend nicht gefunden!"
    echo "Bitte passe den Pfad in ecosystem.config.json an."
    exit 1
fi

# 6. Gehe ins Backend-Verzeichnis
cd /opt/klassik/backend

# 7. Prüfe ob node_modules existiert
if [ ! -d "node_modules" ]; then
    echo "📦 Installiere Dependencies..."
    npm install --production
fi

# 8. Stoppe alte PM2 Prozesse
echo "🛑 Stoppe alte PM2 Prozesse..."
pm2 stop klassik-production 2>/dev/null || true
pm2 delete klassik-production 2>/dev/null || true

# 9. Lösche alte Logs
echo "🗑️ Lösche alte Logs..."
pm2 flush

# 10. Starte mit PM2
echo "▶️ Starte Backend mit PM2..."
pm2 start ecosystem.config.json

# 11. Speichere PM2 Konfiguration
echo "💾 Speichere PM2 Konfiguration..."
pm2 save

# 12. Setup PM2 Startup (falls noch nicht vorhanden)
echo "🔧 Setup PM2 Autostart..."
pm2 startup systemd -u $USER --hp $HOME || true

# 13. Zeige Status
echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Logs anzeigen mit:"
echo "   pm2 logs klassik-production"
echo ""
echo "🔄 Neustart mit:"
echo "   pm2 restart klassik-production"
echo ""
echo "🛑 Stoppen mit:"
echo "   pm2 stop klassik-production"
