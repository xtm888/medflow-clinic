/**
 * VisualAcuitySelector Component
 *
 * StudioVision Parity: French visual acuity input system
 *
 * Features:
 * - Monoyer scale for distance vision (10/10, 9/10, etc.)
 * - Parinaud scale for near vision (P2, P3, etc.)
 * - Special notations (CLD, VBLM, PL+, PL-)
 * - With/without correction (AVL/AVC, AVP)
 * - Pinhole testing (TP - trou sténopéique)
 * - OD/OS/ODG support
 */

import React, { useState, useMemo } from 'react';
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
  Select,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  Divider,
  Switch,
  FormControl,
  FormLabel,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { FiEye, FiCheck, FiX, FiSun, FiMoon } from 'react-icons/fi';

// Monoyer scale values (distance vision at 5 meters)
const MONOYER_SCALE = [
  { value: '10/10', decimal: 1.0, logMAR: 0.0, label: '10/10' },
  { value: '9/10', decimal: 0.9, logMAR: 0.05, label: '9/10' },
  { value: '8/10', decimal: 0.8, logMAR: 0.1, label: '8/10' },
  { value: '7/10', decimal: 0.7, logMAR: 0.15, label: '7/10' },
  { value: '6/10', decimal: 0.6, logMAR: 0.22, label: '6/10' },
  { value: '5/10', decimal: 0.5, logMAR: 0.3, label: '5/10' },
  { value: '4/10', decimal: 0.4, logMAR: 0.4, label: '4/10' },
  { value: '3/10', decimal: 0.3, logMAR: 0.52, label: '3/10' },
  { value: '2/10', decimal: 0.2, logMAR: 0.7, label: '2/10' },
  { value: '1/10', decimal: 0.1, logMAR: 1.0, label: '1/10' },
  { value: '1/20', decimal: 0.05, logMAR: 1.3, label: '1/20' },
  { value: '1/50', decimal: 0.02, logMAR: 1.7, label: '1/50' },
];

// Special low vision notations (French)
const SPECIAL_NOTATIONS = [
  { value: 'CLD', label: 'CLD', description: 'Compte les doigts', category: 'low' },
  { value: 'VBLM', label: 'VBLM', description: 'Voit bouger la main', category: 'low' },
  { value: 'PL+', label: 'PL+', description: 'Perception lumineuse positive', category: 'minimal' },
  { value: 'PL-', label: 'PL-', description: 'Perception lumineuse négative', category: 'none' },
];

// Parinaud scale (near vision at 33cm)
const PARINAUD_SCALE = [
  { value: 'P1.5', label: 'P1.5', jaeger: 'J1', description: 'Vision normale' },
  { value: 'P2', label: 'P2', jaeger: 'J1+', description: 'Très bonne' },
  { value: 'P3', label: 'P3', jaeger: 'J2', description: 'Bonne' },
  { value: 'P4', label: 'P4', jaeger: 'J3', description: 'Satisfaisante' },
  { value: 'P5', label: 'P5', jaeger: 'J4', description: 'Limitée' },
  { value: 'P6', label: 'P6', jaeger: 'J5', description: 'Réduite' },
  { value: 'P8', label: 'P8', jaeger: 'J7', description: 'Très réduite' },
  { value: 'P10', label: 'P10', jaeger: 'J10', description: 'Mauvaise' },
  { value: 'P14', label: 'P14', jaeger: 'J14', description: 'Très mauvaise' },
  { value: 'P20', label: 'P20', jaeger: 'J20', description: 'Quasi nulle' },
];

// Distance at which CLD was measured
const CLD_DISTANCES = ['50cm', '1m', '2m', '3m', '4m', '5m'];

// Correction types
const CORRECTION_TYPES = {
  SC: { label: 'SC', description: 'Sans correction', full: 'Sans correction' },
  AVSC: { label: 'AVSC', description: 'AV sans correction', full: 'Acuité visuelle sans correction' },
  AVAC: { label: 'AVAC', description: 'AV avec correction', full: 'Acuité visuelle avec correction' },
  TP: { label: 'TP', description: 'Trou sténopéique', full: 'Trou sténopéique (pinhole)' },
};

// Get color based on visual acuity
const getAcuityColor = (value) => {
  if (!value) return 'gray';

  // Check special notations
  const special = SPECIAL_NOTATIONS.find(s => s.value === value);
  if (special) {
    if (special.category === 'none') return 'red';
    if (special.category === 'minimal') return 'orange';
    return 'yellow';
  }

  // Check Monoyer
  const monoyer = MONOYER_SCALE.find(m => m.value === value);
  if (monoyer) {
    if (monoyer.decimal >= 0.8) return 'green';
    if (monoyer.decimal >= 0.5) return 'yellow';
    if (monoyer.decimal >= 0.3) return 'orange';
    return 'red';
  }

  return 'gray';
};

/**
 * Main VisualAcuitySelector Component
 */
