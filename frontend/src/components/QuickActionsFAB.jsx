import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, UserPlus, Calendar, FileText, Clock, Printer, AlertCircle, Eye, Pill } from 'lucide-react';

// All available actions with their contexts
const ALL_ACTIONS = [
  {
    id: 'new-patient',
    label: 'Nouveau Patient',
    icon: UserPlus,
    color: 'bg-blue-600 hover:bg-blue-700',
    path: '/patients?action=new',
    shortcut: 'Ctrl+N',
    contexts: ['dashboard', 'patients', 'appointments', 'queue']
  },
  {
    id: 'new-appointment',
    label: 'Nouveau RDV',
    icon: Calendar,
    color: 'bg-purple-600 hover:bg-purple-700',
    path: '/appointments?action=new',
    shortcut: 'Ctrl+A',
    contexts: ['dashboard', 'patients', 'appointments', 'queue']
  },
  {
    id: 'queue',
    label: 'File d\'attente',
    icon: Clock,
    color: 'bg-orange-600 hover:bg-orange-700',
    path: '/queue',
    shortcut: 'Ctrl+Q',
    contexts: ['dashboard', 'appointments']
  },
  {
    id: 'new-prescription',
    label: 'Nouvelle Ordonnance',
    icon: Pill,
    color: 'bg-teal-600 hover:bg-teal-700',
    path: '/prescriptions?action=new',
    contexts: ['prescriptions', 'pharmacy']
  },
  {
    id: 'new-exam',
    label: 'Nouvel Examen',
    icon: Eye,
    color: 'bg-indigo-600 hover:bg-indigo-700',
    path: '/ophthalmology/refraction',
    contexts: ['ophthalmology', 'ivt']
  },
  {
    id: 'print',
    label: 'Imprimer',
    icon: Printer,
    color: 'bg-green-600 hover:bg-green-700',
    action: 'print',
    shortcut: 'Ctrl+Shift+P',
    contexts: ['prescriptions', 'invoicing', 'laboratory']
  }
];

// Map paths to contexts
const getContextFromPath = (pathname) => {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/patients')) return 'patients';
  if (pathname.startsWith('/appointments')) return 'appointments';
  if (pathname.startsWith('/queue')) return 'queue';
  if (pathname.startsWith('/prescriptions')) return 'prescriptions';
  if (pathname.startsWith('/ophthalmology')) return 'ophthalmology';
  if (pathname.startsWith('/ivt')) return 'ivt';
  if (pathname.startsWith('/pharmacy')) return 'pharmacy';
  if (pathname.startsWith('/invoicing')) return 'invoicing';
  if (pathname.startsWith('/laboratory')) return 'laboratory';
  return 'default';
};

function QuickActionsFAB({ onPrintAction }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Filter actions based on current page context
  const contextActions = useMemo(() => {
    const currentContext = getContextFromPath(location.pathname);
    return ALL_ACTIONS.filter(action =>
      action.contexts.includes(currentContext) || action.contexts.includes('all')
    );
  }, [location.pathname]);

  const handleActionClick = (action) => {
    if (action.path) {
      navigate(action.path);
    } else if (action.action === 'print' && onPrintAction) {
      onPrintAction();
    }
    setIsOpen(false);
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Action Buttons */}
      <div className={`absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {contextActions.map((action, index) => {
          const IconComponent = action.icon;
          return (
            <div
              key={action.id}
              className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'backwards'
              }}
            >
              {/* Label */}
              <div className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap">
                {action.label}
                {action.shortcut && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({action.shortcut})
                  </span>
                )}
              </div>

              {/* Button */}
              <button
                onClick={() => handleActionClick(action)}
                className={`flex items-center justify-center w-12 h-12 text-white rounded-full shadow-lg transition-all hover:scale-110 ${action.color}`}
                title={action.label}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main FAB Button */}
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-center w-14 h-14 text-white rounded-full shadow-2xl transition-all hover:scale-110 ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700 rotate-45'
            : 'bg-blue-600 hover:bg-blue-700 rotate-0'
        }`}
        aria-label={isOpen ? 'Fermer les actions rapides' : 'Ouvrir les actions rapides'}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>

      {/* Backdrop (when open) */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default QuickActionsFAB;
