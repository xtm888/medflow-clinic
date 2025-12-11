import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingDown, Pill, Edit, AlertTriangle, Loader2 } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * PharmacyLowStockSection - Medications with low stock
 */
export default function PharmacyLowStockSection({
  lowStockCount,
  onAdjustStock,
  onRefresh,
  refreshKey
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/pharmacy/low-stock');
      setMedications(response.data.data || []);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching low stock:', err);
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

  return (
    <CollapsibleSection
      title="Stock Faible"
      icon={TrendingDown}
      iconColor="text-orange-600"
      gradient="from-orange-50 to-amber-50"
      defaultExpanded={lowStockCount > 0}
      onExpand={loadData}
      loading={loading}
      badge={
        lowStockCount > 0 && (
          <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {lowStockCount} articles
          </span>
        )
      }
    >
      {medications.length === 0 ? (
        <SectionEmptyState
          icon={TrendingDown}
          message="Aucun médicament en stock faible"
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {medications.map((med) => (
            <div
              key={med._id}
              className="flex items-center justify-between p-3 bg-white border border-orange-200 rounded-lg hover:bg-orange-50 transition cursor-pointer"
              onClick={() => navigate(`/pharmacy/${med._id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Pill className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {med.medication?.brandName || med.medication?.genericName || med.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {med.medication?.genericName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-lg font-bold text-orange-600">
                    {med.inventory?.currentStock || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    Min: {med.inventory?.reorderPoint || 0}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdjustStock?.(med);
                  }}
                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded"
                  title="Ajuster le stock"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
