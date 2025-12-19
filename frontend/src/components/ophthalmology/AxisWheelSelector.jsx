/**
 * AxisWheelSelector Component
 *
 * StudioVision Parity: Visual cylinder axis wheel selector
 *
 * Features:
 * - Interactive circular wheel for 0-180° axis selection
 * - Click/drag interaction for intuitive axis input
 * - Common axis positions highlighted (WTR, ATR, oblique)
 * - Keyboard accessible (arrow keys for fine adjustment)
 * - Touch-friendly for tablet use
 * - OD/OS eye indicator with optional mirroring
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
  Tooltip,
  IconButton,
  useColorModeValue,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Kbd,
} from '@chakra-ui/react';
import { FiMinus, FiPlus, FiRotateCcw, FiEye } from 'react-icons/fi';

// Common axis positions in ophthalmology
const AXIS_PRESETS = {
  0: { label: '0°', description: 'Against the Rule (ATR)', color: 'blue' },
  45: { label: '45°', description: 'Oblique', color: 'purple' },
  90: { label: '90°', description: 'With the Rule (WTR)', color: 'green' },
  135: { label: '135°', description: 'Oblique', color: 'purple' },
  180: { label: '180°', description: 'Against the Rule (ATR)', color: 'blue' },
};

// Astigmatism type classification
const getAstigmatismType = (axis) => {
  if (axis === 0 || axis === 180 || (axis >= 165 && axis <= 180) || (axis >= 0 && axis <= 15)) {
    return { type: 'ATR', label: 'Against the Rule', color: 'blue' };
  } else if ((axis >= 75 && axis <= 105)) {
    return { type: 'WTR', label: 'With the Rule', color: 'green' };
  } else {
    return { type: 'Oblique', label: 'Oblique Astigmatism', color: 'purple' };
  }
};

/**
 * Main AxisWheelSelector Component
 */
