/**
 * Install MedFlow Agent as Windows Service
 *
 * Run as Administrator: node install-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'MedFlow Agent',
  description: 'MedFlow medical device file synchronization agent',
  script: path.join(__dirname, 'medflow-agent.js'),
  nodeOptions: [],
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }]
});

svc.on('install', () => {
  console.log('Service installed successfully!');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Service is already installed.');
});

svc.on('start', () => {
  console.log('Service started.');
});

svc.on('error', (err) => {
  console.error('Service error:', err);
});

console.log('Installing MedFlow Agent service...');
svc.install();
