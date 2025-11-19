import { useState } from 'react';
import { Activity, Eye, Move, AlertCircle, Image as ImageIcon } from 'lucide-react';
import DeviceImageSelector from '../../../components/DeviceImageSelector';

export default function AdditionalTestsStep({ data, setData, examId, patientId }) {
  const [selectedTest, setSelectedTest] = useState('pupils');

  const updatePupils = (eye, param, value) => {
    setData(prev => ({
      ...prev,
      pupils: {
        ...prev.pupils,
        [eye]: {
          ...prev.pupils[eye],
          [param]: param === 'size' ? parseFloat(value) : value
        }
      }
    }));
  };

  const updateMotility = (param, value) => {
    setData(prev => ({
      ...prev,
      motility: {
        ...prev.motility,
        [param]: param === 'npc' ? parseFloat(value) : value
      }
    }));
  };

  const updateCoverTest = (distance, value) => {
    setData(prev => ({
      ...prev,
      motility: {
        ...prev.motility,
        coverTest: {
          ...prev.motility.coverTest,
          [distance]: value
        }
      }
    }));
  };

  const updatePD = (param, value) => {
    setData(prev => ({
      ...prev,
      pupilDistance: {
        ...prev.pupilDistance,
        [param]: parseFloat(value) || 0
      }
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-blue-600" />
        Tests Complémentaires
      </h2>

      {/* Test Selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['pupils', 'motility', 'pd', 'covertest', 'imaging'].map(test => (
          <button
            key={test}
            onClick={() => setSelectedTest(test)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              selectedTest === test ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {test === 'imaging' && <ImageIcon className="w-4 h-4" />}
            {test === 'pupils' ? 'Pupilles' :
             test === 'motility' ? 'Motilité' :
             test === 'pd' ? 'Écart Pupillaire' :
             test === 'covertest' ? 'Cover Test' :
             'Images Appareils'}
          </button>
        ))}
      </div>

      {/* Pupils Test */}
      {selectedTest === 'pupils' && (
        <div>
          <h3 className="font-medium mb-4 flex items-center">
            <Eye className="w-4 h-4 mr-2" />
            Examen des Pupilles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OD Pupils */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Œil Droit (OD)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Taille (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={data.pupils.OD.size}
                    onChange={(e) => updatePupils('OD', 'size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Réactivité</label>
                  <select
                    value={data.pupils.OD.reaction}
                    onChange={(e) => updatePupils('OD', 'reaction', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normale</option>
                    <option value="sluggish">Paresseuse</option>
                    <option value="fixed">Fixe</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.pupils.OD.rapd}
                    onChange={(e) => updatePupils('OD', 'rapd', e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm">RAPD (Défaut pupillaire afférent relatif)</label>
                </div>
              </div>
            </div>

            {/* OS Pupils */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Œil Gauche (OS)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Taille (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={data.pupils.OS.size}
                    onChange={(e) => updatePupils('OS', 'size', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Réactivité</label>
                  <select
                    value={data.pupils.OS.reaction}
                    onChange={(e) => updatePupils('OS', 'reaction', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="normal">Normale</option>
                    <option value="sluggish">Paresseuse</option>
                    <option value="fixed">Fixe</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={data.pupils.OS.rapd}
                    onChange={(e) => updatePupils('OS', 'rapd', e.target.checked)}
                    className="mr-2"
                  />
                  <label className="text-sm">RAPD</label>
                </div>
              </div>
            </div>
          </div>

          {/* Anisocoria Alert */}
          {Math.abs(data.pupils.OD.size - data.pupils.OS.size) > 1 && (
            <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  Anisocorie détectée: Différence de {Math.abs(data.pupils.OD.size - data.pupils.OS.size)}mm
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Motility Test */}
      {selectedTest === 'motility' && (
        <div>
          <h3 className="font-medium mb-4 flex items-center">
            <Move className="w-4 h-4 mr-2" />
            Motilité Oculaire
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Versions (Mouvements conjugués)</label>
              <select
                value={data.motility.versions}
                onChange={(e) => updateMotility('versions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="full">Complète</option>
                <option value="limited">Limitée</option>
                <option value="restriction">Restriction</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Vergences</label>
              <select
                value={data.motility.vergence}
                onChange={(e) => updateMotility('vergence', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="normal">Normale</option>
                <option value="reduced">Réduite</option>
                <option value="excessive">Excessive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">PPC (Point Proche de Convergence) cm</label>
              <input
                type="number"
                min="0"
                max="30"
                value={data.motility.npc}
                onChange={(e) => updateMotility('npc', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Normal: 5-10 cm</p>
            </div>
          </div>
        </div>
      )}

      {/* Pupil Distance */}
      {selectedTest === 'pd' && (
        <div>
          <h3 className="font-medium mb-4">Écart Pupillaire (ÉP/PD)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ÉP Binoculaire (mm)</label>
              <input
                type="number"
                step="0.5"
                min="50"
                max="80"
                value={data.pupilDistance.binocular}
                onChange={(e) => updatePD('binocular', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ÉP OD (mm)</label>
              <input
                type="number"
                step="0.5"
                min="25"
                max="40"
                value={data.pupilDistance.OD}
                onChange={(e) => updatePD('OD', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">ÉP OS (mm)</label>
              <input
                type="number"
                step="0.5"
                min="25"
                max="40"
                value={data.pupilDistance.OS}
                onChange={(e) => updatePD('OS', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800">
              Vérification: OD ({data.pupilDistance.OD}mm) + OS ({data.pupilDistance.OS}mm) =
              {' '}{(parseFloat(data.pupilDistance.OD) + parseFloat(data.pupilDistance.OS)).toFixed(1)}mm
              {Math.abs((parseFloat(data.pupilDistance.OD) + parseFloat(data.pupilDistance.OS)) - parseFloat(data.pupilDistance.binocular)) < 1 ?
                <span className="text-green-600 ml-2">✓ Correct</span> :
                <span className="text-red-600 ml-2">✗ Vérifier les mesures</span>
              }
            </p>
          </div>
        </div>
      )}

      {/* Cover Test */}
      {selectedTest === 'covertest' && (
        <div>
          <h3 className="font-medium mb-4">Test de l'Écran (Cover Test)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Vision de Loin</label>
              <select
                value={data.motility.coverTest.distance}
                onChange={(e) => updateCoverTest('distance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="orthophoria">Orthophorie</option>
                <option value="esophoria">Ésophorie</option>
                <option value="exophoria">Exophorie</option>
                <option value="esotropia">Ésotropie</option>
                <option value="exotropia">Exotropie</option>
                <option value="hypertropia">Hypertropie</option>
                <option value="hypotropia">Hypotropie</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Vision de Près</label>
              <select
                value={data.motility.coverTest.near}
                onChange={(e) => updateCoverTest('near', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="orthophoria">Orthophorie</option>
                <option value="esophoria">Ésophorie</option>
                <option value="exophoria">Exophorie</option>
                <option value="esotropia">Ésotropie</option>
                <option value="exotropia">Exotropie</option>
                <option value="hypertropia">Hypertropie</option>
                <option value="hypotropia">Hypotropie</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Device Imaging */}
      {selectedTest === 'imaging' && examId && patientId && (
        <div>
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-600" />
            Images d'Appareils (OCT, Fond d'œil, etc.)
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Visualisez et liez les images capturées par les appareils d'imagerie
            (OCT, rétinographe, angiographe, etc.) à cet examen.
          </p>
          <DeviceImageSelector
            examId={examId}
            patientId={patientId}
            onImageLinked={(image) => {
              console.log('Image linked:', image);
            }}
          />
        </div>
      )}

      {selectedTest === 'imaging' && (!examId || !patientId) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Veuillez d'abord créer l'examen pour accéder aux images d'appareils
            </span>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-3">Résumé des Tests</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Pupilles:</span>
            <p className="font-medium">
              OD: {data.pupils.OD.size}mm ({data.pupils.OD.reaction})
            </p>
            <p className="font-medium">
              OS: {data.pupils.OS.size}mm ({data.pupils.OS.reaction})
            </p>
          </div>
          <div>
            <span className="text-gray-600">Motilité:</span>
            <p className="font-medium">{data.motility.versions}</p>
            <p className="font-medium">PPC: {data.motility.npc}cm</p>
          </div>
          <div>
            <span className="text-gray-600">ÉP:</span>
            <p className="font-medium">{data.pupilDistance.binocular}mm</p>
            <p className="text-xs">OD: {data.pupilDistance.OD}mm</p>
            <p className="text-xs">OS: {data.pupilDistance.OS}mm</p>
          </div>
          <div>
            <span className="text-gray-600">Cover Test:</span>
            <p className="font-medium">VL: {data.motility.coverTest.distance}</p>
            <p className="font-medium">VP: {data.motility.coverTest.near}</p>
          </div>
        </div>
      </div>
    </div>
  );
}