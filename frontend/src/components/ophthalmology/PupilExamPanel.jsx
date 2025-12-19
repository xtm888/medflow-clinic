/**
 * PupilExamPanel Component
 *
 * StudioVision Parity: Pupil examination documentation
 *
 * Features:
 * - Pupil size in photopic/scotopic conditions
 * - Direct and consensual light reflex grading
 * - RAPD (Relative Afferent Pupillary Defect) detection
 * - Anisocoria measurement and significance
 * - Accommodation testing
 * - Pupil shape documentation
 * - Marcus Gunn notation
 * - OD/OS comparison with visual display
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
  Select,
  RadioGroup,
  Radio,
  Stack,
  Switch,
  Alert,
  AlertIcon,
  AlertDescription,
  Circle,
  Grid,
  GridItem,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from '@chakra-ui/react';
import {
  FiEye,
  FiSun,
  FiMoon,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiActivity,
} from 'react-icons/fi';

// Pupil reactivity grades
const REACTIVITY_GRADES = [
  { value: '4+', label: '4+ Vive', description: 'Réaction rapide et ample', color: 'green' },
  { value: '3+', label: '3+ Normale', description: 'Réaction normale', color: 'green' },
  { value: '2+', label: '2+ Lente', description: 'Réaction ralentie', color: 'yellow' },
  { value: '1+', label: '1+ Faible', description: 'Réaction faible', color: 'orange' },
  { value: '0', label: '0 Absente', description: 'Pas de réaction', color: 'red' },
  { value: 'NE', label: 'NE', description: 'Non évaluable', color: 'gray' },
];

// RAPD grades (Marcus Gunn)
const RAPD_GRADES = [
  { value: 'none', label: 'Absent', description: 'Pas de DPAR', color: 'green' },
  { value: 'trace', label: 'Trace', description: 'DPAR minime', color: 'yellow' },
  { value: '1+', label: '1+', description: 'DPAR léger', color: 'yellow' },
  { value: '2+', label: '2+', description: 'DPAR modéré', color: 'orange' },
  { value: '3+', label: '3+', description: 'DPAR sévère', color: 'red' },
  { value: '4+', label: '4+', description: 'DPAR très sévère', color: 'red' },
];

// Pupil shapes
const PUPIL_SHAPES = [
  { value: 'round', label: 'Ronde', description: 'Forme normale' },
  { value: 'oval', label: 'Ovale', description: 'Légèrement allongée' },
  { value: 'irregular', label: 'Irrégulière', description: 'Bords irréguliers' },
  { value: 'peaked', label: 'En pointe', description: 'Synéchie antérieure' },
  { value: 'festooned', label: 'Festonnée', description: 'Synéchies multiples' },
  { value: 'polycoria', label: 'Polycorie', description: 'Pupilles multiples' },
  { value: 'corectopia', label: 'Corectopie', description: 'Pupille décentrée' },
];

// Calculate anisocoria
const calculateAnisocoria = (odSize, osSize) => {
  if (odSize === null || osSize === null) return null;
  return Math.abs(odSize - osSize);
};

// Check if anisocoria is significant
const isSignificantAnisocoria = (anisocoria, lightCondition) => {
  if (anisocoria === null) return false;
  // Greater in dark suggests Horner's or pharmacological
  // Greater in light suggests 3rd nerve palsy or Adie's
  return anisocoria >= 1; // 1mm or more is generally significant
};

/**
 * Visual Pupil Display Component
 */
const PupilDisplay = ({
  size = 4,
  shape = 'round',
  eye = 'OD',
  isReactive = true,
  lightCondition = 'photopic',
  maxSize = 8,
}) => {
  const bgColor = useColorModeValue('gray.800', 'gray.200');
  const irisColor = useColorModeValue('blue.400', 'blue.300');
  const pupilColor = useColorModeValue('black', 'gray.900');

  // Calculate visual size (scaled)
  const visualSize = (size / maxSize) * 40;
  const irisSize = 50;

  return (
    <Tooltip label={`${eye}: ${size}mm ${lightCondition === 'scotopic' ? '(obscurité)' : '(lumière)'}`}>
      <Box position="relative" width={`${irisSize}px`} height={`${irisSize}px`}>
        {/* Iris */}
        <Circle
          size={`${irisSize}px`}
          bg={irisColor}
          position="absolute"
          top="0"
          left="0"
        />

        {/* Pupil */}
        <Circle
          size={`${visualSize}px`}
          bg={pupilColor}
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          transition="all 0.3s"
          border={isReactive ? 'none' : '2px dashed red'}
          borderRadius={shape === 'round' ? 'full' : shape === 'oval' ? '40%' : '30%'}
        />

        {/* Eye label */}
        <Text
          position="absolute"
          bottom="-20px"
          left="50%"
          transform="translateX(-50%)"
          fontSize="xs"
          fontWeight="bold"
          color={eye === 'OD' ? 'blue.500' : 'green.500'}
        >
          {eye}
        </Text>
      </Box>
    </Tooltip>
  );
};

