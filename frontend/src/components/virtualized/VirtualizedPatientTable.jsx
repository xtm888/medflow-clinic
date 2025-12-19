/**
 * VirtualizedPatientTable Component
 *
 * A specialized virtualized table for patient lists.
 * Built on top of VirtualizedTable with patient-specific features.
 */
import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { Edit, Eye, Phone, Mail, Calendar, Star, AlertCircle } from 'lucide-react';
import { VirtualizedTable } from './index';
import { PatientPhotoAvatar } from '../biometric';

// Helper function to calculate age
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'N/A';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Get priority color classes
const getPriorityBadge = (priority, isVip) => {
  if (isVip || priority === 'vip') {
    return {
      className: 'bg-purple-100 text-purple-800 border-purple-300',
      label: 'VIP'
    };
  }
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return {
        className: 'bg-red-100 text-red-800 border-red-300',
        label: 'Urgent'
      };
    case 'high':
      return {
        className: 'bg-orange-100 text-orange-800 border-orange-300',
        label: 'Prioritaire'
      };
    case 'pregnant':
      return {
        className: 'bg-pink-100 text-pink-800 border-pink-300',
        label: 'Enceinte'
      };
    case 'elderly':
      return {
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        label: 'Âgé'
      };
    default:
      return null;
  }
};

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

/**
 * VirtualizedPatientTable - A performant patient list table
 *
 * @param {Object} props
 * @param {Array} props.patients - Array of patient objects
 * @param {number} props.height - Height of the table body (default: 500)
 * @param {boolean} props.selectable - Enable row selection
 * @param {Set} props.selectedPatients - Set of selected patient IDs
 * @param {Function} props.onSelectionChange - Callback when selection changes
 * @param {Function} props.onViewPatient - Callback when viewing patient details
 * @param {Function} props.onEditPatient - Callback when editing patient
 * @param {boolean} props.loading - Show loading state
 * @param {boolean} props.showActions - Show action buttons column
 */
