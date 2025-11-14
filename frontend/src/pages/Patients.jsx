import { useState } from 'react';
import { Search, Plus, Edit, Eye, Phone, Mail, AlertCircle, Star } from 'lucide-react';
import { patients } from '../data/mockData';

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Patients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les dossiers patients et leurs informations médicales
          </p>
        </div>
        <button
          onClick={() => setShowNewPatientModal(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau patient</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center space-x-3">
            <select className="input">
              <option>Tous les patients</option>
              <option>VIP</option>
              <option>Femmes enceintes</option>
              <option>Personnes âgées</option>
            </select>
            <select className="input">
              <option>Trier par nom</option>
              <option>Dernière visite</option>
              <option>Prochain RDV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patients List */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priorité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dernière visite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prochain RDV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-medium">
                          {patient.firstName[0]}{patient.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </div>
                          {patient.vip && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                        </div>
                        <div className="text-sm text-gray-500">
                          {patient.age} ans · {patient.gender === 'M' ? 'Homme' : 'Femme'} · {patient.bloodType}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-sm text-gray-900">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {patient.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {patient.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      patient.priority === 'VIP' ? 'bg-purple-100 text-purple-800' :
                      patient.priority === 'PREGNANT' ? 'bg-pink-100 text-pink-800' :
                      patient.priority === 'ELDERLY' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {patient.priority === 'VIP' ? 'VIP' :
                       patient.priority === 'PREGNANT' ? 'Enceinte' :
                       patient.priority === 'ELDERLY' ? 'Âgé' :
                       'Normal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(patient.lastVisit).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {patient.nextAppointment ? new Date(patient.nextAppointment).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedPatient(patient)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Details Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </h2>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Âge</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.age} ans</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Sexe</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.gender === 'M' ? 'Homme' : 'Femme'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Groupe sanguin</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.bloodType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Assurance</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.insurance}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Adresse</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatient.address}</p>
                  </div>
                </div>
              </div>

              {/* Allergies */}
              {selectedPatient.allergies.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    Allergies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.allergies.map((allergy, index) => (
                      <span key={index} className="badge badge-danger">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical History (mock) */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique médical</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">Dernière visite: {new Date(selectedPatient.lastVisit).toLocaleDateString('fr-FR')}</p>
                    <p className="text-sm text-gray-600 mt-1">Consultation générale - Dr. Kambale</p>
                  </div>
                  {selectedPatient.nextAppointment && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">Prochain RDV: {new Date(selectedPatient.nextAppointment).toLocaleDateString('fr-FR')}</p>
                      <p className="text-sm text-blue-600 mt-1">Suivi - Dr. Kambale</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nouveau Patient</h2>
              <button
                onClick={() => setShowNewPatientModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input type="text" className="input" placeholder="Jean" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input type="text" className="input" placeholder="Dupont" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                  <input type="date" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
                  <select className="input">
                    <option value="">Sélectionner</option>
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" className="input" placeholder="+243 81 234 5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="input" placeholder="patient@email.com" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <input type="text" className="input" placeholder="123 Rue de la Santé, 75013 Paris" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Groupe sanguin</label>
                  <select className="input">
                    <option value="">Sélectionner</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                    <option>O+</option>
                    <option>O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assurance</label>
                  <input type="text" className="input" placeholder="Sécurité Sociale" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergies connues</label>
                  <input type="text" className="input" placeholder="Pénicilline, arachides..." />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input type="checkbox" id="vip" className="rounded border-gray-300" />
                <label htmlFor="vip" className="text-sm font-medium text-gray-700">Marquer comme VIP</label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Créer le patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
