/**
 * Button Component
 *
 * Standardized button component with consistent styling and touch-friendly sizes.
 *
 * Usage:
 * <Button>Click me</Button>
 * <Button variant="primary" size="lg">Submit</Button>
 * <Button variant="outline" leftIcon={<Save />}>Save</Button>
 * <Button loading>Processing...</Button>
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { colors, shadows, borderRadius, componentSizes, transitions } from '../../styles/designTokens';

/**
 * Button variants with their styles
 */
const variantStyles = {
  primary: {
    background: colors.primary[600],
    color: '#ffffff',
    border: 'none',
    hoverBg: colors.primary[700],
    activeBg: colors.primary[800],
    focusRing: colors.primary[500],
  },
  secondary: {
    background: colors.gray[200],
    color: colors.gray[900],
    border: 'none',
    hoverBg: colors.gray[300],
    activeBg: colors.gray[400],
    focusRing: colors.gray[400],
  },
  outline: {
    background: 'transparent',
    color: colors.primary[600],
    border: `2px solid ${colors.primary[600]}`,
    hoverBg: colors.primary[50],
    activeBg: colors.primary[100],
    focusRing: colors.primary[500],
  },
  ghost: {
    background: 'transparent',
    color: colors.gray[700],
    border: 'none',
    hoverBg: colors.gray[100],
    activeBg: colors.gray[200],
    focusRing: colors.gray[400],
  },
  danger: {
    background: colors.error.main,
    color: '#ffffff',
    border: 'none',
    hoverBg: colors.error.dark,
    activeBg: '#991b1b',
    focusRing: colors.error.main,
  },
  success: {
    background: colors.success.main,
    color: '#ffffff',
    border: 'none',
    hoverBg: colors.success.dark,
    activeBg: '#065f46',
    focusRing: colors.success.main,
  },
  warning: {
    background: colors.warning.main,
    color: '#000000',
    border: 'none',
    hoverBg: colors.warning.dark,
    activeBg: '#92400e',
    focusRing: colors.warning.main,
  },
  // Eye-specific variants for ophthalmology
  od: {
    background: colors.medical.od,
    color: '#ffffff',
    border: 'none',
    hoverBg: '#2563eb',
    activeBg: '#1d4ed8',
    focusRing: colors.medical.od,
  },
  os: {
    background: colors.medical.os,
    color: '#ffffff',
    border: 'none',
    hoverBg: '#059669',
    activeBg: '#047857',
    focusRing: colors.medical.os,
  },
  ou: {
    background: colors.medical.ou,
    color: '#ffffff',
    border: 'none',
    hoverBg: '#7c3aed',
    activeBg: '#6d28d9',
    focusRing: colors.medical.ou,
  },
};

/**
 * Size configurations
 */
const sizeStyles = {
  xs: {
    height: '28px',
    padding: '0 8px',
    fontSize: '12px',
    iconSize: 14,
    gap: '4px',
  },
  sm: {
    height: componentSizes.button.sm.height,
    padding: componentSizes.button.sm.padding,
    fontSize: componentSizes.button.sm.fontSize,
    iconSize: 16,
    gap: '6px',
  },
  md: {
    height: componentSizes.button.md.height,
    padding: componentSizes.button.md.padding,
    fontSize: componentSizes.button.md.fontSize,
    iconSize: 18,
    gap: '8px',
  },
  lg: {
    height: componentSizes.button.lg.height,
    padding: componentSizes.button.lg.padding,
    fontSize: componentSizes.button.lg.fontSize,
    iconSize: 20,
    gap: '10px',
  },
  xl: {
    height: '56px',
    padding: '0 32px',
    fontSize: '18px',
    iconSize: 22,
    gap: '12px',
  },
};

/**
 * Main Button Component
 */