const VirtualizedPatientTable = ({
  patients = [],
  height = 500,
  selectable = false,
  selectedPatients = new Set(),
  onSelectionChange,
  onViewPatient,
  onEditPatient,
  loading = false,
  showActions = true,
  className = ''
}) => {
  const navigate = useNavigate();

  // Handle row click
  const handleRowClick = useCallback((patient) => {
    if (onViewPatient) {
      onViewPatient(patient);
    } else {
      navigate(`/patients/${patient._id || patient.id}`);
    }
  }, [navigate, onViewPatient]);

  // Handle selection change
  const handleSelectionChange = useCallback((selectedIds) => {
    if (onSelectionChange) {
      onSelectionChange(new Set(selectedIds));
    }
  }, [onSelectionChange]);

  // Define columns
  const columns = useMemo(() => {
    const cols = [
      {
        key: 'patient',
        header: 'Patient',
        width: 280,
        sortable: true,
        render: (_, patient) => {
          const age = calculateAge(patient.dateOfBirth);
          const effectivePriority = patient.vip ? 'vip' : (patient.priority || 'normal');
          const priorityBadge = getPriorityBadge(effectivePriority, patient.vip);

          return (
            <div className="flex items-center space-x-3">
              <PatientPhotoAvatar
                patient={patient}
                size="sm"
                showBiometricBadge={false}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 truncate">
                    {patient.firstName} {patient.lastName}
                  </span>
                  {patient.vip && <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{patient.patientId || 'N/A'}</span>
                  <span>•</span>
                  <span>{age} ans</span>
                  <span>•</span>
                  <span>{patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'N/A'}</span>
                </div>
                {priorityBadge && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${priorityBadge.className}`}>
                    {priorityBadge.label}
                  </span>
                )}
              </div>
            </div>
          );
        }
      },
      {
        key: 'contact',
        header: 'Contact',
        width: 200,
        render: (_, patient) => {
          const phone = patient.phoneNumber || patient.phone || '';
          const email = patient.email || '';

          return (
            <div className="text-sm">
              {phone && (
                <div className="flex items-center text-gray-600">
                  <Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <span className="truncate">{phone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center text-gray-500 mt-0.5">
                  <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {!phone && !email && (
                <span className="text-gray-400">Non renseigné</span>
              )}
            </div>
          );
        }
      },
      {
        key: 'lastVisit',
        header: 'Dernière visite',
        width: 120,
        sortable: true,
        render: (_, patient) => {
          const lastVisit = patient.lastVisit || patient.lastVisitDate;
          return (
            <div className="text-sm text-gray-600">
              {formatDate(lastVisit)}
            </div>
          );
        }
      },
      {
        key: 'nextAppointment',
        header: 'Prochain RDV',
        width: 120,
        sortable: true,
        render: (_, patient) => {
          const nextAppt = patient.nextAppointment || patient.nextAppointmentDate;
          if (!nextAppt) {
            return <span className="text-sm text-gray-400">-</span>;
          }
          const apptDate = new Date(nextAppt);
          const isToday = new Date().toDateString() === apptDate.toDateString();
          const isPast = apptDate < new Date();

          return (
            <div className={`text-sm ${isToday ? 'text-green-600 font-medium' : isPast ? 'text-red-600' : 'text-gray-600'}`}>
              <div className="flex items-center">
                <Calendar className={`h-3.5 w-3.5 mr-1.5 ${isToday ? 'text-green-500' : isPast ? 'text-red-400' : 'text-gray-400'}`} />
                {formatDate(nextAppt)}
              </div>
              {isToday && <span className="text-xs text-green-500">Aujourd'hui</span>}
            </div>
          );
        }
      },
      {
        key: 'allergies',
        header: 'Alertes',
        width: 100,
        render: (_, patient) => {
          const allergies = patient.medicalHistory?.allergies || patient.allergies || [];
          const hasAllergies = allergies.length > 0;

          if (!hasAllergies) {
            return <span className="text-sm text-gray-400">-</span>;
          }

          return (
            <div className="flex items-center text-amber-600" title={allergies.join(', ')}>
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">{allergies.length} allergie(s)</span>
            </div>
          );
        }
      }
    ];

    // Add actions column if enabled
    if (showActions) {
      cols.push({
        key: 'actions',
        header: 'Actions',
        width: 120,
        render: (_, patient) => (
          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onViewPatient) {
                  onViewPatient(patient);
                } else {
                  navigate(`/patients/${patient._id || patient.id}`);
                }
              }}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="Voir le dossier"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onEditPatient) {
                  onEditPatient(patient);
                } else {
                  navigate(`/patients/${patient._id || patient.id}/edit`);
                }
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Modifier"
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
        )
      });
    }

    return cols;
  }, [navigate, onViewPatient, onEditPatient, showActions]);

  // Empty state component
  const emptyComponent = useMemo(() => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p className="text-lg font-medium">Aucun patient trouvé</p>
      <p className="text-sm mt-1">Modifiez vos filtres ou ajoutez un nouveau patient</p>
    </div>
  ), []);

  return (
    <VirtualizedTable
      data={patients}
      columns={columns}
      rowHeight={72}
      height={height}
      overscan={5}
      onRowClick={handleRowClick}
      selectable={selectable}
      selectedRows={Array.from(selectedPatients)}
      onSelectionChange={handleSelectionChange}
      rowKey="_id"
      loading={loading}
      emptyComponent={emptyComponent}
      className={`virtualized-patient-table ${className}`}
    />
  );
};

VirtualizedPatientTable.propTypes = {
  patients: PropTypes.array.isRequired,
  height: PropTypes.number,
  selectable: PropTypes.bool,
  selectedPatients: PropTypes.instanceOf(Set),
  onSelectionChange: PropTypes.func,
  onViewPatient: PropTypes.func,
  onEditPatient: PropTypes.func,
  loading: PropTypes.bool,
  showActions: PropTypes.bool,
  className: PropTypes.string
};

export default VirtualizedPatientTable;
