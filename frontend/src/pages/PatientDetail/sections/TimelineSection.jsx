import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Filter, ChevronRight } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import PatientTimeline from '../../../components/PatientTimeline';
import patientService from '../../../services/patientService';

/**
 * TimelineSection - Patient activity timeline
 */
export default function TimelineSection({ patientId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [timeline, setTimeline] = useState([]);

  const loadData = async () => {
    if (Array.isArray(timeline) && timeline.length > 0) return;

    console.log('[TimelineSection] Loading timeline for patientId:', patientId);
    setLoading(true);
    try {
      const res = await patientService.getPatientTimeline(patientId);
      console.log('[TimelineSection] Timeline API response:', res);
      // Handle nested data structure: res.data.data is the actual array
      const data = res.data?.data || res.data || res;
      console.log('[TimelineSection] Timeline data:', data);
      console.log('[TimelineSection] Timeline count:', Array.isArray(data) ? data.length : 'not an array');
      // Ensure timeline is always an array
      setTimeline(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[TimelineSection] Error loading timeline:', err);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event) => {
    switch (event.type) {
      case 'visit':
        navigate(`/visits/${event.id}`);
        break;
      case 'prescription':
        navigate(`/prescriptions?patientId=${patientId}&highlight=${event.id}`);
        break;
      case 'examination':
        navigate(`/ophthalmology/exam/${event.id}`);
        break;
      case 'laboratory':
        navigate(`/laboratory?patientId=${patientId}&highlight=${event.id}`);
        break;
      case 'appointment':
        navigate(`/appointments?id=${event.id}`);
        break;
      case 'invoice':
        navigate(`/invoicing?id=${event.id}`);
        break;
      default:
        break;
    }
  };

  return (
    <CollapsibleSection
      title="Chronologie"
      icon={History}
      iconColor="text-indigo-600"
      gradient="from-indigo-50 to-violet-50"
      defaultExpanded={false}
      onExpand={loadData}
      loading={loading}
      badge={
        Array.isArray(timeline) && timeline.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
            {timeline.length} événements
          </span>
        )
      }
    >
      {!Array.isArray(timeline) || timeline.length === 0 ? (
        <SectionEmptyState
          icon={History}
          message="Aucun historique disponible"
        />
      ) : (
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="flex gap-4 text-sm">
            <TimelineStat
              label="Visites"
              count={Array.isArray(timeline) ? timeline.filter(e => e.type === 'visit').length : 0}
            />
            <TimelineStat
              label="Prescriptions"
              count={Array.isArray(timeline) ? timeline.filter(e => e.type === 'prescription').length : 0}
            />
            <TimelineStat
              label="Examens"
              count={Array.isArray(timeline) ? timeline.filter(e => e.type === 'examination').length : 0}
            />
            <TimelineStat
              label="Labo"
              count={Array.isArray(timeline) ? timeline.filter(e => e.type === 'laboratory').length : 0}
            />
          </div>

          {/* Timeline Component */}
          <PatientTimeline
            events={Array.isArray(timeline) ? timeline.slice(0, 20) : []}
            onEventClick={handleEventClick}
            showFilters={false}
            maxItems={20}
            compact
          />

          {Array.isArray(timeline) && timeline.length > 20 && (
            <button
              onClick={() => navigate(`/patients/${patientId}?tab=timeline`)}
              className="w-full flex items-center justify-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 py-2"
            >
              Voir la chronologie complète
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// Timeline stat component
function TimelineStat({ label, count }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-500">{label}:</span>
      <span className="font-semibold text-gray-900">{count}</span>
    </div>
  );
}
