import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

/**
 * useInventory - Generic inventory management hook
 * Consolidates duplicate state management from Frame, OpticalLens, ContactLens, Reagent inventories
 *
 * @param {Object} service - The inventory service (must have getItems, getStats, getAlerts, getBrands methods)
 * @param {Object} config - Configuration options
 * @returns {Object} State and handlers for inventory management
 */
const useInventory = (service, config = {}) => {
  const {
    itemsPerPage = 20,
    errorMessages = {
      fetchItems: 'Erreur lors du chargement des articles',
      fetchStats: 'Erreur lors du chargement des statistiques',
      fetchAlerts: 'Erreur lors du chargement des alertes',
      deleteItem: 'Erreur lors de la suppression'
    }
  } = config;

  // Core state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [brands, setBrands] = useState([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter state
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [inStockOnly, setInStockOnly] = useState(false);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [showStockReceiver, setShowStockReceiver] = useState(false);
  const [showStockAdjuster, setShowStockAdjuster] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Fetch items with filters
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: itemsPerPage,
        search: search || undefined,
        inStockOnly: inStockOnly || undefined,
        ...filters
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });

      const response = await service.getItems(params);
      setItems(response.data || []);
      setTotalPages(response.pages || 1);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error(errorMessages.fetchItems);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, inStockOnly, itemsPerPage, service, errorMessages.fetchItems]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!service.getStats) return;
    try {
      const response = await service.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [service]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!service.getAlerts) return;
    try {
      const response = await service.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [service]);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    if (!service.getBrands) return;
    try {
      const response = await service.getBrands();
      const brandsData = response.data || [];
      // Handle both array of strings and array of objects
      setBrands(brandsData.map(b => typeof b === 'string' ? b : b.brand));
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  }, [service]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchAlerts();
    fetchBrands();
  }, [fetchStats, fetchAlerts, fetchBrands]);

  // Fetch items when filters change
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Refresh all data
  const refreshAll = useCallback(() => {
    fetchItems();
    fetchStats();
    fetchAlerts();
    fetchBrands();
  }, [fetchItems, fetchStats, fetchAlerts, fetchBrands]);

  // Handle filter change
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
    setPage(1);
  }, []);

  // Handle item saved (create/update)
  const handleItemSaved = useCallback((isUpdate = false) => {
    setShowForm(false);
    setSelectedItem(null);
    fetchItems();
    fetchStats();
    fetchBrands();
    toast.success(isUpdate ? 'Article mis a jour' : 'Article ajoute');
  }, [fetchItems, fetchStats, fetchBrands]);

  // Handle stock received
  const handleStockReceived = useCallback(() => {
    setShowStockReceiver(false);
    setSelectedItem(null);
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats]);

  // Handle stock adjusted
  const handleStockAdjusted = useCallback(() => {
    setShowStockAdjuster(false);
    setSelectedItem(null);
    fetchItems();
    fetchStats();
  }, [fetchItems, fetchStats]);

  // Handle delete
  const handleDelete = useCallback(async (deleteMethod, reason = 'Discontinue par utilisateur') => {
    if (!selectedItem) return;

    try {
      await deleteMethod(selectedItem._id || selectedItem.id, reason);
      setShowDeleteConfirm(false);
      setSelectedItem(null);
      fetchItems();
      fetchStats();
      toast.success('Article supprime');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(error.response?.data?.message || errorMessages.deleteItem);
    }
  }, [selectedItem, fetchItems, fetchStats, errorMessages.deleteItem]);

  // Handle alert resolution
  const handleResolveAlert = useCallback(async (resolveMethod, itemId, alertId) => {
    try {
      await resolveMethod(itemId, alertId);
      fetchAlerts();
      toast.success('Alerte resolue');
    } catch (error) {
      toast.error('Erreur');
    }
  }, [fetchAlerts]);

  // Open form for new item
  const openNewForm = useCallback(() => {
    setSelectedItem(null);
    setShowForm(true);
  }, []);

  // Open form for editing
  const openEditForm = useCallback((item) => {
    setSelectedItem(item);
    setShowForm(true);
  }, []);

  // Open stock receiver
  const openStockReceiver = useCallback((item) => {
    setSelectedItem(item);
    setShowStockReceiver(true);
  }, []);

  // Open stock adjuster
  const openStockAdjuster = useCallback((item) => {
    setSelectedItem(item);
    setShowStockAdjuster(true);
  }, []);

  // Open delete confirm
  const openDeleteConfirm = useCallback((item) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  }, []);

  // Close all modals
  const closeModals = useCallback(() => {
    setShowForm(false);
    setShowStockReceiver(false);
    setShowStockAdjuster(false);
    setShowDeleteConfirm(false);
    setSelectedItem(null);
  }, []);

  return {
    // Data
    items,
    stats,
    alerts,
    brands,
    total,

    // Loading states
    loading,

    // Pagination
    page,
    totalPages,
    setPage,

    // Filters
    search,
    setSearch,
    filters,
    setFilters,
    handleFilterChange,
    inStockOnly,
    setInStockOnly,

    // Modal states
    showForm,
    setShowForm,
    showStockReceiver,
    setShowStockReceiver,
    showStockAdjuster,
    setShowStockAdjuster,
    showDeleteConfirm,
    setShowDeleteConfirm,
    selectedItem,
    setSelectedItem,

    // Handlers
    fetchItems,
    fetchStats,
    fetchAlerts,
    fetchBrands,
    refreshAll,
    handleItemSaved,
    handleStockReceived,
    handleStockAdjusted,
    handleDelete,
    handleResolveAlert,
    openNewForm,
    openEditForm,
    openStockReceiver,
    openStockAdjuster,
    openDeleteConfirm,
    closeModals
  };
};

export default useInventory;
