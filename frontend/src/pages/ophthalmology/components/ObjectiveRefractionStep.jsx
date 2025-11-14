import { useState } from 'react';
import { Camera, Eye, Upload, RotateCw } from 'lucide-react';
import { calculateSE, formatPrescription } from '../../../utils/ophthalmologyCalculations';

export default function ObjectiveRefractionStep({ data, setData }) {
  const [selectedDevice, setSelectedDevice] = useState('autorefractor');
  const [manualEntry, setManualEntry] = useState(false);

  const devices = [
    { id: 'autorefractor', name: 'Autorefracteur', model: 'Topcon KR-8900' },
    { id: 'retinoscope', name: 'Rétinoscope', model: 'Heine Beta 200' },
    { id: 'manual', name: 'Entrée Manuelle', model: 'Lunettes d\'essai' }
  ];

  const updateValue = (eye, param, value) => {
    setData(prev => ({
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

    setData(prev => ({
      ...prev,
      objective: {
        ...prev.objective,
        ...readings,
        timestamp: new Date().toISOString()
      }
    }));
  };

  const copyToSubjective = () => {
    setData(prev => ({
      ...prev,
      subjective: {
        ...prev.subjective,
        OD: { ...prev.objective.OD, va: '' },
        OS: { ...prev.objective.OS, va: '' }
      }
    }));
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
                setData(prev => ({
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
          <button
            onClick={performAutorefraction}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Effectuer la Mesure
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Cliquez pour simuler une mesure d'autoréfraction
          </p>
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
                value={data.objective.OD.sphere}
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
                value={data.objective.OD.cylinder}
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
                value={data.objective.OD.axis}
                onChange={(e) => updateValue('OD', 'axis', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-600">Équivalent Sphérique:</span>
            <span className="font-medium ml-2">
              {calculateSE(data.objective.OD.sphere, data.objective.OD.cylinder)}D
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
                value={data.objective.OS.sphere}
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
                value={data.objective.OS.cylinder}
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
                value={data.objective.OS.axis}
                onChange={(e) => updateValue('OS', 'axis', e.target.value)}
                disabled={!manualEntry && selectedDevice === 'autorefractor'}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-gray-600">Équivalent Sphérique:</span>
            <span className="font-medium ml-2">
              {calculateSE(data.objective.OS.sphere, data.objective.OS.cylinder)}D
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
            value={data.objective.confidence}
            onChange={(e) => setData(prev => ({
              ...prev,
              objective: {
                ...prev.objective,
                confidence: parseInt(e.target.value)
              }
            }))}
            className="flex-1"
          />
          <span className="font-medium text-lg">{data.objective.confidence}/10</span>
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
            <span className="ml-2">{formatPrescription({ OD: data.objective.OD }).OD}</span>
          </div>
          <div>
            <span className="font-medium">OS:</span>
            <span className="ml-2">{formatPrescription({ OS: data.objective.OS }).OS}</span>
          </div>
        </div>
        {data.objective.timestamp && (
          <p className="text-xs text-gray-600 mt-2">
            Mesuré le: {new Date(data.objective.timestamp).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={copyToSubjective}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Copier vers Réfraction Subjective
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Upload className="w-4 h-4 inline mr-2" />
          Importer Résultats
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