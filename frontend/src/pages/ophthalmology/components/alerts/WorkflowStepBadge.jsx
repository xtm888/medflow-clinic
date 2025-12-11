/**
 * WorkflowStepBadge
 *
 * Badge component to display alert indicators on workflow tabs.
 * Shows colored badges based on alert severity for the specific step.
 */

import { AlertTriangle, AlertOctagon, AlertCircle, Info } from 'lucide-react';

const SEVERITY_CONFIG = {
  EMERGENCY: {
    bg: 'bg-red-500',
    text: 'text-white',
    icon: AlertOctagon,
    pulse: true
  },
  URGENT: {
    bg: 'bg-orange-500',
    text: 'text-white',
    icon: AlertTriangle,
    pulse: false
  },
  WARNING: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-900',
    icon: AlertCircle,
    pulse: false
  },
  INFO: {
    bg: 'bg-blue-500',
    text: 'text-white',
    icon: Info,
    pulse: false
  }
};

/**
 * Get the highest severity from a list of alerts
 */
function getHighestSeverity(alerts) {
  const severityOrder = ['EMERGENCY', 'URGENT', 'WARNING', 'INFO'];

  for (const severity of severityOrder) {
    if (alerts.some(a => a.severity === severity && a.status === 'active')) {
      return severity;
    }
  }

  return null;
}

/**
 * Badge showing alert count and severity
 */
export function AlertCountBadge({ alerts = [], showIcon = true, size = 'md' }) {
  const activeAlerts = alerts.filter(a => a.status === 'active');

  if (activeAlerts.length === 0) return null;

  const highestSeverity = getHighestSeverity(activeAlerts);
  if (!highestSeverity) return null;

  const config = SEVERITY_CONFIG[highestSeverity];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] min-w-[16px] h-4 px-1',
    md: 'text-xs min-w-[20px] h-5 px-1.5',
    lg: 'text-sm min-w-[24px] h-6 px-2'
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full font-medium
        ${config.bg} ${config.text} ${sizeClasses[size]}
        ${config.pulse ? 'animate-pulse' : ''}
      `}
    >
      {showIcon && <Icon className={`${size === 'sm' ? 'h-2.5 w-2.5' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} ${activeAlerts.length > 1 ? 'mr-0.5' : ''}`} />}
      {activeAlerts.length > 1 && activeAlerts.length}
    </span>
  );
}

/**
 * Dot indicator for minimal display
 */
export function AlertDot({ severity, pulse = false }) {
  if (!severity || !SEVERITY_CONFIG[severity]) return null;

  const config = SEVERITY_CONFIG[severity];

  return (
    <span
      className={`
        inline-block w-2 h-2 rounded-full
        ${config.bg}
        ${pulse || config.pulse ? 'animate-pulse' : ''}
      `}
    />
  );
}

/**
 * Full badge with severity and count breakdown
 */
export function SeverityBreakdownBadge({ alerts = [] }) {
  const activeAlerts = alerts.filter(a => a.status === 'active');

  if (activeAlerts.length === 0) return null;

  const counts = {
    EMERGENCY: activeAlerts.filter(a => a.severity === 'EMERGENCY').length,
    URGENT: activeAlerts.filter(a => a.severity === 'URGENT').length,
    WARNING: activeAlerts.filter(a => a.severity === 'WARNING').length,
    INFO: activeAlerts.filter(a => a.severity === 'INFO').length
  };

  return (
    <div className="flex items-center gap-1">
      {Object.entries(counts).map(([severity, count]) => {
        if (count === 0) return null;
        const config = SEVERITY_CONFIG[severity];

        return (
          <span
            key={severity}
            className={`
              inline-flex items-center justify-center rounded-full
              text-[10px] min-w-[16px] h-4 px-1
              ${config.bg} ${config.text}
              ${config.pulse ? 'animate-pulse' : ''}
            `}
          >
            {count}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Step tab with integrated badge
 */
export function WorkflowStepTab({
  step,
  isActive,
  isCompleted,
  alerts = [],
  onClick,
  hasError = false
}) {
  const stepAlerts = alerts.filter(a =>
    a.status === 'active' &&
    // Match alerts to step by field name patterns
    (a.triggerField?.toLowerCase().includes(step.id.toLowerCase()) ||
     step.alertFields?.some(f => a.triggerField?.includes(f)))
  );

  const highestSeverity = getHighestSeverity(stepAlerts);

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors
        ${isActive
          ? 'bg-blue-100 text-blue-700 font-medium'
          : isCompleted
            ? 'bg-green-50 text-green-700'
            : hasError
              ? 'bg-red-50 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
      `}
    >
      {/* Step label */}
      <span>{step.shortLabel || step.label}</span>

      {/* Alert badge */}
      {stepAlerts.length > 0 && (
        <AlertCountBadge alerts={stepAlerts} size="sm" />
      )}

      {/* Emergency indicator pulse ring */}
      {highestSeverity === 'EMERGENCY' && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}
    </button>
  );
}

/**
 * Navigation with alert summary
 */
export function WorkflowStepNavigation({
  steps,
  currentStepIndex,
  completedSteps,
  stepErrors,
  alerts = [],
  onStepClick
}) {
  return (
    <div className="flex space-x-1 overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <WorkflowStepTab
          key={step.id}
          step={step}
          isActive={index === currentStepIndex}
          isCompleted={completedSteps?.has(step.id)}
          hasError={!!stepErrors?.[step.id]}
          alerts={alerts}
          onClick={() => onStepClick(index)}
        />
      ))}
    </div>
  );
}

export default AlertCountBadge;
