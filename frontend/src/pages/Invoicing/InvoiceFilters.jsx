import { memo } from 'react';
import PropTypes from 'prop-types';
import { Search, FileText } from 'lucide-react';

/**
 * Invoice Filters Component
 * Category summary cards, search bar, and status filter
 */
const InvoiceFilters = memo(({
  categoryStats,
  invoiceCategories,
  allowedCategories,
  filterCategory,
  filterStatus,
  searchTerm,
  onCategoryChange,
  onStatusChange,
  onSearchChange
}) => {
  return (
    <>
      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* All Categories Card */}
        {allowedCategories.includes('all') && (
          <div
            onClick={() => onCategoryChange('all')}
            className={`card cursor-pointer transition-all ${
              filterCategory === 'all'
                ? 'ring-2 ring-gray-500 bg-gray-50'
                : 'hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gray-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  filterCategory === 'all'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {categoryStats.all?.count || 0}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900">Tous</h3>
            <p className="text-lg font-bold text-gray-700">
              {(categoryStats.all?.total || 0).toLocaleString('fr-FR')} FC
            </p>
            <p className="text-xs text-gray-500">
              {categoryStats.all?.paidCount || 0} payées
            </p>
          </div>
        )}

        {/* Category Cards */}
        {Object.entries(invoiceCategories).map(([key, config]) => {
          if (!allowedCategories.includes('all') && !allowedCategories.includes(key)) {
            return null;
          }

          const Icon = config.icon;
          const stats = categoryStats[key] || { count: 0, total: 0, paidCount: 0 };
          const isActive = filterCategory === key;

          return (
            <div
              key={key}
              onClick={() => onCategoryChange(key)}
              className={`card cursor-pointer transition-all ${
                isActive
                  ? `ring-2 ring-${config.color}-500 ${config.lightBg}`
                  : 'hover:shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 ${config.bgColor} rounded-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isActive
                      ? `${config.bgColor} text-white`
                      : `${config.lightBg} ${config.textColor}`
                  }`}
                >
                  {stats.count}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{config.labelFr}</h3>
              <p className={`text-lg font-bold ${config.textColor}`}>
                {stats.total.toLocaleString('fr-FR')} FC
              </p>
              <p className="text-xs text-gray-500">{stats.paidCount} payées</p>
            </div>
          );
        })}
      </div>

      {/* Search & Status Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro de facture ou patient..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="input w-full md:w-48"
          >
            <option value="all">Tous les statuts</option>
            <option value="PAID">Payé</option>
            <option value="PARTIAL">Partiel</option>
            <option value="PENDING">En attente</option>
            <option value="OVERDUE">En retard</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>
    </>
  );
});

InvoiceFilters.displayName = 'InvoiceFilters';

InvoiceFilters.propTypes = {
  categoryStats: PropTypes.object.isRequired,
  invoiceCategories: PropTypes.object.isRequired,
  allowedCategories: PropTypes.arrayOf(PropTypes.string).isRequired,
  filterCategory: PropTypes.string.isRequired,
  filterStatus: PropTypes.string.isRequired,
  searchTerm: PropTypes.string.isRequired,
  onCategoryChange: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  onSearchChange: PropTypes.func.isRequired,
};

export default InvoiceFilters;
