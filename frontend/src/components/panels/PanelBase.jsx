import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, X, Pin, PinOff } from 'lucide-react';

/**
 * Collapsible Panel Wrapper
 * Base component for all info-dense panels
 */
export function Panel({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  collapsible = true,
  onClose,
  className = '',
  variant = 'sidebar', // 'sidebar' | 'floating' | 'inline'
  pinnable = false,
  isPinned = false,
  onPinToggle
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    sidebar: 'bg-white border-l border-gray-200 shadow-lg',
    floating: 'bg-white rounded-lg shadow-2xl border border-gray-200',
    inline: 'bg-gray-50 rounded-lg border border-gray-200'
  };

  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 ${
          collapsible ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" />
                   : <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          {Icon && <Icon className="h-5 w-5 text-purple-600" />}
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {pinnable && (
            <button
              onClick={(e) => { e.stopPropagation(); onPinToggle?.(); }}
              className={`p-1 rounded hover:bg-gray-100 ${isPinned ? 'text-purple-600' : 'text-gray-400'}`}
              title={isPinned ? 'Unpin panel' : 'Pin panel'}
            >
              {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
            </button>
          )}
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-3 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Section Card - Compact info display
 */
export function SectionCard({
  title,
  icon: Icon,
  children,
  alert = false,
  alertType = 'warning', // 'warning' | 'danger' | 'success' | 'info'
  compact = false,
  onClick,
  className = ''
}) {
  const alertStyles = {
    warning: 'border-yellow-300 bg-yellow-50',
    danger: 'border-red-300 bg-red-50 animate-pulse-subtle',
    success: 'border-green-300 bg-green-50',
    info: 'border-blue-300 bg-blue-50'
  };

  const alertIconStyles = {
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    success: 'text-green-600',
    info: 'text-blue-600'
  };

  return (
    <div
      className={`
        rounded-lg border ${alert ? alertStyles[alertType] : 'border-gray-200 bg-white'}
        ${compact ? 'p-2' : 'p-3'}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {title && (
        <div className="flex items-center gap-1.5 mb-2">
          {Icon && <Icon className={`h-3.5 w-3.5 ${alert ? alertIconStyles[alertType] : 'text-gray-500'}`} />}
          <span className={`text-xs font-medium uppercase tracking-wide ${alert ? alertIconStyles[alertType] : 'text-gray-500'}`}>
            {title}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Info Grid - Display key-value pairs in grid
 */
export function InfoGrid({ items, columns = 2 }) {
  return (
    <div className={`grid grid-cols-${columns} gap-2`}>
      {items.map((item, idx) => (
        <div key={idx} className="text-xs">
          <span className="text-gray-500">{item.label}:</span>
          <span className={`ml-1 font-medium ${item.className || 'text-gray-900'}`}>
            {item.value || '-'}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Stat Box - Single stat with label
 */
export function StatBox({
  label,
  value,
  subvalue,
  trend, // 'up' | 'down' | 'stable'
  alert = false,
  alertType = 'warning',
  icon: Icon,
  className = ''
}) {
  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→'
  };

  const trendColors = {
    up: 'text-red-500',
    down: 'text-green-500',
    stable: 'text-gray-400'
  };

  const alertBg = {
    warning: 'bg-yellow-100 border-yellow-300',
    danger: 'bg-red-100 border-red-300',
    success: 'bg-green-100 border-green-300',
    info: 'bg-blue-100 border-blue-300'
  };

  return (
    <div className={`
      text-center p-2 rounded-lg border
      ${alert ? alertBg[alertType] : 'bg-gray-50 border-gray-200'}
      ${className}
    `}>
      {Icon && <Icon className="h-4 w-4 mx-auto mb-1 text-gray-400" />}
      <div className="flex items-center justify-center gap-1">
        <span className={`text-lg font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-sm ${trendColors[trend]}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      {subvalue && <div className="text-xs text-gray-500">{subvalue}</div>}
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Alert Badge - Prominent warning display
 */
export function AlertBadge({
  children,
  type = 'warning', // 'warning' | 'danger' | 'success' | 'info'
  icon: Icon,
  pulse = false,
  className = ''
}) {
  const styles = {
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    danger: 'bg-red-100 text-red-800 border-red-300',
    success: 'bg-green-100 text-green-800 border-green-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border
      ${styles[type]}
      ${pulse ? 'animate-pulse' : ''}
      ${className}
    `}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </div>
  );
}

/**
 * Mini List - Compact list display
 */
export function MiniList({
  items,
  maxItems = 5,
  emptyText = 'Aucun element',
  onViewAll,
  renderItem
}) {
  const displayItems = items?.slice(0, maxItems) || [];
  const hasMore = items?.length > maxItems;

  if (displayItems.length === 0) {
    return <p className="text-xs text-gray-400 italic">{emptyText}</p>;
  }

  return (
    <div className="space-y-1.5">
      {displayItems.map((item, idx) => (
        <div key={idx} className="text-xs">
          {renderItem ? renderItem(item, idx) : (
            <span className="text-gray-700">{item}</span>
          )}
        </div>
      ))}
      {hasMore && onViewAll && (
        <button
          onClick={onViewAll}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          +{items.length - maxItems} autres...
        </button>
      )}
    </div>
  );
}

/**
 * Mini Sparkline - Tiny trend visualization
 */
export function MiniSparkline({ data, height = 30, color = '#8b5cf6' }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point indicator */}
      <circle
        cx={100}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="3"
        fill={color}
      />
    </svg>
  );
}

/**
 * VIP Badge - Special patient indicator
 */
export function VIPBadge({ type, className = '' }) {
  const badges = {
    vip: { label: 'VIP', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
    pregnant: { label: 'Enceinte', bg: 'bg-pink-100 text-pink-800 border-pink-300' },
    elderly: { label: '65+', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
    child: { label: 'Enfant', bg: 'bg-green-100 text-green-800 border-green-300' }
  };

  const badge = badges[type];
  if (!badge) return null;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${badge.bg} ${className}`}>
      {badge.label}
    </span>
  );
}

// Add subtle pulse animation to tailwind
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse-subtle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }
  .animate-pulse-subtle {
    animation: pulse-subtle 2s ease-in-out infinite;
  }
`;
if (typeof document !== 'undefined' && !document.getElementById('panel-styles')) {
  style.id = 'panel-styles';
  document.head.appendChild(style);
}
