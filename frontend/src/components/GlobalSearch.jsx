import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Calendar, FileText, Clock, Home, X, TrendingUp, ChevronRight } from 'lucide-react';
import api from '../services/api';

const QUICK_ACTIONS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Home, path: '/dashboard', category: 'Navigation' },
  { id: 'patients', label: 'Patients', icon: User, path: '/patients', category: 'Navigation' },
  { id: 'queue', label: 'File d\'attente', icon: Clock, path: '/queue', category: 'Navigation' },
  { id: 'appointments', label: 'Rendez-vous', icon: Calendar, path: '/appointments', category: 'Navigation' },
  { id: 'prescriptions', label: 'Ordonnances', icon: FileText, path: '/prescriptions', category: 'Navigation' },
];

function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    setRecentSearches(recent);
  }, [isOpen]);

  // Search function with debounce
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults(QUICK_ACTIONS);
      return;
    }

    setLoading(true);

    try {
      // Search patients
      const patientsResponse = await api.get(`/patients?search=${encodeURIComponent(searchQuery)}&limit=5`);
      const patients = (patientsResponse.data.data || patientsResponse.data.patients || []).map(patient => ({
        id: `patient-${patient._id}`,
        type: 'patient',
        label: `${patient.firstName} ${patient.lastName}`,
        subtitle: patient.phone || patient.email,
        icon: User,
        path: `/visits/new/${patient._id}`,
        data: patient,
        category: 'Patients'
      }));

      // Search appointments (if query looks like a date or time)
      let appointments = [];
      if (/\d{1,2}[/-]\d{1,2}/.test(searchQuery) || /\d{1,2}:\d{2}/.test(searchQuery)) {
        try {
          const appointmentsResponse = await api.get(`/appointments?search=${encodeURIComponent(searchQuery)}&limit=5`);
          appointments = (appointmentsResponse.data.data || appointmentsResponse.data.appointments || []).map(apt => ({
            id: `appointment-${apt._id}`,
            type: 'appointment',
            label: `RDV: ${apt.patient?.firstName} ${apt.patient?.lastName}`,
            subtitle: new Date(apt.date).toLocaleString('fr-FR'),
            icon: Calendar,
            path: `/appointments`,
            data: apt,
            category: 'Rendez-vous'
          }));
        } catch (err) {
          console.error('Error searching appointments:', err);
        }
      }

      // Filter quick actions by query
      const filteredActions = QUICK_ACTIONS.filter(action =>
        action.label.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Combine results
      setResults([...patients, ...appointments, ...filteredActions]);
    } catch (error) {
      console.error('Search error:', error);
      setResults(QUICK_ACTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (item) => {
    // Save to recent searches
    const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const newRecent = [
      { ...item, timestamp: Date.now() },
      ...recent.filter(r => r.id !== item.id)
    ].slice(0, 10);
    localStorage.setItem('recentSearches', JSON.stringify(newRecent));

    // Navigate
    if (item.path) {
      navigate(item.path);
    }

    // Close search
    onClose();
  };

  const groupResultsByCategory = () => {
    const grouped = {};
    results.forEach(result => {
      const category = result.category || 'Autres';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(result);
    });
    return grouped;
  };

  if (!isOpen) return null;

  const groupedResults = groupResultsByCategory();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen px-4 pt-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-50 backdrop-blur-sm"
          onClick={onClose}
        ></div>

        {/* Search Panel */}
        <div className="relative inline-block w-full max-w-2xl my-8 text-left align-middle transition-all transform bg-white rounded-xl shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher des patients, rendez-vous, ou naviguer..."
              className="flex-1 text-lg bg-transparent border-none outline-none placeholder-gray-400"
            />
            {loading && (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto py-2">
            {results.length === 0 && query && !loading && (
              <div className="px-4 py-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Aucun résultat trouvé pour "{query}"</p>
              </div>
            )}

            {results.length === 0 && !query && recentSearches.length > 0 && (
              <div className="px-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" />
                  Récents
                </div>
                {recentSearches.slice(0, 5).map((item, index) => {
                  const IconComponent = item.icon || Search;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        selectedIndex === index
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <IconComponent className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{item.label}</div>
                        {item.subtitle && (
                          <div className="text-xs text-gray-500">{item.subtitle}</div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  );
                })}
              </div>
            )}

            {results.length > 0 && (
              <div className="px-2 space-y-4">
                {Object.entries(groupedResults).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {category}
                    </div>
                    {items.map((result, idx) => {
                      const globalIndex = results.indexOf(result);
                      const IconComponent = result.icon || Search;
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <IconComponent className="w-5 h-5 flex-shrink-0" />
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium">{result.label}</div>
                            {result.subtitle && (
                              <div className="text-xs text-gray-500">{result.subtitle}</div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↓</kbd>
                Naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↵</kbd>
                Sélectionner
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">Esc</kbd>
                Fermer
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
