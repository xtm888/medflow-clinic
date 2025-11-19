const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const EquipmentCatalog = require('../../models/EquipmentCatalog');
const DeviceMeasurement = require('../../models/DeviceMeasurement');
const DeviceImage = require('../../models/DeviceImage');

class DeviceIntegrationService {
  constructor() {
    this.watchers = new Map();
    this.adapters = new Map();
  }

  async initialize() {
    // Load all active equipment configurations
    const equipment = await EquipmentCatalog.find({
      isActive: true,
      connectionStatus: 'Connected'
    });

    for (const device of equipment) {
      await this.setupDeviceIntegration(device);
    }
  }

  async setupDeviceIntegration(device) {
    switch (device.dataExportMethod) {
      case 'Export to shared folder':
        await this.setupFolderWatcher(device);
        break;
      case 'Direct API':
        await this.setupAPIPolling(device);
        break;
      case 'DICOM export':
        await this.setupDICOMListener(device);
        break;
      default:
        console.log(`Manual entry required for ${device.name}`);
    }
  }

  async setupFolderWatcher(device) {
    if (!device.networkConfig.sharedFolder) {
      console.error(`No shared folder configured for ${device.name}`);
      return;
    }

    // Watch for new files in the shared folder
    const watcher = chokidar.watch(device.networkConfig.sharedFolder, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher.on('add', async (filePath) => {
      console.log(`New file from ${device.name}: ${filePath}`);
      await this.processDeviceFile(device, filePath);
    });

    this.watchers.set(device._id.toString(), watcher);
  }

  async processDeviceFile(device, filePath) {
    try {
      const fileExt = path.extname(filePath).toLowerCase();

      // Determine file type and process accordingly
      if (['.jpg', '.jpeg', '.png', '.tiff'].includes(fileExt)) {
        await this.processImageFile(device, filePath);
      } else if (['.pdf', '.txt', '.csv'].includes(fileExt)) {
        await this.processReportFile(device, filePath);
      } else if (fileExt === '.dcm') {
        await this.processDICOMFile(device, filePath);
      }

      // Update last sync time
      await EquipmentCatalog.findByIdAndUpdate(device._id, {
        lastSync: new Date()
      });

    } catch (error) {
      console.error(`Error processing file from ${device.name}:`, error);
    }
  }

  async processImageFile(device, filePath) {
    // Read file and save to DeviceImage
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Extract patient ID from filename (assumes format: PATIENTID_DATE_TYPE.jpg)
    const match = fileName.match(/^(\d+)_/);
    const patientId = match ? match[1] : null;

    const deviceImage = new DeviceImage({
      deviceId: device._id,
      equipmentName: device.name,
      category: device.category,
      filePath: filePath,
      fileName: fileName,
      fileSize: fileBuffer.length,
      mimeType: `image/${fileExt.substring(1)}`,
      patientId: patientId,
      captureDate: new Date(),
      metadata: {
        site: device.site,
        deviceCategory: device.category
      }
    });

    await deviceImage.save();
    console.log(`Saved image from ${device.name}: ${fileName}`);
  }

  async processReportFile(device, filePath) {
    // Parse measurement data from report files
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse based on device type
    let measurementData = {};

    switch (device.category) {
      case 'Autorefractor':
        measurementData = this.parseAutorefractorData(content);
        break;
      case 'Tonometer':
        measurementData = this.parseTonometerData(content);
        break;
      case 'Visual Field':
        measurementData = this.parseVisualFieldData(content);
        break;
      // Add more parsers as needed
    }

    if (measurementData.patientId) {
      const measurement = new DeviceMeasurement({
        deviceId: device._id,
        equipmentName: device.name,
        patientId: measurementData.patientId,
        measurementType: device.category.toLowerCase(),
        measurementDate: new Date(),
        data: measurementData,
        rawData: content
      });

      await measurement.save();
      console.log(`Saved measurement from ${device.name}`);
    }
  }

  parseAutorefractorData(content) {
    // Parse autorefractor report format
    const data = {
      od: {},
      os: {}
    };

    // Example parsing (adjust based on actual format)
    const sphereODMatch = content.match(/OD.*?SPH[:\s]*([-+]?\d+\.?\d*)/i);
    const cylinderODMatch = content.match(/OD.*?CYL[:\s]*([-+]?\d+\.?\d*)/i);
    const axisODMatch = content.match(/OD.*?AXIS[:\s]*(\d+)/i);

    if (sphereODMatch) data.od.sphere = parseFloat(sphereODMatch[1]);
    if (cylinderODMatch) data.od.cylinder = parseFloat(cylinderODMatch[1]);
    if (axisODMatch) data.od.axis = parseInt(axisODMatch[1]);

    // Similar for OS
    const sphereOSMatch = content.match(/OS.*?SPH[:\s]*([-+]?\d+\.?\d*)/i);
    const cylinderOSMatch = content.match(/OS.*?CYL[:\s]*([-+]?\d+\.?\d*)/i);
    const axisOSMatch = content.match(/OS.*?AXIS[:\s]*(\d+)/i);

    if (sphereOSMatch) data.os.sphere = parseFloat(sphereOSMatch[1]);
    if (cylinderOSMatch) data.os.cylinder = parseFloat(cylinderOSMatch[1]);
    if (axisOSMatch) data.os.axis = parseInt(axisOSMatch[1]);

    // Extract patient ID if present
    const patientMatch = content.match(/PATIENT[:\s]*(\d+)/i);
    if (patientMatch) data.patientId = patientMatch[1];

    return data;
  }

  parseTonometerData(content) {
    const data = {};

    // Parse IOP values
    const iopODMatch = content.match(/OD[:\s]*(\d+)\s*mmHg/i);
    const iopOSMatch = content.match(/OS[:\s]*(\d+)\s*mmHg/i);

    if (iopODMatch) data.iopOD = parseInt(iopODMatch[1]);
    if (iopOSMatch) data.iopOS = parseInt(iopOSMatch[1]);

    // Extract patient ID
    const patientMatch = content.match(/PATIENT[:\s]*(\d+)/i);
    if (patientMatch) data.patientId = patientMatch[1];

    return data;
  }

  parseVisualFieldData(content) {
    // Parse visual field report
    const data = {
      md: null,  // Mean Deviation
      psd: null, // Pattern Standard Deviation
      vfi: null  // Visual Field Index
    };

    const mdMatch = content.match(/MD[:\s]*([-+]?\d+\.?\d*)/i);
    const psdMatch = content.match(/PSD[:\s]*([-+]?\d+\.?\d*)/i);
    const vfiMatch = content.match(/VFI[:\s]*(\d+)/i);

    if (mdMatch) data.md = parseFloat(mdMatch[1]);
    if (psdMatch) data.psd = parseFloat(psdMatch[1]);
    if (vfiMatch) data.vfi = parseInt(vfiMatch[1]);

    const patientMatch = content.match(/PATIENT[:\s]*(\d+)/i);
    if (patientMatch) data.patientId = patientMatch[1];

    return data;
  }

  async cleanup() {
    // Stop all watchers
    for (const [id, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
  }
}

module.exports = new DeviceIntegrationService();