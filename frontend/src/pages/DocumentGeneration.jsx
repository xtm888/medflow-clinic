import React, { useState, useEffect } from 'react';
import { FileText, Search, User } from 'lucide-react';
import DocumentGenerator from '../components/documents/DocumentGenerator';
import patientService from '../services/patientService';
import { toast } from 'react-toastify';

export default function DocumentGenerationPage() {
  
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await patientService.getPatients();
      setPatients(response.data || []);
    } catch (error) {
      console.error('Error loading patients:', error);
      toast.error('Erreur lors du chargement des patients');
    } finally {
      setLoading(false);
    }
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(patient => {
    const query = searchQuery.toLowerCase();
    return (
      patient.firstName?.toLowerCase().includes(query) ||
      patient.lastName?.toLowerCase().includes(query) ||
      patient.patientId?.toLowerCase().includes(query) ||
      patient.phoneNumber?.includes(query)
    );
  });

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setShowDocumentGenerator(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Génération de Documents</h1>
        </div>
        <p className="text-gray-600">
          Générez des certificats médicaux, ordonnances et autres documents pour vos patients
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un patient par nom, ID ou téléphone..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des patients...</p>
        </div>
      ) : (
        <>
          {/* Patients List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Sélectionnez un patient ({filteredPatients.length})
              </h2>
            </div>

            {filteredPatients.length === 0 ? (
              <div className="p-12 text-center">
                <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg">
                  {searchQuery ? 'Aucun patient trouvé' : 'Aucun patient enregistré'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full px-6 py-4 hover:bg-blue-50 transition-colors text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                      </div>

                      {/* Patient Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {patient.firstName} {patient.lastName}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span>ID: {patient.patientId}</span>
                          {patient.phoneNumber && (
                            <span>Tel: {patient.phoneNumber}</span>
                          )}
                          {patient.dateOfBirth && (
                            <span>
                              {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} ans
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            patient.gender === 'male'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-pink-100 text-pink-700'
                          }`}>
                            {patient.gender === 'male' ? 'Homme' : 'Femme'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Arrow */}
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Générer Document
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">
                  Générez 26+ types de documents
                </h3>
                <p className="text-sm text-blue-800">
                  Certificats médicaux, correspondances, rapports opératoires, instructions
                  pré/post-opératoires et bien plus. Les données du patient sont automatiquement
                  remplies dans le document sélectionné.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && selectedPatient && (
        <DocumentGenerator
          patientId={selectedPatient._id}
          visitId={null}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedPatient(null);
          }}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
            setSelectedPatient(null);
          }}
        />
      )}
    </div>
  );
}
