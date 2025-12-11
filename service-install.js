const Service = require('node-windows').Service;
const path = require('path');

// Service erstellen
const svc = new Service({
  name: 'TOA Proxy',
  description: 'Proxy Service für TOA IP-Lautsprecher mit Digest Authentication',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname
});

// Event Listeners
svc.on('install', () => {
  console.log('Service installiert!');
  svc.start();
});

svc.on('start', () => {
  console.log('Service gestartet!');
  console.log('Web-UI verfügbar unter: http://localhost:9988');
});

svc.on('alreadyinstalled', () => {
  console.log('Service ist bereits installiert.');
});

svc.on('error', (err) => {
  console.error('Fehler:', err);
});

// Service installieren
console.log('Installiere TOA Proxy als Windows-Dienst...');
svc.install();
