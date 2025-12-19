/**
 * IOPInput Component
 *
 * StudioVision Parity: Intraocular Pressure measurement input
 *
 * Features:
 * - IOP input in mmHg with normal range indicators
 * - Target pressure tracking for glaucoma patients
 * - Time of day recording (diurnal variation)
 * - Multiple measurement methods (Goldmann, NCT, iCare, etc.)
 * - CCT (pachymetry) correction factor
 * - OD/OS separate values with visual comparison
 * - Historical trend mini-chart
 * - Pressure alerts (high/low)
 */

import React, { useMemo } from 'react';
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
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Alert,
  AlertIcon,
  AlertDescription,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  SliderMark,
} from '@chakra-ui/react';
import {
  FiEye,
  FiAlertTriangle,
  FiAlertCircle,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiTarget,
  FiActivity,
} from 'react-icons/fi';

// IOP measurement methods
const MEASUREMENT_METHODS = [
  { value: 'GAT', label: 'Goldmann (GAT)', description: 'Gold standard applanation' },
  { value: 'NCT', label: 'Air-Puff (NCT)', description: 'Non-contact tonometry' },
  { value: 'ICARE', label: 'iCare', description: 'Rebound tonometry' },
  { value: 'TONOPEN', label: 'Tonopen', description: 'Portable applanation' },
  { value: 'PERKINS', label: 'Perkins', description: 'Handheld applanation' },
  { value: 'SCHIOTZ', label: 'Schiøtz', description: 'Indentation tonometry' },
  { value: 'DCT', label: 'DCT Pascal', description: 'Dynamic contour' },
];

// Time of day categories
const TIME_OF_DAY = [
  { value: 'morning', label: 'Matin', icon: '🌅', hours: '6h-12h' },
  { value: 'afternoon', label: 'Après-midi', icon: '☀️', hours: '12h-18h' },
  { value: 'evening', label: 'Soir', icon: '🌆', hours: '18h-22h' },
  { value: 'night', label: 'Nuit', icon: '🌙', hours: '22h-6h' },
];

// IOP status based on value
const getIOPStatus = (value, target = null) => {
  if (value === null || value === undefined) return { status: 'unknown', color: 'gray' };

  // If target is set, compare against target
  if (target) {
    if (value <= target) return { status: 'on_target', color: 'green', label: 'À la cible' };
    if (value <= target + 3) return { status: 'near_target', color: 'yellow', label: 'Proche cible' };
    return { status: 'above_target', color: 'red', label: 'Au-dessus cible' };
  }

  // Otherwise use standard ranges
  if (value < 10) return { status: 'low', color: 'blue', label: 'Basse' };
  if (value <= 21) return { status: 'normal', color: 'green', label: 'Normale' };
  if (value <= 24) return { status: 'borderline', color: 'yellow', label: 'Limite' };
  if (value <= 30) return { status: 'elevated', color: 'orange', label: 'Élevée' };
  return { status: 'high', color: 'red', label: 'Haute' };
};

// CCT correction (simplified Ehlers formula)
const calculateCorrectedIOP = (iop, cct) => {
  if (!iop || !cct) return null;
  // Approximate correction: ~0.5 mmHg per 10µm deviation from 545µm
  const correction = (545 - cct) / 20;
  return Math.round((iop + correction) * 10) / 10;
};

/**
 * Single Eye IOP Input
 */
