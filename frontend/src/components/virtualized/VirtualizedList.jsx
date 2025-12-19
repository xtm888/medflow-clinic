/**
 * VirtualizedList Component
 *
 * A generic virtualized list component for efficiently rendering large lists.
 * Uses @tanstack/react-virtual for virtualization.
 *
 * Performance characteristics:
 * - Only renders visible items + overscan
 * - Maintains smooth scrolling
 * - Minimal DOM nodes
 */
import React, { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import PropTypes from 'prop-types';

/**
 * VirtualizedList - A generic virtualized list for large datasets
 *
 * @param {Object} props
 * @param {Array} props.items - Array of items to render
 * @param {Function} props.renderItem - Render function for each item (item, index) => ReactNode
 * @param {number} props.itemHeight - Fixed height of each item in pixels (for fixed-height lists)
 * @param {Function} props.estimateSize - Function to estimate item size (for variable-height lists)
 * @param {number} props.height - Height of the scrollable container
 * @param {number} props.overscan - Number of items to render outside visible area (default: 5)
 * @param {string} props.className - Additional CSS classes for container
 * @param {Function} props.onScrollEnd - Callback when user scrolls near the end (for infinite scroll)
 * @param {number} props.scrollEndThreshold - Distance from end to trigger onScrollEnd (default: 200)
 * @param {boolean} props.loading - Show loading state
 * @param {ReactNode} props.loadingComponent - Custom loading component
 * @param {ReactNode} props.emptyComponent - Component to show when list is empty
 * @param {string} props.gap - Gap between items (CSS value, e.g., '8px')
 */
const VirtualizedList = ({
  items = [],
  renderItem,
  itemHeight,
  estimateSize,
  height = 400,
  overscan = 5,
  className = '',
  onScrollEnd,
  scrollEndThreshold = 200,
  loading = false,
  loadingComponent,
  emptyComponent,
  gap = '0px'
}) => {
  const parentRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  // Calculate item size
  const getItemSize = useMemo(() => {
    if (itemHeight) {
      return () => itemHeight;
    }
    if (estimateSize) {
      return estimateSize;
    }
    // Default size
    return () => 56;
  }, [itemHeight, estimateSize]);

  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getItemSize,
    overscan,
    // Enable smooth scrolling
    scrollMargin: parentRef.current?.offsetTop ?? 0
  });

  // Handle scroll
  const handleScroll = useCallback((e) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    scrollOffsetRef.current = scrollTop;

    // Check if near the end
    if (onScrollEnd && scrollHeight - scrollTop - clientHeight < scrollEndThreshold) {
      onScrollEnd();
    }
  }, [onScrollEnd, scrollEndThreshold]);

  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems();

  // Parse gap value
  const gapValue = parseInt(gap, 10) || 0;

  // Calculate total size including gaps
  const totalSize = virtualizer.getTotalSize() + (items.length > 0 ? gapValue * (items.length - 1) : 0);

  // Render loading state
  if (loading && items.length === 0) {
    return (
      <div
        className={`virtualized-list virtualized-list--loading ${className}`}
        style={{ height }}
      >
        {loadingComponent || (
          <div className="virtualized-list__loading">
            <div className="virtualized-list__spinner" />
            <span>Chargement...</span>
          </div>
        )}
      </div>
    );
  }

  // Render empty state
  if (!loading && items.length === 0) {
    return (
      <div
        className={`virtualized-list virtualized-list--empty ${className}`}
        style={{ height }}
      >
        {emptyComponent || (
          <div className="virtualized-list__empty">
            <span>Aucun élément à afficher</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`virtualized-list ${className}`}
      style={{
        height,
        overflow: 'auto',
        contain: 'strict'
      }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const top = virtualItem.start + (gapValue * virtualItem.index);

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${top}px)`
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>

      {/* Loading indicator for infinite scroll */}
      {loading && items.length > 0 && (
        <div className="virtualized-list__loading-more">
          {loadingComponent || <span>Chargement...</span>}
        </div>
      )}
    </div>
  );
};

VirtualizedList.propTypes = {
  items: PropTypes.array.isRequired,
  renderItem: PropTypes.func.isRequired,
  itemHeight: PropTypes.number,
  estimateSize: PropTypes.func,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  overscan: PropTypes.number,
  className: PropTypes.string,
  onScrollEnd: PropTypes.func,
  scrollEndThreshold: PropTypes.number,
  loading: PropTypes.bool,
  loadingComponent: PropTypes.node,
  emptyComponent: PropTypes.node,
  gap: PropTypes.string
};

/**
 * CSS Styles (can be imported from a separate CSS file)
 * Add these styles to your global CSS or component-specific stylesheet:
 *
 * .virtualized-list {
 *   position: relative;
 * }
 *
 * .virtualized-list--loading,
 * .virtualized-list--empty {
 *   display: flex;
 *   align-items: center;
 *   justify-content: center;
 * }
 *
 * .virtualized-list__loading,
 * .virtualized-list__empty {
 *   display: flex;
 *   flex-direction: column;
 *   align-items: center;
 *   gap: 12px;
 *   color: #6b7280;
 * }
 *
 * .virtualized-list__spinner {
 *   width: 24px;
 *   height: 24px;
 *   border: 2px solid #e5e7eb;
 *   border-top-color: #3b82f6;
 *   border-radius: 50%;
 *   animation: spin 1s linear infinite;
 * }
 *
 * @keyframes spin {
 *   to { transform: rotate(360deg); }
 * }
 *
 * .virtualized-list__loading-more {
 *   text-align: center;
 *   padding: 16px;
 *   color: #6b7280;
 * }
 */

export default VirtualizedList;
