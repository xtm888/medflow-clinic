/**
 * KeratometryInput Component
 *
 * StudioVision Parity: Corneal curvature (K readings) input
 *
 * Features:
 * - K1/K2 readings in diopters or mm
 * - Steep and flat meridian with axis
 * - Delta K (corneal astigmatism)
 * - Sim K display
 * - Average K calculation
 * - WTR/ATR/Oblique classification
 * - Device data import support
 * - OD/OS with visual comparison
 */

import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  ButtonGroup,
  Tooltip,
  IconButton,
  useColorModeValue,
  SimpleGrid,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Divider,
  FormControl,
  FormLabel,
  Switch,
  Grid,
  GridItem,
  Select,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react';
import {
  FiEye,
  FiDownload,
  FiCopy,
  FiTarget,
  FiActivity,
} from 'react-icons/fi';

import { AxisDisplay, getAstigmatismType } from './AxisWheelSelector';

// Conversion constants
const DIOPTER_TO_MM = 337.5; // Standard refractive index for cornea

// Convert diopters to mm radius
const diopterToMm = (d) => {
  if (!d || d === 0) return null;
  return Math.round((DIOPTER_TO_MM / d) * 100) / 100;
};

// Convert mm to diopters
const mmToDiopter = (mm) => {
  if (!mm || mm === 0) return null;
  return Math.round((DIOPTER_TO_MM / mm) * 100) / 100;
};

// Calculate average K
const calculateAverageK = (k1, k2) => {
  if (k1 === null || k2 === null) return null;
  return Math.round(((k1 + k2) / 2) * 100) / 100;
};

// Calculate Delta K (corneal astigmatism)
const calculateDeltaK = (k1, k2) => {
  if (k1 === null || k2 === null) return null;
  return Math.round(Math.abs(k2 - k1) * 100) / 100;
};

// Classify corneal astigmatism
const classifyCornealAstigmatism = (axis, deltaK) => {
  if (!deltaK || deltaK < 0.5) {
    return { type: 'Sphérique', color: 'green', description: 'Pas d\'astigmatisme significatif' };
  }

  // Use the same logic as cylinder axis classification
  const astigType = getAstigmatismType(axis);

  if (deltaK >= 3) {
    return { ...astigType, severity: 'Fort', color: 'red' };
  } else if (deltaK >= 1.5) {
    return { ...astigType, severity: 'Modéré', color: 'orange' };
  } else {
    return { ...astigType, severity: 'Léger', color: 'yellow' };
  }
};

// Get color based on K value (normal range is roughly 42-46 D)
const getKValueColor = (k) => {
  if (k === null) return 'gray';
  if (k < 40) return 'red'; // Very flat - keratoconus suspect
  if (k < 42) return 'orange';
  if (k <= 46) return 'green'; // Normal
  if (k <= 48) return 'orange';
  return 'red'; // Very steep - keratoconus suspect
};

/**
 * Single Eye Keratometry Input
 */
