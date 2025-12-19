/**
 * FormSection - Collapsible form section with header
 *
 * Groups related form fields with:
 * - Section title and optional icon
 * - Collapsible content
 * - Visual styling variants
 * - Change indicator badge
 *
 * Usage:
 * <FormSection title="Contact" icon={Phone} collapsible>
 *   <FormField label="Email">...</FormField>
 *   <FormField label="Phone">...</FormField>
 * </FormSection>
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Color variants matching StudioVision design
const VARIANTS = {
  default: {
    header: 'bg-gray-50 border-gray-200',
    headerText: 'text-gray-700',
    border: 'border-gray-200'
  },
  blue: {
    header: 'bg-blue-50 border-blue-200',
    headerText: 'text-blue-700',
    border: 'border-blue-200'
  },
  green: {
    header: 'bg-green-50 border-green-200',
    headerText: 'text-green-700',
    border: 'border-green-200'
  },
  pink: {
    header: 'bg-pink-50 border-pink-200',
    headerText: 'text-pink-700',
    border: 'border-pink-200'
  },
  yellow: {
    header: 'bg-yellow-50 border-yellow-200',
    headerText: 'text-yellow-700',
    border: 'border-yellow-200'
  },
  purple: {
    header: 'bg-purple-50 border-purple-200',
    headerText: 'text-purple-700',
    border: 'border-purple-200'
  },
  red: {
    header: 'bg-red-50 border-red-200',
    headerText: 'text-red-700',
    border: 'border-red-200'
  }
};

export default function FormSection({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultExpanded = true,
  variant = 'default',
  hasChanges = false,
  badge,
  headerAction,
  className = '',
  contentClassName = ''
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = VARIANTS[variant] || VARIANTS.default;

  const toggleExpanded = () => {
    if (collapsible) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`rounded-lg border ${colors.border} overflow-hidden ${className}`}>
      {/* Header */}
      <div
        onClick={toggleExpanded}
        className={`
          px-4 py-3 flex items-center justify-between
          ${colors.header}
          ${collapsible ? 'cursor-pointer hover:opacity-90' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-5 w-5 ${colors.headerText}`} />}
          <h3 className={`font-medium ${colors.headerText}`}>{title}</h3>
          {hasChanges && (
            <span className="w-2 h-2 bg-amber-500 rounded-full" title="Modifications non enregistrées" />
          )}
          {badge && (
            <span className="px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerAction}
          {collapsible && (
            <button
              type="button"
              className={`p-1 rounded hover:bg-white/30 ${colors.headerText}`}
              aria-label={expanded ? 'Réduire' : 'Développer'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!collapsible || expanded) && (
        <div className={`p-4 bg-white ${contentClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * FormSectionGrid - Grid layout for multiple form sections
 */
export function FormSectionGrid({ children, columns = 2, className = '' }) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
