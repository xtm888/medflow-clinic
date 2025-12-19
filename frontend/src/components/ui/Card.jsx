/**
 * Card Component
 *
 * Standardized card component with consistent styling.
 *
 * Usage:
 * <Card>Content</Card>
 * <Card variant="elevated" padding="lg">Content</Card>
 * <Card.Header>Title</Card.Header>
 * <Card.Body>Content</Card.Body>
 * <Card.Footer>Actions</Card.Footer>
 */

import React from 'react';
import { colors, shadows, borderRadius, componentSizes } from '../../styles/designTokens';

/**
 * Card variants
 */
const variants = {
  default: {
    background: colors.background.primary,
    border: `1px solid ${colors.gray[200]}`,
    shadow: shadows.sm,
  },
  elevated: {
    background: colors.background.primary,
    border: 'none',
    shadow: shadows.md,
  },
  outlined: {
    background: 'transparent',
    border: `1px solid ${colors.gray[300]}`,
    shadow: 'none',
  },
  filled: {
    background: colors.gray[50],
    border: 'none',
    shadow: 'none',
  },
  // Medical-specific variants
  success: {
    background: colors.success.light,
    border: `1px solid ${colors.success.main}`,
    shadow: shadows.success,
  },
  warning: {
    background: colors.warning.light,
    border: `1px solid ${colors.warning.main}`,
    shadow: shadows.warning,
  },
  error: {
    background: colors.error.light,
    border: `1px solid ${colors.error.main}`,
    shadow: shadows.error,
  },
  info: {
    background: colors.info.light,
    border: `1px solid ${colors.info.main}`,
    shadow: shadows.info,
  },
};

/**
 * Padding sizes
 */
const paddingSizes = {
  none: '0',
  sm: componentSizes.card.sm,
  md: componentSizes.card.md,
  lg: componentSizes.card.lg,
};

/**
 * Main Card Component
 */
const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  rounded = 'lg',
  hover = false,
  clickable = false,
  onClick,
  className = '',
  style = {},
  as: Component = 'div',
  ...props
}) => {
  const variantStyles = variants[variant] || variants.default;
  const paddingValue = paddingSizes[padding] || padding;
  const radiusValue = borderRadius[rounded] || rounded;

  const baseStyles = {
    background: variantStyles.background,
    border: variantStyles.border,
    boxShadow: variantStyles.shadow,
    borderRadius: radiusValue,
    padding: paddingValue,
    transition: 'all 200ms ease',
    cursor: clickable || onClick ? 'pointer' : 'default',
    ...style,
  };

  const hoverStyles = hover || clickable ? {
    ':hover': {
      boxShadow: shadows.lg,
      transform: 'translateY(-2px)',
    },
  } : {};

  return (
    <Component
      className={`card card--${variant} ${className}`}
      style={baseStyles}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
};

/**
 * Card Header
 */
const CardHeader = ({
  children,
  title,
  subtitle,
  action,
  icon,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`card__header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${colors.gray[200]}`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: borderRadius.lg,
              background: colors.primary[100],
              color: colors.primary[600],
            }}
          >
            {icon}
          </div>
        )}
        <div>
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: colors.gray[900],
              }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: colors.gray[500],
              }}
            >
              {subtitle}
            </p>
          )}
          {!title && !subtitle && children}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

/**
 * Card Body
 */
const CardBody = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={`card__body ${className}`}
      style={{
        flex: 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Card Footer
 */
const CardFooter = ({
  children,
  align = 'right',
  className = '',
  style = {},
}) => {
  const alignments = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    between: 'space-between',
  };

  return (
    <div
      className={`card__footer ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: alignments[align] || 'flex-end',
        gap: '12px',
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: `1px solid ${colors.gray[200]}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Card Divider
 */
const CardDivider = ({ style = {} }) => {
  return (
    <hr
      style={{
        margin: '16px 0',
        border: 'none',
        borderTop: `1px solid ${colors.gray[200]}`,
        ...style,
      }}
    />
  );
};

/**
 * Stat Card - for dashboard metrics
 */
const StatCard = ({
  label,
  value,
  change,
  changeType = 'neutral', // 'positive' | 'negative' | 'neutral'
  icon,
  variant = 'default',
  onClick,
}) => {
  const changeColors = {
    positive: colors.success.main,
    negative: colors.error.main,
    neutral: colors.gray[500],
  };

  return (
    <Card variant={variant} clickable={!!onClick} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: colors.gray[500],
              fontWeight: '500',
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '28px',
              fontWeight: '700',
              color: colors.gray[900],
            }}
          >
            {value}
          </p>
          {change !== undefined && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '13px',
                color: changeColors[changeType],
                fontWeight: '500',
              }}
            >
              {changeType === 'positive' && '+'}
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: borderRadius.xl,
              background: colors.primary[100],
              color: colors.primary[600],
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

// Attach sub-components
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Divider = CardDivider;
Card.Stat = StatCard;

export default Card;
export { CardHeader, CardBody, CardFooter, CardDivider, StatCard };