const SingleEyeKeratometry = ({
  eye = 'OD',
  k1, // Flat K (lower value)
  k2, // Steep K (higher value)
  k1Axis, // Axis of flat meridian
  k2Axis, // Axis of steep meridian (usually k1Axis + 90)
  onK1Change,
  onK2Change,
  onK1AxisChange,
  onK2AxisChange,
  displayMode = 'diopters', // 'diopters' or 'mm'
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  // Calculated values
  const averageK = calculateAverageK(k1, k2);
  const deltaK = calculateDeltaK(k1, k2);
  const astigmatism = classifyCornealAstigmatism(k2Axis, deltaK);

  // Display values based on mode
  const displayK1 = displayMode === 'mm' ? diopterToMm(k1) : k1;
  const displayK2 = displayMode === 'mm' ? diopterToMm(k2) : k2;
  const displayAvg = displayMode === 'mm' ? diopterToMm(averageK) : averageK;
  const unit = displayMode === 'mm' ? 'mm' : 'D';

  // Auto-calculate steep axis from flat axis
  const handleK1AxisChange = (axis) => {
    onK1AxisChange?.(axis);
    // Steep meridian is perpendicular
    let steepAxis = axis + 90;
    if (steepAxis > 180) steepAxis -= 180;
    onK2AxisChange?.(steepAxis);
  };

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Badge
            colorScheme={eye === 'OD' ? 'blue' : 'green'}
            fontSize="lg"
            px={3}
            py={1}
          >
            <HStack spacing={1}>
              <FiEye />
              <Text>{eye}</Text>
            </HStack>
          </Badge>

          {deltaK !== null && (
            <Badge colorScheme={astigmatism.color} px={2}>
              ΔK: {deltaK} D - {astigmatism.severity || ''} {astigmatism.type}
            </Badge>
          )}
        </HStack>

        {/* K readings grid */}
        <Grid templateColumns="1fr 1fr" gap={4}>
          {/* K1 (Flat) */}
          <GridItem>
            <FormControl>
              <FormLabel fontSize="xs" color={labelColor}>
                K1 (Plat) - {unit}
              </FormLabel>
              <HStack>
                <NumberInput
                  value={displayK1 ?? ''}
                  onChange={(_, val) => {
                    const diopters = displayMode === 'mm' ? mmToDiopter(val) : val;
                    onK1Change?.(isNaN(diopters) ? null : diopters);
                  }}
                  min={displayMode === 'mm' ? 6 : 35}
                  max={displayMode === 'mm' ? 10 : 55}
                  step={0.25}
                  precision={2}
                  size="sm"
                  isDisabled={disabled}
                >
                  <NumberInputField
                    textAlign="center"
                    fontWeight="bold"
                    color={`${getKValueColor(k1)}.500`}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>

                <Text fontSize="sm" color={labelColor}>@</Text>

                <NumberInput
                  value={k1Axis ?? ''}
                  onChange={(_, val) => handleK1AxisChange(isNaN(val) ? null : val)}
                  min={0}
                  max={180}
                  step={5}
                  size="sm"
                  width="70px"
                  isDisabled={disabled}
                >
                  <NumberInputField textAlign="center" />
                </NumberInput>
                <Text fontSize="xs" color={labelColor}>°</Text>
              </HStack>
            </FormControl>
          </GridItem>

          {/* K2 (Steep) */}
          <GridItem>
            <FormControl>
              <FormLabel fontSize="xs" color={labelColor}>
                K2 (Cambré) - {unit}
              </FormLabel>
              <HStack>
                <NumberInput
                  value={displayK2 ?? ''}
                  onChange={(_, val) => {
                    const diopters = displayMode === 'mm' ? mmToDiopter(val) : val;
                    onK2Change?.(isNaN(diopters) ? null : diopters);
                  }}
                  min={displayMode === 'mm' ? 6 : 35}
                  max={displayMode === 'mm' ? 10 : 55}
                  step={0.25}
                  precision={2}
                  size="sm"
                  isDisabled={disabled}
                >
                  <NumberInputField
                    textAlign="center"
                    fontWeight="bold"
                    color={`${getKValueColor(k2)}.500`}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>

                <Text fontSize="sm" color={labelColor}>@</Text>

                <NumberInput
                  value={k2Axis ?? ''}
                  onChange={(_, val) => onK2AxisChange?.(isNaN(val) ? null : val)}
                  min={0}
                  max={180}
                  step={5}
                  size="sm"
                  width="70px"
                  isDisabled={disabled}
                >
                  <NumberInputField textAlign="center" />
                </NumberInput>
                <Text fontSize="xs" color={labelColor}>°</Text>
              </HStack>
            </FormControl>
          </GridItem>
        </Grid>

        {/* Summary stats */}
        <SimpleGrid columns={3} spacing={2}>
          <Stat size="sm" textAlign="center">
            <StatLabel fontSize="xs">K Moyen</StatLabel>
            <StatNumber fontSize="md" color={`${getKValueColor(averageK)}.500`}>
              {displayAvg ?? '—'} {unit}
            </StatNumber>
          </Stat>

          <Stat size="sm" textAlign="center">
            <StatLabel fontSize="xs">Delta K</StatLabel>
            <StatNumber fontSize="md" color={`${astigmatism.color}.500`}>
              {deltaK ?? '—'} D
            </StatNumber>
          </Stat>

          <Stat size="sm" textAlign="center">
            <StatLabel fontSize="xs">Type</StatLabel>
            <StatNumber fontSize="sm">
              <Badge colorScheme={astigmatism.color} size="sm">
                {astigmatism.type}
              </Badge>
            </StatNumber>
          </Stat>
        </SimpleGrid>

        {/* Visual axis display */}
        {k2Axis !== null && deltaK > 0.5 && (
          <HStack justify="center">
            <AxisDisplay value={k2Axis} eye={eye} size={40} />
            <Text fontSize="xs" color="gray.500">
              Méridien cambré @ {k2Axis}°
            </Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

/**
 * Main Keratometry Panel
 */
const KeratometryInput = ({
  data = {},
  onChange,
  displayMode = 'diopters',
  onDisplayModeChange,
  deviceData = null,
  onImportDevice,
  disabled = false,
  compact = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleChange = useCallback((field, value) => {
    onChange?.({
      ...data,
      [field]: value,
    });
  }, [data, onChange]);

  // Copy OD to OS
  const handleCopyODtoOS = useCallback(() => {
    onChange?.({
      ...data,
      osK1: data.odK1,
      osK2: data.odK2,
      osK1Axis: data.odK1Axis ? (180 - data.odK1Axis) : data.odK1Axis,
      osK2Axis: data.odK2Axis ? (180 - data.odK2Axis) : data.odK2Axis,
    });
  }, [data, onChange]);

  // Import device data
  const handleImportDeviceData = useCallback(() => {
    if (!deviceData) return;
    onChange?.({
      ...data,
      odK1: deviceData.odK1,
      odK2: deviceData.odK2,
      odK1Axis: deviceData.odK1Axis,
      odK2Axis: deviceData.odK2Axis,
      osK1: deviceData.osK1,
      osK2: deviceData.osK2,
      osK1Axis: deviceData.osK1Axis,
      osK2Axis: deviceData.osK2Axis,
    });
    onImportDevice?.();
  }, [deviceData, data, onChange, onImportDevice]);

  if (compact) {
    return (
      <KeratometrySummary
        odK1={data.odK1}
        odK2={data.odK2}
        odAxis={data.odK2Axis}
        osK1={data.osK1}
        osK2={data.osK2}
        osAxis={data.osK2Axis}
      />
    );
  }

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="lg">Kératométrie</Text>

          <HStack spacing={2}>
            {/* Unit toggle */}
            <ButtonGroup size="sm" isAttached variant="outline">
              <Button
                isActive={displayMode === 'diopters'}
                onClick={() => onDisplayModeChange?.('diopters')}
                isDisabled={disabled}
              >
                Dioptries
              </Button>
              <Button
                isActive={displayMode === 'mm'}
                onClick={() => onDisplayModeChange?.('mm')}
                isDisabled={disabled}
              >
                mm
              </Button>
            </ButtonGroup>

            <Tooltip label="Copier OD → OS">
              <IconButton
                icon={<FiCopy />}
                size="sm"
                variant="ghost"
                onClick={handleCopyODtoOS}
                isDisabled={disabled}
                aria-label="Copier vers OS"
              />
            </Tooltip>

            {deviceData && (
              <Tooltip label="Importer données appareil">
                <IconButton
                  icon={<FiDownload />}
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleImportDeviceData}
                  isDisabled={disabled}
                  aria-label="Importer"
                />
              </Tooltip>
            )}
          </HStack>
        </HStack>

        {/* Device data alert */}
        {deviceData && (
          <Alert status="info" size="sm" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">Données topographe/autokerato disponibles</Text>
          </Alert>
        )}

        {/* Dual eye input */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
          <SingleEyeKeratometry
            eye="OD"
            k1={data.odK1}
            k2={data.odK2}
            k1Axis={data.odK1Axis}
            k2Axis={data.odK2Axis}
            onK1Change={(v) => handleChange('odK1', v)}
            onK2Change={(v) => handleChange('odK2', v)}
            onK1AxisChange={(v) => handleChange('odK1Axis', v)}
            onK2AxisChange={(v) => handleChange('odK2Axis', v)}
            displayMode={displayMode}
            disabled={disabled}
          />

          <SingleEyeKeratometry
            eye="OS"
            k1={data.osK1}
            k2={data.osK2}
            k1Axis={data.osK1Axis}
            k2Axis={data.osK2Axis}
            onK1Change={(v) => handleChange('osK1', v)}
            onK2Change={(v) => handleChange('osK2', v)}
            onK1AxisChange={(v) => handleChange('osK1Axis', v)}
            onK2AxisChange={(v) => handleChange('osK2Axis', v)}
            displayMode={displayMode}
            disabled={disabled}
          />
        </SimpleGrid>

        {/* Asymmetry check */}
        {data.odK1 && data.osK1 && (
          <AsymmetryCheck odData={data} osData={data} />
        )}
      </VStack>
    </Box>
  );
};

/**
 * Asymmetry Check Component
 */
const AsymmetryCheck = ({ odData, osData }) => {
  const odAvg = calculateAverageK(odData.odK1, odData.odK2);
  const osAvg = calculateAverageK(osData.osK1, osData.osK2);
  const odDelta = calculateDeltaK(odData.odK1, odData.odK2);
  const osDelta = calculateDeltaK(osData.osK1, osData.osK2);

  const avgDiff = odAvg && osAvg ? Math.abs(odAvg - osAvg) : null;
  const deltaDiff = odDelta && osDelta ? Math.abs(odDelta - osDelta) : null;

  const hasSignificantAsymmetry = avgDiff > 1 || deltaDiff > 1;

  if (!hasSignificantAsymmetry) return null;

  return (
    <Alert status="warning" size="sm" borderRadius="md">
      <AlertIcon />
      <VStack align="start" spacing={0}>
        <Text fontSize="sm" fontWeight="medium">Asymétrie kératométrique détectée</Text>
        <Text fontSize="xs">
          {avgDiff > 1 && `K moyen: Δ ${avgDiff?.toFixed(2)} D`}
          {avgDiff > 1 && deltaDiff > 1 && ' | '}
          {deltaDiff > 1 && `Astigmatisme: Δ ${deltaDiff?.toFixed(2)} D`}
        </Text>
      </VStack>
    </Alert>
  );
};

/**
 * Compact Keratometry Summary
 */
export const KeratometrySummary = ({
  odK1,
  odK2,
  odAxis,
  osK1,
  osK2,
  osAxis,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const formatK = (k1, k2, axis) => {
    if (!k1 && !k2) return '—';
    return `${k1?.toFixed(2) || '—'}/${k2?.toFixed(2) || '—'} @${axis || '—'}°`;
  };

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <VStack spacing={2} align="stretch">
        <Text fontSize="sm" fontWeight="medium">Kératométrie</Text>
        <SimpleGrid columns={2} spacing={2}>
          <HStack>
            <Badge colorScheme="blue" size="sm">OD</Badge>
            <Text fontSize="sm" fontFamily="mono">
              {formatK(odK1, odK2, odAxis)}
            </Text>
          </HStack>
          <HStack>
            <Badge colorScheme="green" size="sm">OS</Badge>
            <Text fontSize="sm" fontFamily="mono">
              {formatK(osK1, osK2, osAxis)}
            </Text>
          </HStack>
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

// Export utilities
export {
  diopterToMm,
  mmToDiopter,
  calculateAverageK,
  calculateDeltaK,
  classifyCornealAstigmatism,
  getKValueColor,
  DIOPTER_TO_MM,
};

export default KeratometryInput;
