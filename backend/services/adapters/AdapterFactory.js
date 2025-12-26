/**
 * AdapterFactory - Factory pattern for device adapters
 *
 * Responsible for:
 * - Selecting the appropriate adapter based on device type
 * - Instantiating adapters with device configuration
 * - Providing fallback to BaseAdapter for unknown device types
 * - Managing adapter registry
 */

const BaseAdapter = require('./BaseAdapter');
const OctAdapter = require('./OctAdapter');
const TonometryAdapter = require('./TonometryAdapter');
const AutorefractorAdapter = require('./AutorefractorAdapter');
const SpecularMicroscopeAdapter = require('./SpecularMicroscopeAdapter');
const BiometerAdapter = require('./BiometerAdapter');
const NidekAdapter = require('./NidekAdapter');
const VisualFieldAdapter = require('./VisualFieldAdapter');

const { createContextLogger } = require('../../utils/structuredLogger');
const log = createContextLogger('AdapterFactory');

class AdapterFactory {
  /**
   * Registry of device type to adapter class mappings
   */
  static adapterRegistry = {
    // OCT devices
    'oct': OctAdapter,
    'optical-coherence-tomography': OctAdapter,

    // Tonometry devices
    'tonometer': TonometryAdapter,
    'tonometry': TonometryAdapter,
    'iop': TonometryAdapter,

    // Autorefractor and Keratometer devices
    'auto-refractor': AutorefractorAdapter,
    'autorefractor': AutorefractorAdapter,
    'keratometer': AutorefractorAdapter,
    'ark': AutorefractorAdapter, // Auto Refractor Keratometer

    // Specular Microscope devices
    'specular-microscope': SpecularMicroscopeAdapter,
    'specular': SpecularMicroscopeAdapter,
    'endothelial': SpecularMicroscopeAdapter,

    // Biometer devices
    'biometer': BiometerAdapter,
    'biometry': BiometerAdapter,
    'iol-master': BiometerAdapter,
    'lenstar': BiometerAdapter,
    'al-scan': BiometerAdapter,

    // NIDEK devices (auto-detection based on model)
    'nidek': NidekAdapter,
    'nidek-ark': NidekAdapter,
    'nidek-opd': NidekAdapter,
    'nidek-al': NidekAdapter,
    'nidek-rs': NidekAdapter,
    'nidek-cem': NidekAdapter,
    'nidek-nt': NidekAdapter,

    // Visual Field / Perimetry devices
    'visual-field': VisualFieldAdapter,
    'perimeter': VisualFieldAdapter,
    'perimetry': VisualFieldAdapter,
    'hfa': VisualFieldAdapter,           // Humphrey Field Analyzer
    'humphrey': VisualFieldAdapter,
    'octopus': VisualFieldAdapter,       // Haag-Streit Octopus
    'kowa-ap': VisualFieldAdapter,       // Kowa AP series
  };

  /**
   * Get appropriate adapter for a device
   *
   * @param {Object} device - Device model instance
   * @returns {BaseAdapter} - Instantiated adapter
   * @throws {Error} - If device is invalid
   */
  static getAdapter(device) {
    if (!device) {
      throw new Error('Device is required');
    }

    if (!device.type) {
      throw new Error('Device type is required');
    }

    // Normalize device type for lookup
    const normalizedType = device.type.toLowerCase().trim();

    // Get adapter class from registry
    const AdapterClass = this.adapterRegistry[normalizedType];

    if (!AdapterClass) {
      log.warn(
        `No specific adapter found for device type: ${device.type}. ` +
        `Using BaseAdapter as fallback. Device ID: ${device._id}`
      );

      // Return a generic adapter that uses the base functionality
      // This allows the system to work even for device types without specific adapters
      return this.createGenericAdapter(device);
    }

    // Instantiate and return the specific adapter
    return new AdapterClass(device);
  }

