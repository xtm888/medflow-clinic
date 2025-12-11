import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/apiConfig';
import OfflineWarningBanner from '../components/OfflineWarningBanner';
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplet,
  User,
  Clock,
  Search,
  CheckCircle,
  RefreshCw,
  Save,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const VITAL_RANGES = {
  bloodPressure: {
    systolic: { normal: [90, 120], warning: [121, 139], critical: [140, 180] },
    diastolic: { normal: [60, 80], warning: [81, 89], critical: [90, 120] }
  },
  heartRate: { normal: [60, 100], warning: [101, 120], critical: [121, 200] },
  temperature: { normal: [36.1, 37.2], warning: [37.3, 38.0], critical: [38.1, 42.0] },
  oxygenSaturation: { normal: [95, 100], warning: [90, 94], critical: [0, 89] }
};

const NurseVitalsEntry = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [queuePatients, setQueuePatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState([]);

  const [vitals, setVitals] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    notes: ''
  });

  useEffect(() => {
    fetchQueuePatients();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (selectedPatient) {
      fetchVitalsHistory();
    }
  }, [selectedPatient]);

  const fetchQueuePatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/queue', {
        params: { status: 'waiting', limit: 20 }
      });
      const data = response.data?.data || response.data || [];
      setQueuePatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    try {
      const response = await api.get('/patients', {
        params: { search: searchTerm, limit: 10 }
      });
      const data = response.data?.data || response.data || [];
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error searching patients:', error);
    }
  };

  const fetchVitalsHistory = async () => {
    if (!selectedPatient) return;

    try {
      const response = await api.get(`/patients/${selectedPatient._id}/vitals`);
      const data = response.data?.data || response.data || [];
      setVitalsHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vitals history:', error);
      setVitalsHistory([]);
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchTerm('');
    setSearchResults([]);
    // Reset vitals form
    setVitals({
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      heartRate: '',
      temperature: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      notes: ''
    });
  };

  const handleInputChange = (field, value) => {
    setVitals(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateBMI = () => {
    if (!vitals.weight || !vitals.height) return null;
    const weight = parseFloat(vitals.weight);
    const height = parseFloat(vitals.height) / 100;
    if (weight <= 0 || height <= 0) return null;
    return (weight / (height * height)).toFixed(1);
  };

  const getBMIStatus = (bmi) => {
    if (!bmi) return null;
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: 'Insuffisance pondérale', color: 'text-blue-600' };
    if (val < 25) return { label: 'Normal', color: 'text-green-600' };
    if (val < 30) return { label: 'Surpoids', color: 'text-orange-600' };
    return { label: 'Obésité', color: 'text-red-600' };
  };

  const getValueStatus = (value, type) => {
    if (!value) return 'border-gray-300';
    const num = parseFloat(value);
    if (isNaN(num)) return 'border-gray-300';

    const ranges = VITAL_RANGES[type];
    if (!ranges) return 'border-gray-300';

    if (type === 'oxygenSaturation' && num < ranges.warning[0]) {
      return 'border-red-500 bg-red-50';
    }
    if (num >= ranges.critical?.[0] && num <= ranges.critical?.[1]) {
      return 'border-red-500 bg-red-50';
    }
    if (num >= ranges.warning?.[0] && num <= ranges.warning?.[1]) {
      return 'border-orange-500 bg-orange-50';
    }
    if (num >= ranges.normal[0] && num <= ranges.normal[1]) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-gray-300';
  };

  const handleSaveVitals = async () => {
    if (!selectedPatient) {
      toast.error('Veuillez sélectionner un patient');
      return;
    }

    try {
      setSaving(true);

      const vitalsData = {
        bloodPressure: vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic
          ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`
          : null,
        heartRate: vitals.heartRate ? parseFloat(vitals.heartRate) : null,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : null,
        respiratoryRate: vitals.respiratoryRate ? parseFloat(vitals.respiratoryRate) : null,
        oxygenSaturation: vitals.oxygenSaturation ? parseFloat(vitals.oxygenSaturation) : null,
        weight: vitals.weight ? parseFloat(vitals.weight) : null,
        height: vitals.height ? parseFloat(vitals.height) : null,
        notes: vitals.notes,
        recordedBy: user._id,
        recordedAt: new Date()
      };

      await api.post(`/patients/${selectedPatient._id}/vitals`, vitalsData);

      toast.success('Signes vitaux enregistrés');

      // Reset form and refresh history
      setVitals({
        bloodPressureSystolic: '',
        bloodPressureDiastolic: '',
        heartRate: '',
        temperature: '',
        respiratoryRate: '',
        oxygenSaturation: '',
        weight: '',
        height: '',
        notes: ''
      });

      fetchVitalsHistory();
    } catch (error) {
      console.error('Error saving vitals:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const bmi = calculateBMI();
  const bmiStatus = getBMIStatus(bmi);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Activity className="h-8 w-8 mr-3 text-primary-600" />
            Prise des Signes Vitaux
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enregistrement des constantes pour les patients en attente
          </p>
        </div>
        <button
          onClick={fetchQueuePatients}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <OfflineWarningBanner isCritical={true} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Selection Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">Rechercher un patient</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Nom, ID patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-y-auto">
                {searchResults.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => selectPatient(patient)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                      <p className="text-sm text-gray-500">{patient.patientId}</p>
                    </div>
                    <User className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Queue List */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-600" />
              Patients en attente
            </h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : queuePatients.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucun patient en attente</p>
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {queuePatients.map((entry) => (
                  <button
                    key={entry._id}
                    onClick={() => selectPatient(entry.patient)}
                    className={`w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedPatient?._id === entry.patient?._id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {entry.patient?.firstName} {entry.patient?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {entry.patient?.patientId}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {entry.queueNumber}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Vitals Entry Form */}
        <div className="lg:col-span-2">
          {selectedPatient ? (
            <div className="space-y-4">
              {/* Selected Patient Info */}
              <div className="card bg-primary-50 border-primary-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-bold">
                      {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-lg">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        ID: {selectedPatient.patientId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Changer
                  </button>
                </div>
              </div>

              {/* Vitals Form */}
              <div className="card">
                <h3 className="font-medium text-gray-900 mb-4">Signes Vitaux</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Blood Pressure */}
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tension artérielle
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="Sys"
                        value={vitals.bloodPressureSystolic}
                        onChange={(e) => handleInputChange('bloodPressureSystolic', e.target.value)}
                        className="input w-20 text-center"
                      />
                      <span className="text-gray-400">/</span>
                      <input
                        type="number"
                        placeholder="Dia"
                        value={vitals.bloodPressureDiastolic}
                        onChange={(e) => handleInputChange('bloodPressureDiastolic', e.target.value)}
                        className="input w-20 text-center"
                      />
                      <span className="text-xs text-gray-500">mmHg</span>
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Heart className="h-4 w-4 inline mr-1 text-red-500" />
                      Pouls
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={vitals.heartRate}
                        onChange={(e) => handleInputChange('heartRate', e.target.value)}
                        className={`input ${getValueStatus(vitals.heartRate, 'heartRate')}`}
                      />
                      <span className="text-xs text-gray-500">bpm</span>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Thermometer className="h-4 w-4 inline mr-1 text-orange-500" />
                      Température
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={vitals.temperature}
                        onChange={(e) => handleInputChange('temperature', e.target.value)}
                        className={`input ${getValueStatus(vitals.temperature, 'temperature')}`}
                      />
                      <span className="text-xs text-gray-500">°C</span>
                    </div>
                  </div>

                  {/* Respiratory Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Wind className="h-4 w-4 inline mr-1 text-blue-500" />
                      Fréq. resp.
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={vitals.respiratoryRate}
                        onChange={(e) => handleInputChange('respiratoryRate', e.target.value)}
                        className="input"
                      />
                      <span className="text-xs text-gray-500">/min</span>
                    </div>
                  </div>

                  {/* Oxygen Saturation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Droplet className="h-4 w-4 inline mr-1 text-cyan-500" />
                      SpO2
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={vitals.oxygenSaturation}
                        onChange={(e) => handleInputChange('oxygenSaturation', e.target.value)}
                        className={`input ${getValueStatus(vitals.oxygenSaturation, 'oxygenSaturation')}`}
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Poids
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={vitals.weight}
                        onChange={(e) => handleInputChange('weight', e.target.value)}
                        className="input"
                      />
                      <span className="text-xs text-gray-500">kg</span>
                    </div>
                  </div>

                  {/* Height */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taille
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={vitals.height}
                        onChange={(e) => handleInputChange('height', e.target.value)}
                        className="input"
                      />
                      <span className="text-xs text-gray-500">cm</span>
                    </div>
                  </div>

                  {/* BMI Display */}
                  {bmi && (
                    <div className="col-span-2 md:col-span-1 bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500">IMC calculé</p>
                      <p className={`text-2xl font-bold ${bmiStatus?.color || ''}`}>{bmi}</p>
                      {bmiStatus && (
                        <p className={`text-sm ${bmiStatus.color}`}>{bmiStatus.label}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={vitals.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="input"
                    rows="2"
                    placeholder="Observations particulières..."
                  />
                </div>

                {/* Save Button */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveVitals}
                    disabled={saving}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Enregistrer
                  </button>
                </div>
              </div>

              {/* Vitals History */}
              {vitalsHistory.length > 0 && (
                <div className="card">
                  <button
                    onClick={() => setExpandedHistory(!expandedHistory)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <History className="h-5 w-5 text-gray-400" />
                      Historique des constantes
                    </h3>
                    {expandedHistory ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {expandedHistory && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">TA</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pouls</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Temp</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SpO2</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vitalsHistory.slice(0, 10).map((record, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-sm text-gray-600">
                                {formatDate(record.recordedAt || record.createdAt)}
                              </td>
                              <td className="px-3 py-2 text-sm">{record.bloodPressure || '-'}</td>
                              <td className="px-3 py-2 text-sm">{record.heartRate || '-'}</td>
                              <td className="px-3 py-2 text-sm">{record.temperature || '-'}</td>
                              <td className="px-3 py-2 text-sm">{record.oxygenSaturation || '-'}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-12">
              <User className="h-16 w-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">Sélectionnez un patient</p>
              <p className="text-gray-400 text-sm mt-1">
                Choisissez un patient dans la liste ou utilisez la recherche
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NurseVitalsEntry;
