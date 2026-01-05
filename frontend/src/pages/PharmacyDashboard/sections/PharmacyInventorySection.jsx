import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Pill, Edit, Search, Loader2 } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * PharmacyInventorySection - All medications with search/filter
 */
export default function PharmacyInventorySection({
  totalItems,
  categories,
  statuses,
  onAdjustStock,
  refreshKey
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [medications, setMedications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 15;

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      const response = await api.get('/pharmacy/inventory', { params });
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setMedications(data);
      setTotalCount(response?.data?.pagination?.total || response?.data?.total || 0);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setMedications([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount and when refreshKey changes (clinic change)
  useEffect(() => {
    setPage(0); // Reset to first page on clinic change
    loadData();
  }, [refreshKey]);

  // Reload when filters change (after initial load)
  useEffect(() => {
    if (loaded) {
      loadData();
    }
  }, [page, searchTerm, categoryFilter, statusFilter]);

  const getStatusColor = (status) => {
    const colors = {
      'in-stock': 'bg-green-100 text-green-700',
      'low-stock': 'bg-orange-100 text-orange-700',
      'out-of-stock': 'bg-red-100 text-red-700',
      'overstocked': 'bg-blue-100 text-blue-700',
      'on-order': 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'in-stock': 'En stock',
      'low-stock': 'Stock faible',
      'out-of-stock': 'Rupture',
      'overstocked': 'Surstock',
      'on-order': 'En commande'
    };
    return labels[status] || status;
  };

  const getDaysToExpiry = (expirationDate) => {
    const now = new Date();
    const expiry = new Date(expirationDate);
    return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
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
      title="Inventaire Complet"
      icon={Package}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-indigo-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading && !loaded}
      badge={
        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
          {totalItems} articles
        </span>
      }
    >
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Rechercher par nom, code..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {statuses.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {medications.length === 0 ? (
        <SectionEmptyState
          icon={Package}
          message="Aucun médicament trouvé"
        />
      ) : (
        <>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Médicament</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {medications.map((med) => {
                  const earliestBatch = getEarliestExpiry(med.batches);
                  const daysToExpiry = earliestBatch ? getDaysToExpiry(earliestBatch.expirationDate) : null;

                  return (
                    <tr
                      key={med._id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => navigate(`/pharmacy/${med._id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Pill className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {med.medication?.brandName || med.medication?.genericName}
                            </p>
                            <p className="text-xs text-gray-500">{med.medication?.genericName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                          {med.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{med.inventory?.currentStock || 0}</p>
                        <p className="text-xs text-gray-500">
                          Min: {med.inventory?.reorderPoint || 0}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(med.inventory?.status)}`}>
                          {getStatusLabel(med.inventory?.status || 'in-stock')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {earliestBatch ? (
                          <div>
                            <p className={`text-sm ${
                              daysToExpiry < 30 ? 'text-red-600 font-semibold' :
                              daysToExpiry < 90 ? 'text-orange-600' : 'text-gray-900'
                            }`}>
                              {new Date(earliestBatch.expirationDate).toLocaleDateString('fr-FR')}
                            </p>
                            <p className="text-xs text-gray-500">{daysToExpiry}j</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {med.pricing?.sellingPrice
                          ? `${med.pricing.sellingPrice.toLocaleString('fr-FR')} CFA`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdjustStock?.(med);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                          title="Ajuster"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, totalCount)} sur {totalCount}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * rowsPerPage >= totalCount}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
