import { useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import { calculateKeratometricAstigmatism } from '../../../utils/ophthalmologyCalculations';

export default function KeratometryStep({ data, setData }) {
  const [selectedEye, setSelectedEye] = useState('OD');

  const updateKeratometry = (eye, meridian, param, value) => {
    setData(prev => ({
      ...prev,
      keratometry: {
        ...prev.keratometry,
        [eye]: {
          ...prev.keratometry[eye],
          [meridian]: {
            ...prev.keratometry[eye][meridian],
            [param]: parseFloat(value) || 0
          },
          astigmatism: Math.abs(
            (prev.keratometry[eye].k1.power || 0) - (prev.keratometry[eye].k2.power || 0)
          ).toFixed(2)
        }
      }
    }));
  };

  const calculateAstigmatism = (eye) => {
    const k1 = data.keratometry[eye].k1.power;
    const k2 = data.keratometry[eye].k2.power;
    const k1Axis = data.keratometry[eye].k1.axis;
    const k2Axis = data.keratometry[eye].k2.axis;

    return calculateKeratometricAstigmatism(k1, k1Axis, k2, k2Axis);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-blue-600" />
        Kératométrie
      </h2>

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
      </div>

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
              <td className="px-4 py-2 text-center">{data.keratometry.OD.k1.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OD.k1.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OD.k2.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OD.k2.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OD.astigmatism}D</td>
            </tr>
            <tr className="border-b">
              <td className="px-4 py-2 font-medium">OS</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OS.k1.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OS.k1.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OS.k2.power}</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OS.k2.axis}°</td>
              <td className="px-4 py-2 text-center">{data.keratometry.OS.astigmatism}D</td>
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