const AxisWheelSelector = ({
  value = 90,
  onChange,
  eye = 'OD',
  size = 200,
  showPresets = true,
  showNumericInput = true,
  showAstigmatismType = true,
  disabled = false,
  label,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef(null);

  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const wheelBg = useColorModeValue('gray.50', 'gray.700');
  const axisLineColor = useColorModeValue('red.500', 'red.400');
  const tickColor = useColorModeValue('gray.400', 'gray.500');
  const majorTickColor = useColorModeValue('gray.600', 'gray.400');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  const astigmatismInfo = getAstigmatismType(value);

  // Calculate angle from mouse/touch position
  const calculateAngle = useCallback((clientX, clientY) => {
    if (!wheelRef.current) return value;

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle in radians, then convert to degrees
    let angle = Math.atan2(centerY - clientY, clientX - centerX);
    angle = (angle * 180 / Math.PI);

    // Convert to 0-180 range (cylinder axis range)
    // The visual representation shows a full circle but axis is 0-180
    angle = Math.round(angle);
    if (angle < 0) angle += 180;
    if (angle > 180) angle = angle - 180;

    return Math.max(0, Math.min(180, angle));
  }, [value]);

  // Mouse/touch handlers
  const handleMouseDown = useCallback((e) => {
    if (disabled) return;
    setIsDragging(true);
    const angle = calculateAngle(e.clientX, e.clientY);
    onChange?.(angle);
  }, [disabled, calculateAngle, onChange]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || disabled) return;
    const angle = calculateAngle(e.clientX, e.clientY);
    onChange?.(angle);
  }, [isDragging, disabled, calculateAngle, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    setIsDragging(true);
    const touch = e.touches[0];
    const angle = calculateAngle(touch.clientX, touch.clientY);
    onChange?.(angle);
  }, [disabled, calculateAngle, onChange]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || disabled) return;
    const touch = e.touches[0];
    const angle = calculateAngle(touch.clientX, touch.clientY);
    onChange?.(angle);
  }, [isDragging, disabled, calculateAngle, onChange]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    let newValue = value;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        newValue = Math.min(180, value + (e.shiftKey ? 5 : 1));
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        newValue = Math.max(0, value - (e.shiftKey ? 5 : 1));
        e.preventDefault();
        break;
      case 'Home':
        newValue = 0;
        e.preventDefault();
        break;
      case 'End':
        newValue = 180;
        e.preventDefault();
        break;
      default:
        return;
    }
    onChange?.(newValue);
  }, [disabled, value, onChange]);

  // Global mouse events for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Render tick marks around the wheel
  const renderTicks = () => {
    const ticks = [];
    const radius = size / 2 - 10;
    const innerRadius = radius - 15;
    const labelRadius = radius - 30;

    for (let deg = 0; deg <= 180; deg += 5) {
      const isMajor = deg % 45 === 0;
      const isCardinal = deg === 0 || deg === 90 || deg === 180;

      // Convert to radians for positioning (0° is at right, going counter-clockwise)
      const rad = (deg * Math.PI) / 180;

      const x1 = size / 2 + Math.cos(rad) * radius;
      const y1 = size / 2 - Math.sin(rad) * radius;
      const x2 = size / 2 + Math.cos(rad) * (isMajor ? innerRadius - 5 : innerRadius);
      const y2 = size / 2 - Math.sin(rad) * (isMajor ? innerRadius - 5 : innerRadius);

      ticks.push(
        <line
          key={`tick-${deg}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isCardinal ? majorTickColor : tickColor}
          strokeWidth={isMajor ? 2 : 1}
          opacity={isMajor ? 1 : 0.5}
        />
      );

      // Add labels for major ticks
      if (isMajor) {
        const labelX = size / 2 + Math.cos(rad) * labelRadius;
        const labelY = size / 2 - Math.sin(rad) * labelRadius;

        ticks.push(
          <text
            key={`label-${deg}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={textColor}
            fontSize="12"
            fontWeight={isCardinal ? 'bold' : 'normal'}
          >
            {deg}°
          </text>
        );
      }
    }

    // Mirror for bottom half (180-360 maps to 0-180)
    for (let deg = 185; deg < 360; deg += 5) {
      const displayDeg = 360 - deg;
      const isMajor = displayDeg % 45 === 0;

      const rad = (deg * Math.PI) / 180;
      const radius2 = size / 2 - 10;
      const innerRadius2 = radius2 - 15;

      const x1 = size / 2 + Math.cos(rad) * radius2;
      const y1 = size / 2 - Math.sin(rad) * radius2;
      const x2 = size / 2 + Math.cos(rad) * (isMajor ? innerRadius2 - 5 : innerRadius2);
      const y2 = size / 2 - Math.sin(rad) * (isMajor ? innerRadius2 - 5 : innerRadius2);

      ticks.push(
        <line
          key={`tick-mirror-${deg}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={tickColor}
          strokeWidth={isMajor ? 2 : 1}
          opacity={0.3}
        />
      );
    }

    return ticks;
  };

  // Render the axis indicator line
  const renderAxisLine = () => {
    const radius = size / 2 - 25;
    const rad = (value * Math.PI) / 180;

    // Line extends in both directions (representing cylinder axis)
    const x1 = size / 2 + Math.cos(rad) * radius;
    const y1 = size / 2 - Math.sin(rad) * radius;
    const x2 = size / 2 - Math.cos(rad) * radius;
    const y2 = size / 2 + Math.sin(rad) * radius;

    return (
      <g>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={axisLineColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Arrow head on primary side */}
        <circle
          cx={x1}
          cy={y1}
          r={6}
          fill={axisLineColor}
        />
        {/* Small circle on opposite side */}
        <circle
          cx={x2}
          cy={y2}
          r={3}
          fill={axisLineColor}
          opacity={0.5}
        />
      </g>
    );
  };

  return (
    <VStack spacing={3} align="center">
      {/* Label and eye indicator */}
      <HStack spacing={2}>
        {label && <Text fontWeight="medium" color={textColor}>{label}</Text>}
        <Badge
          colorScheme={eye === 'OD' ? 'blue' : 'green'}
          fontSize="sm"
          px={2}
        >
          <HStack spacing={1}>
            <FiEye />
            <Text>{eye}</Text>
          </HStack>
        </Badge>
      </HStack>

      {/* Main wheel */}
      <Box
        ref={wheelRef}
        position="relative"
        width={`${size}px`}
        height={`${size}px`}
        cursor={disabled ? 'not-allowed' : 'crosshair'}
        opacity={disabled ? 0.5 : 1}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={`${eye} Cylinder Axis`}
        aria-valuemin={0}
        aria-valuemax={180}
        aria-valuenow={value}
        _focus={{
          outline: '2px solid',
          outlineColor: 'blue.500',
          outlineOffset: '2px',
          borderRadius: 'full',
        }}
      >
        <svg width={size} height={size}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 5}
            fill={wheelBg}
            stroke={borderColor}
            strokeWidth={2}
          />

          {/* Tick marks */}
          {renderTicks()}

          {/* Center dot */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={4}
            fill={textColor}
          />

          {/* Axis line indicator */}
          {renderAxisLine()}
        </svg>

        {/* Current value display in center */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          textAlign="center"
          pointerEvents="none"
          mt={8}
        >
          <Text
            fontSize="2xl"
            fontWeight="bold"
            color={axisLineColor}
          >
            {value}°
          </Text>
        </Box>
      </Box>

      {/* Astigmatism type indicator */}
      {showAstigmatismType && (
        <Badge
          colorScheme={astigmatismInfo.color}
          fontSize="sm"
          px={3}
          py={1}
        >
          {astigmatismInfo.type}: {astigmatismInfo.label}
        </Badge>
      )}

      {/* Numeric input with fine controls */}
      {showNumericInput && (
        <HStack spacing={2}>
          <Tooltip label="Decrease by 1° (Shift+Arrow for 5°)">
            <IconButton
              icon={<FiMinus />}
              size="sm"
              variant="outline"
              onClick={() => onChange?.(Math.max(0, value - 1))}
              isDisabled={disabled || value <= 0}
              aria-label="Decrease axis"
            />
          </Tooltip>

          <NumberInput
            value={value}
            onChange={(_, val) => onChange?.(Math.max(0, Math.min(180, val || 0)))}
            min={0}
            max={180}
            step={1}
            size="sm"
            width="80px"
            isDisabled={disabled}
          >
            <NumberInputField textAlign="center" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>

          <Tooltip label="Increase by 1° (Shift+Arrow for 5°)">
            <IconButton
              icon={<FiPlus />}
              size="sm"
              variant="outline"
              onClick={() => onChange?.(Math.min(180, value + 1))}
              isDisabled={disabled || value >= 180}
              aria-label="Increase axis"
            />
          </Tooltip>

          <Tooltip label="Reset to 90° (WTR)">
            <IconButton
              icon={<FiRotateCcw />}
              size="sm"
              variant="ghost"
              onClick={() => onChange?.(90)}
              isDisabled={disabled}
              aria-label="Reset axis"
            />
          </Tooltip>
        </HStack>
      )}

      {/* Quick presets */}
      {showPresets && (
        <HStack spacing={1} flexWrap="wrap" justify="center">
          {Object.entries(AXIS_PRESETS).map(([deg, preset]) => (
            <Tooltip key={deg} label={preset.description}>
              <Badge
                colorScheme={parseInt(deg) === value ? preset.color : 'gray'}
                variant={parseInt(deg) === value ? 'solid' : 'outline'}
                cursor={disabled ? 'not-allowed' : 'pointer'}
                px={2}
                py={1}
                borderRadius="full"
                onClick={() => !disabled && onChange?.(parseInt(deg))}
                _hover={!disabled ? { bg: hoverBg } : undefined}
              >
                {preset.label}
              </Badge>
            </Tooltip>
          ))}
        </HStack>
      )}

      {/* Keyboard hint */}
      <Text fontSize="xs" color="gray.500">
        <Kbd>←</Kbd><Kbd>→</Kbd> ±1° | <Kbd>Shift</Kbd>+arrows ±5°
      </Text>
    </VStack>
  );
};

/**
 * Compact AxisWheelSelector for inline use
 */
export const AxisWheelCompact = ({
  value = 90,
  onChange,
  eye = 'OD',
  disabled = false,
}) => {
  const astigmatismInfo = getAstigmatismType(value);
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <HStack
      spacing={2}
      p={2}
      bg={bgColor}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
    >
      <Badge colorScheme={eye === 'OD' ? 'blue' : 'green'} size="sm">
        {eye}
      </Badge>

      <HStack spacing={1}>
        <IconButton
          icon={<FiMinus />}
          size="xs"
          variant="ghost"
          onClick={() => onChange?.(Math.max(0, value - 1))}
          isDisabled={disabled || value <= 0}
          aria-label="Decrease"
        />

        <NumberInput
          value={value}
          onChange={(_, val) => onChange?.(Math.max(0, Math.min(180, val || 0)))}
          min={0}
          max={180}
          size="xs"
          width="60px"
          isDisabled={disabled}
        >
          <NumberInputField textAlign="center" px={1} />
        </NumberInput>

        <IconButton
          icon={<FiPlus />}
          size="xs"
          variant="ghost"
          onClick={() => onChange?.(Math.min(180, value + 1))}
          isDisabled={disabled || value >= 180}
          aria-label="Increase"
        />
      </HStack>

      <Tooltip label={astigmatismInfo.label}>
        <Badge colorScheme={astigmatismInfo.color} size="sm">
          {astigmatismInfo.type}
        </Badge>
      </Tooltip>
    </HStack>
  );
};

/**
 * Dual Axis Selector for OD/OS
 */
export const DualAxisSelector = ({
  odValue = 90,
  osValue = 90,
  onOdChange,
  onOsChange,
  size = 180,
  mirrorOS = true,
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Flex
      gap={6}
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      justify="center"
      wrap="wrap"
    >
      <AxisWheelSelector
        value={odValue}
        onChange={onOdChange}
        eye="OD"
        size={size}
        disabled={disabled}
        label="Right Eye"
      />

      <AxisWheelSelector
        value={osValue}
        onChange={onOsChange}
        eye="OS"
        size={size}
        disabled={disabled}
        label="Left Eye"
      />
    </Flex>
  );
};

/**
 * Mini axis display (read-only)
 */
export const AxisDisplay = ({
  value = 90,
  eye,
  size = 40,
}) => {
  const astigmatismInfo = getAstigmatismType(value);
  const bgColor = useColorModeValue('gray.100', 'gray.700');
  const axisColor = useColorModeValue('red.500', 'red.400');

  const rad = (value * Math.PI) / 180;
  const lineLength = size / 2 - 8;

  return (
    <Tooltip label={`${value}° - ${astigmatismInfo.label}`}>
      <HStack spacing={1}>
        {eye && (
          <Badge colorScheme={eye === 'OD' ? 'blue' : 'green'} size="sm">
            {eye}
          </Badge>
        )}
        <Box
          width={`${size}px`}
          height={`${size}px`}
          borderRadius="full"
          bg={bgColor}
          position="relative"
        >
          <svg width={size} height={size}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 2}
              fill="none"
              stroke="gray"
              strokeWidth={1}
              opacity={0.3}
            />
            <line
              x1={size / 2 + Math.cos(rad) * lineLength}
              y1={size / 2 - Math.sin(rad) * lineLength}
              x2={size / 2 - Math.cos(rad) * lineLength}
              y2={size / 2 + Math.sin(rad) * lineLength}
              stroke={axisColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </Box>
        <Text fontSize="sm" fontWeight="medium">
          {value}°
        </Text>
      </HStack>
    </Tooltip>
  );
};

// Export constants for external use
export { AXIS_PRESETS, getAstigmatismType };

export default AxisWheelSelector;
