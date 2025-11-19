import { Copy, Loader2, Check, History } from 'lucide-react';
import { useState } from 'react';

/**
 * Reusable button for copying previous data
 */
function CopyPreviousButton({
  onCopy,
  disabled = false,
  loading = false,
  label = 'Copier précédent',
  shortLabel = 'Copier',
  tooltip,
  variant = 'secondary', // 'primary' | 'secondary' | 'ghost'
  size = 'sm', // 'sm' | 'md' | 'lg'
  showIcon = true,
  className = ''
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;

    try {
      await onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const baseStyles = 'inline-flex items-center font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:ring-gray-500'
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-sm'
  };

  const iconSizeStyles = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-4 w-4'
  };

  const disabledStyles = disabled || loading
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={tooltip || label}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
    >
      {loading ? (
        <Loader2 className={`${iconSizeStyles[size]} animate-spin ${showIcon && label ? 'mr-1' : ''}`} />
      ) : copied ? (
        <Check className={`${iconSizeStyles[size]} text-green-500 ${showIcon && label ? 'mr-1' : ''}`} />
      ) : showIcon ? (
        <History className={`${iconSizeStyles[size]} ${label ? 'mr-1' : ''}`} />
      ) : null}
      {size === 'sm' ? shortLabel : label}
    </button>
  );
}

/**
 * Button group for copy actions with multiple options
 */
export function CopyPreviousButtonGroup({
  options,
  disabled = false,
  loading = false
}) {
  return (
    <div className="flex items-center space-x-2">
      {options.map((option, index) => (
        <CopyPreviousButton
          key={index}
          onCopy={option.onCopy}
          label={option.label}
          shortLabel={option.shortLabel || option.label}
          tooltip={option.tooltip}
          disabled={disabled || option.disabled}
          loading={loading}
          variant={option.variant || 'ghost'}
          size={option.size || 'sm'}
        />
      ))}
    </div>
  );
}

/**
 * Inline copy indicator shown after successful copy
 */
export function CopySuccessIndicator({ visible }) {
  if (!visible) return null;

  return (
    <span className="inline-flex items-center text-xs text-green-600 animate-in fade-in">
      <Check className="h-3 w-3 mr-1" />
      Copié
    </span>
  );
}

export default CopyPreviousButton;
