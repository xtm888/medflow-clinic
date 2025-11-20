import { useState, useEffect } from 'react';
import { Search, User, Calendar, Phone, X, Loader2 } from 'lucide-react';
import api from '../services/apiConfig';

export default function PatientSelectorModal({ isOpen, onClose, onSelectPatient, title = "Sélectionner un patient" }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPatients();
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        searchPatients();
      } else if (isOpen) {
        fetchPatients();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/patients?limit=20');
      if (response.data?.success) {
        setPatients(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError('Erreur lors du chargement des patients');
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/patients/search?query=${encodeURIComponent(searchTerm)}`);
      if (response.data?.success) {
        setPatients(response.data.data || []);
      }
    } catch (err) {
      console.error('Error searching patients:', err);
      setError('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient) => {
    onSelectPatient(patient);
    onClose();
    setSearchTerm('');
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, téléphone ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Patient List */}
        <div className="overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <p>{error}</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Aucun patient trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {patients.map((patient) => (
                <button
                  key={patient._id || patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <div className="mt-1 text-sm text-gray-500 space-y-1">
                          <p className="flex items-center gap-2">
                            <span className="font-medium">ID:</span> {patient.patientId || patient._id}
                          </p>
                          {patient.birthDate && (
                            <p className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {formatDate(patient.birthDate)} ({calculateAge(patient.birthDate)})
                            </p>
                          )}
                          {patient.phoneNumber && (
                            <p className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              {patient.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}