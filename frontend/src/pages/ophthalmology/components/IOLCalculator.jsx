import { useState } from 'react';
import {
  Calculator,
  Eye,
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import api from '../../../services/apiConfig';

export default function IOLCalculator({ patientId, examId, biometryData, onCalculationComplete }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedEye, setSelectedEye] = useState('OD');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    axialLength: biometryData?.axialLength || '',
    keratometry: {
      K1: biometryData?.keratometry?.K1 || '',
      K2: biometryData?.keratometry?.K2 || ''
    },
    acd: biometryData?.acd || '',
    targetRefraction: -0.25,
    aConstant: 118.4,
    formula: 'SRK_T',
    lensType: 'monofocal'
  });

  const formulas = [
    { id: 'SRK_T', name: 'SRK/T', description: 'Standard pour yeux normaux' },
    { id: 'HOFFER_Q', name: 'Hoffer Q', description: 'Meilleur pour yeux courts (<22mm)' },
    { id: 'HOLLADAY_1', name: 'Holladay 1', description: 'Bon compromis' },
    { id: 'HAIGIS', name: 'Haigis', description: 'Utilise la ACD mesurée' }
  ];

  const commonIOLs = [
    { name: 'Alcon AcrySof SA60AT', aConstant: 118.4 },
    { name: 'Alcon AcrySof SN60WF', aConstant: 118.7 },
    { name: 'J&J Tecnis ZCB00', aConstant: 119.3 },
    { name: 'B+L enVista MX60', aConstant: 119.1 },
    { name: 'Zeiss CT Lucia', aConstant: 118.3 }
  ];

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateKeratometry = (field, value) => {
    setFormData(prev => ({
      ...prev,
      keratometry: {
        ...prev.keratometry,
        [field]: parseFloat(value) || ''
      }
    }));
  };

  const calculateIOL = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        eye: selectedEye,
        axialLength: parseFloat(formData.axialLength),
        keratometry: {
          K1: parseFloat(formData.keratometry.K1),
          K2: parseFloat(formData.keratometry.K2)
        },
        acd: formData.acd ? parseFloat(formData.acd) : undefined,
        targetRefraction: parseFloat(formData.targetRefraction),
        aConstant: parseFloat(formData.aConstant),
        formula: formData.formula
      };

      const endpoint = examId
        ? `/ophthalmology/exams/${examId}/iol-calculation`
        : `/ophthalmology/patients/${patientId}/iol-calculation`;

      const response = await api.post(endpoint, payload);
      setResults(response.data.data);

      if (onCalculationComplete) {
        onCalculationComplete(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du calcul');
    } finally {
      setLoading(false);
    }
  };

  const isValidInput = () => {
    return formData.axialLength &&
           formData.keratometry.K1 &&
           formData.keratometry.K2 &&
           formData.aConstant &&
           parseFloat(formData.axialLength) >= 20 &&
           parseFloat(formData.axialLength) <= 35 &&
           parseFloat(formData.keratometry.K1) >= 35 &&
           parseFloat(formData.keratometry.K1) <= 52;
  };

  const getALCategory = (al) => {
    if (!al) return null;
    if (al < 22) return { text: 'Court', color: 'yellow', recommendation: 'Hoffer Q recommandé' };
    if (al > 26) return { text: 'Long', color: 'yellow', recommendation: 'SRK/T recommandé' };
    return { text: 'Normal', color: 'green', recommendation: null };
  };

  const alCategory = getALCategory(parseFloat(formData.axialLength));

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Calculator className="w-5 h-5 mr-2 text-indigo-600" />
        Calculateur IOL
      </h2>

      {/* Eye Selection */}
      <div className="flex gap-2 mb-6">
        {['OD', 'OS'].map(eye => (
          <button
            key={eye}
            onClick={() => setSelectedEye(eye)}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              selectedEye === eye
                ? eye === 'OD' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            {eye === 'OD' ? 'Œil Droit' : 'Œil Gauche'}
          </button>
        ))}
      </div>

      {/* Biometry Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Axial Length */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Longueur Axiale (mm) *
          </label>
          <input
            type="number"
            step="0.01"
            min="18"
            max="40"
            value={formData.axialLength}
            onChange={(e) => updateFormData('axialLength', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="23.50"
          />
          {alCategory && (
            <div className={`mt-1 text-xs ${
              alCategory.color === 'yellow' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {alCategory.text}
              {alCategory.recommendation && ` - ${alCategory.recommendation}`}
            </div>
          )}
        </div>

        {/* ACD */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Profondeur Chambre Antérieure (mm)
          </label>
          <input
            type="number"
            step="0.01"
            min="2"
            max="5"
            value={formData.acd}
            onChange={(e) => updateFormData('acd', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="3.20"
          />
          <p className="mt-1 text-xs text-gray-500">Requis pour Haigis</p>
        </div>

        {/* Keratometry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            K1 (Kératométrie plate) (D) *
          </label>
          <input
            type="number"
            step="0.01"
            min="30"
            max="55"
            value={formData.keratometry.K1}
            onChange={(e) => updateKeratometry('K1', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="43.25"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            K2 (Kératométrie cambrée) (D) *
          </label>
          <input
            type="number"
            step="0.01"
            min="30"
            max="55"
            value={formData.keratometry.K2}
            onChange={(e) => updateKeratometry('K2', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="44.00"
          />
        </div>
      </div>

      {/* Target Refraction & Formula */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Réfraction Cible (D)
          </label>
          <select
            value={formData.targetRefraction}
            onChange={(e) => updateFormData('targetRefraction', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="0">Emmétrope (0.00)</option>
            <option value="-0.25">Mini-monovision (-0.25)</option>
            <option value="-0.5">Légère myopie (-0.50)</option>
            <option value="-1.0">Monovision (-1.00)</option>
            <option value="-1.5">Monovision forte (-1.50)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Formule de Calcul
          </label>
          <select
            value={formData.formula}
            onChange={(e) => updateFormData('formula', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {formulas.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {formulas.find(f => f.id === formData.formula)?.description}
          </p>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Options avancées
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Constante A
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.aConstant}
                  onChange={(e) => updateFormData('aConstant', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IOL Prédéfinie
                </label>
                <select
                  onChange={(e) => {
                    const iol = commonIOLs.find(i => i.name === e.target.value);
                    if (iol) updateFormData('aConstant', iol.aConstant);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner une IOL...</option>
                  {commonIOLs.map(iol => (
                    <option key={iol.name} value={iol.name}>
                      {iol.name} (A={iol.aConstant})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de Lentille
                </label>
                <select
                  value={formData.lensType}
                  onChange={(e) => updateFormData('lensType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="monofocal">Monofocale</option>
                  <option value="multifocal">Multifocale</option>
                  <option value="toric">Torique</option>
                  <option value="edof">EDOF</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateIOL}
        disabled={!isValidInput() || loading}
        className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
          isValidInput() && !loading
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Calcul en cours...
          </>
        ) : (
          <>
            <Calculator className="w-5 h-5" />
            Calculer la Puissance IOL
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            Résultats du Calcul
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-600">Puissance IOL Recommandée</p>
              <p className="text-3xl font-bold text-indigo-600">
                {results.recommendedPower?.toFixed(1) || results.power?.toFixed(1)} D
              </p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-600">Réfraction Post-op Prédite</p>
              <p className="text-2xl font-bold text-indigo-600">
                {results.predictedRefraction?.toFixed(2) || '0.00'} D
              </p>
            </div>
          </div>

          {/* Power Options */}
          {results.powerOptions && results.powerOptions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Options de Puissance:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Puissance</th>
                      <th className="text-center py-2">Réfraction Prédite</th>
                      <th className="text-center py-2">Écart Cible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.powerOptions.map((opt, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${opt.isRecommended ? 'bg-indigo-100' : ''}`}
                      >
                        <td className="py-2 flex items-center gap-2">
                          {opt.power.toFixed(1)} D
                          {opt.isRecommended && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {opt.predictedRefraction >= 0 ? '+' : ''}
                          {opt.predictedRefraction.toFixed(2)} D
                        </td>
                        <td className="text-center py-2">
                          {Math.abs(opt.predictedRefraction - formData.targetRefraction).toFixed(2)} D
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Formula Used */}
          <div className="mt-4 pt-4 border-t border-indigo-200 text-sm text-gray-600">
            <p>Formule: {formulas.find(f => f.id === formData.formula)?.name}</p>
            <p>Constante A: {formData.aConstant}</p>
            <p>K moyen: {((parseFloat(formData.keratometry.K1) + parseFloat(formData.keratometry.K2)) / 2).toFixed(2)} D</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-500 text-center">
        Ces calculs sont fournis à titre indicatif. Toujours vérifier avec les
        formules de référence et l'expérience clinique.
      </p>
    </div>
  );
}
