/**
 * PatientTable Component
 *
 * Displays the patient list in a table format with selection support.
 */

import { useNavigate } from 'react-router-dom';
import { Phone, Mail, Star, Eye, Edit, CheckSquare, Square, Loader2, AlertCircle } from 'lucide-react';
import { PatientPhotoAvatar } from '../../../components/biometric';
import PatientPreviewCard from '../../../components/PatientPreviewCard';
import EmptyState from '../../../components/EmptyState';
import { calculateAge, getGenderDisplay } from '../constants';

export default function PatientTable({
  patients,
  loading,
  error,
  selectionMode,
  selectedPatients,
  togglePatientSelection,
  selectAllPatients,
  clearSelection,
  hasActiveFilters,
  searchTerm,
  priorityFilter,
  pagination,
  goToPage,
  setShowWizard,
  fetchPatients
}) {
  const navigate = useNavigate();

  // Loading State
  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des patients...</span>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <div className="flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
        <button
          onClick={() => fetchPatients()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Reessayer
        </button>
      </div>
    );
  }

  return (
    <div className="card p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Selection checkbox column */}
              {selectionMode && (
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <button
                    onClick={() => {
                      if (selectedPatients.size === patients.length) {
                        clearSelection();
                      } else {
                        selectAllPatients();
                      }
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title={selectedPatients.size === patients.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                  >
                    {selectedPatients.size === patients.length && patients.length > 0 ? (
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                    ) : selectedPatients.size > 0 ? (
                      <div className="h-5 w-5 border-2 border-blue-600 rounded bg-blue-100 flex items-center justify-center">
                        <div className="h-2 w-2 bg-blue-600 rounded-sm"></div>
                      </div>
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priorite
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Derniere visite
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
            {patients.length === 0 ? (
              <tr>
                <td colSpan={selectionMode ? "7" : "6"} className="px-0">
                  {searchTerm || priorityFilter !== 'all' || hasActiveFilters() ? (
                    <EmptyState type="filtered" compact={true} />
                  ) : (
                    <EmptyState
                      type="patients"
                      customAction={{
                        label: 'Ajouter un patient',
                        path: '#',
                        onClick: () => setShowWizard(true)
                      }}
                    />
                  )}
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <PatientRow
                  key={patient._id || patient.id}
                  patient={patient}
                  selectionMode={selectionMode}
                  isSelected={selectedPatients.has(patient._id || patient.id)}
                  toggleSelection={() => togglePatientSelection(patient._id || patient.id)}
                  navigate={navigate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {patients.length > 0 && pagination.pages > 1 && (
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {pagination.page} sur {pagination.pages} ({pagination.total} patients)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn btn-secondary btn-sm"
            >
              Precedent
            </button>
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="btn btn-secondary btn-sm"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      {patients.length > 0 && pagination.pages <= 1 && (
        <div className="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500">
          {patients.length} patient{patients.length > 1 ? 's' : ''} trouve{patients.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function PatientRow({ patient, selectionMode, isSelected, toggleSelection, navigate }) {
  const age = calculateAge(patient.dateOfBirth);
  const phone = patient.phoneNumber || patient.phone || 'N/A';
  const email = patient.email || 'N/A';
  const bloodType = patient.bloodGroup || patient.bloodType || 'N/A';
  const effectivePriority = patient.vip ? 'vip' : (patient.priority || patient.patientType || 'normal');
  const isVip = patient.vip;
  const lastVisit = patient.lastVisit || patient.lastVisitDate;
  const nextAppointment = patient.nextAppointment || patient.nextAppointmentDate;

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
      {/* Selection checkbox */}
      {selectionMode && (
        <td className="px-3 py-4 whitespace-nowrap">
          <button
            onClick={toggleSelection}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-blue-600" />
            ) : (
              <Square className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </td>
      )}

      <td className="px-6 py-4 whitespace-nowrap">
        <PatientPreviewCard patient={patient} position="right">
          <div className="flex items-center cursor-pointer">
            <PatientPhotoAvatar
              patient={patient}
              size="sm"
              showBiometricBadge={true}
            />
            <div className="ml-4">
              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                  {patient.firstName} {patient.lastName}
                </div>
                {isVip && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                {/* Legacy/Incomplete data badge */}
                {(patient.dataStatus === 'incomplete' || patient.legacyId) && (
                  <span
                    className="px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded border border-amber-300"
                    title={patient.placeholderFields?.length > 0
                      ? `Données incomplètes: ${patient.placeholderFields.join(', ')}`
                      : 'Données importées du système legacy'
                    }
                  >
                    LEGACY
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {patient.patientId && <span className="mr-2">{patient.patientId}</span>}
                {age !== 'N/A' && `${age} ans`} · {getGenderDisplay(patient.gender)} · {bloodType}
              </div>
            </div>
          </div>
        </PatientPreviewCard>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center text-sm text-gray-900">
            <Phone className="h-4 w-4 mr-2 text-gray-400" />
            {phone}
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <Mail className="h-4 w-4 mr-2 text-gray-400" />
            {email}
          </div>
        </div>
      </td>

      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
          effectivePriority === 'vip' ? 'bg-purple-100 text-purple-800' :
          effectivePriority === 'pregnant' ? 'bg-pink-100 text-pink-800' :
          effectivePriority === 'elderly' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {effectivePriority === 'vip' ? 'VIP' :
           effectivePriority === 'pregnant' ? 'Enceinte' :
           effectivePriority === 'elderly' ? 'Age' :
           'Normal'}
        </span>
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {lastVisit ? new Date(lastVisit).toLocaleDateString('fr-FR') : '-'}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {nextAppointment ? new Date(nextAppointment).toLocaleDateString('fr-FR') : '-'}
      </td>

      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(`/patients/${patient._id || patient.id}`)}
            className="text-primary-600 hover:text-primary-900"
            title="Voir le dossier"
          >
            <Eye className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate(`/patients/${patient._id || patient.id}/edit`)}
            className="text-gray-600 hover:text-gray-900"
            title="Modifier"
          >
            <Edit className="h-5 w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