  /**
   * Create a generic adapter for devices without specific adapter implementations
   *
   * @param {Object} device - Device model instance
   * @returns {BaseAdapter} - Generic adapter instance
   */
  static createGenericAdapter(device) {
    // Create an anonymous class that extends BaseAdapter
    // and implements minimal required methods
    class GenericAdapter extends BaseAdapter {
      constructor(device) {
        super(device);
        this.measurementType = device.type.toUpperCase();
      }

      async validate(data) {
        // Basic validation using common fields
        return this.validateCommonFields(data, ['eye']);
      }

      async transform(data) {
        // Pass-through transformation
        return {
          measurementType: this.measurementType,
          measurementDate: data.measurementDate || data.capturedAt || new Date(),
          eye: data.eye || 'OU',
          rawData: {
            format: 'json',
            data: data
          },
          source: data.source || 'device'
        };
      }

      async process(data, patientId, examId = null) {
        try {
          const validation = await this.validate(data);
          if (!validation.isValid) {
            return this.handleError(
              new Error(`Validation failed: ${JSON.stringify(validation.errors)}`),
              'validation'
            );
          }

          const transformed = await this.transform(data);
          const measurement = await this.save(transformed, patientId, examId);

          await this.logEvent('MEASUREMENT_IMPORT', 'SUCCESS', {
            integrationMethod: data.source || 'manual',
            initiatedBy: 'DEVICE',
            processing: {
              recordsProcessed: 1
            }
          });

          return this.createSuccessResponse({
            measurementId: measurement._id,
            message: 'Measurement processed successfully (generic adapter)'
          });

        } catch (error) {
          await this.logEvent('MEASUREMENT_IMPORT', 'FAILED', {
            integrationMethod: data.source || 'manual',
            initiatedBy: 'DEVICE',
            errorDetails: {
              code: error.code || 'GENERIC_PROCESSING_ERROR',
              message: error.message,
              severity: 'MEDIUM'
            }
          });

          return this.handleError(error, 'Generic processing');
        }
      }
    }

    return new GenericAdapter(device);
  }

  /**
   * Register a new adapter for a device type
   *
   * @param {String} deviceType - Device type identifier
   * @param {Class} AdapterClass - Adapter class (must extend BaseAdapter)
   * @throws {Error} - If adapter class is invalid
   */
  static registerAdapter(deviceType, AdapterClass) {
    if (!deviceType || typeof deviceType !== 'string') {
      throw new Error('Device type must be a non-empty string');
    }

    if (!AdapterClass || !(AdapterClass.prototype instanceof BaseAdapter)) {
      throw new Error('Adapter class must extend BaseAdapter');
    }

    const normalizedType = deviceType.toLowerCase().trim();
    this.adapterRegistry[normalizedType] = AdapterClass;

    log.info(`Registered adapter for device type: ${deviceType}`);
  }

  /**
   * Get list of supported device types
   *
   * @returns {Array<String>} - List of supported device types
   */
  static getSupportedDeviceTypes() {
    return Object.keys(this.adapterRegistry);
  }

  /**
   * Check if a device type has a specific adapter
   *
   * @param {String} deviceType - Device type identifier
   * @returns {Boolean} - True if specific adapter exists
   */
  static hasAdapter(deviceType) {
    if (!deviceType) return false;

    const normalizedType = deviceType.toLowerCase().trim();
    return this.adapterRegistry[normalizedType] !== undefined;
  }

  /**
   * Get adapter class name for a device type
   *
   * @param {String} deviceType - Device type identifier
   * @returns {String|null} - Adapter class name or null
   */
  static getAdapterName(deviceType) {
    if (!deviceType) return null;

    const normalizedType = deviceType.toLowerCase().trim();
    const AdapterClass = this.adapterRegistry[normalizedType];

    return AdapterClass ? AdapterClass.name : null;
  }

  /**
   * Get adapter for device type by string (without device instance)
   * Useful for testing or when device instance is not available
   *
   * @param {String} deviceType - Device type identifier
   * @param {Object} mockDevice - Mock device object with minimal properties
   * @returns {BaseAdapter} - Instantiated adapter
   */
  static getAdapterByType(deviceType, mockDevice = null) {
    if (!mockDevice) {
      mockDevice = {
        _id: 'mock-device-id',
        type: deviceType,
        name: `Mock ${deviceType} Device`,
        manufacturer: 'Unknown',
        model: 'Unknown'
      };
    }

    return this.getAdapter(mockDevice);
  }

  /**
   * Validate adapter implementation
   * Checks if adapter implements all required methods
   *
   * @param {BaseAdapter} adapter - Adapter instance
   * @returns {Object} - Validation result { valid: Boolean, missingMethods: Array }
   */
  static validateAdapter(adapter) {
    const requiredMethods = ['process', 'validate', 'transform'];
    const missingMethods = [];

    for (const method of requiredMethods) {
      if (typeof adapter[method] !== 'function') {
        missingMethods.push(method);
      }
    }

    return {
      valid: missingMethods.length === 0,
      missingMethods
    };
  }

  /**
   * Get statistics about registered adapters
   *
   * @returns {Object} - Statistics object
   */
  static getAdapterStats() {
    const deviceTypes = Object.keys(this.adapterRegistry);
    const adapterClasses = new Set(Object.values(this.adapterRegistry));

    return {
      totalDeviceTypes: deviceTypes.length,
      uniqueAdapters: adapterClasses.size,
      deviceTypes: deviceTypes,
      adapterClasses: Array.from(adapterClasses).map(cls => cls.name)
    };
  }
}

module.exports = AdapterFactory;
