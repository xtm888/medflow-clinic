import { useState } from 'react';
import { Eye, EyeOff, Settings } from 'lucide-react';

export default function VisualAcuityStep({ data = {}, onChange }) {
  const [selectedEye, setSelectedEye] = useState('OD');
  const [testDistance, setTestDistance] = useState('distance');
  const [acuityScale, setAcuityScale] = useState('monoyer'); // 'monoyer' (French) or 'snellen' (US/UK)

  // Initialize visual acuity data structure if not present
  if (!data || !data.visualAcuity) {
    if (!data) data = {};
    data.visualAcuity = {
      distance: {
        OD: { unaided: '', pinhole: '', corrected: '' },
        OS: { unaided: '', pinhole: '', corrected: '' }
      },
      near: {
        OD: { unaided: '', corrected: '' },
        OS: { unaided: '', corrected: '' }
      }
    };
  }

  // French Monoyer decimal scale (standard in francophone countries)
  const monoyerValues = [
    '10/10',    // Normal vision (20/20 Snellen)
    '9/10',     // 20/22
    '8/10',     // 20/25
    '7/10',     // 20/28
    '6/10',     // 20/32
    '5/10',     // 20/40
    '4/10',     // 20/50
    '3/10',     // 20/63
    '2/10',     // 20/100
    '1/10',     // 20/200
    '1/20',     // Very low vision
  ];

  // Above normal vision (Monoyer)
  const aboveNormalMonoyer = ['12/10', '14/10', '16/10', '20/10'];

  // Snellen chart values (US/UK system)
  const snellenValues = [
    '20/20', '20/22', '20/25', '20/28', '20/32',
    '20/40', '20/50', '20/63', '20/80', '20/100',
    '20/125', '20/160', '20/200', '20/400'
  ];

  // Above normal vision (Snellen)
  const aboveNormalSnellen = ['20/16', '20/14', '20/12.5', '20/10'];

  // Low vision special values (same in both systems)
  const lowVisionValues = [
    { value: 'CLD', label: 'CLD - Compte Les Doigts', description: 'Patient compte les doigts' },
    { value: 'MDM', label: 'MDM - Mouvement De Main', description: 'Voit les mouvements de la main' },
    { value: 'PL+', label: 'PL+ - Perception Lumineuse', description: 'Perçoit la lumière' },
    { value: 'PL-', label: 'PL- - Pas de Perception', description: 'Ne perçoit pas la lumière' }
  ];

  // Near vision values (Parinaud scale - French standard)
  const nearVisionValues = [
    'P1.5', 'P2', 'P3', 'P4', 'P5', 'P6', 'P8', 'P10', 'P14', 'P20', 'P28'
  ];

  // Conversion mapping for display
  const monoyerToSnellen = {
    '20/10': '20/10', '16/10': '20/12.5', '14/10': '20/14', '12/10': '20/16',
    '10/10': '20/20', '9/10': '20/22', '8/10': '20/25', '7/10': '20/28',
    '6/10': '20/32', '5/10': '20/40', '4/10': '20/50', '3/10': '20/63',
    '2/10': '20/100', '1/10': '20/200', '1/20': '20/400'
  };

  const getEquivalent = (value) => {
    if (!value || lowVisionValues.some(lv => lv.value === value)) return '';
    if (acuityScale === 'monoyer' && monoyerToSnellen[value]) {
      return `(${monoyerToSnellen[value]} Snellen)`;
    }
    // Find Monoyer equivalent for Snellen
    const entry = Object.entries(monoyerToSnellen).find(([m, s]) => s === value);
    if (entry) return `(${entry[0]} Monoyer)`;
    return '';
  };

  const updateVA = (eye, test, type, value) => {
    onChange(prev => {
      const updatedData = { ...prev };
      if (!updatedData.visualAcuity) {
        updatedData.visualAcuity = {
          distance: {
            OD: { unaided: '', pinhole: '', corrected: '' },
            OS: { unaided: '', pinhole: '', corrected: '' }
          },
          near: {
            OD: { unaided: '', corrected: '' },
            OS: { unaided: '', corrected: '' }
          }
        };
      }
      if (!updatedData.visualAcuity[test]) {
        updatedData.visualAcuity[test] = {
          OD: test === 'distance' ? { unaided: '', pinhole: '', corrected: '' } : { unaided: '', corrected: '' },
          OS: test === 'distance' ? { unaided: '', pinhole: '', corrected: '' } : { unaided: '', corrected: '' }
        };
      }
      if (!updatedData.visualAcuity[test][eye]) {
        updatedData.visualAcuity[test][eye] = test === 'distance' ? { unaided: '', pinhole: '', corrected: '' } : { unaided: '', corrected: '' };
      }

      updatedData.visualAcuity[test][eye][type] = value;
      return updatedData;
    });
  };

  const getCurrentValues = () => {
    if (testDistance === 'near') {
      return nearVisionValues;
    }
    return acuityScale === 'monoyer'
      ? [...aboveNormalMonoyer.reverse(), ...monoyerValues]
      : [...aboveNormalSnellen.reverse(), ...snellenValues];
  };

  const renderAcuitySelect = (eye, type, label) => {
    const currentValue = data.visualAcuity?.[testDistance]?.[eye]?.[type] || '';
    const values = getCurrentValues();

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <select
          value={currentValue}
          onChange={(e) => updateVA(eye, testDistance, type, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sélectionner</option>

          {testDistance === 'distance' && (
            <>
              {/* Low Vision */}
              <optgroup label="Basse Vision">
                {lowVisionValues.map(lv => (
                  <option key={lv.value} value={lv.value}>{lv.label}</option>
                ))}
              </optgroup>

              {/* Above Normal */}
              <optgroup label={acuityScale === 'monoyer' ? 'Vision Supérieure' : 'Above Normal'}>
                {(acuityScale === 'monoyer' ? aboveNormalMonoyer : aboveNormalSnellen).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </optgroup>

              {/* Normal and Below */}
              <optgroup label={acuityScale === 'monoyer' ? 'Échelle Monoyer' : 'Snellen Scale'}>
                {(acuityScale === 'monoyer' ? monoyerValues : snellenValues).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </optgroup>
            </>
          )}

          {testDistance === 'near' && (
            <optgroup label="Échelle de Parinaud">
              {nearVisionValues.map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </optgroup>
          )}
        </select>
        {currentValue && testDistance === 'distance' && (
          <p className="text-xs mt-1 text-gray-500">{getEquivalent(currentValue)}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <Eye className="w-5 h-5 mr-2 text-blue-600" />
          Mesure de l'Acuité Visuelle
        </h2>

        {/* Scale Selector */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAcuityScale('monoyer')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              acuityScale === 'monoyer'
                ? 'bg-white text-blue-600 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monoyer (FR)
          </button>
          <button
            onClick={() => setAcuityScale('snellen')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              acuityScale === 'snellen'
                ? 'bg-white text-blue-600 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Snellen (US)
          </button>
        </div>
      </div>

      {/* Scale Info */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        {acuityScale === 'monoyer' ? (
          <p className="text-blue-800">
            <strong>Échelle Monoyer (décimale française)</strong> : 10/10 = vision normale.
            Utilisée en France, Belgique, Congo et pays francophones.
          </p>
        ) : (
          <p className="text-blue-800">
            <strong>Snellen Scale (US/UK)</strong> : 20/20 = normal vision.
            Used in English-speaking countries.
          </p>
        )}
      </div>

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
          Œil Gauche (OG)
        </button>
        <button
          onClick={() => setSelectedEye('OU')}
          className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OU' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Binoculaire (ODG)
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
          Vision de Loin (VL)
        </button>
        <button
          onClick={() => setTestDistance('near')}
          className={`px-4 py-2 rounded transition-colors ${
            testDistance === 'near' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Vision de Près (VP)
        </button>
      </div>

      {/* Visual Acuity Grid */}
      {selectedEye !== 'OU' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {renderAcuitySelect(selectedEye, 'unaided', 'Sans Correction (SC)')}

          {testDistance === 'distance' && renderAcuitySelect(selectedEye, 'pinhole', 'Trou Sténopéique (TS)')}

          {renderAcuitySelect(selectedEye, 'corrected', 'Avec Correction (AC)')}
        </div>
      )}

      {/* Binocular Summary for OU */}
      {selectedEye === 'OU' && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-center">
            La mesure binoculaire sera calculée automatiquement à partir des valeurs OD et OG
          </p>
        </div>
      )}

      {/* Summary Display */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3">Résumé de l'Acuité Visuelle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OD Summary */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2 text-blue-600" />
              Œil Droit (OD)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">VL sans correction:</span>
                <span className="font-medium">{data.visualAcuity?.distance?.OD?.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VL trou sténopéique:</span>
                <span className="font-medium">{data.visualAcuity?.distance?.OD?.pinhole || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VL avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity?.distance?.OD?.corrected || '-'}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-gray-600">VP sans correction:</span>
                <span className="font-medium">{data.visualAcuity?.near?.OD?.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VP avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity?.near?.OD?.corrected || '-'}</span>
              </div>
            </div>
          </div>

          {/* OS Summary */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2 text-blue-600" />
              Œil Gauche (OG)
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">VL sans correction:</span>
                <span className="font-medium">{data.visualAcuity?.distance?.OS?.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VL trou sténopéique:</span>
                <span className="font-medium">{data.visualAcuity?.distance?.OS?.pinhole || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VL avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity?.distance?.OS?.corrected || '-'}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-gray-600">VP sans correction:</span>
                <span className="font-medium">{data.visualAcuity?.near?.OS?.unaided || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">VP avec correction:</span>
                <span className="font-medium text-green-600">{data.visualAcuity?.near?.OS?.corrected || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Abbreviations Reference */}
        <div className="mt-4 p-3 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-500">
            <strong>Abréviations:</strong> OD = Œil Droit | OG = Œil Gauche | VL = Vision de Loin | VP = Vision de Près |
            SC = Sans Correction | AC = Avec Correction | TS = Trou Sténopéique |
            CLD = Compte Les Doigts | MDM = Mouvement De Main | PL = Perception Lumineuse
          </p>
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
            value={data.visualAcuity?.notes || ''}
            onChange={(e) => {
              onChange(prev => ({
                ...prev,
                visualAcuity: {
                  ...prev?.visualAcuity,
                  notes: e.target.value
                }
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
}
