import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  Clock,
  Download,
  Eye,
  HardDrive,
  RefreshCw,
  XCircle
} from 'lucide-react';
import deviceService from '../services/deviceService';
import api from '../services/apiConfig';

/**
 * DeviceMeasurementSelector Component
 *
 * Displays available device measurements for an exam and allows importing them
 * into the exam fields (auto-population of refraction, keratometry, IOP data)
 */
const DeviceMeasurementSelector = ({ examId, patientId, onMeasurementApplied }) => {
  const [measurements, setMeasurements] = useState([]);
  const [linkedMeasurements, setLinkedMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (examId) {
      loadMeasurements();
    }
  }, [examId]);

  const loadMeasurements = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get available measurements (within 24h window)
      const availableResponse = await api.get(
        `/ophthalmology/exams/${examId}/available-measurements`
      );
      setMeasurements(availableResponse.data.data || []);

      // Get already linked measurements
      const linkedResponse = await api.get(
        `/ophthalmology/exams/${examId}/device-measurements`
      );
      setLinkedMeasurements(linkedResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load measurements');
      console.error('Error loading device measurements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMeasurement = async (measurement) => {
    setApplying(measurement._id);

    try {
      // First, link the measurement to the exam
      await api.post(`/ophthalmology/exams/${examId}/link-measurement`, {
        measurementId: measurement._id,
        deviceId: measurement.device._id
      });

      // Then, apply the measurement data to exam fields
      await api.post(`/ophthalmology/exams/${examId}/apply-measurement`, {
        measurementId: measurement._id
      });

      // Reload measurements to update UI
      await loadMeasurements();

      // Notify parent component to reload exam data
      if (onMeasurementApplied) {
        onMeasurementApplied(measurement);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply measurement');
      console.error('Error applying measurement:', err);
    } finally {
      setApplying(null);
    }
  };

  const isMeasurementLinked = (measurementId) => {
    return linkedMeasurements.some(
      lm => lm.measurement?._id === measurementId
    );
  };

  const isMeasurementApplied = (measurementId) => {
    const linked = linkedMeasurements.find(
      lm => lm.measurement?._id === measurementId
    );
    return linked?.appliedToExam || false;
  };

  const formatMeasurementType = (type) => {
    const typeMap = {
      'autorefractor': 'Autoréfraction',
      'auto-refractor': 'Autoréfraction',
      'tonometer': 'Tonométrie',
      'tonometry': 'Tonométrie',
      'keratometer': 'Kératomètre',
      'keratometry': 'Kératomètrie',
      'oct': 'OCT',
      'perimeter': 'Périmètrie'
    };
    return typeMap[type.toLowerCase()] || type;
  };

  const formatMeasurementValue = (measurement) => {
    const type = measurement.measurementType.toLowerCase();

    if (type === 'autorefractor' || type === 'auto-refractor') {
      const od = measurement.data?.refraction?.OD;
      const os = measurement.data?.refraction?.OS;
      return (
        <div className="text-xs space-y-1">
          {od && (
            <div>
              <span className="font-medium">OD:</span> Sph {od.sphere?.toFixed(2)} Cyl{' '}
              {od.cylinder?.toFixed(2)} Axe {od.axis}°
            </div>
          )}
          {os && (
            <div>
              <span className="font-medium">OS:</span> Sph {os.sphere?.toFixed(2)} Cyl{' '}
              {os.cylinder?.toFixed(2)} Axe {os.axis}°
            </div>
          )}
        </div>
      );
    }

    if (type === 'tonometer' || type === 'tonometry') {
      const od = measurement.data?.iop?.OD;
      const os = measurement.data?.iop?.OS;
      return (
        <div className="text-xs space-y-1">
          {od && <div><span className="font-medium">OD:</span> {od.value} mmHg</div>}
          {os && <div><span className="font-medium">OS:</span> {os.value} mmHg</div>}
        </div>
      );
    }

    if (type === 'keratometer' || type === 'keratometry') {
      const od = measurement.data?.keratometry?.OD;
      const os = measurement.data?.keratometry?.OS;
      return (
        <div className="text-xs space-y-1">
          {od && (
            <div>
              <span className="font-medium">OD:</span> K1 {od.k1?.power?.toFixed(2)}D, K2{' '}
              {od.k2?.power?.toFixed(2)}D
            </div>
          )}
          {os && (
            <div>
              <span className="font-medium">OS:</span> K1 {os.k1?.power?.toFixed(2)}D, K2{' '}
              {os.k2?.power?.toFixed(2)}D
            </div>
          )}
        </div>
      );
    }

    return <div className="text-xs text-gray-500">Mesure disponible</div>;
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="text-sm text-blue-800">
            Chargement des mesures disponibles...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
        <button
          onClick={loadMeasurements}
          className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Aucune mesure d'appareil disponible pour cet examen
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Les mesures dans les 24 heures précédant l'examen apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <HardDrive className="w-5 h-5" />
            <h3 className="font-semibold">Mesures d'Appareils Disponibles</h3>
          </div>
          <button
            onClick={loadMeasurements}
            className="p-1 hover:bg-blue-500 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-blue-100 mt-1">
          {measurements.length} mesure(s) disponible(s) - Cliquez pour importer
        </p>
      </div>

      {/* Measurements List */}
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {measurements.map((measurement) => {
          const isLinked = isMeasurementLinked(measurement._id);
          const isApplied = isMeasurementApplied(measurement._id);
          const isApplying = applying === measurement._id;

          return (
            <div
              key={measurement._id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                isApplied ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Measurement Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="font-medium text-gray-900">
                      {formatMeasurementType(measurement.measurementType)}
                    </span>
                    {isApplied && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </div>

                  {/* Device Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <HardDrive className="w-3 h-3" />
                    <span>{measurement.device?.name}</span>
                    <span className="text-gray-400">•</span>
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(measurement.measurementDate).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  {/* Measurement Values */}
                  <div className="bg-gray-50 rounded p-2">
                    {formatMeasurementValue(measurement)}
                  </div>

                  {/* Status */}
                  {isApplied && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                      <CheckCircle className="w-3 h-3" />
                      <span>Données importées dans l'examen</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                  {isApplied ? (
                    <div className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                      Importé
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApplyMeasurement(measurement)}
                      disabled={isApplying}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-sm"
                    >
                      {isApplying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Import...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Importer
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeviceMeasurementSelector;
