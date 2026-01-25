@echo off
echo Starte Kaspa Stack Installation auf dem Server...
echo.
echo Dieser Prozess dauert ca. 10-15 Minuten
echo Bitte gib dein SSH-Passwort ein wenn gefragt
echo.
pause

ssh -i "C:\Users\TUF-s\.ssh\id_ed25519_new" admxn@192.168.2.148 "cd /opt/klassik && chmod +x scripts/install-production.sh && sudo ./scripts/install-production.sh"

echo.
echo Installation abgeschlossen!
echo.
echo Teste jetzt die Services...
timeout /t 5

ssh -i "C:\Users\TUF-s\.ssh\id_ed25519_new" admxn@192.168.2.148 "cd /opt/klassik && sudo docker-compose ps"

echo.
echo Fertig! Die Services sollten jetzt laufen.
pause
