# 🔓 UnlockIt - Gamifizierte Team-Rätsel

Eine moderne, gamifizierte WebApp für Team-Events, bei der Gruppen nacheinander knifflige Rätsel lösen und digitale Schlösser knacken müssen.

## ✨ Features

### 🎮 Spielmechanik
- **Sequenzielle Rätsel**: Teams lösen Fragen der Reihe nach
- **3-Versuche-System**: Maximaal 3 Antwortversuche pro Frage
- **Tipps-System**: 3 Tipps pro Frage (Tipp 3 = Lösung, 0 Punkte)
- **Zeitlimits**: Konfigurierbare Zeitbegrenzung pro Frage
- **Punkte-System**: Zeitbasierte Bewertung mit Tipps-Penalties

### 🛠️ Admin-Features
- **Event-Management**: Events erstellen und konfigurieren
- **Fragen-Editor**: Text, Bilder, Schwierigkeitsgrad, Tipps
- **Live-Moderation**: Echtzeit-Übersicht aller Teams
- **Excel-Export**: Detaillierte Spielstände exportieren
- **Zugangskontrolle**: Optional Event-spezifische Zugangscodes

### 🌐 Realtime & UX
- **WebSocket-Integration**: Live-Updates für Scoreboard
- **QR-Code-Generierung**: Einfache Team-Anmeldung
- **Responsives Design**: Optimiert für alle Geräte
- **Schloss-UI**: Thematische, ansprechende Benutzeroberfläche

## 🚀 Tech-Stack

- **Backend**: Node.js + Express.js
- **Datenbank**: MySQL mit Knex.js (Migrations & Query Builder)
- **Frontend**: React.js mit modernem Hooks-Design
- **Realtime**: Socket.io für Live-Updates
- **File-Handling**: Multer für Bild-Uploads
- **Export**: ExcelJS für .xlsx-Datei-Export
- **Styling**: Tailwind CSS mit Custom Animations

## 📦 Installation & Setup

### 1. Repository klonen
```bash
git clone <repository-url>
cd UnlockIt
```

### 2. Dependencies installieren
```bash
# Root dependencies (Backend)
npm install

# Frontend dependencies
cd client
npm install
cd ..
```

### 3. Umgebungsvariablen einrichten
```bash
cp env.example .env
```

Bearbeite die `.env` Datei:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=unlockit

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. MySQL Datenbank einrichten
```bash
# MySQL Datenbank erstellen
mysql -u root -p
CREATE DATABASE unlockit;
exit;

# Migrationen ausführen
npm run migrate
```

### 5. Upload-Ordner erstellen
```bash
mkdir uploads
```

### 6. Anwendung starten
```bash
# Development (Backend + Frontend parallel)
npm run dev

# Oder separat:
npm run server  # Backend (Port 3001)
npm run client  # Frontend (Port 3000)
```

## 🎯 Benutzung

### Admin-Setup
1. Navigiere zu `/admin`
2. Registriere einen Admin-Account
3. Erstelle ein neues Event
4. Füge Fragen hinzu (Text, Bilder, Tipps, Lösungen)
5. Konfiguriere Startzeitpunkt und Einstellungen

### Team-Anmeldung
1. Generiere QR-Code auf der Startseite
2. Teams scannen QR-Code oder nutzen direkten Link
3. Team-Namen eingeben und anmelden
4. Warten auf Event-Start

### Spielablauf
1. Event startet automatisch zur konfigurierten Zeit
2. Teams erhalten erste Frage
3. Tipps verwenden (optional, mit Punkte-Abzug)
4. Antwort eingeben (max. 3 Versuche)
5. Bei korrekter Antwort: Punkte erhalten + nächste Frage
6. Live-Scoreboard verfolgen

## 📊 Datenbank-Schema

### Events
- ID, Name, Startzeit
- Zufällige Reihenfolge (ja/nein)
- Team-Registrierung offen
- Zugangs-Code (optional)

### Teams
- ID, Name, Event-Zuordnung
- Logo-URL (optional)

### Questions
- ID, Event-Zuordnung, Titel, Beschreibung
- Bild-Pfad, Schwierigkeit, Lösung
- 3 Tipps, Zeitlimit, Reihenfolge

### Team Progress
- Team-ID, Frage-ID
- 3 Versuche, verwendete Tipps
- Korrekt-Flag, Zeiten, Punkte

## 🛡️ Sicherheit & Cheat-Schutz

- **Rate Limiting**: IP-basierte Anfrage-Begrenzung
- **Versuchslimit**: Max. 3 Versuche pro Frage
- **Zugangscodes**: Event-spezifische Codes
- **JWT-Authentifizierung**: Sichere Admin-Bereiche
- **Input-Validierung**: Schutz vor Injection-Angriffen

## 🔧 Entwicklung

### Verfügbare Scripts
```bash
npm run dev          # Entwicklung (Backend + Frontend)
npm run server       # Nur Backend
npm run client       # Nur Frontend
npm run build        # Production Build
npm run migrate      # Datenbank-Migrationen
npm run migrate:rollback  # Migration rückgängig
```

