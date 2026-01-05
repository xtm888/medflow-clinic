import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Pill, Edit, AlertCircle, Loader2 } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * PharmacyExpiringSection - Medications expiring soon
 */
export default function PharmacyExpiringSection({
  expiringCount,
  onAdjustStock,
  refreshKey
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/pharmacy/expiring', { params: { days: 30 } });
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setMedications(data);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching expiring:', err);
      setMedications([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload when refreshKey changes (clinic change)
  useEffect(() => {
    if (loaded) {
      loadData();
    }
  }, [refreshKey]);

  const getDaysToExpiry = (expirationDate) => {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diff = expiry - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getEarliestExpiry = (batches) => {
    if (!batches || batches.length === 0) return null;
    const activeBatches = batches.filter(b => b.status === 'active' && b.quantity > 0);
    if (activeBatches.length === 0) return null;
    return activeBatches.reduce((earliest, batch) => {
      return new Date(batch.expirationDate) < new Date(earliest.expirationDate) ? batch : earliest;
    });
  };

  return (
    <CollapsibleSection
      title="Expire Bientôt"
      icon={Calendar}
      iconColor="text-red-600"
      gradient="from-red-50 to-pink-50"
      defaultExpanded={expiringCount > 0}
      onExpand={loadData}
      loading={loading}
      badge={
        expiringCount > 0 && (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {expiringCount} articles
          </span>
        )
      }
    >
      {medications.length === 0 ? (
        <SectionEmptyState
          icon={Calendar}
          message="Aucun médicament n'expire dans les 30 prochains jours"
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {medications.map((med) => {
            const earliestBatch = getEarliestExpiry(med.batches);
            const daysToExpiry = earliestBatch ? getDaysToExpiry(earliestBatch.expirationDate) : null;

            return (
              <div
                key={med._id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-red-50 transition cursor-pointer ${
                  daysToExpiry !== null && daysToExpiry < 7
                    ? 'bg-red-100 border-red-300'
                    : daysToExpiry !== null && daysToExpiry < 14
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-red-200'
                }`}
                onClick={() => navigate(`/pharmacy/${med._id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    daysToExpiry !== null && daysToExpiry < 7 ? 'bg-red-200' : 'bg-red-100'
                  }`}>
                    <Pill className={`h-5 w-5 ${
                      daysToExpiry !== null && daysToExpiry < 7 ? 'text-red-700' : 'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {med.medication?.brandName || med.medication?.genericName || med.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Stock: {med.inventory?.currentStock || 0} unités
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {earliestBatch && (
                      <>
                        <p className={`text-sm font-semibold ${
                          daysToExpiry < 7 ? 'text-red-700' :
                          daysToExpiry < 14 ? 'text-red-600' :
                          'text-orange-600'
                        }`}>
                          {new Date(earliestBatch.expirationDate).toLocaleDateString('fr-FR')}
                        </p>
                        <p className={`text-xs ${
                          daysToExpiry < 7 ? 'text-red-600 font-medium' : 'text-gray-500'
                        }`}>
                          {daysToExpiry} jours restants
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdjustStock?.(med);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded"
                    title="Ajuster le stock"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
