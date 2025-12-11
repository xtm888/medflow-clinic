import { AlertCircle, FileText, Pill, DollarSign, Upload, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

/**
 * PendingActionsWidget - Shows pending actions requiring user attention
 *
 * Role-specific pending items:
 * - Doctors/Ophthalmologists: Unsigned notes, pending prescriptions, follow-up reminders
 * - Nurses: Medications to administer, vitals to check
 * - Pharmacists: Prescriptions to verify and dispense
 * - Receptionists: Payments to collect, appointments to confirm
 * - Lab Technicians: Results to upload, tests to perform
 * - Accountants: Invoices to create, pending payments
 */
const PendingActionsWidget = ({ userRole, actions = [] }) => {
  const [showAll, setShowAll] = useState(false);
  // Role-specific action configurations
  const getRoleActions = () => {
    switch (userRole) {
      case 'doctor':
      case 'ophthalmologist':
        return {
          title: 'Actions en attente',
          emptyMessage: 'Toutes les tâches sont à jour',
          icon: ClipboardList,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          actions: actions.filter(a => ['unsigned_note', 'prescription_pending', 'follow_up'].includes(a.type))
        };

      case 'nurse':
        return {
          title: 'Soins en attente',
          emptyMessage: 'Aucun soin en attente',
          icon: AlertCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
          actions: actions.filter(a => ['medication_admin', 'vitals_check', 'patient_observation'].includes(a.type))
        };

      case 'pharmacist':
        return {
          title: 'Prescriptions en attente',
          emptyMessage: 'Aucune prescription à traiter',
          icon: Pill,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-50',
          actions: actions.filter(a => ['prescription_verify', 'dispense_medication', 'stock_alert'].includes(a.type))
        };

      case 'receptionist':
        return {
          title: 'Actions administratives',
          emptyMessage: 'Aucune action en attente',
          icon: FileText,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
          actions: actions.filter(a => ['payment_collect', 'appointment_confirm', 'registration_incomplete'].includes(a.type))
        };

      case 'lab_technician':
        return {
          title: 'Résultats en attente',
          emptyMessage: 'Tous les résultats sont à jour',
          icon: Upload,
          iconColor: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          actions: actions.filter(a => ['result_upload', 'test_perform', 'quality_check'].includes(a.type))
        };

      case 'accountant':
        return {
          title: 'Tâches financières',
          emptyMessage: 'Aucune tâche financière en attente',
          icon: DollarSign,
          iconColor: 'text-pink-600',
          bgColor: 'bg-pink-50',
          actions: actions.filter(a => ['invoice_create', 'payment_pending', 'reconciliation'].includes(a.type))
        };

      default:
        return {
          title: 'Actions en attente',
          emptyMessage: 'Aucune action en attente',
          icon: AlertCircle,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          actions: actions
        };
    }
  };

  const roleConfig = getRoleActions();
  const { title, emptyMessage, icon: Icon, iconColor, bgColor, actions: roleActions } = roleConfig;

  // Get action icon based on type
  const getActionIcon = (type) => {
    switch (type) {
      case 'unsigned_note':
      case 'prescription_pending':
      case 'prescription_verify':
        return FileText;
      case 'medication_admin':
      case 'dispense_medication':
      case 'stock_alert':
        return Pill;
      case 'payment_collect':
      case 'payment_pending':
      case 'invoice_create':
        return DollarSign;
      case 'result_upload':
      case 'test_perform':
        return Upload;
      default:
        return AlertCircle;
    }
  };

  // Get urgency indicator
  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-gray-300 bg-gray-50';
    }
  };

  // Get urgency badge
  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'critical':
        return { text: 'Critique', class: 'bg-red-100 text-red-800' };
      case 'high':
        return { text: 'Urgent', class: 'bg-orange-100 text-orange-800' };
      case 'medium':
        return { text: 'Important', class: 'bg-yellow-100 text-yellow-800' };
      default:
        return { text: 'Normal', class: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`${bgColor} p-2 rounded-lg`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {roleActions.length > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">
            {roleActions.length}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {roleActions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Icon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{emptyMessage}</p>
            <p className="text-xs text-gray-400 mt-1">Excellent travail! 🎉</p>
          </div>
        ) : (
          <>
            {(showAll ? roleActions : roleActions.slice(0, 5)).map((action, index) => {
              const ActionIcon = getActionIcon(action.type);
              const urgencyBadge = getUrgencyBadge(action.urgency);

              return (
                <div
                  key={action.id || index}
                  className={`flex items-start p-3 rounded-lg transition-all hover:shadow-sm cursor-pointer ${getUrgencyColor(action.urgency)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <ActionIcon className="h-5 w-5 text-gray-600" />
                  </div>

                  <div className="ml-3 flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{action.title}</p>
                        {action.description && (
                          <p className="text-xs text-gray-600 mt-1">{action.description}</p>
                        )}
                      </div>

                      {action.urgency && action.urgency !== 'low' && (
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full font-semibold ${urgencyBadge.class}`}>
                          {urgencyBadge.text}
                        </span>
                      )}
                    </div>

                    {action.deadline && (
                      <p className="text-xs text-gray-500 mt-2">
                        ⏰ À faire avant: {new Date(action.deadline).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}

                    {action.link && (
                      <Link
                        to={action.link}
                        className="inline-flex items-center mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Traiter →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}

            {roleActions.length > 5 && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  {showAll ? 'Voir moins' : `Voir toutes les actions (${roleActions.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Stats */}
      {roleActions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-500">Critiques</p>
              <p className="text-lg font-bold text-red-600">
                {roleActions.filter(a => a.urgency === 'critical').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Urgents</p>
              <p className="text-lg font-bold text-orange-600">
                {roleActions.filter(a => a.urgency === 'high').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Normaux</p>
              <p className="text-lg font-bold text-gray-600">
                {roleActions.filter(a => !a.urgency || ['medium', 'low'].includes(a.urgency)).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingActionsWidget;
