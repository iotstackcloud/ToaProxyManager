const Service = require('node-windows').Service;
const path = require('path');

// Service erstellen
const svc = new Service({
  name: 'TOA Proxy',
  script: path.join(__dirname, 'server.js')
});

// Event Listeners
svc.on('uninstall', () => {
  console.log('Service wurde deinstalliert.');
});

svc.on('error', (err) => {
  console.error('Fehler:', err);
});

// Service deinstallieren
console.log('Deinstalliere TOA Proxy Windows-Dienst...');
svc.uninstall();
