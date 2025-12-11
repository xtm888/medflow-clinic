import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

/**
 * CollapsibleSection - Reusable collapsible container for dashboard sections
 *
 * @param {string} title - Section title
 * @param {React.Component} icon - Lucide icon component
 * @param {string} iconColor - Tailwind color class for icon (e.g., "text-blue-600")
 * @param {string} gradient - Tailwind gradient classes (e.g., "from-blue-50 to-indigo-50")
 * @param {boolean} defaultExpanded - Whether section starts expanded
 * @param {React.Node} badge - Optional badge/count to show in header
 * @param {React.Node} headerExtra - Optional extra content in header (e.g., quick stats)
 * @param {React.Node} actions - Optional action buttons for header
 * @param {boolean} loading - Show loading state
 * @param {function} onExpand - Callback when section is expanded (for lazy loading)
 * @param {React.Node} children - Section content
 */
export default function CollapsibleSection({
  title,
  icon: Icon,
  iconColor = 'text-blue-600',
  gradient = 'from-gray-50 to-slate-50',
  defaultExpanded = true,
  badge,
  headerExtra,
  actions,
  loading = false,
  onExpand,
  children,
  className = ''
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && onExpand) {
      onExpand();
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className={`w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r ${gradient} border-b border-gray-200`}>
        <button
          onClick={handleToggle}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition text-left"
        >
          {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />}
          <h2 className="font-semibold text-gray-900 truncate">{title}</h2>
          {badge && (
            <span className="flex-shrink-0">{badge}</span>
          )}
          {headerExtra && !expanded && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 truncate ml-2">
              {headerExtra}
            </div>
          )}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions && expanded && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-white/50 rounded transition"
          >
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Chargement...</span>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CollapsibleSectionGroup - Container for multiple collapsible sections
 * with expand/collapse all functionality
 */
export function CollapsibleSectionGroup({ children, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * SectionStat - Quick stat display for section headers
 */
export function SectionStat({ label, value, color = 'text-gray-900' }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

/**
 * SectionEmptyState - Empty state for sections with no data
 */
export function SectionEmptyState({ icon: Icon, message, action }) {
  return (
    <div className="text-center py-8">
      {Icon && <Icon className="h-12 w-12 mx-auto text-gray-300 mb-3" />}
      <p className="text-gray-500 mb-3">{message}</p>
      {action}
    </div>
  );
}

/**
 * SectionLoading - Loading state for sections
 */
export function SectionLoading({ message = 'Chargement...' }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
      <span className="ml-2 text-sm text-gray-500">{message}</span>
    </div>
  );
}

/**
 * SectionActionButton - Consistent action button for sections
 */
export function SectionActionButton({ icon: Icon, children, onClick, variant = 'primary', size = 'sm' }) {
  const baseClasses = "inline-flex items-center gap-1.5 font-medium rounded-lg transition";
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    ghost: 'text-blue-600 hover:bg-blue-50'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses[variant]}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
