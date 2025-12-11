import { memo } from 'react';
import PropTypes from 'prop-types';
import { Plus, RefreshCw } from 'lucide-react';

/**
 * Invoice Header Component
 * Displays the page title, category name, and action buttons
 */
const InvoiceHeader = memo(({
  filterCategory,
  categoryConfig,
  canCreateInvoice,
  onRefresh,
  onCreateNew
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Facturation</h1>
        <p className="mt-1 text-sm text-gray-500">
          {filterCategory === 'all'
            ? 'Toutes les catégories'
            : categoryConfig?.labelFr || 'Facturation'}
        </p>
      </div>
      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          className="btn btn-secondary flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Actualiser</span>
        </button>
        {canCreateInvoice && (
          <button
            onClick={onCreateNew}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouvelle facture</span>
          </button>
        )}
      </div>
    </div>
  );
});

InvoiceHeader.displayName = 'InvoiceHeader';

InvoiceHeader.propTypes = {
  filterCategory: PropTypes.string.isRequired,
  categoryConfig: PropTypes.shape({
    labelFr: PropTypes.string,
  }),
  canCreateInvoice: PropTypes.bool.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onCreateNew: PropTypes.func.isRequired,
};

export default InvoiceHeader;
