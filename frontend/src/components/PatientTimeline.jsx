import { useState } from 'react';
import {
  Calendar,
  Stethoscope,
  Pill,
  Eye,
  FlaskConical,
  FileText,
  ChevronRight,
  Filter
} from 'lucide-react';
import ProviderBadge from './ProviderBadge';

// Timeline event type configurations
const eventTypeConfig = {
  visit: {
    icon: Stethoscope,
    color: 'bg-blue-100 text-blue-600 border-blue-200',
    label: 'Visite'
  },
  prescription: {
    icon: Pill,
    color: 'bg-green-100 text-green-600 border-green-200',
    label: 'Ordonnance'
  },
  examination: {
    icon: Eye,
    color: 'bg-purple-100 text-purple-600 border-purple-200',
    label: 'Examen'
  },
  laboratory: {
    icon: FlaskConical,
    color: 'bg-yellow-100 text-yellow-600 border-yellow-200',
    label: 'Laboratoire'
  },
  document: {
    icon: FileText,
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    label: 'Document'
  }
};

export default function PatientTimeline({
  events = [],
  onEventClick,
  showFilters = true,
  maxItems = 50
}) {
  const [selectedType, setSelectedType] = useState('all');
  const [expandedEvents, setExpandedEvents] = useState(new Set());

  // Filter events by type
  const filteredEvents = selectedType === 'all'
    ? events
    : events.filter(e => e.type === selectedType);

  // Limit displayed events
  const displayedEvents = filteredEvents.slice(0, maxItems);

  const toggleEventExpand = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { label: 'Complété', class: 'bg-green-100 text-green-700' },
      active: { label: 'Actif', class: 'bg-blue-100 text-blue-700' },
      pending: { label: 'En attente', class: 'bg-yellow-100 text-yellow-700' },
      cancelled: { label: 'Annulé', class: 'bg-red-100 text-red-700' },
      dispensed: { label: 'Dispensé', class: 'bg-green-100 text-green-700' },
      ordered: { label: 'Commandé', class: 'bg-blue-100 text-blue-700' },
      processing: { label: 'En cours', class: 'bg-yellow-100 text-yellow-700' },
      'in-progress': { label: 'En cours', class: 'bg-blue-100 text-blue-700' },
      'checked-in': { label: 'Arrivé', class: 'bg-green-100 text-green-700' },
      scheduled: { label: 'Planifié', class: 'bg-gray-100 text-gray-700' },
      waiting: { label: 'En attente', class: 'bg-yellow-100 text-yellow-700' },
      'with-doctor': { label: 'Chez le médecin', class: 'bg-purple-100 text-purple-700' },
      draft: { label: 'Brouillon', class: 'bg-gray-100 text-gray-700' }
    };
    const config = statusConfig[status] || { label: status, class: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">Aucun événement dans la chronologie</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-400" />
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedType === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tous ({events.length})
          </button>
          {Object.entries(eventTypeConfig).map(([type, config]) => {
            const count = events.filter(e => e.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedType === type
                    ? config.color
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {displayedEvents.map((event, index) => {
            const config = eventTypeConfig[event.type] || eventTypeConfig.document;
            const Icon = config.icon;
            const isExpanded = expandedEvents.has(event.id);

            return (
              <div key={event.id || index} className="relative flex gap-4">
                {/* Icon */}
                <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-2 ${config.color} flex items-center justify-center bg-white`}>
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {event.title}
                        </h4>
                        {event.status && getStatusBadge(event.status)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {event.description}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500 ml-4">
                      <div>{formatDate(event.date)}</div>
                      <div>{formatTime(event.date)}</div>
                    </div>
                  </div>

                  {/* Provider */}
                  {event.provider && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <ProviderBadge
                        provider={{
                          firstName: event.provider.split(' ')[0],
                          lastName: event.provider.split(' ').slice(1).join(' '),
                          specialization: event.providerSpecialty
                        }}
                        size="xs"
                      />
                    </div>
                  )}

                  {/* Expandable details */}
                  {event.details && Object.keys(event.details).length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleEventExpand(event.id)}
                        className="flex items-center text-xs text-primary-600 hover:text-primary-700"
                      >
                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        {isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          {event.details.diagnoses && event.details.diagnoses.length > 0 && (
                            <div className="mb-2">
                              <strong>Diagnostics:</strong>
                              <ul className="ml-3 mt-1 list-disc">
                                {event.details.diagnoses.map((d, i) => (
                                  <li key={i}>{typeof d === 'object' ? (d.diagnosis || d.description || d.code || JSON.stringify(d)) : d}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {event.details.medicationCount > 0 && (
                            <div className="mb-1">
                              <strong>Médicaments:</strong> {event.details.medicationCount}
                            </div>
                          )}
                          {event.details.clinicalActs > 0 && (
                            <div className="mb-1">
                              <strong>Actes cliniques:</strong> {event.details.clinicalActs}
                            </div>
                          )}
                          {event.details.validUntil && (
                            <div className="mb-1">
                              <strong>Valide jusqu'au:</strong> {formatDate(event.details.validUntil)}
                            </div>
                          )}
                          {event.details.result && (
                            <div className="mb-1">
                              <strong>Résultat:</strong> {event.details.result}
                              {event.details.isAbnormal && (
                                <span className="ml-2 text-red-600">(Anormal)</span>
                              )}
                            </div>
                          )}
                          {event.details.visualAcuity && (
                            <div className="mb-1">
                              <strong>Acuité visuelle:</strong>{' '}
                              OD: {event.details.visualAcuity.rightEye?.uncorrected || 'N/A'} |
                              OG: {event.details.visualAcuity.leftEye?.uncorrected || 'N/A'}
                            </div>
                          )}
                          {/* Show message if no details available */}
                          {(!event.details.diagnoses || event.details.diagnoses.length === 0) &&
                           !event.details.medicationCount &&
                           !event.details.clinicalActs &&
                           !event.details.validUntil &&
                           !event.details.result &&
                           !event.details.visualAcuity && (
                            <p className="text-gray-400 italic">Aucun détail supplémentaire disponible</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Click action */}
                  {onEventClick && (
                    <button
                      onClick={() => onEventClick(event)}
                      className="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Voir plus
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load more indicator */}
      {filteredEvents.length > maxItems && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Affichage de {maxItems} sur {filteredEvents.length} événements
          </p>
        </div>
      )}
    </div>
  );
}
