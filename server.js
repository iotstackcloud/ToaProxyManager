const express = require('express');
const DigestFetch = require('digest-fetch').default || require('digest-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const oldSend = res.send;
  res.send = function(data) {
    console.log(`[${req.method}] ${req.url} -> ${res.statusCode}`);
    return oldSend.apply(res, arguments);
  };
  next();
});

const publicPath = path.join(__dirname, 'public');
const indexPath = path.join(publicPath, 'index.html');
console.log('Static files path:', publicPath);
console.log('Index file exists:', fs.existsSync(indexPath));

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Standard-Konfiguration
let config = {
  port: 9988,
  speakers: [],
  groups: []
};

// SSE Clients fuer Live-Logging
let sseClients = [];

// Logging-Funktion mit SSE-Broadcast
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const timeOnly = new Date().toLocaleTimeString('de-DE');
  const logEntry = `[${timestamp}] [${level}] ${message}`;

  if (data) {
    console.log(logEntry, JSON.stringify(data, null, 2));
  } else {
    console.log(logEntry);
  }

  const sseData = JSON.stringify({
    timestamp: timeOnly,
    level: level,
    message: message,
    data: data
  });

  sseClients.forEach(client => {
    client.write(`data: ${sseData}\n\n`);
  });
}

// Konfiguration laden
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = { ...config, ...JSON.parse(data) };
      if (!config.groups) config.groups = [];
      log('INFO', 'Konfiguration geladen');
    } else {
      saveConfig();
      log('INFO', 'Neue Konfiguration erstellt');
    }
  } catch (err) {
    log('ERROR', 'Fehler beim Laden der Konfiguration', { error: err.message });
  }
}

// Konfiguration speichern
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    log('ERROR', 'Fehler beim Speichern der Konfiguration', { error: err.message });
  }
}

// Lautsprecher nach ID finden
function findSpeaker(id) {
  return config.speakers.find(s => s.id === id);
}

// Gruppe nach ID finden
function findGroup(id) {
  return config.groups.find(g => g.id === id);
}

// Digest Auth Request Funktion
async function makeDigestRequest(speaker, urlPath) {
  const url = `http://${speaker.ip}${urlPath}`;

  log('REQUEST', `Sende Anfrage an ${speaker.name}`, {
    url: url,
    username: speaker.username
  });

  try {
    const client = new DigestFetch(speaker.username, speaker.password);
    const response = await client.fetch(url);
    const responseText = await response.text();

    log('RESPONSE', `Antwort von ${speaker.name}`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: responseText
    };
  } catch (err) {
    log('ERROR', `Fehler bei Anfrage an ${speaker.name}`, {
      url: url,
      error: err.message
    });
    throw err;
  }
}

// ==================== SSE LOG STREAM ====================

app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const welcomeMsg = JSON.stringify({
    timestamp: new Date().toLocaleTimeString('de-DE'),
    level: 'INFO',
    message: 'Log-Stream verbunden',
    data: null
  });
  res.write(`data: ${welcomeMsg}\n\n`);

  sseClients.push(res);
  log('INFO', `Log-Client verbunden (${sseClients.length} aktiv)`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log(`[SSE] Client getrennt (${sseClients.length} aktiv)`);
  });
});

// ==================== SPEAKER API ====================

app.get('/api/speakers', (req, res) => {
  const safeSpeakers = config.speakers.map(s => ({
    id: s.id,
    name: s.name,
    ip: s.ip,
    username: s.username
  }));
  res.json(safeSpeakers);
});

app.post('/api/speakers', (req, res) => {
  const { name, ip, username, password } = req.body;

  if (!name || !ip || !username || !password) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const speaker = { id, name, ip, username, password };

  config.speakers.push(speaker);
  saveConfig();

  log('INFO', 'Neuer Lautsprecher hinzugefuegt', { id, name, ip });
  res.json({ id, name, ip, username });
});

