import { useState, useEffect } from 'react';
import { Plus, Minus, RotateCw, Check, Eye } from 'lucide-react';
import { calculateSE, validateRefraction, formatPrescription } from '../../../utils/ophthalmologyCalculations';

export default function SubjectiveRefractionStep({ data, setData }) {
  const [selectedEye, setSelectedEye] = useState('OD');
  const [refinementStep, setRefinementStep] = useState('sphere');
  const [validationErrors, setValidationErrors] = useState([]);

  // Initialize subjective data structure if not present
  if (!data.subjective) {
    data.subjective = {
      OD: { sphere: 0, cylinder: 0, axis: 0, va: '' },
      OS: { sphere: 0, cylinder: 0, axis: 0, va: '' },
      add: 0,
      binocular: { balanced: false },
      crossCylinder: {
        OD: { refined: false },
        OS: { refined: false }
      }
    };
  }

  // Start with objective refraction values
  useEffect(() => {
    if (data.objective?.OD?.sphere !== 0 || data.objective?.OS?.sphere !== 0) {
      setData(prev => ({
        ...prev,
        subjective: {
          ...prev.subjective,
          OD: { ...(prev.objective?.OD || { sphere: 0, cylinder: 0, axis: 0 }), va: '' },
          OS: { ...(prev.objective?.OS || { sphere: 0, cylinder: 0, axis: 0 }), va: '' }
        }
      }));
    }
  }, []);

  // Update refraction value
  const updateValue = (eye, parameter, increment) => {
    const currentValue = parseFloat(data.subjective?.[eye]?.[parameter]) || 0;
    let newValue;

    if (parameter === 'sphere' || parameter === 'cylinder') {
      newValue = (currentValue + increment).toFixed(2);
    } else if (parameter === 'axis') {
      newValue = ((currentValue + increment + 180) % 180) || 1;
    }

    setData(prev => ({
      ...prev,
      subjective: {
        ...prev.subjective,
        [eye]: {
          ...prev.subjective[eye],
          [parameter]: parseFloat(newValue)
        }
      }
    }));

    // Validate new values
    const errors = validateRefraction(
      data.subjective[eye].sphere,
      data.subjective[eye].cylinder,
      newValue
    );
    setValidationErrors(errors);
  };

  // Cross Cylinder Refinement
  const performCrossCylinder = (eye) => {
    setData(prev => ({
      ...prev,
      subjective: {
        ...prev.subjective,
        crossCylinder: {
          ...prev.subjective.crossCylinder,
          [eye]: {
            ...prev.subjective.crossCylinder[eye],
            refined: true
          }
        }
      }
    }));
  };

  // Duochrome/Red-Green Test
  const updateDuochrome = (eye, preference) => {
    setData(prev => ({
      ...prev,
      subjective: {
        ...prev.subjective,
        redGreen: {
          ...prev.subjective.redGreen,
          [eye]: preference
        }
      }
    }));

    // Auto-adjust sphere based on preference
    if (preference === 'red') {
      updateValue(eye, 'sphere', -0.25);
    } else if (preference === 'green') {
      updateValue(eye, 'sphere', 0.25);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Eye className="w-5 h-5 mr-2 text-blue-600" />
        Réfraction Subjective
      </h2>

      {/* Eye Selector */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setSelectedEye('OD')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OD' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Œil Droit (OD)
        </button>
        <button
          onClick={() => setSelectedEye('OS')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedEye === 'OS' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Œil Gauche (OS)
        </button>
      </div>

      {/* Refinement Steps */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          {['sphere', 'cylinder', 'axis', 'duochrome'].map(step => (
            <button
              key={step}
              onClick={() => setRefinementStep(step)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                refinementStep === step ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {step === 'sphere' ? 'Sphère' :
               step === 'cylinder' ? 'Cylindre' :
               step === 'axis' ? 'Axe' : 'Rouge-Vert'}
            </button>
          ))}
        </div>
      </div>

      {/* Refraction Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sphere Control */}
        <div className={refinementStep === 'sphere' ? 'ring-2 ring-blue-500 rounded-lg p-4' : 'p-4 border border-gray-200 rounded-lg'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sphère (D)
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => updateValue(selectedEye, 'sphere', -0.25)}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              step="0.25"
              value={data.subjective[selectedEye].sphere}
              onChange={(e) => updateValue(selectedEye, 'sphere', parseFloat(e.target.value) - data.subjective[selectedEye].sphere)}
              className="w-24 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => updateValue(selectedEye, 'sphere', 0.25)}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            ES: {calculateSE(data.subjective[selectedEye].sphere, data.subjective[selectedEye].cylinder)}D
          </div>
        </div>

        {/* Cylinder Control */}
        <div className={refinementStep === 'cylinder' ? 'ring-2 ring-blue-500 rounded-lg p-4' : 'p-4 border border-gray-200 rounded-lg'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cylindre (D)
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => updateValue(selectedEye, 'cylinder', -0.25)}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              step="0.25"
              value={data.subjective[selectedEye].cylinder}
              onChange={(e) => updateValue(selectedEye, 'cylinder', parseFloat(e.target.value) - data.subjective[selectedEye].cylinder)}
              className="w-24 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => updateValue(selectedEye, 'cylinder', 0.25)}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => performCrossCylinder(selectedEye)}
            className="mt-2 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            <RotateCw className="w-3 h-3 inline mr-1" />
            Cross-Cylindre
          </button>
        </div>

        {/* Axis Control */}
        <div className={refinementStep === 'axis' ? 'ring-2 ring-blue-500 rounded-lg p-4' : 'p-4 border border-gray-200 rounded-lg'}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Axe (°)
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => updateValue(selectedEye, 'axis', -5)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              -5°
            </button>
            <input
              type="number"
              min="1"
              max="180"
              value={data.subjective[selectedEye].axis}
              onChange={(e) => updateValue(selectedEye, 'axis', parseInt(e.target.value) - data.subjective[selectedEye].axis)}
              className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => updateValue(selectedEye, 'axis', 5)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              +5°
            </button>
          </div>
          {data.subjective?.crossCylinder?.[selectedEye]?.refined && (
            <div className="text-xs text-green-600 mt-1">
              <Check className="w-3 h-3 inline mr-1" />
              Affiné
            </div>
          )}
        </div>
      </div>

      {/* Duochrome Test */}
      {refinementStep === 'duochrome' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">Test Rouge-Vert ({selectedEye})</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => updateDuochrome(selectedEye, 'red')}
              className={`px-6 py-3 rounded ${
                data.subjective.redGreen[selectedEye] === 'red'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              }`}
            >
              Plus net sur Rouge
            </button>
            <button
              onClick={() => updateDuochrome(selectedEye, 'balanced')}
              className={`px-6 py-3 rounded ${
                data.subjective.redGreen[selectedEye] === 'balanced'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Équilibré
            </button>
            <button
              onClick={() => updateDuochrome(selectedEye, 'green')}
              className={`px-6 py-3 rounded ${
                data.subjective.redGreen[selectedEye] === 'green'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              Plus net sur Vert
            </button>
          </div>
        </div>
      )}

      {/* Visual Acuity with Correction */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Acuité avec correction ({selectedEye})
          </label>
          <select
            value={data.subjective[selectedEye].va}
            onChange={(e) => setData(prev => ({
              ...prev,
              subjective: {
                ...prev.subjective,
                [selectedEye]: {
                  ...prev.subjective[selectedEye],
                  va: e.target.value
                }
              }
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sélectionner</option>
            {['20/10', '20/12.5', '20/16', '20/20', '20/25', '20/32', '20/40', '20/50', '20/63', '20/80', '20/100'].map(va => (
              <option key={va} value={va}>{va}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          {validationErrors.map((error, idx) => (
            <p key={idx} className="text-sm text-red-600">{error.message}</p>
          ))}
        </div>
      )}

      {/* Current Prescription Summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-3">Réfraction Subjective Actuelle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">OD:</span>
            <span className="ml-2">
              {formatPrescription({ OD: data.subjective.OD }).OD}
            </span>
            {data.subjective.OD.va && (
              <span className="ml-2 text-green-600">({data.subjective.OD.va})</span>
            )}
          </div>
          <div>
            <span className="font-medium">OS:</span>
            <span className="ml-2">
              {formatPrescription({ OS: data.subjective.OS }).OS}
            </span>
            {data.subjective.OS.va && (
              <span className="ml-2 text-green-600">({data.subjective.OS.va})</span>
            )}
          </div>
        </div>
      </div>

      {/* Binocular Balance */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold mb-3">Équilibrage Binoculaire</h3>
        <div className="flex items-center gap-4">
          <label className="text-sm">Œil Dominant:</label>
          <select
            value={data.subjective?.binocular.dominantEye}
            onChange={(e) => setData(prev => ({
              ...prev,
              subjective: {
                ...prev.subjective,
                binocular: {
                  ...prev.subjective.binocular,
                  dominantEye: e.target.value
                }
              }
            }))}
            className="px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="OD">Œil Droit</option>
            <option value="OS">Œil Gauche</option>
          </select>
          <button
            onClick={() => setData(prev => ({
              ...prev,
              subjective: {
                ...prev.subjective,
                binocular: {
                  ...prev.subjective.binocular,
                  balanced: true
                }
              }
            }))}
            className={`px-3 py-1 rounded ${
              data.subjective?.binocular.balanced
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {data.subjective?.binocular.balanced ? 'Équilibré' : 'Équilibrer'}
          </button>
        </div>
      </div>
    </div>
  );
}