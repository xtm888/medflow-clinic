/**
 * Uninstall MedFlow Agent Windows Service
 *
 * Run as Administrator: node uninstall-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'MedFlow Agent',
  script: path.join(__dirname, 'medflow-agent.js')
});

svc.on('uninstall', () => {
  console.log('Service uninstalled successfully!');
});

svc.on('alreadyuninstalled', () => {
  console.log('Service is already uninstalled.');
});

console.log('Uninstalling MedFlow Agent service...');
svc.uninstall();