app.put('/api/speakers/:id', (req, res) => {
  const speaker = findSpeaker(req.params.id);
  if (!speaker) {
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  const { name, ip, username, password } = req.body;
  if (name) speaker.name = name;
  if (ip) speaker.ip = ip;
  if (username) speaker.username = username;
  if (password) speaker.password = password;

  saveConfig();
  log('INFO', 'Lautsprecher aktualisiert', { id: speaker.id, name: speaker.name });
  res.json({ id: speaker.id, name: speaker.name, ip: speaker.ip, username: speaker.username });
});

app.delete('/api/speakers/:id', (req, res) => {
  const index = config.speakers.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  const deleted = config.speakers.splice(index, 1)[0];

  // Auch aus allen Gruppen entfernen
  config.groups.forEach(group => {
    group.speakerIds = group.speakerIds.filter(id => id !== deleted.id);
  });

  saveConfig();
  log('INFO', 'Lautsprecher geloescht', { id: deleted.id, name: deleted.name });
  res.json({ success: true });
});

// ==================== GROUP API ====================

app.get('/api/groups', (req, res) => {
  const groups = config.groups.map(g => ({
    id: g.id,
    name: g.name,
    speakerIds: g.speakerIds,
    speakers: g.speakerIds.map(id => {
      const s = findSpeaker(id);
      return s ? { id: s.id, name: s.name, ip: s.ip } : null;
    }).filter(Boolean)
  }));
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  const { name, speakerIds } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const group = { id, name, speakerIds: speakerIds || [] };

  config.groups.push(group);
  saveConfig();

  log('INFO', 'Neue Gruppe erstellt', { id, name, speakerCount: group.speakerIds.length });
  res.json(group);
});

app.put('/api/groups/:id', (req, res) => {
  const group = findGroup(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Gruppe nicht gefunden' });
  }

  const { name, speakerIds } = req.body;
  if (name) group.name = name;
  if (speakerIds) group.speakerIds = speakerIds;

  saveConfig();
  log('INFO', 'Gruppe aktualisiert', { id: group.id, name: group.name });
  res.json(group);
});

app.delete('/api/groups/:id', (req, res) => {
  const index = config.groups.findIndex(g => g.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Gruppe nicht gefunden' });
  }

  const deleted = config.groups.splice(index, 1)[0];
  saveConfig();
  log('INFO', 'Gruppe geloescht', { id: deleted.id, name: deleted.name });
  res.json({ success: true });
});

// ==================== PROXY ROUTES (SINGLE SPEAKER) ====================

// Pattern abspielen (fuer Avigilon Unity)
app.get('/play/:speakerId', async (req, res) => {
  const speaker = findSpeaker(req.params.speakerId);
  if (!speaker) {
    log('WARN', 'Lautsprecher nicht gefunden', { id: req.params.speakerId });
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  const pattern = req.query.pattern || req.query.pattern_number || 1;
  const playcount = req.query.playcount || 1;
  const interval = req.query.interval || 0;
  const duration = req.query.duration;

  let urlPath = `/api/v2/pattern/play?pattern_number=${pattern}`;
  if (playcount > 1) urlPath += `&playcount=${playcount}`;
  if (interval > 0) urlPath += `&interval=${interval}`;
  if (duration) urlPath += `&duration=${duration}`;

  log('INFO', `Play-Anfrage fuer ${speaker.name}`, { pattern, playcount, interval, duration });

  try {
    const result = await makeDigestRequest(speaker, urlPath);

    if (result.ok) {
      res.json({ success: true, speaker: speaker.name, pattern, response: result.data });
    } else {
      res.status(result.status).json({
        error: 'TOA Fehler',
        status: result.status,
        statusText: result.statusText,
        response: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pattern stoppen
app.get('/stop/:speakerId', async (req, res) => {
  const speaker = findSpeaker(req.params.speakerId);
  if (!speaker) {
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  log('INFO', `Stop-Anfrage fuer ${speaker.name}`);

  try {
    const result = await makeDigestRequest(speaker, '/api/v2/pattern/stop');

    if (result.ok) {
      res.json({ success: true, speaker: speaker.name, response: result.data });
    } else {
      res.status(result.status).json({
        error: 'TOA Fehler',
        status: result.status,
        response: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status abrufen
app.get('/status/:speakerId', async (req, res) => {
  const speaker = findSpeaker(req.params.speakerId);
  if (!speaker) {
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  log('INFO', `Status-Anfrage fuer ${speaker.name}`);

  try {
    const result = await makeDigestRequest(speaker, '/api/v2/info/status');

    if (result.ok) {
      let statusData;
      try {
        const parsed = JSON.parse(result.data);
        // Die API gibt { response: {...}, result: true } zurueck
        statusData = parsed.response || parsed;
      } catch {
        statusData = result.data;
      }
      res.json({ success: true, speaker: speaker.name, status: statusData });
    } else {
      res.status(result.status).json({
        error: 'TOA Fehler',
        status: result.status,
        response: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verbindung testen
app.get('/api/test/:speakerId', async (req, res) => {
  const speaker = findSpeaker(req.params.speakerId);
  if (!speaker) {
    return res.status(404).json({ error: 'Lautsprecher nicht gefunden' });
  }

  log('INFO', `Test-Anfrage fuer ${speaker.name}`);

  try {
    const result = await makeDigestRequest(speaker, '/api/v2/info/status');

    if (result.ok) {
      res.json({ success: true, message: 'Verbindung erfolgreich', response: result.data });
    } else {
      res.status(result.status).json({
        success: false,
        message: `HTTP ${result.status} ${result.statusText}`,
        response: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PROXY ROUTES (GROUP) ====================

// Gruppe abspielen - alle Lautsprecher gleichzeitig
app.get('/group/play/:groupId', async (req, res) => {
  const group = findGroup(req.params.groupId);
  if (!group) {
    log('WARN', 'Gruppe nicht gefunden', { id: req.params.groupId });
    return res.status(404).json({ error: 'Gruppe nicht gefunden' });
  }

  const pattern = req.query.pattern || req.query.pattern_number || 1;
  const playcount = req.query.playcount || 1;
  const interval = req.query.interval || 0;
  const duration = req.query.duration;

  let urlPath = `/api/v2/pattern/play?pattern_number=${pattern}`;
  if (playcount > 1) urlPath += `&playcount=${playcount}`;
  if (interval > 0) urlPath += `&interval=${interval}`;
  if (duration) urlPath += `&duration=${duration}`;

  log('INFO', `Gruppen-Play fuer ${group.name}`, {
    pattern,
    speakerCount: group.speakerIds.length
  });

  const results = await Promise.allSettled(
    group.speakerIds.map(async (speakerId) => {
      const speaker = findSpeaker(speakerId);
      if (!speaker) return { speakerId, error: 'Nicht gefunden' };

      try {
        const result = await makeDigestRequest(speaker, urlPath);
        return {
          speakerId,
          speakerName: speaker.name,
          success: result.ok,
          status: result.status
        };
      } catch (err) {
        return { speakerId, speakerName: speaker.name, error: err.message };
      }
    })
  );

  const summary = {
    group: group.name,
    pattern,
    total: group.speakerIds.length,
    success: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
    failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
    details: results.map(r => r.value || r.reason)
  };

  log('INFO', `Gruppen-Play abgeschlossen`, summary);
  res.json(summary);
});

// Gruppe stoppen
app.get('/group/stop/:groupId', async (req, res) => {
  const group = findGroup(req.params.groupId);
  if (!group) {
    return res.status(404).json({ error: 'Gruppe nicht gefunden' });
  }

  log('INFO', `Gruppen-Stop fuer ${group.name}`);

  const results = await Promise.allSettled(
    group.speakerIds.map(async (speakerId) => {
      const speaker = findSpeaker(speakerId);
      if (!speaker) return { speakerId, error: 'Nicht gefunden' };

      try {
        const result = await makeDigestRequest(speaker, '/api/v2/pattern/stop');
        return {
          speakerId,
          speakerName: speaker.name,
          success: result.ok
        };
      } catch (err) {
        return { speakerId, speakerName: speaker.name, error: err.message };
      }
    })
  );

  const summary = {
    group: group.name,
    total: group.speakerIds.length,
    success: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
    failed: results.filter(r => r.status === 'rejected' || !r.value.success).length
  };

  res.json(summary);
});

// ==================== STATIC FILES (after API routes) ====================

// Serve static files
app.use(express.static(publicPath));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(indexPath);
});

// ==================== SERVER START ====================

loadConfig();

const PORT = config.port || 9988;
app.listen(PORT, () => {
  log('INFO', '========================================');
  log('INFO', `TOA Proxy Server gestartet auf Port ${PORT}`);
  log('INFO', `Web-UI: http://localhost:${PORT}`);
  log('INFO', `Lautsprecher: ${config.speakers.length}`);
  log('INFO', `Gruppen: ${config.groups.length}`);
  log('INFO', '========================================');
});