### API-Endpunkte
- `POST /api/auth/login` - Admin-Login
- `GET /api/events` - Events auflisten
- `POST /api/teams/register` - Team-Anmeldung
- `GET /api/game/team/:id/current-question` - Aktuelle Frage
- `POST /api/game/question/:id/answer` - Antwort einreichen
- `GET /api/game/event/:id/scoreboard` - Live-Scoreboard
- `GET /api/game/event/:id/export` - Excel-Export

## 🎨 UI/UX Features

- **Gradient-Backgrounds**: Moderne Farbverläufe
- **Lock-Animationen**: Thematische Schloss-Effekte
- **Glass-Morphism**: Moderne transparente Elemente
- **Responsive Design**: Mobile-first Ansatz
- **Dark Theme**: Augenschonende dunkle Oberfläche
- **Toast-Notifications**: Benutzerfreundliche Rückmeldungen

## 📱 Mobile Optimierung

- Touch-optimierte Buttons
- Responsive Layout für alle Bildschirmgrößen
- QR-Code-Scanner-Integration

## 🚀 Production Deployment

### Schnell-Deployment
```bash
# Alle Dependencies installieren
npm run install:all

# Production Build erstellen und starten
npm run start:prod
```

### Manuelles Production Setup
```bash
# 1. Environment auf Production setzen
export NODE_ENV=production

# 2. Dependencies installieren
npm run install:all

# 3. React App bauen
npm run build

# 4. Datenbank migrieren
npm run migrate

# 5. Server starten
npm start
```

### Environment-Variablen für Production
```env
# Wichtig: NODE_ENV auf production setzen
NODE_ENV=production

# Server Configuration
PORT=3001

# Database Configuration (Production DB)
DB_HOST=your-production-db-host
DB_PORT=3306
DB_USER=your-production-db-user
DB_PASSWORD=your-secure-production-password
DB_NAME=unlockit_production

# Security (Starke Secrets verwenden!)
JWT_SECRET=your-super-secure-jwt-secret-for-production
SESSION_SECRET=your-super-secure-session-secret-for-production

# Rate Limiting (Produktionseinstellungen)
RATE_LIMIT_WINDOW_MS=900000  # 15 Minuten
RATE_LIMIT_MAX_REQUESTS=100   # Max 100 Requests pro IP
```

### Production Features
- ✅ **Static File Serving**: React Build wird direkt vom Node.js Server serviert
- ✅ **Rate Limiting**: Automatisch aktiviert in Production
- ✅ **Security Headers**: Helmet.js für zusätzliche Sicherheit  
- ✅ **Error Handling**: Robuste Fehlerbehandlung
- ✅ **Single Port**: Alles läuft auf einem Port (Standard: 3001)

### Verfügbare Scripts
```bash
npm run install:all    # Alle Dependencies installieren
npm run build         # React App bauen
npm start            # Production Server starten
npm run start:prod   # Build + Start in einem Befehl
npm run migrate      # Datenbank migrieren

# PM2 Process Management (empfohlen für Production)
npm run start:pm2    # Mit PM2 starten
npm run stop:pm2     # PM2 Process stoppen
npm run restart:pm2  # PM2 Process neustarten
npm run logs:pm2     # PM2 Logs anzeigen
```

### PM2 Process Management (Empfohlen)
```bash
# PM2 global installieren
npm install -g pm2

# App mit PM2 starten
npm run start:pm2

# Status überprüfen
pm2 status

# Logs verfolgen
npm run logs:pm2

# Bei System-Neustart automatisch starten
pm2 startup
pm2 save
```

### Deployment-Checklist
- [ ] `.env` Datei mit Production-Werten erstellen
- [ ] `NODE_ENV=production` setzen
- [ ] Starke JWT/Session Secrets verwenden
- [ ] Production-Datenbank konfigurieren
- [ ] `npm run install:all` ausführen
- [ ] `npm run migrate` ausführen
- [ ] `npm run start:prod` ausführen
- [ ] Port 3001 freigeben/weiterleiten
- [ ] SSL-Zertifikat konfigurieren (empfohlen)
- Offline-Verhalten bei Verbindungsproblemen

## 🚀 Production Deployment

1. Umgebungsvariablen für Production setzen
2. Frontend build: `npm run build`
3. SSL-Zertifikat einrichten
4. Reverse Proxy (nginx) konfigurieren
5. PM2 oder ähnlichen Process Manager nutzen
6. Regelmäßige Backups einrichten

## 🤝 Contribution

Contributions sind willkommen! Bitte:
1. Fork des Repositories
2. Feature Branch erstellen
3. Tests schreiben/aktualisieren
4. Pull Request erstellen

## 📄 Lizenz

MIT License - Siehe LICENSE Datei für Details.

---

**Entwickelt für unvergessliche Team-Events** 🎉 