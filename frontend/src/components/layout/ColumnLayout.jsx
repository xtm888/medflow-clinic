/**
 * ColumnLayout - Responsive Multi-Column Layout System
 *
 * A flexible, responsive column layout component for StudioVision-style interfaces.
 * Supports 2, 3, and 4 column layouts with proper responsive collapse.
 *
 * Usage:
 * <ColumnLayout columns={3} height={500}>
 *   <ColumnLayout.Column variant="category">Categories</ColumnLayout.Column>
 *   <ColumnLayout.Column variant="selection">Items</ColumnLayout.Column>
 *   <ColumnLayout.Column variant="summary">Summary</ColumnLayout.Column>
 * </ColumnLayout>
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { colors, columnLayouts, componentSizes } from '../../styles/designTokens';

// Context for passing layout configuration
const ColumnLayoutContext = createContext({
  columns: 3,
  variant: 'default',
  isMobile: false,
  isTablet: false,
  activeColumn: null,
  setActiveColumn: () => {},
});

/**
 * Get column variant styles
 */
const getVariantStyles = (variant, isDark = false) => {
  const variants = {
    category: {
      background: isDark ? colors.studio.category.bgDark : colors.studio.category.bg,
      borderColor: colors.studio.category.border,
      headerBg: isDark ? '#5B4B85' : '#D8D8E8',
      color: isDark ? '#ffffff' : colors.studio.category.text,
    },
    selection: {
      background: isDark ? colors.studio.selection.bgDark : colors.studio.selection.bg,
      borderColor: colors.studio.selection.border,
      headerBg: isDark ? '#B99217' : '#EFEFA8',
      color: isDark ? '#ffffff' : colors.studio.selection.text,
    },
    entry: {
      background: isDark ? colors.studio.entry.bgDark : colors.studio.entry.bg,
      borderColor: colors.studio.entry.border,
      headerBg: isDark ? '#1E7B47' : '#C8EFC8',
      color: isDark ? '#ffffff' : colors.studio.entry.text,
    },
    summary: {
      background: isDark ? colors.studio.summary.bgDark : colors.studio.summary.bg,
      borderColor: colors.studio.summary.border,
      headerBg: isDark ? '#3A3A3A' : '#E0E0E0',
      color: isDark ? '#ffffff' : colors.studio.summary.text,
    },
    prescription: {
      background: isDark ? colors.studio.prescription.bgDark : colors.studio.prescription.bg,
      borderColor: colors.studio.prescription.border,
      headerBg: isDark ? '#007878' : '#B8E8E8',
      color: isDark ? '#ffffff' : colors.studio.prescription.text,
    },
    default: {
      background: isDark ? colors.gray[800] : colors.gray[50],
      borderColor: colors.gray[300],
      headerBg: isDark ? colors.gray[700] : colors.gray[200],
      color: isDark ? colors.gray[100] : colors.gray[800],
    },
  };

  return variants[variant] || variants.default;
};

/**
 * Get column flex styles based on layout type and column index
 */
const getColumnFlexStyles = (columns, index, isMobile, isTablet) => {
  // Mobile: All columns stack vertically
  if (isMobile) {
    return {
      flex: '1 1 100%',
      minWidth: '100%',
      maxWidth: '100%',
    };
  }

  // Tablet: 2-column grid
  if (isTablet && columns > 2) {
    return {
      flex: '1 1 50%',
      minWidth: '280px',
      maxWidth: '50%',
    };
  }

  // Desktop: Full column layout
  if (columns === 2) {
    return index === 0
      ? columnLayouts.twoColumn.left
      : columnLayouts.twoColumn.right;
  }

  if (columns === 3) {
    const keys = ['left', 'center', 'right'];
    return columnLayouts.threeColumn[keys[index]] || {};
  }

  if (columns === 4) {
    const keys = ['col1', 'col2', 'col3', 'col4'];
    return columnLayouts.fourColumn[keys[index]] || {};
  }

  return { flex: '1 1 auto' };
};

/**
 * Main ColumnLayout Container
 */