/**
 * Single Eye Pupil Input
 */
const SingleEyePupil = ({
  eye = 'OD',
  sizePhotopic,
  sizeScotopic,
  directReactivity,
  consensualReactivity,
  shape,
  onSizePhotopicChange,
  onSizeScotopicChange,
  onDirectReactivityChange,
  onConsensualReactivityChange,
  onShapeChange,
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  const directGrade = REACTIVITY_GRADES.find(g => g.value === directReactivity);
  const consensualGrade = REACTIVITY_GRADES.find(g => g.value === consensualReactivity);

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4} align="stretch">
        {/* Header with visual */}
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

          <HStack spacing={4}>
            <PupilDisplay
              size={sizePhotopic || 3}
              shape={shape}
              eye={eye}
              isReactive={directReactivity !== '0'}
              lightCondition="photopic"
            />
            <PupilDisplay
              size={sizeScotopic || 6}
              shape={shape}
              eye={eye}
              isReactive={directReactivity !== '0'}
              lightCondition="scotopic"
            />
          </HStack>
        </HStack>

        {/* Size inputs */}
        <Grid templateColumns="1fr 1fr" gap={4}>
          {/* Photopic (light) */}
          <FormControl>
            <FormLabel fontSize="xs" color={labelColor}>
              <HStack spacing={1}>
                <FiSun />
                <Text>Lumière (mm)</Text>
              </HStack>
            </FormLabel>
            <NumberInput
              value={sizePhotopic ?? ''}
              onChange={(_, val) => onSizePhotopicChange?.(isNaN(val) ? null : val)}
              min={1}
              max={9}
              step={0.5}
              precision={1}
              size="sm"
              isDisabled={disabled}
            >
              <NumberInputField textAlign="center" fontWeight="bold" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>

          {/* Scotopic (dark) */}
          <FormControl>
            <FormLabel fontSize="xs" color={labelColor}>
              <HStack spacing={1}>
                <FiMoon />
                <Text>Obscurité (mm)</Text>
              </HStack>
            </FormLabel>
            <NumberInput
              value={sizeScotopic ?? ''}
              onChange={(_, val) => onSizeScotopicChange?.(isNaN(val) ? null : val)}
              min={2}
              max={10}
              step={0.5}
              precision={1}
              size="sm"
              isDisabled={disabled}
            >
              <NumberInputField textAlign="center" fontWeight="bold" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        </Grid>

        {/* Reactivity */}
        <Grid templateColumns="1fr 1fr" gap={4}>
          {/* Direct reflex */}
          <FormControl>
            <FormLabel fontSize="xs" color={labelColor}>
              Réflexe Direct
            </FormLabel>
            <Select
              value={directReactivity || ''}
              onChange={(e) => onDirectReactivityChange?.(e.target.value)}
              size="sm"
              isDisabled={disabled}
            >
              <option value="">Sélectionner</option>
              {REACTIVITY_GRADES.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </Select>
            {directGrade && (
              <Text fontSize="xs" color={`${directGrade.color}.500`} mt={1}>
                {directGrade.description}
              </Text>
            )}
          </FormControl>

          {/* Consensual reflex */}
          <FormControl>
            <FormLabel fontSize="xs" color={labelColor}>
              Réflexe Consensuel
            </FormLabel>
            <Select
              value={consensualReactivity || ''}
              onChange={(e) => onConsensualReactivityChange?.(e.target.value)}
              size="sm"
              isDisabled={disabled}
            >
              <option value="">Sélectionner</option>
              {REACTIVITY_GRADES.map((grade) => (
                <option key={grade.value} value={grade.value}>
                  {grade.label}
                </option>
              ))}
            </Select>
            {consensualGrade && (
              <Text fontSize="xs" color={`${consensualGrade.color}.500`} mt={1}>
                {consensualGrade.description}
              </Text>
            )}
          </FormControl>
        </Grid>

        {/* Shape */}
        <FormControl>
          <FormLabel fontSize="xs" color={labelColor}>Forme</FormLabel>
          <Select
            value={shape || 'round'}
            onChange={(e) => onShapeChange?.(e.target.value)}
            size="sm"
            isDisabled={disabled}
          >
            {PUPIL_SHAPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} - {s.description}
              </option>
            ))}
          </Select>
        </FormControl>
      </VStack>
    </Box>
  );
};

