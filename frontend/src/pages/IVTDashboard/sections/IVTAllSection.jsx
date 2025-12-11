import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Eye, Search, Filter, Loader2 } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';

/**
 * IVTAllSection - All IVT injections with filters
 */
export default function IVTAllSection({ totalCount }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [injections, setInjections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState({
    eye: '',
    indication: '',
    medication: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        page,
        limit: 15
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await api.get('/ivt', { params });
      setInjections(response.data.data || []);
      setTotalPages(response.data.pages || 1);
      setLoaded(true);
    } catch (err) {
      console.error('Error fetching injections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loaded) {
      loadData();
    }
  }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const colors = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-gray-100 text-gray-800',
      'adverse-event': 'bg-red-100 text-red-800'
    };
    const labels = {
      'scheduled': 'Programmée',
      'in-progress': 'En cours',
      'completed': 'Terminée',
      'cancelled': 'Annulée',
      'adverse-event': 'Effet indésirable'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getIndicationLabel = (indication) => {
    const labels = {
      'wet_AMD': 'DMLA humide',
      'DME': 'OMD',
      'BRVO': 'OBVR',
      'CRVO': 'OVCR',
      'myopic_CNV': 'NVC myopique',
      'PDR': 'RDP',
      'neovascular_glaucoma': 'Glaucome NV',
      'uveitis': 'Uvéite',
      'CME': 'OMC'
    };
    return labels[indication] || indication;
  };

  return (
    <CollapsibleSection
      title="Toutes les IVT"
      icon={Stethoscope}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-indigo-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading && !loaded}
      badge={
        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
          {totalCount} injections
        </span>
      }
    >
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <select
          name="eye"
          value={filters.eye}
          onChange={handleFilterChange}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous les yeux</option>
          <option value="OD">Œil Droit (OD)</option>
          <option value="OS">Œil Gauche (OS)</option>
        </select>

        <select
          name="indication"
          value={filters.indication}
          onChange={handleFilterChange}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes indications</option>
          <option value="wet_AMD">DMLA humide</option>
          <option value="DME">OMD</option>
          <option value="BRVO">OBVR</option>
          <option value="CRVO">OVCR</option>
          <option value="myopic_CNV">NVC myopique</option>
          <option value="PDR">RDP</option>
          <option value="uveitis">Uvéite</option>
        </select>

        <input
          type="text"
          name="medication"
          value={filters.medication}
          onChange={handleFilterChange}
          placeholder="Médication..."
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />

        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tous statuts</option>
          <option value="scheduled">Programmée</option>
          <option value="completed">Terminée</option>
          <option value="cancelled">Annulée</option>
        </select>

        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleFilterChange}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleFilterChange}
          className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {injections.length === 0 ? (
        <SectionEmptyState
          icon={Stethoscope}
          message="Aucune injection IVT trouvée"
        />
      ) : (
        <>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Œil</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Indication</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Médication</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Série</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {injections.map((injection) => (
                  <tr
                    key={injection._id}
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => navigate(`/ivt/${injection._id}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(injection.injectionDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">
                        {injection.patient?.firstName} {injection.patient?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{injection.patient?.patientId}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded font-medium">
                        {injection.eye}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {getIndicationLabel(injection.indication?.primary)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {injection.medication?.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      #{injection.series?.injectionNumber}
                      <span className="text-gray-400 ml-1">({injection.series?.protocol})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(injection.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Page {page} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
