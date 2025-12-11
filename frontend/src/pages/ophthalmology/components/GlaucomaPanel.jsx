import { useState, useEffect } from 'react';
import {
  Eye,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Target,
  BarChart3,
  Clock,
  FileText
} from 'lucide-react';
import api from '../../../services/apiConfig';

export default function GlaucomaPanel({ patientId, examId, data, onChange }) {
  const [progressionData, setProgressionData] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tonometry');

  // Initialize data structures
  useEffect(() => {
    if (!data.tonometry) {
      onChange(prev => ({
        ...prev,
        tonometry: {
          method: 'goldmann',
          OD: { iop: '', time: '' },
          OS: { iop: '', time: '' },
          cct: { OD: '', OS: '' },
          correctedIOP: { OD: '', OS: '' }
        }
      }));
    }
    if (!data.visualField) {
      onChange(prev => ({
        ...prev,
        visualField: {
          testType: 'humphrey-24-2',
          OD: { md: '', psd: '', vfi: '', ght: '', reliability: 'good' },
          OS: { md: '', psd: '', vfi: '', ght: '', reliability: 'good' },
          interpretation: ''
        }
      }));
    }
    if (!data.gonioscopy) {
      onChange(prev => ({
        ...prev,
        gonioscopy: {
          OD: { superior: 'open', inferior: 'open', nasal: 'open', temporal: 'open' },
          OS: { superior: 'open', inferior: 'open', nasal: 'open', temporal: 'open' },
          notes: ''
        }
      }));
    }
  }, []);

  // Fetch progression data
  useEffect(() => {
    if (patientId) {
      fetchProgressionData();
    }
  }, [patientId]);

  const fetchProgressionData = async () => {
    setLoading(true);
    try {
      const [progressRes, recsRes] = await Promise.all([
        api.get(`/ophthalmology/patients/${patientId}/progression`),
        api.get(`/ophthalmology/patients/${patientId}/treatment-recommendations`)
      ]);
      setProgressionData(progressRes.data.data);
      setRecommendations(recsRes.data.data);
    } catch (error) {
      console.error('Error fetching glaucoma data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTonometry = (eye, field, value) => {
    onChange(prev => ({
      ...prev,
      tonometry: {
        ...prev.tonometry,
        [eye]: {
          ...(prev.tonometry?.[eye] || {}),
          [field]: field === 'iop' ? parseFloat(value) || '' : value
        }
      }
    }));
  };

  const updateVisualField = (eye, field, value) => {
    onChange(prev => ({
      ...prev,
      visualField: {
        ...prev.visualField,
        [eye]: {
          ...(prev.visualField?.[eye] || {}),
          [field]: value
        }
      }
    }));
  };

  const updateGonioscopy = (eye, quadrant, value) => {
    onChange(prev => ({
      ...prev,
      gonioscopy: {
        ...prev.gonioscopy,
        [eye]: {
          ...(prev.gonioscopy?.[eye] || {}),
          [quadrant]: value
        }
      }
    }));
  };

  const calculateCorrectedIOP = (iop, cct) => {
    if (!iop || !cct) return null;
    // Simplified IOP correction: subtract 2.5 mmHg for every 50 microns above 545
    const correction = ((cct - 545) / 50) * 2.5;
    return (iop - correction).toFixed(1);
  };

  // Auto-calculate corrected IOP
  useEffect(() => {
    if (data.tonometry?.OD?.iop && data.tonometry?.cct?.OD) {
      const corrected = calculateCorrectedIOP(data.tonometry.OD.iop, data.tonometry.cct.OD);
      if (corrected !== data.tonometry?.correctedIOP?.OD) {
        onChange(prev => ({
          ...prev,
          tonometry: {
            ...prev.tonometry,
            correctedIOP: {
              ...prev.tonometry?.correctedIOP,
              OD: corrected
            }
          }
        }));
      }
    }
    if (data.tonometry?.OS?.iop && data.tonometry?.cct?.OS) {
      const corrected = calculateCorrectedIOP(data.tonometry.OS.iop, data.tonometry.cct.OS);
      if (corrected !== data.tonometry?.correctedIOP?.OS) {
        onChange(prev => ({
          ...prev,
          tonometry: {
            ...prev.tonometry,
            correctedIOP: {
              ...prev.tonometry?.correctedIOP,
              OS: corrected
            }
          }
        }));
      }
    }
  }, [data.tonometry?.OD?.iop, data.tonometry?.OS?.iop, data.tonometry?.cct?.OD, data.tonometry?.cct?.OS]);

  const getIOPRiskLevel = (iop) => {
    if (!iop) return null;
    if (iop > 21) return { level: 'high', color: 'red', text: 'Élevé' };
    if (iop > 18) return { level: 'moderate', color: 'yellow', text: 'Limite' };
    return { level: 'normal', color: 'green', text: 'Normal' };
  };

  const getMDRiskLevel = (md) => {
    if (!md) return null;
    const val = parseFloat(md);
    if (val < -12) return { level: 'severe', color: 'red', text: 'Sévère' };
    if (val < -6) return { level: 'moderate', color: 'yellow', text: 'Modéré' };
    if (val < -2) return { level: 'mild', color: 'orange', text: 'Léger' };
    return { level: 'normal', color: 'green', text: 'Normal' };
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-purple-600" />
        Suivi Glaucome
      </h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 flex-wrap border-b pb-4">
        {[
          { id: 'tonometry', label: 'Tonométrie', icon: Target },
          { id: 'visualfield', label: 'Champ Visuel', icon: Eye },
          { id: 'gonioscopy', label: 'Gonioscopie', icon: Activity },
          { id: 'progression', label: 'Progression', icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tonometry Tab */}
      {activeTab === 'tonometry' && (
        <div className="space-y-6">
          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Méthode de Mesure
            </label>
            <select
              value={data.tonometry?.method || 'goldmann'}
              onChange={(e) => onChange(prev => ({
                ...prev,
                tonometry: { ...prev.tonometry, method: e.target.value }
              }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="goldmann">Goldmann (Aplanation)</option>
              <option value="tonopen">Tono-Pen</option>
              <option value="icare">iCare (Rebound)</option>
              <option value="pneumatic">Pneumotonométrie</option>
              <option value="nct">Air Puff (NCT)</option>
            </select>
          </div>

          {/* IOP Measurements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OD */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Œil Droit (OD)
              </h4>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">PIO (mmHg)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="5"
                      max="60"
                      value={data.tonometry?.OD?.iop || ''}
                      onChange={(e) => updateTonometry('OD', 'iop', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {data.tonometry?.OD?.iop && (
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                        getIOPRiskLevel(data.tonometry.OD.iop)?.color === 'red' ? 'bg-red-100 text-red-700' :
                        getIOPRiskLevel(data.tonometry.OD.iop)?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {getIOPRiskLevel(data.tonometry.OD.iop)?.text}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Heure</label>
                    <input
                      type="time"
                      value={data.tonometry?.OD?.time || ''}
                      onChange={(e) => updateTonometry('OD', 'time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">CCT (μm)</label>
                  <input
                    type="number"
                    min="400"
                    max="700"
                    value={data.tonometry?.cct?.OD || ''}
                    onChange={(e) => onChange(prev => ({
                      ...prev,
                      tonometry: {
                        ...prev.tonometry,
                        cct: { ...prev.tonometry?.cct, OD: parseFloat(e.target.value) || '' }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {data.tonometry?.correctedIOP?.OD && (
                  <div className="bg-white p-2 rounded border">
                    <span className="text-sm text-gray-600">PIO Corrigée: </span>
                    <span className="font-medium">{data.tonometry.correctedIOP.OD} mmHg</span>
                  </div>
                )}
              </div>
            </div>

            {/* OS */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Œil Gauche (OS)
              </h4>
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">PIO (mmHg)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="5"
                      max="60"
                      value={data.tonometry?.OS?.iop || ''}
                      onChange={(e) => updateTonometry('OS', 'iop', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {data.tonometry?.OS?.iop && (
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                        getIOPRiskLevel(data.tonometry.OS.iop)?.color === 'red' ? 'bg-red-100 text-red-700' :
                        getIOPRiskLevel(data.tonometry.OS.iop)?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {getIOPRiskLevel(data.tonometry.OS.iop)?.text}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Heure</label>
                    <input
                      type="time"
                      value={data.tonometry?.OS?.time || ''}
                      onChange={(e) => updateTonometry('OS', 'time', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">CCT (μm)</label>
                  <input
                    type="number"
                    min="400"
                    max="700"
                    value={data.tonometry?.cct?.OS || ''}
                    onChange={(e) => onChange(prev => ({
                      ...prev,
                      tonometry: {
                        ...prev.tonometry,
                        cct: { ...prev.tonometry?.cct, OS: parseFloat(e.target.value) || '' }
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {data.tonometry?.correctedIOP?.OS && (
                  <div className="bg-white p-2 rounded border">
                    <span className="text-sm text-gray-600">PIO Corrigée: </span>
                    <span className="font-medium">{data.tonometry.correctedIOP.OS} mmHg</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* IOP Target */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3">PIO Cible</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">OD (mmHg)</label>
                <input
                  type="number"
                  min="8"
                  max="21"
                  value={data.tonometry?.target?.OD || ''}
                  onChange={(e) => onChange(prev => ({
                    ...prev,
                    tonometry: {
                      ...prev.tonometry,
                      target: { ...prev.tonometry?.target, OD: parseFloat(e.target.value) || '' }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">OS (mmHg)</label>
                <input
                  type="number"
                  min="8"
                  max="21"
                  value={data.tonometry?.target?.OS || ''}
                  onChange={(e) => onChange(prev => ({
                    ...prev,
                    tonometry: {
                      ...prev.tonometry,
                      target: { ...prev.tonometry?.target, OS: parseFloat(e.target.value) || '' }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Field Tab */}
      {activeTab === 'visualfield' && (
        <div className="space-y-6">
          {/* Test Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de Test
            </label>
            <select
              value={data.visualField?.testType || 'humphrey-24-2'}
              onChange={(e) => onChange(prev => ({
                ...prev,
                visualField: { ...prev.visualField, testType: e.target.value }
              }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="humphrey-24-2">Humphrey 24-2</option>
              <option value="humphrey-10-2">Humphrey 10-2</option>
              <option value="humphrey-30-2">Humphrey 30-2</option>
              <option value="octopus">Octopus</option>
              <option value="goldmann">Goldman Kinétique</option>
              <option value="fdt">FDT (Frequency Doubling)</option>
            </select>
          </div>

          {/* VF Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OD */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Œil Droit (OD)
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">MD (dB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.visualField?.OD?.md || ''}
                      onChange={(e) => updateVisualField('OD', 'md', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="-2.50"
                    />
                    {data.visualField?.OD?.md && (
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                        getMDRiskLevel(data.visualField.OD.md)?.color === 'red' ? 'bg-red-100 text-red-700' :
                        getMDRiskLevel(data.visualField.OD.md)?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        getMDRiskLevel(data.visualField.OD.md)?.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {getMDRiskLevel(data.visualField.OD.md)?.text}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">PSD (dB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.visualField?.OD?.psd || ''}
                      onChange={(e) => updateVisualField('OD', 'psd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1.50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">VFI (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={data.visualField?.OD?.vfi || ''}
                      onChange={(e) => updateVisualField('OD', 'vfi', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="98"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">GHT</label>
                    <select
                      value={data.visualField?.OD?.ght || ''}
                      onChange={(e) => updateVisualField('OD', 'ght', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">--</option>
                      <option value="WNL">Dans limites normales</option>
                      <option value="borderline">Limite</option>
                      <option value="ONL">Hors limites normales</option>
                      <option value="GHS">Suspecté de glaucome</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fiabilité</label>
                  <select
                    value={data.visualField?.OD?.reliability || 'good'}
                    onChange={(e) => updateVisualField('OD', 'reliability', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="excellent">Excellente</option>
                    <option value="good">Bonne</option>
                    <option value="moderate">Modérée</option>
                    <option value="poor">Faible</option>
                    <option value="unreliable">Non fiable</option>
                  </select>
                </div>
              </div>
            </div>

            {/* OS */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Œil Gauche (OS)
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">MD (dB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.visualField?.OS?.md || ''}
                      onChange={(e) => updateVisualField('OS', 'md', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="-2.50"
                    />
                    {data.visualField?.OS?.md && (
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${
                        getMDRiskLevel(data.visualField.OS.md)?.color === 'red' ? 'bg-red-100 text-red-700' :
                        getMDRiskLevel(data.visualField.OS.md)?.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        getMDRiskLevel(data.visualField.OS.md)?.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {getMDRiskLevel(data.visualField.OS.md)?.text}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">PSD (dB)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={data.visualField?.OS?.psd || ''}
                      onChange={(e) => updateVisualField('OS', 'psd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1.50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">VFI (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={data.visualField?.OS?.vfi || ''}
                      onChange={(e) => updateVisualField('OS', 'vfi', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="98"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">GHT</label>
                    <select
                      value={data.visualField?.OS?.ght || ''}
                      onChange={(e) => updateVisualField('OS', 'ght', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">--</option>
                      <option value="WNL">Dans limites normales</option>
                      <option value="borderline">Limite</option>
                      <option value="ONL">Hors limites normales</option>
                      <option value="GHS">Suspecté de glaucome</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fiabilité</label>
                  <select
                    value={data.visualField?.OS?.reliability || 'good'}
                    onChange={(e) => updateVisualField('OS', 'reliability', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="excellent">Excellente</option>
                    <option value="good">Bonne</option>
                    <option value="moderate">Modérée</option>
                    <option value="poor">Faible</option>
                    <option value="unreliable">Non fiable</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interprétation
            </label>
            <textarea
              value={data.visualField?.interpretation || ''}
              onChange={(e) => onChange(prev => ({
                ...prev,
                visualField: { ...prev.visualField, interpretation: e.target.value }
              }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Décrire les déficits du champ visuel..."
            />
          </div>
        </div>
      )}

      {/* Gonioscopy Tab */}
      {activeTab === 'gonioscopy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OD */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Œil Droit (OD)</h4>
              <div className="grid grid-cols-2 gap-3">
                {['superior', 'inferior', 'nasal', 'temporal'].map(quadrant => (
                  <div key={quadrant}>
                    <label className="block text-sm text-gray-600 mb-1 capitalize">
                      {quadrant === 'superior' ? 'Supérieur' :
                       quadrant === 'inferior' ? 'Inférieur' :
                       quadrant === 'nasal' ? 'Nasal' : 'Temporal'}
                    </label>
                    <select
                      value={data.gonioscopy?.OD?.[quadrant] || 'open'}
                      onChange={(e) => updateGonioscopy('OD', quadrant, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="grade4">Grade 4 - Ouvert</option>
                      <option value="grade3">Grade 3</option>
                      <option value="grade2">Grade 2</option>
                      <option value="grade1">Grade 1</option>
                      <option value="grade0">Grade 0 - Fermé</option>
                      <option value="open">Ouvert</option>
                      <option value="narrow">Étroit</option>
                      <option value="closed">Fermé</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* OS */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-3">Œil Gauche (OS)</h4>
              <div className="grid grid-cols-2 gap-3">
                {['superior', 'inferior', 'nasal', 'temporal'].map(quadrant => (
                  <div key={quadrant}>
                    <label className="block text-sm text-gray-600 mb-1 capitalize">
                      {quadrant === 'superior' ? 'Supérieur' :
                       quadrant === 'inferior' ? 'Inférieur' :
                       quadrant === 'nasal' ? 'Nasal' : 'Temporal'}
                    </label>
                    <select
                      value={data.gonioscopy?.OS?.[quadrant] || 'open'}
                      onChange={(e) => updateGonioscopy('OS', quadrant, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="grade4">Grade 4 - Ouvert</option>
                      <option value="grade3">Grade 3</option>
                      <option value="grade2">Grade 2</option>
                      <option value="grade1">Grade 1</option>
                      <option value="grade0">Grade 0 - Fermé</option>
                      <option value="open">Ouvert</option>
                      <option value="narrow">Étroit</option>
                      <option value="closed">Fermé</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={data.gonioscopy?.notes || ''}
              onChange={(e) => onChange(prev => ({
                ...prev,
                gonioscopy: { ...prev.gonioscopy, notes: e.target.value }
              }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Synéchies, pigmentation, néovascularisation..."
            />
          </div>
        </div>
      )}

      {/* Progression Tab */}
      {activeTab === 'progression' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-gray-500">Chargement des données...</p>
            </div>
          ) : progressionData ? (
            <>
              {/* IOP History */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-4 flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Historique PIO
                </h4>
                {progressionData.iopHistory?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Date</th>
                          <th className="text-center py-2">OD</th>
                          <th className="text-center py-2">OS</th>
                          <th className="text-left py-2">Méthode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressionData.iopHistory.slice(0, 10).map((entry, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2">{new Date(entry.date).toLocaleDateString('fr-FR')}</td>
                            <td className="text-center py-2">
                              <span className={entry.OD?.iop > 21 ? 'text-red-600 font-medium' : ''}>
                                {entry.OD?.iop || '-'}
                              </span>
                            </td>
                            <td className="text-center py-2">
                              <span className={entry.OS?.iop > 21 ? 'text-red-600 font-medium' : ''}>
                                {entry.OS?.iop || '-'}
                              </span>
                            </td>
                            <td className="py-2">{entry.method || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Aucun historique de PIO disponible</p>
                )}
              </div>

              {/* VF History */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-4 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Historique Champ Visuel
                </h4>
                {progressionData.vfHistory?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Date</th>
                          <th className="text-center py-2">MD OD</th>
                          <th className="text-center py-2">MD OS</th>
                          <th className="text-center py-2">VFI OD</th>
                          <th className="text-center py-2">VFI OS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressionData.vfHistory.slice(0, 10).map((entry, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2">{new Date(entry.date).toLocaleDateString('fr-FR')}</td>
                            <td className="text-center py-2">{entry.OD?.md || '-'}</td>
                            <td className="text-center py-2">{entry.OS?.md || '-'}</td>
                            <td className="text-center py-2">{entry.OD?.vfi ? `${entry.OD.vfi}%` : '-'}</td>
                            <td className="text-center py-2">{entry.OS?.vfi ? `${entry.OS.vfi}%` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Aucun historique de champ visuel disponible</p>
                )}
              </div>

              {/* Recommendations */}
              {recommendations && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-medium mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-yellow-600" />
                    Recommandations
                  </h4>
                  <div className="space-y-2">
                    {recommendations.recommendations?.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-yellow-600">•</span>
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                  {recommendations.riskFactors?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-yellow-300">
                      <p className="text-sm font-medium text-yellow-800">Facteurs de risque:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {recommendations.riskFactors.map((risk, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                            {risk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Aucune donnée de progression disponible</p>
              <p className="text-sm">Les données apparaîtront après plusieurs consultations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
