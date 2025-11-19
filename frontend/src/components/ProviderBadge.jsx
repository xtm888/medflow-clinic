import { User, Stethoscope, Eye, Syringe } from 'lucide-react';

// Provider badge component to show who performed an action
export default function ProviderBadge({
  provider,
  date,
  action = '',
  size = 'sm',
  showSpecialty = true,
  className = ''
}) {
  if (!provider) return null;

  const name = provider.firstName && provider.lastName
    ? `${provider.firstName} ${provider.lastName}`
    : provider.name || 'N/A';

  const specialty = provider.specialization || provider.specialty || provider.role;

  const getSpecialtyIcon = () => {
    const specialtyLower = (specialty || '').toLowerCase();
    if (specialtyLower.includes('ophthalmo')) return Eye;
    if (specialtyLower.includes('nurse') || specialtyLower.includes('infirm')) return Syringe;
    if (specialtyLower.includes('doctor') || specialtyLower.includes('médecin')) return Stethoscope;
    return User;
  };

  const getSpecialtyColor = () => {
    const specialtyLower = (specialty || '').toLowerCase();
    if (specialtyLower.includes('ophthalmo')) return 'bg-blue-100 text-blue-700';
    if (specialtyLower.includes('nurse') || specialtyLower.includes('infirm')) return 'bg-green-100 text-green-700';
    if (specialtyLower.includes('doctor') || specialtyLower.includes('médecin')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  const SpecialtyIcon = getSpecialtyIcon();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (size === 'xs') {
    return (
      <span className={`inline-flex items-center text-xs text-gray-500 ${className}`}>
        <SpecialtyIcon className="h-3 w-3 mr-1" />
        {name}
      </span>
    );
  }

  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`p-1.5 rounded-full ${getSpecialtyColor()}`}>
          <SpecialtyIcon className="h-3 w-3" />
        </div>
        <div className="text-xs">
          <span className="font-medium text-gray-700">{name}</span>
          {showSpecialty && specialty && (
            <span className="text-gray-400 ml-1">({specialty})</span>
          )}
          {date && (
            <div className="text-gray-400">{formatDate(date)}</div>
          )}
        </div>
      </div>
    );
  }

  // Medium size
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className={`p-2 rounded-full ${getSpecialtyColor()}`}>
        <SpecialtyIcon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900">{name}</div>
        {showSpecialty && specialty && (
          <div className="text-xs text-gray-500">{specialty}</div>
        )}
        {action && (
          <div className="text-xs text-gray-400 mt-0.5">{action}</div>
        )}
        {date && (
          <div className="text-xs text-gray-400 mt-1">{formatDate(date)}</div>
        )}
      </div>
    </div>
  );
}

// List of providers with interaction counts
export function ProviderList({ providers = [], onProviderClick }) {
  if (!providers.length) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        Aucun praticien trouvé
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {providers.map((provider, index) => (
        <div
          key={provider._id || index}
          onClick={() => onProviderClick?.(provider)}
          className={`flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 ${onProviderClick ? 'cursor-pointer' : ''}`}
        >
          <ProviderBadge
            provider={provider}
            showSpecialty={true}
            size="sm"
          />
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {provider.interactions || 0}
            </div>
            <div className="text-xs text-gray-500">
              {provider.interactions === 1 ? 'interaction' : 'interactions'}
            </div>
            {provider.lastSeen && (
              <div className="text-xs text-gray-400 mt-1">
                Dernier: {new Date(provider.lastSeen).toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
