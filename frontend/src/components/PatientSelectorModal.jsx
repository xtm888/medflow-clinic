import { useState, useEffect } from 'react';
import { Search, X, Users } from 'lucide-react';
import patientService from '../services/patientService';

export default function PatientSelectorModal({ isOpen, onClose, onSelectPatient, title = "Sélectionner un patient" }) {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPatients();
    }
  }, [isOpen]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await patientService.getPatients();
      setPatients(response.data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const search = searchTerm.toLowerCase();
    return (
      patient.firstName?.toLowerCase().includes(search) ||
      patient.lastName?.toLowerCase().includes(search) ||
      patient.email?.toLowerCase().includes(search) ||
      patient.phoneNumber?.includes(search)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, email ou téléphone..."
              className="input pl-10 w-full"
              autoFocus
            />
          </div>
        </div>

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'Aucun patient trouvé' : 'Aucun patient disponible'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPatients.map((patient) => (
                <button
                  key={patient._id || patient.id}
                  onClick={() => {
                    onSelectPatient(patient);
                    onClose();
                  }}
                  className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        {patient.email && <span>{patient.email}</span>}
                        {patient.phoneNumber && <span>{patient.phoneNumber}</span>}
                      </div>
                      {patient.dateOfBirth && (
                        <p className="text-xs text-gray-500 mt-1">
                          Né(e) le: {new Date(patient.dateOfBirth).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} trouvé{filteredPatients.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
