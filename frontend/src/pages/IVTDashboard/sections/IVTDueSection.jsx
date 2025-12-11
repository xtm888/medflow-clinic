import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, User, Calendar, Eye } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * IVTDueSection - Patients overdue for injection
 */
export default function IVTDueSection({ dueCount, onRefresh }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    if (loaded) return;

    setLoading(true);
    try {
      const response = await api.get('/ivt/due');
      setPatients(response.data.data || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching due patients:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysOverdue = (date) => {
    return Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
  };

  return (
    <CollapsibleSection
      title="Patients en Retard"
      icon={AlertCircle}
      iconColor="text-red-600"
      gradient="from-red-50 to-pink-50"
      defaultExpanded={dueCount > 0}
      onExpand={loadData}
      loading={loading}
      badge={
        dueCount > 0 && (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1 animate-pulse">
            <AlertCircle className="h-3 w-3" />
            {dueCount} en retard
          </span>
        )
      }
    >
      {patients.length === 0 ? (
        <SectionEmptyState
          icon={AlertCircle}
          message="Aucun patient en retard pour injection"
        />
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {patients.map((item) => {
            const daysOverdue = getDaysOverdue(item.nextInjection?.recommendedDate);

            return (
              <div
                key={item._id}
                className={`p-4 rounded-lg border cursor-pointer transition ${
                  daysOverdue > 14
                    ? 'bg-red-100 border-red-300 hover:bg-red-150'
                    : 'bg-red-50 border-red-200 hover:bg-red-100'
                }`}
                onClick={() => navigate(`/ivt/${item._id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${daysOverdue > 14 ? 'bg-red-200' : 'bg-red-100'}`}>
                      <User className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.patient?.firstName} {item.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{item.patient?.patientId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                          {item.eye}
                        </span>
                        <span className="text-xs text-gray-600">
                          {item.indication?.primary}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-red-600">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {formatDate(item.nextInjection?.recommendedDate)}
                      </span>
                    </div>
                    <p className={`text-xs font-semibold mt-1 ${
                      daysOverdue > 14 ? 'text-red-700' : 'text-red-600'
                    }`}>
                      {daysOverdue} jours de retard
                    </p>
                    {item.medication?.name && (
                      <p className="text-xs text-gray-500 mt-1">{item.medication.name}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
