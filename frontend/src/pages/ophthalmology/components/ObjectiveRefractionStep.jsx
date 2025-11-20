import { useState } from 'react';
import { Camera, Eye, Upload, RotateCw, HardDrive, CheckCircle, History } from 'lucide-react';
import { calculateSE, formatPrescription } from '../../../utils/ophthalmologyCalculations';
import DeviceMeasurementSelector from '../../../components/DeviceMeasurementSelector';
import { usePreviousRefraction } from '../../../hooks/usePreviousData';

export default function ObjectiveRefractionStep({ data, onChange, examId, patientId }) {
  const [selectedDevice, setSelectedDevice] = useState('autorefractor');
  const [manualEntry, setManualEntry] = useState(false);
  const [showDeviceImport, setShowDeviceImport] = useState(false);

  // Initialize objective data structure if not present
  if (!data.objective) {
    data.objective = {
      OD: { sphere: 0, cylinder: 0, axis: 0 },
      OS: { sphere: 0, cylinder: 0, axis: 0 },
      confidence: 7,
      timestamp: null,
      sourceDevice: null,
      device: null
    };
  }

  // Hook for copy previous functionality
  const { hasPreviousExam, copyObjectiveRefraction, loading: loadingPrevious } = usePreviousRefraction(patientId);

  const handleCopyPrevious = () => {
    const previousData = copyObjectiveRefraction();
    if (previousData) {
      onChange(prev => ({
        ...prev,
        objective: {
          ...prev.objective,
          OD: previousData.OD || prev.objective.OD,
          OS: previousData.OS || prev.objective.OS
        }
      }));
    }
  };

  const devices = [
    { id: 'autorefractor', name: 'Autorefracteur', model: 'Topcon KR-8900' },
    { id: 'retinoscope', name: 'Rétinoscope', model: 'Heine Beta 200' },
    { id: 'manual', name: 'Entrée Manuelle', model: 'Lunettes d\'essai' }
  ];

  const updateValue = (eye, param, value) => {
    onChange(prev => ({
      ...prev,
      objective: {
        ...prev.objective,
        [eye]: {
          ...prev.objective[eye],
          [param]: parseFloat(value) || 0
        }
      }
    }));
  };

  const performAutorefraction = () => {
    // Simulate autorefractor reading
    const readings = {
      OD: {
        sphere: (-Math.random() * 6).toFixed(2),
        cylinder: (-Math.random() * 2).toFixed(2),
        axis: Math.floor(Math.random() * 180) + 1
      },
      OS: {
        sphere: (-Math.random() * 6).toFixed(2),
        cylinder: (-Math.random() * 2).toFixed(2),
        axis: Math.floor(Math.random() * 180) + 1
      }
    };

    onChange(prev => ({
      ...prev,
      objective: {
        ...prev.objective,
        ...readings,
        timestamp: new Date().toISOString()
      }
    }));
  };

  const copyToSubjective = () => {
    onChange(prev => ({
      ...prev,
      subjective: {
        ...prev.subjective,
        OD: { ...prev.objective.OD, va: '' },
        OS: { ...prev.objective.OS, va: '' }
      }
    }));
  };

  const handleMeasurementApplied = (measurement) => {
    // Reload the exam data to get the updated values with device-sourced data
    // For now, we'll manually update the form data from the measurement
    if (measurement.measurementType.toLowerCase() === 'autorefractor' ||
        measurement.measurementType.toLowerCase() === 'auto-refractor') {
      const refractionData = measurement.data.refraction;
      if (refractionData) {
        onChange(prev => ({
          ...prev,
          objective: {
            ...prev.objective,
            OD: {
              sphere: refractionData.OD?.sphere || 0,
              cylinder: refractionData.OD?.cylinder || 0,
              axis: refractionData.OD?.axis || 0
            },
            OS: {
              sphere: refractionData.OS?.sphere || 0,
              cylinder: refractionData.OS?.cylinder || 0,
              axis: refractionData.OS?.axis || 0
            },
            method: 'autorefractor',
            device: measurement.device?.name || 'Device',
            sourceDevice: measurement.device?._id,
            sourceMeasurement: measurement._id,
            timestamp: measurement.measurementDate
          }
        }));
        setShowDeviceImport(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Camera className="w-5 h-5 mr-2 text-blue-600" />
        Réfraction Objective
      </h2>

      {/* Device Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Méthode de Mesure
        </label>
        <div className="flex gap-4">
          {devices.map(device => (
            <button
              key={device.id}
              onClick={() => {
                setSelectedDevice(device.id);
                setManualEntry(device.id === 'manual');
                onChange(prev => ({
                  ...prev,
                  objective: {
                    ...prev.objective,
                    method: device.id,
                    device: device.model
                  }
                }));
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedDevice === device.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {device.name}
            </button>
          ))}
        </div>
        {selectedDevice !== 'manual' && (
          <p className="text-sm text-gray-500 mt-2">
            Appareil: {devices.find(d => d.id === selectedDevice)?.model}
          </p>
        )}
      </div>

      {/* Autorefractor Controls */}
      {selectedDevice === 'autorefractor' && (
        <div className="mb-6">
          <div className="flex gap-3">
            <button
              onClick={performAutorefraction}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Effectuer la Mesure
            </button>
            {examId && patientId && (
              <button
                onClick={() => setShowDeviceImport(!showDeviceImport)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <HardDrive className="w-4 h-4 mr-2" />
                {showDeviceImport ? 'Masquer' : 'Importer depuis Appareil'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {showDeviceImport ? 'Sélectionnez une mesure pour l\'importer' : 'Cliquez pour simuler une mesure ou importer depuis un appareil'}
          </p>
        </div>
      )}

      {/* Device Measurement Selector */}
      {showDeviceImport && examId && patientId && (
        <div className="mb-6">
          <DeviceMeasurementSelector
            examId={examId}
            patientId={patientId}
            onMeasurementApplied={handleMeasurementApplied}
          />
        </div>
      )}

      {/* Source Device Indicator */}
      {data.objective?.sourceDevice && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">
              Données importées depuis: {data.objective?.device}
            </p>
            <p className="text-xs text-green-700">
              Mesure effectuée le: {data.objective?.timestamp ? new Date(data.objective?.timestamp).toLocaleString('fr-FR') : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Refraction Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* OD Values */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-blue-600" />
            Œil Droit (OD)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sphère (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.objective?.OD?.sphere || 0}
                onChange={(e) => updateValue('OD', 'sphere', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cylindre (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.objective?.OD?.cylinder || 0}
                onChange={(e) => updateValue('OD', 'cylinder', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Axe (°)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={data.objective?.OD?.axis || 0}
                onChange={(e) => updateValue('OD', 'axis', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-600">Équivalent Sphérique:</span>
            <span className="font-medium ml-2">
              {calculateSE(data.objective?.OD?.sphere || 0, data.objective?.OD?.cylinder || 0)}D
            </span>
          </div>
        </div>

        {/* OS Values */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-blue-600" />
            Œil Gauche (OS)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sphère (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.objective?.OS.sphere}
                onChange={(e) => updateValue('OS', 'sphere', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cylindre (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.objective?.OS.cylinder}
                onChange={(e) => updateValue('OS', 'cylinder', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Axe (°)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={data.objective?.OS.axis}
                onChange={(e) => updateValue('OS', 'axis', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-600">Équivalent Sphérique:</span>
            <span className="font-medium ml-2">
              {calculateSE(data.objective?.OS?.sphere || 0, data.objective?.OS?.cylinder || 0)}D
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Level */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Niveau de Confiance
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max="10"
            value={data.objective?.confidence || 7}
            onChange={(e) => onChange(prev => ({
              ...prev,
              objective: {
                ...prev.objective,
                confidence: parseInt(e.target.value)
              }
            }))}
            className="flex-1"
          />
          <span className="font-medium text-lg">{data.objective?.confidence || 7}/10</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {data.objective.confidence >= 8 ? 'Mesure fiable' :
           data.objective.confidence >= 5 ? 'Mesure acceptable' :
           'Mesure peu fiable - vérifier'}
        </p>
      </div>

      {/* Results Summary */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-3">Réfraction Objective</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">OD:</span>
            <span className="ml-2">{formatPrescription({ OD: data.objective?.OD || { sphere: 0, cylinder: 0, axis: 0 } }).OD}</span>
          </div>
          <div>
            <span className="font-medium">OS:</span>
            <span className="ml-2">{formatPrescription({ OS: data.objective?.OS || { sphere: 0, cylinder: 0, axis: 0 } }).OS}</span>
          </div>
        </div>
        {data.objective?.timestamp && (
          <p className="text-xs text-gray-600 mt-2">
            Mesuré le: {new Date(data.objective?.timestamp).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        {hasPreviousExam && (
          <button
            onClick={handleCopyPrevious}
            disabled={loadingPrevious}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 flex items-center gap-2"
            title="Copier les valeurs du dernier examen"
          >
            <History className="h-4 w-4" />
            Copier précédent
          </button>
        )}
        <button
          onClick={copyToSubjective}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Copier vers Réfraction Subjective
        </button>
      </div>

      {/* Clinical Notes */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes sur la Réfraction Objective
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="2"
          placeholder="Qualité de la mesure, coopération du patient, remarques..."
        />
      </div>
    </div>
  );
}