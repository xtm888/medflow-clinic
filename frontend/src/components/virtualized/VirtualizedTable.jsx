/**
 * VirtualizedTable Component
 *
 * A virtualized table component for efficiently rendering large datasets.
 * Supports:
 * - Fixed header
 * - Sortable columns
 * - Row selection
 * - Row click handling
 * - Custom cell rendering
 */
import React, { useRef, useMemo, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PropTypes from 'prop-types';

/**
 * VirtualizedTable - A performant table for large datasets
 *
 * @param {Object} props
 * @param {Array} props.data - Array of row data objects
 * @param {Array} props.columns - Column definitions
 * @param {number} props.rowHeight - Height of each row in pixels (default: 48)
 * @param {number} props.height - Height of the table body
 * @param {number} props.overscan - Number of rows to render outside visible area
 * @param {Function} props.onRowClick - Callback when row is clicked
 * @param {boolean} props.selectable - Enable row selection
 * @param {Array} props.selectedRows - Array of selected row IDs
 * @param {Function} props.onSelectionChange - Callback when selection changes
 * @param {string} props.rowKey - Property to use as row key (default: '_id')
 * @param {Function} props.rowClassName - Function to determine row CSS class
 * @param {boolean} props.stickyHeader - Keep header fixed while scrolling
 * @param {boolean} props.loading - Show loading state
 * @param {ReactNode} props.emptyComponent - Component to show when table is empty
 * @param {string} props.className - Additional CSS classes
 */
const VirtualizedTable = ({
  data = [],
  columns = [],
  rowHeight = 48,
  height = 400,
  overscan = 5,
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey = '_id',
  rowClassName,
  stickyHeader = true,
  loading = false,
  emptyComponent,
  className = ''
}) => {
  const parentRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sort data if sort config is set
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number') {
        comparison = aVal - bVal;
      } else if (aVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sortConfig]);

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan
  });

  // Handle sort
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Handle row selection
  const handleRowSelect = useCallback((rowId, event) => {
    if (!selectable || !onSelectionChange) return;

    event.stopPropagation();

    const newSelection = selectedRows.includes(rowId)
      ? selectedRows.filter(id => id !== rowId)
      : [...selectedRows, rowId];

    onSelectionChange(newSelection);
  }, [selectable, selectedRows, onSelectionChange]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!selectable || !onSelectionChange) return;

    if (selectedRows.length === sortedData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedData.map(row => row[rowKey]));
    }
  }, [selectable, selectedRows, sortedData, rowKey, onSelectionChange]);

  // Check if all selected
  const isAllSelected = selectable && selectedRows.length === sortedData.length && sortedData.length > 0;
  const isIndeterminate = selectable && selectedRows.length > 0 && selectedRows.length < sortedData.length;

  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems();

  // Calculate total width
  const totalWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + (col.width || 150), 0);
  }, [columns]);

  // Render header
  const renderHeader = () => (
    <div
      className="virtualized-table__header"
      style={{
        display: 'flex',
        height: rowHeight,
        position: stickyHeader ? 'sticky' : 'relative',
        top: 0,
        zIndex: 1,
        background: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        minWidth: totalWidth
      }}
    >
      {selectable && (
        <div
          className="virtualized-table__cell virtualized-table__cell--checkbox"
          style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isIndeterminate;
            }}
            onChange={handleSelectAll}
            aria-label="Select all"
          />
        </div>
      )}
      {columns.map((column) => (
        <div
          key={column.key}
          className={`virtualized-table__cell virtualized-table__cell--header ${column.sortable ? 'virtualized-table__cell--sortable' : ''}`}
          style={{
            width: column.width || 150,
            flex: column.flex || 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontWeight: 600,
            color: '#374151',
            cursor: column.sortable ? 'pointer' : 'default'
          }}
          onClick={() => column.sortable && handleSort(column.key)}
        >
          {column.header}
          {column.sortable && sortConfig.key === column.key && (
            <span style={{ marginLeft: 4 }}>
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  // Render loading state
  if (loading && data.length === 0) {
    return (
      <div className={`virtualized-table virtualized-table--loading ${className}`}>
        {renderHeader()}
        <div
          style={{
            height: height - rowHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="virtualized-table__loading">
            <div className="virtualized-table__spinner" />
            <span>Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!loading && data.length === 0) {
    return (
      <div className={`virtualized-table virtualized-table--empty ${className}`}>
        {renderHeader()}
        <div
          style={{
            height: height - rowHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {emptyComponent || (
            <div className="virtualized-table__empty">
              <span>Aucune donnée à afficher</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`virtualized-table ${className}`}>
      {renderHeader()}

      <div
        ref={parentRef}
        className="virtualized-table__body"
        style={{
          height: height - rowHeight,
          overflow: 'auto',
          contain: 'strict'
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
            minWidth: totalWidth
          }}
        >
          {virtualItems.map((virtualRow) => {
            const row = sortedData[virtualRow.index];
            const rowId = row[rowKey];
            const isSelected = selectedRows.includes(rowId);
            const customClassName = rowClassName ? rowClassName(row, virtualRow.index) : '';

            return (
              <div
                key={rowId || virtualRow.index}
                data-index={virtualRow.index}
                className={`virtualized-table__row ${isSelected ? 'virtualized-table__row--selected' : ''} ${customClassName}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid #e5e7eb',
                  background: isSelected ? '#eff6ff' : virtualRow.index % 2 === 0 ? '#fff' : '#f9fafb',
                  cursor: onRowClick ? 'pointer' : 'default'
                }}
                onClick={() => onRowClick && onRowClick(row, virtualRow.index)}
              >
                {selectable && (
                  <div
                    className="virtualized-table__cell virtualized-table__cell--checkbox"
                    style={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(rowId, e)}
                      aria-label={`Select row ${virtualRow.index + 1}`}
                    />
                  </div>
                )}
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="virtualized-table__cell"
                    style={{
                      width: column.width || 150,
                      flex: column.flex || 'none',
                      padding: '0 12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {column.render
                      ? column.render(row[column.key], row, virtualRow.index)
                      : row[column.key]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator for infinite scroll */}
      {loading && data.length > 0 && (
        <div
          className="virtualized-table__loading-more"
          style={{ textAlign: 'center', padding: 12, color: '#6b7280' }}
        >
          Chargement...
        </div>
      )}
    </div>
  );
};

VirtualizedTable.propTypes = {
  data: PropTypes.array.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.node.isRequired,
      width: PropTypes.number,
      flex: PropTypes.string,
      sortable: PropTypes.bool,
      render: PropTypes.func
    })
  ).isRequired,
  rowHeight: PropTypes.number,
  height: PropTypes.number,
  overscan: PropTypes.number,
  onRowClick: PropTypes.func,
  selectable: PropTypes.bool,
  selectedRows: PropTypes.array,
  onSelectionChange: PropTypes.func,
  rowKey: PropTypes.string,
  rowClassName: PropTypes.func,
  stickyHeader: PropTypes.bool,
  loading: PropTypes.bool,
  emptyComponent: PropTypes.node,
  className: PropTypes.string
};

/**
 * CSS Styles (add to global CSS or component stylesheet):
 *
 * .virtualized-table {
 *   border: 1px solid #e5e7eb;
 *   border-radius: 8px;
 *   overflow: hidden;
 * }
 *
 * .virtualized-table__row:hover {
 *   background: #f3f4f6 !important;
 * }
 *
 * .virtualized-table__row--selected {
 *   background: #eff6ff !important;
 * }
 *
 * .virtualized-table__cell--sortable:hover {
 *   background: #f1f5f9;
 * }
 *
 * .virtualized-table__loading,
 * .virtualized-table__empty {
 *   display: flex;
 *   flex-direction: column;
 *   align-items: center;
 *   gap: 12px;
 *   color: #6b7280;
 * }
 *
 * .virtualized-table__spinner {
 *   width: 24px;
 *   height: 24px;
 *   border: 2px solid #e5e7eb;
 *   border-top-color: #3b82f6;
 *   border-radius: 50%;
 *   animation: spin 1s linear infinite;
 * }
 */

export default VirtualizedTable;
