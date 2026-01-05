import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Clock } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * IVTUpcomingSection - Upcoming injections in next 30 days
 */
export default function IVTUpcomingSection({ upcomingCount, onRefresh }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [injections, setInjections] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    if (loaded) return;

    setLoading(true);
    try {
      const response = await api.get('/ivt/upcoming', { params: { days: 30 } });
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setInjections(data);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching upcoming:', err);
      setInjections([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  };

  const getDaysUntil = (date) => {
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  // Group by week
  const groupedByWeek = injections.reduce((acc, inj) => {
    const daysUntil = getDaysUntil(inj.nextInjection?.recommendedDate);
    let weekLabel;
    if (daysUntil <= 7) weekLabel = 'Cette semaine';
    else if (daysUntil <= 14) weekLabel = 'Semaine prochaine';
    else weekLabel = 'Dans 2-4 semaines';

    if (!acc[weekLabel]) acc[weekLabel] = [];
    acc[weekLabel].push(inj);
    return acc;
  }, {});

  return (
    <CollapsibleSection
      title="À Venir (30 jours)"
      icon={Calendar}
      iconColor="text-green-600"
      gradient="from-green-50 to-emerald-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading}
      badge={
        upcomingCount > 0 && (
          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
            {upcomingCount} programmées
          </span>
        )
      }
    >
      {injections.length === 0 ? (
        <SectionEmptyState
          icon={Calendar}
          message="Aucune injection programmée dans les 30 prochains jours"
        />
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {Object.entries(groupedByWeek).map(([weekLabel, weekInjections]) => (
            <div key={weekLabel}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{weekLabel}</h4>
              <div className="space-y-2">
                {weekInjections.map((injection) => {
                  const daysUntil = getDaysUntil(injection.nextInjection?.recommendedDate);

                  return (
                    <div
                      key={injection._id}
                      className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition cursor-pointer"
                      onClick={() => navigate(`/ivt/${injection._id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-100">
                          <User className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {injection.patient?.firstName} {injection.patient?.lastName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">
                              {injection.patient?.patientId}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {injection.eye}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-700">
                          {formatDate(injection.nextInjection?.recommendedDate)}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {daysUntil === 0 ? "Aujourd'hui" :
                           daysUntil === 1 ? 'Demain' :
                           `Dans ${daysUntil}j`}
                        </p>
                        {injection.medication?.name && (
                          <p className="text-xs text-gray-400">{injection.medication.name}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
