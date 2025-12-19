/**
 * MedFlow Design Tokens
 *
 * Unified design system for consistent UI across the application.
 * Use these tokens instead of hardcoded values.
 *
 * Usage:
 * import { colors, spacing, shadows, typography } from '@/styles/designTokens';
 */

// =============================================================================
// COLOR SYSTEM
// =============================================================================

export const colors = {
  // Primary Brand (Medical Blue)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',  // Main primary
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Semantic Colors
  success: {
    light: '#d1fae5',
    main: '#10b981',
    dark: '#047857',
    contrast: '#ffffff',
  },
  warning: {
    light: '#fef3c7',
    main: '#f59e0b',
    dark: '#b45309',
    contrast: '#000000',
  },
  error: {
    light: '#fee2e2',
    main: '#ef4444',
    dark: '#b91c1c',
    contrast: '#ffffff',
  },
  info: {
    light: '#dbeafe',
    main: '#3b82f6',
    dark: '#1d4ed8',
    contrast: '#ffffff',
  },

  // StudioVision Theme Colors (Column-based UI)
  studio: {
    // Category column (Purple/Lavender)
    category: {
      bg: '#E8E8F8',
      bgDark: '#6B5B95',
      border: '#C8C8E8',
      text: '#4A4A6A',
      active: '#8B7BB8',
    },
    // Selection column (Yellow/Cream)
    selection: {
      bg: '#FFFFD8',
      bgDark: '#C9A227',
      border: '#E8E8B8',
      text: '#5A5A3A',
      active: '#FFE066',
    },
    // Data entry column (Green/Mint)
    entry: {
      bg: '#D8FFD8',
      bgDark: '#2E8B57',
      border: '#B8E8B8',
      text: '#2A5A2A',
      active: '#90EE90',
    },
    // Summary column (Gray)
    summary: {
      bg: '#F0F0F0',
      bgDark: '#4A4A4A',
      border: '#D8D8D8',
      text: '#3A3A3A',
      active: '#C8C8C8',
    },
    // Active prescription (Cyan)
    prescription: {
      bg: '#D8FFFF',
      bgDark: '#008B8B',
      border: '#B8E8E8',
      text: '#2A5A5A',
    },
  },

  // Neutral Gray Scale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Medical-specific Colors
  medical: {
    od: '#3b82f6',      // Right eye (OD) - Blue
    os: '#10b981',      // Left eye (OS) - Green
    ou: '#8b5cf6',      // Both eyes (OU) - Purple
    urgent: '#ef4444',  // Urgent/Emergency
    routine: '#6b7280', // Routine
    stat: '#f59e0b',    // STAT orders
  },

  // Background Colors
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
    dark: '#1f2937',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
};

// =============================================================================
// SPACING SYSTEM (8px base)
// =============================================================================

export const spacing = {
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px - Minimum touch target
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',

  // Colored shadows for cards
  primary: '0 4px 14px 0 rgba(2, 132, 199, 0.25)',
  success: '0 4px 14px 0 rgba(16, 185, 129, 0.25)',
  warning: '0 4px 14px 0 rgba(245, 158, 11, 0.25)',
  error: '0 4px 14px 0 rgba(239, 68, 68, 0.25)',
};

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

// =============================================================================
// Z-INDEX SYSTEM
// =============================================================================

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
};

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// =============================================================================
// TRANSITIONS
// =============================================================================

export const transitions = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',

  // Specific transitions
  colors: 'color 200ms, background-color 200ms, border-color 200ms',
  transform: 'transform 200ms ease-in-out',
  opacity: 'opacity 200ms ease-in-out',
  shadow: 'box-shadow 200ms ease-in-out',
  all: 'all 200ms ease-in-out',
};

// =============================================================================
// COLUMN LAYOUT PRESETS (StudioVision-style)
// =============================================================================

export const columnLayouts = {
  // 3-column layout (PathologyPicker)
  threeColumn: {
    left: { flex: '0 0 20%', minWidth: '180px', maxWidth: '250px' },
    center: { flex: '1 1 40%', minWidth: '280px' },
    right: { flex: '1 1 40%', minWidth: '280px' },
  },

  // 4-column layout (TreatmentBuilder)
  fourColumn: {
    col1: { flex: '0 0 15%', minWidth: '140px', maxWidth: '180px' },
    col2: { flex: '0 0 20%', minWidth: '160px', maxWidth: '220px' },
    col3: { flex: '1 1 30%', minWidth: '240px' },
    col4: { flex: '1 1 35%', minWidth: '280px' },
  },

  // 2-column layout (simple split)
  twoColumn: {
    left: { flex: '0 0 30%', minWidth: '250px', maxWidth: '400px' },
    right: { flex: '1 1 70%', minWidth: '400px' },
  },
};

// =============================================================================
// COMPONENT SIZES
// =============================================================================

export const componentSizes = {
  // Touch-friendly button sizes
  button: {
    sm: { height: '36px', padding: '0 12px', fontSize: '14px' },
    md: { height: '44px', padding: '0 20px', fontSize: '16px' },  // Default
    lg: { height: '52px', padding: '0 28px', fontSize: '18px' },
  },

  // Input sizes
  input: {
    sm: { height: '36px', padding: '8px 12px', fontSize: '14px' },
    md: { height: '44px', padding: '10px 14px', fontSize: '16px' },
    lg: { height: '52px', padding: '12px 16px', fontSize: '18px' },
  },

  // Table row heights
  tableRow: {
    compact: '40px',
    normal: '52px',   // Touch-friendly default
    comfortable: '64px',
  },

  // Card padding
  card: {
    sm: '12px',
    md: '16px',
    lg: '24px',
  },

  // Modal sizes
  modal: {
    sm: '400px',
    md: '560px',
    lg: '720px',
    xl: '900px',
    full: '95vw',
  },

  // Sidebar width
  sidebar: {
    collapsed: '64px',
    normal: '256px',
    wide: '320px',
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get color with opacity
 * @param {string} hexColor - Hex color code
 * @param {number} opacity - Opacity value 0-1
 */
export const withOpacity = (hexColor, opacity) => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get responsive column style based on screen size
 * @param {string} layout - 'twoColumn' | 'threeColumn' | 'fourColumn'
 * @param {string} column - Column key (left, center, right, col1, col2, etc.)
 * @param {boolean} isMobile - Is mobile viewport
 */
export const getColumnStyle = (layout, column, isMobile = false) => {
  if (isMobile) {
    return { flex: '1 1 100%', minWidth: '100%' };
  }
  return columnLayouts[layout]?.[column] || {};
};

// Default export for convenience
export default {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius,
  zIndex,
  breakpoints,
  transitions,
  columnLayouts,
  componentSizes,
  withOpacity,
  getColumnStyle,
};
