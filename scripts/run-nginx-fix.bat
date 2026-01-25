@echo off
echo ====================================================================
echo  Klassik Nginx Fix - Ausfuehrung auf Server
echo ====================================================================
echo.

set SSH_KEY=C:\Users\TUF-s\.ssh\id_ed25519_new
set SERVER=admxn@192.168.2.148

echo [1/2] Skript ausfuehrbar machen...
ssh -i "%SSH_KEY%" %SERVER% "chmod +x /tmp/fix-nginx.sh"

echo.
echo [2/2] Nginx-Konfiguration reparieren...
echo HINWEIS: Du wirst nach dem sudo-Passwort gefragt!
echo.

ssh -i "%SSH_KEY%" %SERVER% "bash /tmp/fix-nginx.sh"

echo.
echo ====================================================================
echo  Teste jetzt: https://klassik.99pace.space
echo ====================================================================
pause