/**
 * Main Pupil Exam Panel
 */
const PupilExamPanel = ({
  data = {},
  onChange,
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

  // Calculate anisocoria
  const anisoPhotopic = calculateAnisocoria(data.odSizePhotopic, data.osSizePhotopic);
  const anisoScotopic = calculateAnisocoria(data.odSizeScotopic, data.osSizeScotopic);
  const hasSignificantAniso = isSignificantAnisocoria(anisoPhotopic) || isSignificantAnisocoria(anisoScotopic);

  // Find RAPD info
  const rapdInfo = RAPD_GRADES.find(g => g.value === data.rapd);

  if (compact) {
    return (
      <PupilSummary
        odSizePhotopic={data.odSizePhotopic}
        osSizePhotopic={data.osSizePhotopic}
        odReactivity={data.odDirectReactivity}
        osReactivity={data.osDirectReactivity}
        rapd={data.rapd}
        rapdEye={data.rapdEye}
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
          <Text fontWeight="bold" fontSize="lg">Examen Pupillaire</Text>

          {/* Quick status */}
          <HStack spacing={2}>
            {data.rapd && data.rapd !== 'none' && (
              <Badge colorScheme="red">
                DPAR {data.rapdEye}
              </Badge>
            )}
            {hasSignificantAniso && (
              <Badge colorScheme="orange">
                Anisocorie
              </Badge>
            )}
          </HStack>
        </HStack>

        {/* Visual comparison */}
        <HStack justify="center" spacing={8} py={4}>
          <VStack>
            <Text fontSize="xs" color="gray.500">Lumière</Text>
            <HStack spacing={4}>
              <PupilDisplay
                size={data.odSizePhotopic || 3}
                shape={data.odShape}
                eye="OD"
                isReactive={data.odDirectReactivity !== '0'}
                lightCondition="photopic"
              />
              <PupilDisplay
                size={data.osSizePhotopic || 3}
                shape={data.osShape}
                eye="OS"
                isReactive={data.osDirectReactivity !== '0'}
                lightCondition="photopic"
              />
            </HStack>
          </VStack>

          <Divider orientation="vertical" height="60px" />

          <VStack>
            <Text fontSize="xs" color="gray.500">Obscurité</Text>
            <HStack spacing={4}>
              <PupilDisplay
                size={data.odSizeScotopic || 6}
                shape={data.odShape}
                eye="OD"
                isReactive={data.odDirectReactivity !== '0'}
                lightCondition="scotopic"
              />
              <PupilDisplay
                size={data.osSizeScotopic || 6}
                shape={data.osShape}
                eye="OS"
                isReactive={data.osDirectReactivity !== '0'}
                lightCondition="scotopic"
              />
            </HStack>
          </VStack>
        </HStack>

        {/* Anisocoria alert */}
        {hasSignificantAniso && (
          <Alert status="warning" size="sm" borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" fontWeight="medium">Anisocorie détectée</Text>
              <Text fontSize="xs">
                Lumière: {anisoPhotopic?.toFixed(1)}mm |
                Obscurité: {anisoScotopic?.toFixed(1)}mm
                {anisoScotopic > anisoPhotopic
                  ? ' (Plus marquée en scotopique - évoquer Horner)'
                  : ' (Plus marquée en photopique - évoquer paralysie III ou Adie)'}
              </Text>
            </VStack>
          </Alert>
        )}

        {/* Dual eye inputs */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
          <SingleEyePupil
            eye="OD"
            sizePhotopic={data.odSizePhotopic}
            sizeScotopic={data.odSizeScotopic}
            directReactivity={data.odDirectReactivity}
            consensualReactivity={data.odConsensualReactivity}
            shape={data.odShape}
            onSizePhotopicChange={(v) => handleChange('odSizePhotopic', v)}
            onSizeScotopicChange={(v) => handleChange('odSizeScotopic', v)}
            onDirectReactivityChange={(v) => handleChange('odDirectReactivity', v)}
            onConsensualReactivityChange={(v) => handleChange('odConsensualReactivity', v)}
            onShapeChange={(v) => handleChange('odShape', v)}
            disabled={disabled}
          />

          <SingleEyePupil
            eye="OS"
            sizePhotopic={data.osSizePhotopic}
            sizeScotopic={data.osSizeScotopic}
            directReactivity={data.osDirectReactivity}
            consensualReactivity={data.osConsensualReactivity}
            shape={data.osShape}
            onSizePhotopicChange={(v) => handleChange('osSizePhotopic', v)}
            onSizeScotopicChange={(v) => handleChange('osSizeScotopic', v)}
            onDirectReactivityChange={(v) => handleChange('osDirectReactivity', v)}
            onConsensualReactivityChange={(v) => handleChange('osConsensualReactivity', v)}
            onShapeChange={(v) => handleChange('osShape', v)}
            disabled={disabled}
          />
        </SimpleGrid>

        <Divider />

        {/* RAPD / Marcus Gunn */}
        <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
          <Grid templateColumns="1fr 1fr 2fr" gap={4} alignItems="center">
            <FormControl>
              <FormLabel fontSize="sm">DPAR (Marcus Gunn)</FormLabel>
              <Select
                value={data.rapd || 'none'}
                onChange={(e) => handleChange('rapd', e.target.value)}
                size="sm"
                isDisabled={disabled}
              >
                {RAPD_GRADES.map((grade) => (
                  <option key={grade.value} value={grade.value}>
                    {grade.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            {data.rapd && data.rapd !== 'none' && (
              <FormControl>
                <FormLabel fontSize="sm">Œil atteint</FormLabel>
                <RadioGroup
                  value={data.rapdEye || ''}
                  onChange={(v) => handleChange('rapdEye', v)}
                  isDisabled={disabled}
                >
                  <Stack direction="row">
                    <Radio value="OD" colorScheme="blue">OD</Radio>
                    <Radio value="OS" colorScheme="green">OS</Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>
            )}

            {rapdInfo && data.rapd !== 'none' && (
              <Alert
                status={rapdInfo.color === 'green' ? 'success' : rapdInfo.color === 'yellow' ? 'warning' : 'error'}
                size="sm"
                borderRadius="md"
              >
                <AlertIcon />
                <AlertDescription fontSize="sm">
                  {rapdInfo.description} - {data.rapdEye}
                </AlertDescription>
              </Alert>
            )}
          </Grid>
        </Box>

        {/* Accommodation */}
        <FormControl>
          <FormLabel fontSize="sm">Accommodation</FormLabel>
          <RadioGroup
            value={data.accommodation || 'normal'}
            onChange={(v) => handleChange('accommodation', v)}
            isDisabled={disabled}
          >
            <Stack direction="row" spacing={4}>
              <Radio value="normal">Normale</Radio>
              <Radio value="reduced">Réduite</Radio>
              <Radio value="absent">Absente</Radio>
              <Radio value="spasm">Spasme</Radio>
            </Stack>
          </RadioGroup>
        </FormControl>
      </VStack>
    </Box>
  );
};

/**
 * Compact Pupil Summary
 */
export const PupilSummary = ({
  odSizePhotopic,
  osSizePhotopic,
  odReactivity,
  osReactivity,
  rapd,
  rapdEye,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const anisocoria = calculateAnisocoria(odSizePhotopic, osSizePhotopic);

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <VStack spacing={2} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium">Pupilles</Text>
          {rapd && rapd !== 'none' && (
            <Badge colorScheme="red" size="sm">DPAR {rapdEye}</Badge>
          )}
        </HStack>

        <SimpleGrid columns={2} spacing={2}>
          <HStack>
            <Badge colorScheme="blue" size="sm">OD</Badge>
            <Text fontSize="sm">
              {odSizePhotopic || '—'}mm / {odReactivity || '—'}
            </Text>
          </HStack>
          <HStack>
            <Badge colorScheme="green" size="sm">OS</Badge>
            <Text fontSize="sm">
              {osSizePhotopic || '—'}mm / {osReactivity || '—'}
            </Text>
          </HStack>
        </SimpleGrid>

        {anisocoria !== null && anisocoria >= 1 && (
          <Badge colorScheme="orange" size="sm" alignSelf="center">
            Anisocorie: {anisocoria}mm
          </Badge>
        )}
      </VStack>
    </Box>
  );
};

// Export constants and utilities
export {
  REACTIVITY_GRADES,
  RAPD_GRADES,
  PUPIL_SHAPES,
  calculateAnisocoria,
  isSignificantAnisocoria,
};

export default PupilExamPanel;
