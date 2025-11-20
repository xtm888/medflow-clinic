import { useState } from 'react';
import { Activity, Eye, HardDrive, CheckCircle, History } from 'lucide-react';
import { calculateKeratometricAstigmatism } from '../../../utils/ophthalmologyCalculations';
import DeviceMeasurementSelector from '../../../components/DeviceMeasurementSelector';
import { usePreviousRefraction } from '../../../hooks/usePreviousData';

export default function KeratometryStep({ data, setData, examId, patientId }) {
  const [selectedEye, setSelectedEye] = useState('OD');
  const [showDeviceImport, setShowDeviceImport] = useState(false);

  // Initialize keratometry data structure if not present
  if (!data.keratometry) {
    data.keratometry = {
      OD: {
        k1: { power: 44.00, axis: 180 },
        k2: { power: 44.00, axis: 90 },
        astigmatism: 0
      },
      OS: {
        k1: { power: 44.00, axis: 180 },
        k2: { power: 44.00, axis: 90 },
        astigmatism: 0
      },
      sourceDevice: null,
      timestamp: null
    };
  }

  // Hook for copy previous functionality
  const { hasPreviousExam, copyKeratometry, loading: loadingPrevious } = usePreviousRefraction(patientId);

  const handleCopyPrevious = () => {
    const previousData = copyKeratometry();
    if (previousData) {
      setData(prev => ({
        ...prev,
        keratometry: {
          ...(prev.keratometry || {}),
          OD: previousData.OD || prev.keratometry?.OD || { k1: { power: 44.00, axis: 180 }, k2: { power: 44.00, axis: 90 }, astigmatism: 0 },
          OS: previousData.OS || prev.keratometry?.OS || { k1: { power: 44.00, axis: 180 }, k2: { power: 44.00, axis: 90 }, astigmatism: 0 }
        }
      }));
    }
  };

  const updateKeratometry = (eye, meridian, param, value) => {
    setData(prev => ({
      ...prev,
      keratometry: {
        ...(prev.keratometry || {}),
        [eye]: {
          ...(prev.keratometry?.[eye] || {}),
          [meridian]: {
            ...(prev.keratometry?.[eye]?.[meridian] || {}),
            [param]: parseFloat(value) || 0
          },
          astigmatism: Math.abs(
            (prev.keratometry?.[eye]?.k1?.power || 0) - (prev.keratometry?.[eye]?.k2?.power || 0)
          ).toFixed(2)
        }
      }
    }));
  };

  const calculateAstigmatism = (eye) => {
    const k1 = data.keratometry?.[eye]?.k1?.power || 0;
    const k2 = data.keratometry?.[eye]?.k2?.power || 0;
    const k1Axis = data.keratometry?.[eye]?.k1?.axis || 0;
    const k2Axis = data.keratometry?.[eye]?.k2?.axis || 0;

    return calculateKeratometricAstigmatism(k1, k1Axis, k2, k2Axis);
  };

  const handleMeasurementApplied = (measurement) => {
    // Handle keratometry measurement import
    if (measurement.measurementType.toLowerCase() === 'keratometer' ||
        measurement.measurementType.toLowerCase() === 'keratometry') {
      const keratometryData = measurement.data.keratometry;
      if (keratometryData) {
        setData(prev => ({
          ...prev,
          keratometry: {
            OD: {
              k1: {
                power: keratometryData.OD?.k1?.power || 0,
                axis: keratometryData.OD?.k1?.axis || 0
              },
              k2: {
                power: keratometryData.OD?.k2?.power || 0,
                axis: keratometryData.OD?.k2?.axis || 0
              },
              astigmatism: Math.abs(
                (keratometryData.OD?.k1?.power || 0) - (keratometryData.OD?.k2?.power || 0)
              ).toFixed(2)
            },
            OS: {
              k1: {
                power: keratometryData.OS?.k1?.power || 0,
                axis: keratometryData.OS?.k1?.axis || 0
              },
              k2: {
                power: keratometryData.OS?.k2?.power || 0,
                axis: keratometryData.OS?.k2?.axis || 0
              },
              astigmatism: Math.abs(
                (keratometryData.OS?.k1?.power || 0) - (keratometryData.OS?.k2?.power || 0)
              ).toFixed(2)
            },
            sourceDevice: measurement.device?._id,
            sourceMeasurement: measurement._id,
            importedAt: measurement.measurementDate
          }
        }));
        setShowDeviceImport(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Kératométrie
        </h2>
        {hasPreviousExam && (
          <button
            onClick={handleCopyPrevious}
            disabled={loadingPrevious}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-300 flex items-center gap-2"
            title="Copier les valeurs du dernier examen"
          >
            <History className="h-4 w-4" />
            Copier précédent
          </button>
        )}
      </div>

      {/* Eye Selector */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setSelectedEye('OD')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OD' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Œil Droit (OD)
        </button>
        <button
          onClick={() => setSelectedEye('OS')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OS' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Œil Gauche (OS)
        </button>
        {examId && patientId && (
          <button
            onClick={() => setShowDeviceImport(!showDeviceImport)}
            className="ml-auto flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <HardDrive className="w-4 h-4 mr-2" />
            {showDeviceImport ? 'Masquer' : 'Importer depuis Appareil'}
          </button>
        )}
      </div>

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
      {data.keratometry?.sourceDevice && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">
              Données importées depuis un kératomètre
            </p>
            <p className="text-xs text-green-700">
              Mesure effectuée le: {new Date(data.keratometry?.importedAt || Date.now()).toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
      )}

      {/* Keratometry Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* K1 (Flat Meridian) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">K1 - Méridien Plat</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Puissance (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.keratometry[selectedEye].k1.power}
                onChange={(e) => updateKeratometry(selectedEye, 'k1', 'power', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Axe (°)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={data.keratometry[selectedEye].k1.axis}
                onChange={(e) => updateKeratometry(selectedEye, 'k1', 'axis', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Rayon de courbure: {(337.5 / (data.keratometry[selectedEye].k1.power || 1)).toFixed(2)} mm
          </div>
        </div>

        {/* K2 (Steep Meridian) */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">K2 - Méridien Cambré</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Puissance (D)</label>
              <input
                type="number"
                step="0.25"
                value={data.keratometry[selectedEye].k2.power}
                onChange={(e) => updateKeratometry(selectedEye, 'k2', 'power', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Axe (°)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={data.keratometry[selectedEye].k2.axis}
                onChange={(e) => updateKeratometry(selectedEye, 'k2', 'axis', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Rayon de courbure: {(337.5 / (data.keratometry[selectedEye].k2.power || 1)).toFixed(2)} mm
          </div>
        </div>
      </div>

      {/* Astigmatism Calculation */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-medium mb-3">Astigmatisme Cornéen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Œil Droit (OD)</p>
            <p className="text-lg font-medium">
              {calculateAstigmatism('OD').magnitude}D
              <span className={`ml-2 text-sm px-2 py-1 rounded ${
                calculateAstigmatism('OD').type === 'Faible' ? 'bg-green-100 text-green-700' :
                calculateAstigmatism('OD').type === 'Modéré' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {calculateAstigmatism('OD').type}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Axe: {calculateAstigmatism('OD').axis}°
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Œil Gauche (OS)</p>
            <p className="text-lg font-medium">
              {calculateAstigmatism('OS').magnitude}D
              <span className={`ml-2 text-sm px-2 py-1 rounded ${
                calculateAstigmatism('OS').type === 'Faible' ? 'bg-green-100 text-green-700' :
                calculateAstigmatism('OS').type === 'Modéré' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {calculateAstigmatism('OS').type}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Axe: {calculateAstigmatism('OS').axis}°
            </p>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Œil</th>
              <th className="px-4 py-2 text-center">K1 (D)</th>
              <th className="px-4 py-2 text-center">K1 Axe</th>
              <th className="px-4 py-2 text-center">K2 (D)</th>
              <th className="px-4 py-2 text-center">K2 Axe</th>
              <th className="px-4 py-2 text-center">Astigmatisme</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-4 py-2 font-medium">OD</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OD.k1.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OD.k1.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OD.k2.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OD.k2.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OD.astigmatism}D</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-2 font-medium">OS</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OS.k1.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OS.k1.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OS.k2.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OS.k2.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry?.OS.astigmatism}D</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Clinical Notes */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes Cliniques
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
          placeholder="Régularité cornéenne, kératocône suspect, etc..."
        />
      </div>
    </div>
  );
}