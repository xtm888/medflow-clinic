import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiConfig';
import { useAuth } from '../contexts/AuthContext';

const IVTDashboard = () => {
  const [injections, setInjections] = useState([]);
  const [upcomingInjections, setUpcomingInjections] = useState([]);
  const [patientsDue, setPatientsDue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    eye: '',
    indication: '',
    medication: '',
    status: '',
    startDate: '',
    endDate: '',
    searchTerm: ''
  });

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('all'); // all, upcoming, due

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [filters, page, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'all') {
        await fetchInjections();
      } else if (activeTab === 'upcoming') {
        await fetchUpcoming();
      } else if (activeTab === 'due') {
        await fetchDue();
      }

      // Always fetch stats
      await fetchStats();

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load IVT injection data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInjections = async () => {
    const params = {
      ...filters,
      page,
      limit: 20
    };

    const response = await api.get('/ivt', { params });
    setInjections(response.data.data);
    setTotalPages(response.data.pages);
  };

  const fetchUpcoming = async () => {
    const response = await api.get('/ivt/upcoming', {
      params: { days: 30 }
    });
    setUpcomingInjections(response.data.data);
  };

  const fetchDue = async () => {
    const response = await api.get('/ivt/due');
    setPatientsDue(response.data.data);
  };

  const fetchStats = async () => {
    const response = await api.get('/ivt/stats', {
      params: {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      }
    });
    setStats(response.data.data);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(1);
  };

  const handleCreateInjection = () => {
    navigate('/ivt/new');
  };

  const handleViewInjection = (injectionId) => {
    navigate(`/ivt/${injectionId}`);
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-gray-100 text-gray-800',
      'adverse-event': 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const getIndicationBadge = (indication) => {
    const colors = {
      'wet_AMD': 'bg-orange-100 text-orange-800',
      'DME': 'bg-purple-100 text-purple-800',
      'BRVO': 'bg-indigo-100 text-indigo-800',
      'CRVO': 'bg-pink-100 text-pink-800',
      'myopic_CNV': 'bg-teal-100 text-teal-800'
    };

    const labels = {
      'wet_AMD': 'DMLA humide',
      'DME': 'OMD',
      'BRVO': 'OBVR',
      'CRVO': 'OVCR',
      'myopic_CNV': 'NVC myopique',
      'PDR': 'RDP',
      'neovascular_glaucoma': 'Glaucome néovasculaire',
      'uveitis': 'Uvéite',
      'CME': 'OMC'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[indication] || 'bg-gray-100 text-gray-800'}`}>
        {labels[indication] || indication}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && injections.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Injections Intravitréennes (IVT)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestion des injections anti-VEGF et stéroïdes
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'ophthalmologist') && (
          <button
            onClick={handleCreateInjection}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle IVT
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Injections</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInjections || 0}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taux Complications</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.complicationRate ? `${stats.complicationRate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">À venir (30j)</p>
                <p className="text-2xl font-bold text-gray-900">{upcomingInjections.length}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Patients en retard</p>
                <p className="text-2xl font-bold text-red-600">{patientsDue.length}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all')}
              className={`${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Toutes les IVT
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`${
                activeTab === 'upcoming'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              À venir
              {upcomingInjections.length > 0 && (
                <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs">
                  {upcomingInjections.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('due')}
              className={`${
                activeTab === 'due'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              En retard
              {patientsDue.length > 0 && (
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                  {patientsDue.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Filters (only show for 'all' tab) */}
        {activeTab === 'all' && (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Œil</label>
                <select
                  name="eye"
                  value={filters.eye}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  <option value="OD">Œil Droit (OD)</option>
                  <option value="OS">Œil Gauche (OS)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                <select
                  name="indication"
                  value={filters.indication}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Toutes</option>
                  <option value="wet_AMD">DMLA humide</option>
                  <option value="DME">OMD (Diabétique)</option>
                  <option value="BRVO">OBVR</option>
                  <option value="CRVO">OVCR</option>
                  <option value="myopic_CNV">NVC myopique</option>
                  <option value="PDR">RDP</option>
                  <option value="uveitis">Uvéite</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Médication</label>
                <input
                  type="text"
                  name="medication"
                  value={filters.medication}
                  onChange={handleFilterChange}
                  placeholder="Avastin, Lucentis..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous</option>
                  <option value="scheduled">Programmée</option>
                  <option value="completed">Terminée</option>
                  <option value="cancelled">Annulée</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Content based on active tab */}
      {activeTab === 'all' && (
        <InjectionsList
          injections={injections}
          onViewInjection={handleViewInjection}
          getStatusBadge={getStatusBadge}
          getIndicationBadge={getIndicationBadge}
          formatDate={formatDate}
        />
      )}

      {activeTab === 'upcoming' && (
        <UpcomingList
          injections={upcomingInjections}
          onViewInjection={handleViewInjection}
          formatDate={formatDate}
        />
      )}

      {activeTab === 'due' && (
        <DueList
          patients={patientsDue}
          onViewInjection={handleViewInjection}
          formatDate={formatDate}
        />
      )}

      {/* Pagination (only for 'all' tab) */}
      {activeTab === 'all' && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg mt-4">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> sur <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Suivant
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-components
const InjectionsList = ({ injections, onViewInjection, getStatusBadge, getIndicationBadge, formatDate }) => (
  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Œil</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Indication</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Médication</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Série</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {injections.length === 0 ? (
            <tr>
              <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-sm">Aucune injection IVT trouvée</p>
              </td>
            </tr>
          ) : (
            injections.map((injection) => (
              <tr key={injection._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onViewInjection(injection._id)}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(injection.injectionDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {injection.patient?.firstName} {injection.patient?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{injection.patient?.patientId}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">{injection.eye}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getIndicationBadge(injection.indication?.primary)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {injection.medication?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  #{injection.series?.injectionNumber}
                  <span className="text-gray-500 ml-1">({injection.series?.protocol})</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(injection.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewInjection(injection._id);
                    }}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Voir
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const UpcomingList = ({ injections, onViewInjection, formatDate }) => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">Injections à venir (30 prochains jours)</h3>
    {injections.length === 0 ? (
      <p className="text-gray-500 text-center py-8">Aucune injection programmée</p>
    ) : (
      <div className="space-y-4">
        {injections.map((injection) => (
          <div
            key={injection._id}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onViewInjection(injection._id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {injection.patient?.firstName} {injection.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">{injection.patient?.patientId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600">
                  {formatDate(injection.nextInjection?.recommendedDate)}
                </p>
                <p className="text-xs text-gray-500">{injection.eye} - {injection.medication?.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const DueList = ({ patients, onViewInjection, formatDate }) => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <h3 className="text-lg font-medium text-gray-900 mb-4">Patients en retard pour injection</h3>
    {patients.length === 0 ? (
      <p className="text-gray-500 text-center py-8">Aucun patient en retard</p>
    ) : (
      <div className="space-y-4">
        {patients.map((item) => (
          <div
            key={item._id}
            className="border border-red-200 rounded-lg p-4 hover:bg-red-50 cursor-pointer bg-red-50"
            onClick={() => onViewInjection(item._id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.patient?.firstName} {item.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">{item.patient?.patientId}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {item.indication?.primary} - {item.eye}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-red-600">
                  Prévue: {formatDate(item.nextInjection?.recommendedDate)}
                </p>
                <p className="text-xs text-red-500">
                  {Math.floor((new Date() - new Date(item.nextInjection?.recommendedDate)) / (1000 * 60 * 60 * 24))} jours de retard
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default IVTDashboard;