const SingleIOPInput = ({
  value,
  onChange,
  eye = 'OD',
  target = null,
  cct = null,
  onCctChange,
  method = 'GAT',
  onMethodChange,
  timeOfDay = 'morning',
  onTimeOfDayChange,
  previousValue = null,
  disabled = false,
  compact = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');

  const iopStatus = getIOPStatus(value, target);
  const correctedIOP = calculateCorrectedIOP(value, cct);
  const trend = previousValue ? value - previousValue : null;

  // Color based on status
  const getSliderColorScheme = () => {
    if (!value) return 'gray';
    if (value <= 10) return 'blue';
    if (value <= 21) return 'green';
    if (value <= 24) return 'yellow';
    if (value <= 30) return 'orange';
    return 'red';
  };

  if (compact) {
    return (
      <HStack
        spacing={2}
        p={2}
        bg={bgColor}
        borderRadius="md"
        border="1px solid"
        borderColor={borderColor}
      >
        <Badge colorScheme={eye === 'OD' ? 'blue' : 'green'}>
          {eye}
        </Badge>
        <NumberInput
          value={value || ''}
          onChange={(_, val) => onChange?.(val)}
          min={0}
          max={80}
          size="sm"
          width="70px"
          isDisabled={disabled}
        >
          <NumberInputField textAlign="center" />
        </NumberInput>
        <Text fontSize="sm" color="gray.500">mmHg</Text>
        {value && (
          <Badge colorScheme={iopStatus.color} size="sm">
            {iopStatus.label}
          </Badge>
        )}
      </HStack>
    );
  }

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="2px solid"
      borderColor={iopStatus.color ? `${iopStatus.color}.200` : borderColor}
    >
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <HStack spacing={2}>
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
          </HStack>

          {/* Status indicator */}
          <HStack spacing={2}>
            {trend !== null && (
              <Stat size="sm">
                <StatHelpText mb={0}>
                  <StatArrow type={trend > 0 ? 'increase' : 'decrease'} />
                  {Math.abs(trend)} mmHg
                </StatHelpText>
              </Stat>
            )}
            <Badge
              colorScheme={iopStatus.color}
              fontSize="md"
              px={3}
              py={1}
            >
              {value ? `${value} mmHg` : '—'}
            </Badge>
          </HStack>
        </HStack>

        {/* Main IOP slider */}
        <Box px={4} pt={8} pb={4}>
          <Slider
            value={value || 15}
            onChange={onChange}
            min={0}
            max={60}
            step={1}
            isDisabled={disabled}
            colorScheme={getSliderColorScheme()}
          >
            {/* Range markers */}
            <SliderMark value={10} mt={2} ml={-2} fontSize="xs" color="gray.500">
              10
            </SliderMark>
            <SliderMark value={21} mt={2} ml={-2} fontSize="xs" color="gray.500">
              21
            </SliderMark>
            {target && (
              <SliderMark
                value={target}
                mt={-8}
                ml={-2}
                fontSize="xs"
                color="green.500"
              >
                <FiTarget /> {target}
              </SliderMark>
            )}

            {/* Current value marker */}
            <SliderMark
              value={value || 15}
              textAlign="center"
              bg={`${iopStatus.color}.500`}
              color="white"
              mt={-10}
              ml={-5}
              w={10}
              borderRadius="md"
              fontSize="sm"
              fontWeight="bold"
            >
              {value || '—'}
            </SliderMark>

            <SliderTrack h={3} borderRadius="full">
              {/* Normal range indicator */}
              <Box
                position="absolute"
                left="16.7%"
                right="65%"
                h="100%"
                bg="green.100"
                borderRadius="full"
              />
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb boxSize={6}>
              <Box color={`${iopStatus.color}.500`} as={FiActivity} />
            </SliderThumb>
          </Slider>
        </Box>

        {/* Numeric input */}
        <HStack justify="center" spacing={4}>
          <NumberInput
            value={value || ''}
            onChange={(_, val) => onChange?.(val)}
            min={0}
            max={80}
            step={1}
            size="lg"
            width="120px"
            isDisabled={disabled}
          >
            <NumberInputField textAlign="center" fontWeight="bold" fontSize="xl" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
          <Text fontWeight="medium" color={textColor}>mmHg</Text>
        </HStack>

        {/* Target pressure */}
        {target && (
          <HStack justify="center" spacing={2}>
            <FiTarget color="green" />
            <Text fontSize="sm" color="gray.500">
              Cible: <strong>{target} mmHg</strong>
            </Text>
            {value && (
              <Badge
                colorScheme={value <= target ? 'green' : 'red'}
                variant="outline"
              >
                {value <= target ? 'Atteinte' : `+${value - target}`}
              </Badge>
            )}
          </HStack>
        )}

        <Divider />

        {/* Additional measurements */}
        <SimpleGrid columns={2} spacing={3}>
          {/* CCT / Pachymetry */}
          <FormControl size="sm">
            <FormLabel fontSize="xs" color="gray.500">
              Pachymétrie (µm)
            </FormLabel>
            <NumberInput
              value={cct || ''}
              onChange={(_, val) => onCctChange?.(val)}
              min={400}
              max={700}
              step={1}
              size="sm"
              isDisabled={disabled}
            >
              <NumberInputField />
            </NumberInput>
            {correctedIOP && (
              <Text fontSize="xs" color="gray.500" mt={1}>
                PIO corrigée: <strong>{correctedIOP}</strong> mmHg
              </Text>
            )}
          </FormControl>

          {/* Measurement method */}
          <FormControl size="sm">
            <FormLabel fontSize="xs" color="gray.500">
              Méthode
            </FormLabel>
            <Select
              value={method}
              onChange={(e) => onMethodChange?.(e.target.value)}
              size="sm"
              isDisabled={disabled}
            >
              {MEASUREMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>

        {/* Alerts */}
        {value && value > 30 && (
          <Alert status="error" size="sm" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              PIO très élevée - Vérifier et envisager traitement urgent
            </AlertDescription>
          </Alert>
        )}

        {value && value < 6 && (
          <Alert status="warning" size="sm" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              PIO basse - Exclure hypotonie
            </AlertDescription>
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

/**
 * Dual Eye IOP Input
 */
export const DualIOPInput = ({
  odValue,
  osValue,
  onOdChange,
  onOsChange,
  odTarget = null,
  osTarget = null,
  odCct = null,
  osCct = null,
  onOdCctChange,
  onOsCctChange,
  method = 'GAT',
  onMethodChange,
  timeOfDay = 'morning',
  onTimeOfDayChange,
  odPrevious = null,
  osPrevious = null,
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Calculate asymmetry
  const asymmetry = odValue && osValue ? Math.abs(odValue - osValue) : null;
  const significantAsymmetry = asymmetry && asymmetry >= 3;

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4}>
        {/* Header with time and method */}
        <HStack justify="space-between" width="100%">
          <Text fontWeight="bold" fontSize="lg">
            Pression Intraoculaire (PIO)
          </Text>

          <HStack spacing={2}>
            {/* Time of day */}
            <ButtonGroup size="sm" isAttached variant="outline">
              {TIME_OF_DAY.map((t) => (
                <Tooltip key={t.value} label={`${t.label} (${t.hours})`}>
                  <Button
                    isActive={timeOfDay === t.value}
                    colorScheme={timeOfDay === t.value ? 'blue' : 'gray'}
                    variant={timeOfDay === t.value ? 'solid' : 'outline'}
                    onClick={() => onTimeOfDayChange?.(t.value)}
                    isDisabled={disabled}
                  >
                    {t.icon}
                  </Button>
                </Tooltip>
              ))}
            </ButtonGroup>

            {/* Method selector */}
            <Select
              value={method}
              onChange={(e) => onMethodChange?.(e.target.value)}
              size="sm"
              width="150px"
              isDisabled={disabled}
            >
              {MEASUREMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </HStack>
        </HStack>

        {/* Asymmetry alert */}
        {significantAsymmetry && (
          <Alert status="warning" size="sm" borderRadius="md">
            <AlertIcon />
            <AlertDescription fontSize="sm">
              Asymétrie significative: {asymmetry} mmHg entre OD et OS
            </AlertDescription>
          </Alert>
        )}

        {/* Dual input */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} width="100%">
          <SingleIOPInput
            value={odValue}
            onChange={onOdChange}
            eye="OD"
            target={odTarget}
            cct={odCct}
            onCctChange={onOdCctChange}
            method={method}
            previousValue={odPrevious}
            disabled={disabled}
          />
          <SingleIOPInput
            value={osValue}
            onChange={onOsChange}
            eye="OS"
            target={osTarget}
            cct={osCct}
            onCctChange={onOsCctChange}
            method={method}
            previousValue={osPrevious}
            disabled={disabled}
          />
        </SimpleGrid>

        {/* Summary */}
        <HStack
          justify="center"
          spacing={4}
          p={3}
          bg={useColorModeValue('gray.50', 'gray.700')}
          borderRadius="md"
          width="100%"
        >
          <HStack>
            <Badge colorScheme="blue">OD</Badge>
            <Text fontWeight="bold">{odValue || '—'}</Text>
          </HStack>
          <Text color="gray.400">/</Text>
          <HStack>
            <Badge colorScheme="green">OS</Badge>
            <Text fontWeight="bold">{osValue || '—'}</Text>
          </HStack>
          <Text color="gray.500" fontSize="sm">mmHg</Text>
          {asymmetry !== null && (
            <Badge
              colorScheme={significantAsymmetry ? 'orange' : 'gray'}
              variant="outline"
            >
              Δ {asymmetry}
            </Badge>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

/**
 * IOP History Mini-Chart
 */
export const IOPHistoryMini = ({
  history = [], // [{ date, odValue, osValue }]
  targetOD,
  targetOS,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  if (!history.length) {
    return (
      <Box p={3} bg={bgColor} borderRadius="md" textAlign="center">
        <Text fontSize="sm" color="gray.500">Aucun historique PIO</Text>
      </Box>
    );
  }

  // Get last 6 measurements
  const recentHistory = history.slice(-6);
  const maxValue = Math.max(...recentHistory.flatMap(h => [h.odValue, h.osValue].filter(Boolean)), 30);

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <Text fontSize="sm" fontWeight="medium" mb={2}>Historique PIO</Text>

      <Flex height="80px" align="flex-end" justify="space-around">
        {recentHistory.map((record, idx) => (
          <VStack key={idx} spacing={0}>
            {/* OD bar */}
            <Tooltip label={`OD: ${record.odValue} mmHg`}>
              <Box
                width="12px"
                height={`${(record.odValue / maxValue) * 60}px`}
                bg={getIOPStatus(record.odValue, targetOD).color + '.400'}
                borderRadius="sm"
                mr="2px"
              />
            </Tooltip>
            {/* OS bar */}
            <Tooltip label={`OS: ${record.osValue} mmHg`}>
              <Box
                width="12px"
                height={`${(record.osValue / maxValue) * 60}px`}
                bg={getIOPStatus(record.osValue, targetOS).color + '.400'}
                borderRadius="sm"
                opacity={0.7}
              />
            </Tooltip>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {new Date(record.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}
            </Text>
          </VStack>
        ))}
      </Flex>

      {/* Legend */}
      <HStack justify="center" mt={2} spacing={4}>
        <HStack spacing={1}>
          <Box w={3} h={3} bg="blue.400" borderRadius="sm" />
          <Text fontSize="xs">OD</Text>
        </HStack>
        <HStack spacing={1}>
          <Box w={3} h={3} bg="green.400" borderRadius="sm" />
          <Text fontSize="xs">OS</Text>
        </HStack>
      </HStack>
    </Box>
  );
};

/**
 * Compact IOP Summary Display
 */
export const IOPSummary = ({
  odValue,
  osValue,
  odTarget,
  osTarget,
  method = 'GAT',
  timeOfDay,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const odStatus = getIOPStatus(odValue, odTarget);
  const osStatus = getIOPStatus(osValue, osTarget);

  const timeInfo = TIME_OF_DAY.find(t => t.value === timeOfDay);

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <HStack justify="space-between">
        <HStack spacing={3}>
          <Text fontWeight="medium" fontSize="sm">PIO</Text>
          <HStack spacing={2}>
            <HStack spacing={1}>
              <Badge colorScheme="blue" size="sm">OD</Badge>
              <Text fontWeight="bold" color={`${odStatus.color}.500`}>
                {odValue || '—'}
              </Text>
            </HStack>
            <Text color="gray.400">/</Text>
            <HStack spacing={1}>
              <Badge colorScheme="green" size="sm">OS</Badge>
              <Text fontWeight="bold" color={`${osStatus.color}.500`}>
                {osValue || '—'}
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.500">mmHg</Text>
          </HStack>
        </HStack>

        <HStack spacing={2}>
          {timeInfo && <Text fontSize="xs">{timeInfo.icon}</Text>}
          <Badge variant="outline" size="sm">{method}</Badge>
        </HStack>
      </HStack>
    </Box>
  );
};

// Export utilities
export {
  MEASUREMENT_METHODS,
  TIME_OF_DAY,
  getIOPStatus,
  calculateCorrectedIOP,
};

export default SingleIOPInput;
