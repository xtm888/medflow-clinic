import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function VisualAcuityStep({ data, setData }) {
  const [selectedEye, setSelectedEye] = useState('OD');
  const [testDistance, setTestDistance] = useState('distance');

  // Snellen chart values
  const snellenValues = [
    'CF', 'HM', 'LP', 'NLP',
    '20/200', '20/160', '20/125', '20/100', '20/80',
    '20/63', '20/50', '20/40', '20/32', '20/25',
    '20/20', '20/16', '20/12.5', '20/10'
  ];

  const updateVA = (eye, test, type, value) => {
    setData(prev => ({
      ...prev,
      visualAcuity: {
        ...prev.visualAcuity,
        [test]: {
          ...prev.visualAcuity[test],
          [eye]: {
            ...prev.visualAcuity[test][eye],
            [type]: value
          }
        }
      }
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Eye className="w-5 h-5 mr-2 text-blue-600" />
        Mesure de l'Acuité Visuelle
      </h2>

      {/* Eye Selector */}
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setSelectedEye('OD')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OD' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Œil Droit (OD)
        </button>
        <button
          onClick={() => setSelectedEye('OS')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OS' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Œil Gauche (OS)
        </button>
        <button
          onClick={() => setSelectedEye('OU')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OU' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Binoculaire (OU)
        </button>
      </div>

      {/* Test Type Selector */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setTestDistance('distance')}
          className={`px-4 py-2 rounded transition-colors ${
            testDistance === 'distance' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Vision de Loin (6m)
        </button>
        <button
          onClick={() => setTestDistance('near')}
          className={`px-4 py-2 rounded transition-colors ${
            testDistance === 'near' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Vision de Près (40cm)
        </button>
      </div>

      {/* Visual Acuity Grid */}
      {selectedEye !== 'OU' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Unaided VA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sans Correction
            </label>
            <select
              value={data.visualAcuity[testDistance][selectedEye].unaided}
              onChange={(e) => updateVA(selectedEye, testDistance, 'unaided', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner</option>
              <optgroup label="Basse Vision">
                <option value="CF">CF - Compte les Doigts</option>
                <option value="HM">HM - Mouvements de Main</option>
                <option value="LP">LP - Perception Lumineuse</option>
                <option value="NLP">NLP - Pas de Perception</option>
              </optgroup>
              <optgroup label="Snellen">
                {snellenValues.filter(v => v.includes('/')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Pinhole VA (distance only) */}
          {testDistance === 'distance' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trou Sténopéique
              </label>
              <select
                value={data.visualAcuity[testDistance][selectedEye].pinhole}
                onChange={(e) => updateVA(selectedEye, testDistance, 'pinhole', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
                {snellenValues.filter(v => v.includes('/')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              {/* Show improvement indicator */}
              {data.visualAcuity[testDistance][selectedEye].pinhole &&
               data.visualAcuity[testDistance][selectedEye].unaided && (
                <p className="text-xs mt-1 text-green-600">
                  {parseInt(data.visualAcuity[testDistance][selectedEye].pinhole.split('/')[1]) <
                   parseInt(data.visualAcuity[testDistance][selectedEye].unaided.split('/')[1])
                    ? '✓ Amélioration avec trou sténopéique' : ''}
                </p>
              )}
            </div>
          )}

          {/* Best Corrected VA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avec Correction
            </label>
            <select
              value={data.visualAcuity[testDistance][selectedEye].corrected}
              onChange={(e) => updateVA(selectedEye, testDistance, 'corrected', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner</option>
              {snellenValues.filter(v => v.includes('/')).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Summary Display */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3">Résumé de l'Acuité Visuelle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2 text-blue-600" />
              Œil Droit (OD)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de loin sans correction:</span>
                <span className="font-medium">{data.visualAcuity.distance.OD.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trou sténopéique:</span>
                <span className="font-medium">{data.visualAcuity.distance.OD.pinhole || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity.distance.OD.corrected || '-'}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de près sans correction:</span>
                <span className="font-medium">{data.visualAcuity.near.OD.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de près avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity.near.OD.corrected || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2 text-blue-600" />
              Œil Gauche (OS)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de loin sans correction:</span>
                <span className="font-medium">{data.visualAcuity.distance.OS.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Trou sténopéique:</span>
                <span className="font-medium">{data.visualAcuity.distance.OS.pinhole || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity.distance.OS.corrected || '-'}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de près sans correction:</span>
                <span className="font-medium">{data.visualAcuity.near.OS.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Vision de près avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity.near.OS.corrected || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes Cliniques
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="2"
            placeholder="Observations sur l'acuité visuelle..."
          />
        </div>
      </div>
    </div>
  );
}