const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  rounded = 'lg',
  className = '',
  style = {},
  as: Component = 'button',
  type = 'button',
  ...props
}, ref) => {
  const variantStyle = variantStyles[variant] || variantStyles.primary;
  const sizeStyle = sizeStyles[size] || sizeStyles.md;
  const radiusValue = borderRadius[rounded] || rounded;

  const isDisabled = disabled || loading;

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeStyle.gap,
    height: sizeStyle.height,
    padding: sizeStyle.padding,
    fontSize: sizeStyle.fontSize,
    fontWeight: '500',
    fontFamily: 'inherit',
    lineHeight: '1',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    borderRadius: radiusValue,
    background: variantStyle.background,
    color: variantStyle.color,
    border: variantStyle.border,
    boxShadow: variant === 'primary' || variant === 'danger' || variant === 'success'
      ? shadows.sm
      : 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: transitions.all,
    width: fullWidth ? '100%' : 'auto',
    outline: 'none',
    ...style,
  };

  // Icon sizing
  const iconStyle = {
    width: sizeStyle.iconSize,
    height: sizeStyle.iconSize,
    flexShrink: 0,
  };

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      className={`btn btn--${variant} btn--${size} ${className}`}
      style={baseStyles}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = variantStyle.hoverBg;
          if (variant === 'primary' || variant === 'danger' || variant === 'success') {
            e.currentTarget.style.boxShadow = shadows.md;
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = variantStyle.background;
          if (variant === 'primary' || variant === 'danger' || variant === 'success') {
            e.currentTarget.style.boxShadow = shadows.sm;
          }
        }
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = variantStyle.activeBg;
        }
      }}
      onMouseUp={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = variantStyle.hoverBg;
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 3px ${variantStyle.focusRing}40`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = variant === 'primary' || variant === 'danger' || variant === 'success'
          ? shadows.sm
          : 'none';
      }}
      {...props}
    >
      {loading && (
        <Loader2
          style={{ ...iconStyle, animation: 'spin 1s linear infinite' }}
        />
      )}
      {!loading && leftIcon && (
        <span style={iconStyle}>{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && (
        <span style={iconStyle}>{rightIcon}</span>
      )}
    </Component>
  );
});

Button.displayName = 'Button';

/**
 * IconButton - Button with only an icon
 */
const IconButton = React.forwardRef(({
  icon,
  variant = 'ghost',
  size = 'md',
  label,
  ...props
}, ref) => {
  const sizeMap = {
    xs: '28px',
    sm: '36px',
    md: '44px',
    lg: '52px',
    xl: '56px',
  };

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      {...props}
      style={{
        width: sizeMap[size],
        padding: 0,
        ...props.style,
      }}
    >
      {icon}
    </Button>
  );
});

IconButton.displayName = 'IconButton';

/**
 * ButtonGroup - Group of buttons with connected styling
 */
const ButtonGroup = ({
  children,
  attached = false,
  spacing = 2,
  vertical = false,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`btn-group ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: attached ? 0 : `${spacing * 4}px`,
        ...style,
      }}
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        const isFirst = index === 0;
        const isLast = index === React.Children.count(children) - 1;

        if (!attached) return child;

        return React.cloneElement(child, {
          style: {
            ...child.props.style,
            borderRadius: vertical
              ? isFirst
                ? `${borderRadius.lg} ${borderRadius.lg} 0 0`
                : isLast
                  ? `0 0 ${borderRadius.lg} ${borderRadius.lg}`
                  : 0
              : isFirst
                ? `${borderRadius.lg} 0 0 ${borderRadius.lg}`
                : isLast
                  ? `0 ${borderRadius.lg} ${borderRadius.lg} 0`
                  : 0,
            borderLeft: !vertical && !isFirst ? 'none' : undefined,
            borderTop: vertical && !isFirst ? 'none' : undefined,
            marginLeft: !vertical && !isFirst ? '-1px' : undefined,
            marginTop: vertical && !isFirst ? '-1px' : undefined,
          },
        });
      })}
    </div>
  );
};

// Attach sub-components
Button.Icon = IconButton;
Button.Group = ButtonGroup;

export default Button;
export { IconButton, ButtonGroup };