const ColumnLayout = ({
  children,
  columns = 3,
  height = 450,
  className = '',
  dark = false,
  gap = 0,
  rounded = true,
  shadow = true,
  showMobileNav = true,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activeColumn, setActiveColumn] = useState(0);

  // Responsive detection
  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  // Get column labels for mobile navigation
  const columnLabels = React.Children.toArray(children)
    .filter(child => child?.type === Column)
    .map((child, idx) => child.props?.label || `Col ${idx + 1}`);

  return (
    <ColumnLayoutContext.Provider
      value={{
        columns,
        dark,
        isMobile,
        isTablet,
        activeColumn,
        setActiveColumn,
      }}
    >
      <div
        className={`column-layout ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? 'auto' : height,
          minHeight: isMobile ? '400px' : height,
          background: dark ? colors.gray[900] : colors.background.primary,
          borderRadius: rounded ? '8px' : 0,
          boxShadow: shadow ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Mobile Column Navigation */}
        {isMobile && showMobileNav && columnLabels.length > 1 && (
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${colors.gray[300]}`,
              background: dark ? colors.gray[800] : colors.gray[100],
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {columnLabels.map((label, idx) => (
              <button
                key={idx}
                onClick={() => setActiveColumn(idx)}
                style={{
                  flex: '1 1 auto',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: activeColumn === idx ? '600' : '400',
                  color: activeColumn === idx
                    ? colors.primary[600]
                    : dark ? colors.gray[300] : colors.gray[600],
                  background: activeColumn === idx
                    ? dark ? colors.gray[700] : colors.background.primary
                    : 'transparent',
                  border: 'none',
                  borderBottom: activeColumn === idx
                    ? `2px solid ${colors.primary[600]}`
                    : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 200ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Column Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flex: 1,
            gap: gap,
            overflow: 'hidden',
          }}
        >
          {React.Children.toArray(children)
            .filter(child => child?.type === Column)
            .map((child, idx) =>
              React.cloneElement(child, {
                key: idx,
                _index: idx,
                _isVisible: isMobile ? activeColumn === idx : true,
              })
            )}
        </div>
      </div>
    </ColumnLayoutContext.Provider>
  );
};

/**
 * Column Component
 */
const Column = ({
  children,
  variant = 'default',
  label = '',
  header = null,
  footer = null,
  scrollable = true,
  _index = 0,
  _isVisible = true,
  className = '',
  style = {},
}) => {
  const { columns, dark, isMobile, isTablet } = useContext(ColumnLayoutContext);

  const variantStyles = getVariantStyles(variant, dark);
  const flexStyles = getColumnFlexStyles(columns, _index, isMobile, isTablet);

  if (!_isVisible) {
    return null;
  }

  return (
    <div
      className={`column-layout__column ${className}`}
      style={{
        ...flexStyles,
        display: 'flex',
        flexDirection: 'column',
        background: variantStyles.background,
        borderRight: !isMobile && _index < columns - 1
          ? `1px solid ${variantStyles.borderColor}`
          : 'none',
        overflow: 'hidden',
        transition: 'all 200ms ease',
        ...style,
      }}
    >
      {/* Column Header */}
      {(header || label) && (
        <div
          style={{
            padding: '10px 12px',
            background: variantStyles.headerBg,
            borderBottom: `1px solid ${variantStyles.borderColor}`,
            fontWeight: '600',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: variantStyles.color,
          }}
        >
          {header || label}
        </div>
      )}

      {/* Column Content */}
      <div
        style={{
          flex: 1,
          overflow: scrollable ? 'auto' : 'hidden',
          padding: '0',
        }}
      >
        {children}
      </div>

      {/* Column Footer */}
      {footer && (
        <div
          style={{
            padding: '10px 12px',
            background: variantStyles.headerBg,
            borderTop: `1px solid ${variantStyles.borderColor}`,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

/**
 * List Item Component - for consistent item styling in columns
 */
const ListItem = ({
  children,
  selected = false,
  onClick,
  disabled = false,
  icon = null,
  badge = null,
  className = '',
}) => {
  const { dark } = useContext(ColumnLayoutContext);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '10px 12px',
        minHeight: '44px', // Touch-friendly
        fontSize: '14px',
        textAlign: 'left',
        background: selected
          ? dark ? colors.primary[700] : colors.primary[100]
          : 'transparent',
        color: selected
          ? dark ? '#ffffff' : colors.primary[800]
          : dark ? colors.gray[200] : colors.gray[800],
        border: 'none',
        borderBottom: `1px solid ${dark ? colors.gray[700] : colors.gray[200]}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.background = dark
            ? colors.gray[700]
            : colors.gray[100];
        }
      }}
      onMouseLeave={(e) => {
        if (!selected && !disabled) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
      <span style={{ flex: 1 }}>{children}</span>
      {badge && (
        <span
          style={{
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '9999px',
            background: dark ? colors.gray[600] : colors.gray[200],
            color: dark ? colors.gray[200] : colors.gray[700],
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

/**
 * Sub-column Splitter - for dividing a column into sub-sections
 */
const SubColumns = ({ children, columns = 2, gap = 1 }) => {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        gap: gap * 4,
      }}
    >
      {React.Children.map(children, (child, idx) => (
        <div
          key={idx}
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRight: idx < columns - 1
              ? `1px solid ${colors.gray[300]}`
              : 'none',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * Section Header - for dividing content within a column
 */
const SectionHeader = ({ children, dark = false }) => {
  const context = useContext(ColumnLayoutContext);
  const isDark = context.dark || dark;

  return (
    <div
      style={{
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: isDark ? colors.gray[400] : colors.gray[500],
        background: isDark ? colors.gray[800] : colors.gray[100],
        borderBottom: `1px solid ${isDark ? colors.gray[700] : colors.gray[200]}`,
      }}
    >
      {children}
    </div>
  );
};

// Attach sub-components
ColumnLayout.Column = Column;
ColumnLayout.ListItem = ListItem;
ColumnLayout.SubColumns = SubColumns;
ColumnLayout.SectionHeader = SectionHeader;

export default ColumnLayout;
export { Column, ListItem, SubColumns, SectionHeader };
