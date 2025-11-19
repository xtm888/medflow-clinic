import { CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * TodayTasksWidget - Shows role-specific tasks for today
 *
 * Displays prioritized tasks based on user role:
 * - Doctors/Ophthalmologists: Appointments, pending consultations
 * - Nurses: Vitals to check, medications to administer
 * - Receptionists: Check-ins, appointment confirmations
 * - Pharmacists: Prescriptions to dispense
 * - Lab Technicians: Tests to perform, results to upload
 * - Accountants: Invoices to create, payments to process
 */
const TodayTasksWidget = ({ userRole, tasks = [] }) => {
  // Role-specific task configurations
  const getRoleTasks = () => {
    switch (userRole) {
      case 'doctor':
      case 'ophthalmologist':
        return {
          title: 'Mes tâches du jour',
          emptyMessage: 'Aucune tâche pour aujourd\'hui',
          icon: Calendar,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          tasks: tasks.filter(t => ['appointment', 'consultation', 'follow_up'].includes(t.type))
        };

      case 'nurse':
        return {
          title: 'Soins à effectuer',
          emptyMessage: 'Aucun soin en attente',
          icon: AlertCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
          tasks: tasks.filter(t => ['vitals', 'medication', 'patient_care'].includes(t.type))
        };

      case 'receptionist':
        return {
          title: 'Accueil & RDV',
          emptyMessage: 'Aucune tâche d\'accueil',
          icon: Clock,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50',
          tasks: tasks.filter(t => ['check_in', 'appointment_confirm', 'registration'].includes(t.type))
        };

      case 'pharmacist':
        return {
          title: 'Prescriptions à traiter',
          emptyMessage: 'Aucune prescription en attente',
          icon: AlertCircle,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-50',
          tasks: tasks.filter(t => ['prescription', 'dispense', 'verification'].includes(t.type))
        };

      case 'lab_technician':
        return {
          title: 'Examens du jour',
          emptyMessage: 'Aucun examen en attente',
          icon: Calendar,
          iconColor: 'text-indigo-600',
          bgColor: 'bg-indigo-50',
          tasks: tasks.filter(t => ['imaging', 'test', 'result_upload'].includes(t.type))
        };

      case 'accountant':
        return {
          title: 'Facturation & Paiements',
          emptyMessage: 'Aucune tâche financière',
          icon: Clock,
          iconColor: 'text-pink-600',
          bgColor: 'bg-pink-50',
          tasks: tasks.filter(t => ['invoice', 'payment', 'reconciliation'].includes(t.type))
        };

      default:
        return {
          title: 'Tâches du jour',
          emptyMessage: 'Aucune tâche',
          icon: CheckCircle2,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          tasks: tasks
        };
    }
  };

  const roleConfig = getRoleTasks();
  const { title, emptyMessage, icon: Icon, iconColor, bgColor, tasks: roleTasks } = roleConfig;

  // Task priority badge
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
          {roleTasks.length} tâche{roleTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {roleTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <>
            {roleTasks.slice(0, 5).map((task, index) => (
              <div
                key={task.id || index}
                className="flex items-start justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                    {task.priority && task.priority !== 'low' && (
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityBadge(task.priority)}`}>
                        {task.priority === 'urgent' ? 'Urgent' :
                         task.priority === 'high' ? 'Prioritaire' : 'Normal'}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                  )}
                  {task.time && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {task.time}
                    </p>
                  )}
                </div>
                {task.link && (
                  <Link
                    to={task.link}
                    className="ml-3 text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap"
                  >
                    Voir →
                  </Link>
                )}
              </div>
            ))}

            {roleTasks.length > 5 && (
              <div className="text-center pt-2">
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Voir toutes les tâches ({roleTasks.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TodayTasksWidget;
