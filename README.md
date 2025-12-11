# TOA Proxy Manager - Anleitung

## Übersicht

Der TOA Proxy Manager ist ein Dienst, der als Vermittler zwischen Avigilon Unity und TOA IP-Lautsprechern fungiert. Er löst das Problem, dass Avigilon Unity keine Digest-Authentifizierung unterstützt.

```
Avigilon Unity  ──(HTTP ohne Auth)──>  TOA Proxy  ──(HTTP + Digest Auth)──>  TOA Lautsprecher
```

---

## Voraussetzungen

- Node.js (Version 14 oder höher) - Download: https://nodejs.org
- Netzwerkzugriff auf die TOA Lautsprecher

---

## Installation

### 1. Node.js installieren (falls nicht vorhanden)

Laden Sie Node.js von https://nodejs.org herunter und installieren Sie es.

### 2. Abhängigkeiten installieren

Öffnen Sie eine Eingabeaufforderung (cmd) und führen Sie aus:

```cmd
cd "C:\Users\xxx\Toa\toa-proxy"
npm install
```

### 3. Server starten (manuell)

```cmd
npm start
```

Der Server läuft dann unter: **http://localhost:8080**

---

## Web-Oberfläche

Öffnen Sie im Browser: **http://localhost:8080**

### Lautsprecher hinzufügen

1. Klicken Sie auf **"+ Lautsprecher hinzufügen"**
2. Füllen Sie die Felder aus:
   - **Name**: Beliebiger Name (z.B. "Eingang Hauptgebäude")
   - **IP-Adresse**: IP des TOA Lautsprechers (z.B. 192.168.1.100)
   - **Benutzername**: Benutzername des Lautsprechers (z.B. admin)
   - **Passwort**: Passwort des Lautsprechers
3. Klicken Sie auf **"Speichern"**

### Funktionen testen

- **Test**: Prüft die Verbindung zum Lautsprecher
- **Play**: Spielt das ausgewählte Pattern ab
- **Stop**: Stoppt die aktuelle Wiedergabe

### Avigilon Unity URL

Nach dem Hinzufügen eines Lautsprechers wird die URL angezeigt, die Sie in Avigilon Unity verwenden können:

```
http://localhost:8080/play/[SPEAKER-ID]?pattern=1
```

---

## Integration in Avigilon Unity

### Schritt 1: Proxy-URL kopieren

1. Öffnen Sie die Web-Oberfläche (http://localhost:8080)
2. Kopieren Sie die angezeigte **"Avigilon Unity URL"** für den gewünschten Lautsprecher

### Schritt 2: In Avigilon Unity einrichten

1. Öffnen Sie Avigilon Unity
2. Gehen Sie zu den **Regeleinstellungen** oder **Aktionen**
3. Erstellen Sie eine neue **HTTP-Aktion**
4. Fügen Sie die kopierte URL ein:
   ```
   http://localhost:8080/play/abc123xyz?pattern=1
   ```
5. Für verschiedene Patterns ändern Sie die Nummer: `pattern=1`, `pattern=2`, etc.

### URL-Parameter

| Parameter | Beschreibung | Werte |
|-----------|--------------|-------|
| `pattern` | Pattern-Nummer | 1-20 |
| `volume` | Lautstärke-Anpassung | -20 bis +20 (Standard: 0) |
| `playcount` | Anzahl Wiederholungen | 1-10 |
| `interval` | Pause zwischen Wiederholungen (Sek.) | 0-99 |
| `duration` | Maximale Dauer (Sek.) | 5-36000 |

**Beispiele:**

```
# Pattern 3 abspielen
http://localhost:8080/play/abc123?pattern=3

# Pattern 1 mit erhöhter Lautstärke
http://localhost:8080/play/abc123?pattern=1&volume=10

# Pattern 2, 3x wiederholen mit 5 Sekunden Pause
http://localhost:8080/play/abc123?pattern=2&playcount=3&interval=5

# Wiedergabe stoppen
http://localhost:8080/stop/abc123
```

---

## Als Windows-Dienst installieren

Damit der Proxy automatisch mit Windows startet:

### Installation (als Administrator)

```cmd
cd "C:\Users\xxx\Toa\toa-proxy"
npm run install-service
```

### Deinstallation

```cmd
npm run uninstall-service
```

### Dienst verwalten

Nach der Installation können Sie den Dienst über die Windows-Dienstverwaltung steuern:

1. Drücken Sie `Win + R`
2. Geben Sie `services.msc` ein
3. Suchen Sie nach **"TOA Proxy"**
4. Hier können Sie den Dienst starten, stoppen oder den Starttyp ändern

---

## Konfiguration

Die Konfiguration wird in `config.json` gespeichert:

```json
{
  "port": 8080,
  "speakers": [
    {
      "id": "abc123xyz",
      "name": "Eingang Hauptgebäude",
      "ip": "192.168.1.100",
      "username": "admin",
      "password": "geheim"
    }
  ]
}
```

### Port ändern

1. Öffnen Sie `config.json`
2. Ändern Sie den Wert bei `"port"`
3. Starten Sie den Server neu

---

## API-Referenz

### Lautsprecher verwalten

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/api/speakers` | Alle Lautsprecher abrufen |
| POST | `/api/speakers` | Neuen Lautsprecher hinzufügen |
| PUT | `/api/speakers/:id` | Lautsprecher bearbeiten |
| DELETE | `/api/speakers/:id` | Lautsprecher löschen |

### Steuerung (für Avigilon Unity)

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/play/:id?pattern=1` | Pattern abspielen |
| GET | `/stop/:id` | Wiedergabe stoppen |
| GET | `/status/:id` | Status abrufen |
| GET | `/api/test/:id` | Verbindung testen |

---

## Fehlerbehebung

### "Verbindungsfehler" beim Testen

- Prüfen Sie, ob die IP-Adresse korrekt ist
- Prüfen Sie, ob der Lautsprecher im Netzwerk erreichbar ist (ping)
- Prüfen Sie Benutzername und Passwort

### Server startet nicht

- Prüfen Sie, ob Port 8080 bereits belegt ist
- Ändern Sie ggf. den Port in `config.json`

### Avigilon Unity ruft URL nicht auf

- Stellen Sie sicher, dass der Server läuft
- Prüfen Sie, ob der Avigilon-Server den Proxy-Server erreichen kann
- Verwenden Sie ggf. die IP-Adresse statt `localhost`:
  ```
  http://192.168.1.50:8080/play/abc123?pattern=1
  ```

---

## Unterstützte TOA Modelle

- IP-A1SC15
- IP-A1PC238
- IP-A1PC580R/S
- IP-A1AF
- IP-A1PA12
- IP-A1PG
- IP-A1RM

---

## Sicherheitshinweise

- Der Proxy-Service erfordert **keine Authentifizierung** für eingehende Anfragen
- Stellen Sie sicher, dass der Proxy nur aus dem internen Netzwerk erreichbar ist
- Die Passwörter werden unverschlüsselt in `config.json` gespeichert
- Beschränken Sie den Zugriff auf den Server entsprechend Ihrer Sicherheitsrichtlinien
