import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Clock, FileText, Eye, Pill,
  AlertCircle, ArrowRight, Plus
} from 'lucide-react';

// Predefined empty states for different modules
const EMPTY_STATES = {
  patients: {
    icon: Users,
    title: 'Aucun patient enregistré',
    description: 'Commencez par ajouter votre premier patient pour gérer les dossiers médicaux.',
    action: {
      label: 'Ajouter un patient',
      path: '/patients?action=new',
      shortcut: 'Ctrl+N'
    },
    tips: [
      'Les patients peuvent être ajoutés manuellement ou importés',
      'Chaque patient aura un dossier médical complet'
    ]
  },
  appointments: {
    icon: Calendar,
    title: 'Aucun rendez-vous',
    description: 'Planifiez des rendez-vous pour organiser les consultations.',
    action: {
      label: 'Nouveau rendez-vous',
      path: '/appointments?action=new',
      shortcut: 'Ctrl+A'
    },
    tips: [
      'Les rendez-vous peuvent être récurrents',
      'Assignez un médecin pour un meilleur suivi'
    ]
  },
  queue: {
    icon: Clock,
    title: 'File d\'attente vide',
    description: 'Les patients enregistrés pour aujourd\'hui apparaîtront ici.',
    action: {
      label: 'Voir les rendez-vous',
      path: '/appointments'
    },
    tips: [
      'Les patients avec RDV aujourd\'hui peuvent être ajoutés à la file',
      'Utilisez le tri par priorité pour gérer les urgences'
    ]
  },
  prescriptions: {
    icon: Pill,
    title: 'Aucune ordonnance',
    description: 'Les ordonnances créées apparaîtront ici.',
    action: {
      label: 'Nouvelle ordonnance',
      path: '/prescriptions?action=new'
    },
    tips: [
      'Créez des ordonnances depuis une visite pour un meilleur suivi',
      'Les favoris accélèrent la prescription de médicaments courants'
    ]
  },
  exams: {
    icon: Eye,
    title: 'Aucun examen',
    description: 'Les examens ophtalmologiques apparaîtront ici.',
    action: {
      label: 'Nouvel examen',
      path: '/ophthalmology/refraction'
    },
    tips: [
      'Sélectionnez un patient avant de commencer l\'examen',
      'Les données des appareils peuvent être importées automatiquement'
    ]
  },
  search: {
    icon: AlertCircle,
    title: 'Aucun résultat',
    description: 'Aucun élément ne correspond à vos critères de recherche.',
    tips: [
      'Essayez avec des termes plus généraux',
      'Vérifiez l\'orthographe des mots recherchés'
    ]
  },
  filtered: {
    icon: AlertCircle,
    title: 'Aucun résultat avec ces filtres',
    description: 'Modifiez vos filtres pour voir plus de résultats.',
    tips: [
      'Essayez de réduire le nombre de filtres actifs',
      'Réinitialisez les filtres pour voir tous les éléments'
    ]
  }
};

function EmptyState({
  type = 'search',
  customTitle,
  customDescription,
  customAction,
  showTips = true,
  compact = false
}) {
  const navigate = useNavigate();
  const config = EMPTY_STATES[type] || EMPTY_STATES.search;

  const IconComponent = config.icon;
  const title = customTitle || config.title;
  const description = customDescription || config.description;
  const action = customAction || config.action;

  if (compact) {
    return (
      <div className="text-center py-8 px-4">
        <IconComponent className="mx-auto h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">{title}</p>
        {action && (
          <button
            onClick={() => action.onClick ? action.onClick() : navigate(action.path)}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {action.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12 px-6">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <IconComponent className="h-8 w-8 text-gray-400" />
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">{description}</p>

      {/* Action Button */}
      {action && (
        <button
          onClick={() => action.onClick ? action.onClick() : navigate(action.path)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors mb-6"
        >
          <Plus className="h-4 w-4 mr-2" />
          {action.label}
          {action.shortcut && (
            <span className="ml-2 text-xs opacity-75">({action.shortcut})</span>
          )}
        </button>
      )}

      {/* Tips */}
      {showTips && config.tips && config.tips.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Conseils
          </p>
          <ul className="space-y-2">
            {config.tips.map((tip, index) => (
              <li key={index} className="flex items-start text-sm text-gray-500">
                <ArrowRight className="h-4 w-4 text-gray-300 mr-2 mt-0.5 flex-shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EmptyState;
