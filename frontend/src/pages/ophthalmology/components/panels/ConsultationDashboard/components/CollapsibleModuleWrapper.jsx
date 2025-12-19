/**
 * CollapsibleModuleWrapper Component
 *
 * Wrapper for collapsible consultation modules with toggle header.
 * Supports optional badge for StudioVision mode indication.
 */

import { ChevronUp, ChevronDown } from 'lucide-react';

export default function CollapsibleModuleWrapper({
  title,
  icon: Icon,
  iconColor,
  expanded,
  onToggle,
  badge,
  children
}) {
  return (
    <div className={expanded ? '' : 'opacity-75'}>
      <button
        onClick={onToggle}
        className="w-full mb-2 flex items-center justify-between text-left"
      >
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          {title}
          {badge && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              {badge}
            </span>
          )}
        </h2>
        {expanded
          ? <ChevronUp className="h-5 w-5 text-gray-400" />
          : <ChevronDown className="h-5 w-5 text-gray-400" />
        }
      </button>
      {expanded && children}
    </div>
  );
}
