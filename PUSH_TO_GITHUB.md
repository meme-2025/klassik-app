# GitHub Push Anleitung

## EINMALIG (erster Push - jetzt ausführen):

```powershell
cd "C:\Users\TUF-s\Desktop\git\Klassik"

# Remote URL setzen (falls noch nicht korrekt)
git remote set-url origin https://github.com/meme-2025/klassik-app.git

# Alle Änderungen committen
git add .
git commit -m "Initial commit - Klassik backend and frontend"

# Auf GitHub pushen
git push -u origin main
```

Beim ersten Push wirst du nach **Username** und **Password** gefragt:
- **Username**: `meme-2025`
- **Password**: Dein GitHub Personal Access Token (den du gerade erstellt hast)

---

## ZUKÜNFTIG (nach jeder Änderung):

Führe diese 3 Befehle aus:

```powershell
cd "C:\Users\TUF-s\Desktop\git\Klassik"
git add .
git commit -m "Beschreibung deiner Änderungen"
git push
```

**Beispiele für Commit-Messages:**
- `git commit -m "Fix: Auth Bug behoben"`
- `git commit -m "Feature: User Profile hinzugefügt"`
- `git commit -m "Update: Frontend Design verbessert"`

**Tipp**: Wenn du Credentials nicht jedes Mal eingeben willst, speichere sie:

```powershell
git config --global credential.helper wincred
```

Dann werden Username und Token beim ersten Mal gespeichert und du musst sie nicht mehr eingeben.

---

## Schnell-Befehl (alles in einer Zeile):

```powershell
cd "C:\Users\TUF-s\Desktop\git\Klassik"; git add .; git commit -m "Update"; git push
```

---

## Status prüfen (optional):

Zeigt was geändert wurde:
```powershell
git status
```

Zeigt Commit-Historie:
```powershell
git log --oneline -10
```
