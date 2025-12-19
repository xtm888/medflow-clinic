/**
 * useDeviceSync - Real-time device measurement synchronization hook
 *
 * Auto-detects available device measurements on consultation start,
 * subscribes to WebSocket for real-time updates, and provides an API
 * for importing measurements into ophthalmology exams.
 *
 * Features:
 * - Auto-detect available measurements within 24 hours
 * - WebSocket subscription for real-time device updates
 * - Filter by patientId and clinic
 * - Toast notifications for new measurements
 * - Import single or all measurements
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocketEvent } from './useWebSocket';
import deviceService from '../services/deviceService';
import { useClinic } from '../contexts/ClinicContext';
import { toast } from 'react-toastify';

// Device type to measurement type mapping
const DEVICE_TYPE_MAP = {
  autorefractor: {
    label: 'Auto-réfractomètre',
    icon: 'Eye',
    fields: ['sphere', 'cylinder', 'axis'],
    targetTab: 'refraction'
  },
  tonometer: {
    label: 'Tonomètre',
    icon: 'Activity',
    fields: ['iop'],
    targetTab: 'examen'
  },
  keratometer: {
    label: 'Kératomètre',
    icon: 'Target',
    fields: ['k1', 'k2', 'astigmatism'],
    targetTab: 'refraction'
  },
  oct: {
    label: 'OCT',
    icon: 'Scan',
    fields: ['thickness', 'rnfl', 'gccAnalysis'],
    targetTab: 'examen'
  },
  perimeter: {
    label: 'Périmètre',
    icon: 'Grid',
    fields: ['visualField', 'mdValue', 'psdValue'],
    targetTab: 'examen'
  },
  pachymeter: {
    label: 'Pachymètre',
    icon: 'Layers',
    fields: ['centralThickness', 'thinnestPoint'],
    targetTab: 'refraction'
  },
  topographer: {
    label: 'Topographe',
    icon: 'Map',
    fields: ['simK', 'eccentricity', 'irregularity'],
    targetTab: 'lentilles'
  },
  lensmeter: {
    label: 'Frontofocomètre',
    icon: 'Glasses',
    fields: ['sphere', 'cylinder', 'axis', 'add'],
    targetTab: 'refraction'
  }
};

// Format measurement value for display
const formatMeasurementValue = (type, data) => {
  switch (type) {
    case 'autorefractor':
    case 'lensmeter':
      if (!data) return 'N/A';
      const od = data.OD ? `OD: ${data.OD.sphere >= 0 ? '+' : ''}${data.OD.sphere?.toFixed(2) || '0.00'} (${data.OD.cylinder?.toFixed(2) || '0.00'}) x ${data.OD.axis || '0'}°` : '';
      const os = data.OS ? `OS: ${data.OS.sphere >= 0 ? '+' : ''}${data.OS.sphere?.toFixed(2) || '0.00'} (${data.OS.cylinder?.toFixed(2) || '0.00'}) x ${data.OS.axis || '0'}°` : '';
      return [od, os].filter(Boolean).join(' | ');

    case 'tonometer':
      if (!data) return 'N/A';
      return `OD: ${data.OD?.iop || '-'} mmHg | OS: ${data.OS?.iop || '-'} mmHg`;

    case 'keratometer':
      if (!data) return 'N/A';
      return `K1: ${data.k1?.toFixed(2) || '-'} K2: ${data.k2?.toFixed(2) || '-'}`;

    case 'oct':
      if (!data) return 'N/A';
      return `RNFL: ${data.rnfl || '-'} µm`;

    case 'perimeter':
      if (!data) return 'N/A';
      return `MD: ${data.mdValue?.toFixed(1) || '-'} dB | PSD: ${data.psdValue?.toFixed(1) || '-'} dB`;

    case 'pachymeter':
      if (!data) return 'N/A';
      return `CCT: ${data.centralThickness || '-'} µm`;

    case 'topographer':
      if (!data) return 'N/A';
      return `SimK: ${data.simK?.toFixed(2) || '-'} D`;

    default:
      return JSON.stringify(data).substring(0, 50);
  }
};

/**
 * useDeviceSync hook
 *
 * @param {string} patientId - Patient ID to filter measurements
 * @param {string} clinicId - Clinic ID to filter devices (optional, uses current clinic)
 * @param {Object} options - Additional options
 * @param {number} options.maxAgeHours - Maximum age of measurements to show (default: 24)
 * @param {boolean} options.autoNotify - Show toast notifications for new data (default: true)
 * @returns {Object} Device sync state and methods
 */