const VisualAcuitySelector = ({
  value,
  onChange,
  eye = 'OD',
  type = 'distance', // 'distance' or 'near'
  correctionType = 'SC',
  onCorrectionTypeChange,
  showCorrectionToggle = true,
  disabled = false,
  compact = false,
  label,
}) => {
  const [cldDistance, setCldDistance] = useState('1m');

  // Colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const selectedBg = useColorModeValue('blue.500', 'blue.400');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');

  const scale = type === 'distance' ? MONOYER_SCALE : PARINAUD_SCALE;
  const acuityColor = getAcuityColor(value);

  const handleSelect = (newValue) => {
    if (disabled) return;

    // For CLD, append distance
    if (newValue === 'CLD') {
      onChange?.(`CLD ${cldDistance}`);
    } else {
      onChange?.(newValue);
    }
  };

  // Parse CLD value
  const parsedValue = useMemo(() => {
    if (value?.startsWith('CLD ')) {
      return { base: 'CLD', distance: value.replace('CLD ', '') };
    }
    return { base: value, distance: null };
  }, [value]);

  if (compact) {
    return (
      <Popover placement="bottom-start">
        <PopoverTrigger>
          <Button
            size="sm"
            variant="outline"
            isDisabled={disabled}
            colorScheme={acuityColor}
            leftIcon={<FiEye />}
          >
            {eye}: {value || '—'}
          </Button>
        </PopoverTrigger>
        <PopoverContent width="300px">
          <PopoverArrow />
          <PopoverHeader fontWeight="bold">
            {type === 'distance' ? 'Acuité Visuelle de Loin' : 'Acuité Visuelle de Près'}
          </PopoverHeader>
          <PopoverBody>
            <VStack spacing={2} align="stretch">
              <SimpleGrid columns={4} spacing={1}>
                {scale.map((item) => (
                  <Button
                    key={item.value}
                    size="xs"
                    variant={value === item.value ? 'solid' : 'outline'}
                    colorScheme={value === item.value ? 'blue' : 'gray'}
                    onClick={() => handleSelect(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </SimpleGrid>
              {type === 'distance' && (
                <>
                  <Divider />
                  <HStack spacing={1}>
                    {SPECIAL_NOTATIONS.map((item) => (
                      <Tooltip key={item.value} label={item.description}>
                        <Button
                          size="xs"
                          variant={parsedValue.base === item.value ? 'solid' : 'outline'}
                          colorScheme={parsedValue.base === item.value ? 'orange' : 'gray'}
                          onClick={() => handleSelect(item.value)}
                        >
                          {item.label}
                        </Button>
                      </Tooltip>
                    ))}
                  </HStack>
                </>
              )}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
      opacity={disabled ? 0.6 : 1}
    >
      <VStack spacing={3} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <HStack spacing={2}>
            <Badge
              colorScheme={eye === 'OD' ? 'blue' : eye === 'OS' ? 'green' : 'purple'}
              fontSize="md"
              px={2}
              py={1}
            >
              <HStack spacing={1}>
                <FiEye />
                <Text>{eye}</Text>
              </HStack>
            </Badge>
            {label && <Text fontWeight="medium" color={textColor}>{label}</Text>}
          </HStack>

          {/* Current value display */}
          <Badge
            colorScheme={acuityColor}
            fontSize="lg"
            px={3}
            py={1}
          >
            {value || '—'}
          </Badge>
        </HStack>

        {/* Correction type toggle */}
        {showCorrectionToggle && (
          <ButtonGroup size="sm" isAttached variant="outline" width="100%">
            {Object.entries(CORRECTION_TYPES).map(([key, config]) => (
              <Tooltip key={key} label={config.full}>
                <Button
                  flex={1}
                  isActive={correctionType === key}
                  colorScheme={correctionType === key ? 'blue' : 'gray'}
                  variant={correctionType === key ? 'solid' : 'outline'}
                  onClick={() => onCorrectionTypeChange?.(key)}
                  isDisabled={disabled}
                >
                  {config.label}
                </Button>
              </Tooltip>
            ))}
          </ButtonGroup>
        )}

        {/* Scale selector */}
        <Box>
          <Text fontSize="sm" color="gray.500" mb={2}>
            {type === 'distance' ? 'Échelle de Monoyer (5m)' : 'Échelle de Parinaud (33cm)'}
          </Text>

          <SimpleGrid columns={type === 'distance' ? 4 : 5} spacing={1}>
            {scale.map((item) => (
              <Tooltip
                key={item.value}
                label={type === 'near' ? `${item.description} (${item.jaeger})` : `LogMAR: ${item.logMAR}`}
              >
                <Button
                  size="sm"
                  variant={value === item.value ? 'solid' : 'outline'}
                  colorScheme={value === item.value ? 'blue' : 'gray'}
                  onClick={() => handleSelect(item.value)}
                  isDisabled={disabled}
                  _hover={!disabled ? { bg: hoverBg } : undefined}
                >
                  {item.label}
                </Button>
              </Tooltip>
            ))}
          </SimpleGrid>
        </Box>

        {/* Special notations for distance vision */}
        {type === 'distance' && (
          <Box>
            <Text fontSize="sm" color="gray.500" mb={2}>
              Notations spéciales
            </Text>

            <HStack spacing={2}>
              {SPECIAL_NOTATIONS.map((item) => (
                <Tooltip key={item.value} label={item.description}>
                  <Button
                    size="sm"
                    variant={parsedValue.base === item.value ? 'solid' : 'outline'}
                    colorScheme={
                      parsedValue.base === item.value
                        ? item.category === 'none' ? 'red'
                        : item.category === 'minimal' ? 'orange'
                        : 'yellow'
                        : 'gray'
                    }
                    onClick={() => handleSelect(item.value)}
                    isDisabled={disabled}
                  >
                    {item.label}
                  </Button>
                </Tooltip>
              ))}

              {/* CLD distance selector */}
              {parsedValue.base === 'CLD' && (
                <Select
                  size="sm"
                  width="80px"
                  value={parsedValue.distance || cldDistance}
                  onChange={(e) => {
                    setCldDistance(e.target.value);
                    onChange?.(`CLD ${e.target.value}`);
                  }}
                  isDisabled={disabled}
                >
                  {CLD_DISTANCES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              )}
            </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

/**
 * Dual Eye Visual Acuity Selector
 */
export const DualVisualAcuitySelector = ({
  odValue,
  osValue,
  onOdChange,
  onOsChange,
  odCorrection = 'SC',
  osCorrection = 'SC',
  onOdCorrectionChange,
  onOsCorrectionChange,
  type = 'distance',
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4}>
        <Text fontWeight="bold" fontSize="lg">
          {type === 'distance' ? 'Acuité Visuelle de Loin' : 'Acuité Visuelle de Près'}
        </Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} width="100%">
          <VisualAcuitySelector
            value={odValue}
            onChange={onOdChange}
            eye="OD"
            type={type}
            correctionType={odCorrection}
            onCorrectionTypeChange={onOdCorrectionChange}
            disabled={disabled}
          />
          <VisualAcuitySelector
            value={osValue}
            onChange={onOsChange}
            eye="OS"
            type={type}
            correctionType={osCorrection}
            onCorrectionTypeChange={onOsCorrectionChange}
            disabled={disabled}
          />
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

/**
 * Complete Visual Acuity Panel (Distance + Near)
 */
export const VisualAcuityPanel = ({
  data = {},
  onChange,
  disabled = false,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  const handleChange = (field, value) => {
    onChange?.({
      ...data,
      [field]: value,
    });
  };

  return (
    <VStack spacing={4} p={4} bg={bgColor} borderRadius="lg">
      <Text fontWeight="bold" fontSize="xl">Acuité Visuelle</Text>

      {/* Distance Vision */}
      <DualVisualAcuitySelector
        odValue={data.distanceOD}
        osValue={data.distanceOS}
        onOdChange={(v) => handleChange('distanceOD', v)}
        onOsChange={(v) => handleChange('distanceOS', v)}
        odCorrection={data.distanceODCorrection}
        osCorrection={data.distanceOSCorrection}
        onOdCorrectionChange={(v) => handleChange('distanceODCorrection', v)}
        onOsCorrectionChange={(v) => handleChange('distanceOSCorrection', v)}
        type="distance"
        disabled={disabled}
      />

      {/* Near Vision */}
      <DualVisualAcuitySelector
        odValue={data.nearOD}
        osValue={data.nearOS}
        onOdChange={(v) => handleChange('nearOD', v)}
        onOsChange={(v) => handleChange('nearOS', v)}
        odCorrection={data.nearODCorrection}
        osCorrection={data.nearOSCorrection}
        onOdCorrectionChange={(v) => handleChange('nearODCorrection', v)}
        onOsCorrectionChange={(v) => handleChange('nearOSCorrection', v)}
        type="near"
        disabled={disabled}
      />
    </VStack>
  );
};

/**
 * Compact Visual Acuity Display (read-only summary)
 */
export const VisualAcuitySummary = ({
  distanceOD,
  distanceOS,
  nearOD,
  nearOS,
  correction = 'AVSC',
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      p={3}
      bg={bgColor}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={2} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium">Acuité Visuelle</Text>
          <Badge colorScheme="blue" size="sm">{correction}</Badge>
        </HStack>

        <SimpleGrid columns={2} spacing={2}>
          <HStack>
            <Badge colorScheme="blue" size="sm">OD</Badge>
            <Text fontSize="sm">
              L: <strong>{distanceOD || '—'}</strong>
              {nearOD && <> / P: <strong>{nearOD}</strong></>}
            </Text>
          </HStack>
          <HStack>
            <Badge colorScheme="green" size="sm">OS</Badge>
            <Text fontSize="sm">
              L: <strong>{distanceOS || '—'}</strong>
              {nearOS && <> / P: <strong>{nearOS}</strong></>}
            </Text>
          </HStack>
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

// Export constants
export {
  MONOYER_SCALE,
  PARINAUD_SCALE,
  SPECIAL_NOTATIONS,
  CORRECTION_TYPES,
  CLD_DISTANCES,
  getAcuityColor,
};

export default VisualAcuitySelector;