export function useDeviceSync(patientId, clinicId = null, options = {}) {
  const { maxAgeHours = 24, autoNotify = true } = options;

  const { currentClinic } = useClinic();
  const effectiveClinicId = clinicId || currentClinic?._id;

  // State
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasNewMeasurements, setHasNewMeasurements] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  // Track already-notified measurements to avoid duplicate toasts
  const notifiedMeasurementsRef = useRef(new Set());

  // Fetch available measurements for patient
  const fetchMeasurements = useCallback(async () => {
    if (!patientId) {
      setMeasurements([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all devices for the clinic
      const devicesResponse = await deviceService.getDevices({
        clinic: effectiveClinicId,
        status: 'active'
      });

      const devices = devicesResponse?.data || [];
      const allMeasurements = [];

      // Calculate the cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

      // Fetch measurements from each device
      for (const device of devices) {
        try {
          const measurementsResponse = await deviceService.getDeviceMeasurements(
            device._id,
            patientId,
            {
              startDate: cutoffTime.toISOString(),
              limit: 10
            }
          );

          const deviceMeasurements = measurementsResponse?.data || [];

          // Add device info to each measurement
          deviceMeasurements.forEach(m => {
            allMeasurements.push({
              ...m,
              device: {
                id: device._id,
                name: device.name,
                type: device.deviceType,
                manufacturer: device.manufacturer
              },
              typeInfo: DEVICE_TYPE_MAP[device.deviceType] || {
                label: device.deviceType,
                icon: 'HardDrive',
                fields: [],
                targetTab: 'examen'
              },
              formattedValue: formatMeasurementValue(device.deviceType, m.data),
              isNew: !notifiedMeasurementsRef.current.has(m._id)
            });
          });
        } catch (deviceError) {
          console.warn(`Failed to fetch measurements from device ${device.name}:`, deviceError);
        }
      }

      // Sort by timestamp (newest first)
      allMeasurements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setMeasurements(allMeasurements);
      setLastFetch(new Date());

      // Check for new measurements
      const newOnes = allMeasurements.filter(m => m.isNew);
      if (newOnes.length > 0) {
        setHasNewMeasurements(true);

        // Show notification for new measurements
        if (autoNotify && newOnes.length > 0) {
          const types = [...new Set(newOnes.map(m => m.typeInfo.label))];
          toast.success(
            `${newOnes.length} nouvelle(s) mesure(s) disponible(s): ${types.join(', ')}`,
            { duration: 5000 }
          );
        }

        // Mark as notified
        newOnes.forEach(m => notifiedMeasurementsRef.current.add(m._id));
      }

    } catch (err) {
      console.error('Failed to fetch device measurements:', err);
      setError(err.message || 'Erreur lors de la récupération des mesures');
    } finally {
      setLoading(false);
    }
  }, [patientId, effectiveClinicId, maxAgeHours, autoNotify]);

  // Initial fetch on mount or when patient changes
  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  // Listen for real-time device measurement updates via WebSocket
  useWebSocketEvent('device_measurement', (data) => {
    // Only process if it's for our patient
    if (data.patientId !== patientId) return;

    const newMeasurement = {
      ...data,
      typeInfo: DEVICE_TYPE_MAP[data.deviceType] || {
        label: data.deviceType,
        icon: 'HardDrive',
        fields: [],
        targetTab: 'examen'
      },
      formattedValue: formatMeasurementValue(data.deviceType, data.data),
      isNew: true
    };

    setMeasurements(prev => {
      // Check if we already have this measurement
      const exists = prev.some(m => m._id === newMeasurement._id);
      if (exists) return prev;

      // Add to beginning (newest first)
      return [newMeasurement, ...prev];
    });

    setHasNewMeasurements(true);

    // Show toast notification
    if (autoNotify) {
      toast.success(
        `Nouvelle mesure ${newMeasurement.typeInfo.label} reçue`,
        { duration: 4000 }
      );
    }
  });

  // Import a single measurement into exam data
  const importMeasurement = useCallback(async (measurementId) => {
    const measurement = measurements.find(m => m._id === measurementId);
    if (!measurement) {
      throw new Error('Mesure non trouvée');
    }

    // Return the measurement data for the caller to apply
    return {
      deviceType: measurement.device.type,
      targetTab: measurement.typeInfo.targetTab,
      fields: measurement.typeInfo.fields,
      data: measurement.data,
      timestamp: measurement.timestamp,
      deviceName: measurement.device.name
    };
  }, [measurements]);

  // Import all available measurements
  const importAll = useCallback(async () => {
    const importedData = {};

    for (const measurement of measurements) {
      const targetTab = measurement.typeInfo.targetTab;
      if (!importedData[targetTab]) {
        importedData[targetTab] = {};
      }

      // Merge data for each target tab
      importedData[targetTab] = {
        ...importedData[targetTab],
        [measurement.device.type]: {
          data: measurement.data,
          timestamp: measurement.timestamp,
          deviceName: measurement.device.name
        }
      };
    }

    return importedData;
  }, [measurements]);

  // Dismiss new measurement notification
  const dismiss = useCallback(() => {
    setHasNewMeasurements(false);
    setMeasurements(prev => prev.map(m => ({ ...m, isNew: false })));
  }, []);

  // Refresh measurements
  const refresh = useCallback(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  // Get measurements filtered by device type
  const getMeasurementsByType = useCallback((deviceType) => {
    return measurements.filter(m => m.device.type === deviceType);
  }, [measurements]);

  // Get measurements for a specific target tab
  const getMeasurementsByTab = useCallback((targetTab) => {
    return measurements.filter(m => m.typeInfo.targetTab === targetTab);
  }, [measurements]);

  return {
    // State
    measurements,
    loading,
    error,
    hasNewMeasurements,
    lastFetch,

    // Methods
    importMeasurement,
    importAll,
    dismiss,
    refresh,
    getMeasurementsByType,
    getMeasurementsByTab,

    // Device type info
    deviceTypeMap: DEVICE_TYPE_MAP
  };
}

export default useDeviceSync;
