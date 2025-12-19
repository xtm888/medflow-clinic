/**
 * @deprecated Use RefractionPanel from '@/pages/ophthalmology/components/panels/RefractionPanel' instead.
 *
 * This Chakra UI version is deprecated in favor of the Tailwind CSS version which:
 * - Is more consistent with the project's styling
 * - Has 3-column layout (VA | Objective | Subjective)
 * - Includes previous exam data loading
 * - Has keyboard shortcuts (Ctrl+D, Alt+P)
 *
 * Utility functions (transposeCylinder, calculateSphericalEquivalent, formatPrescription)
 * are still exported from this file for backwards compatibility.
 *
 * RefractionPanel Component (DEPRECATED)
 *
 * StudioVision Parity: Complete refraction/prescription entry panel
 *
 * Features:
 * - Sphere, Cylinder, Axis input for OD and OS
 * - Add (addition) for presbyopia
 * - PD (pupillary distance) - binocular and monocular
 * - Integrated AxisWheelSelector for visual axis input
 * - Auto-refractor data import capability
 * - Transpose function (plus/minus cylinder conversion)
 * - Visual prescription summary
 * - Spherical equivalent calculation
 * - French notation support
 */

import React, { useState, useCallback, useMemo } from 'react';
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
  Divider,
  FormControl,
  FormLabel,
  Switch,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Grid,
  GridItem,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Alert,
  AlertIcon,
  Collapse,
} from '@chakra-ui/react';
import {
  FiEye,
  FiRefreshCw,
  FiCopy,
  FiDownload,
  FiSettings,
  FiArrowRight,
  FiArrowDown,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

import AxisWheelSelector, { AxisWheelCompact, AxisDisplay } from './AxisWheelSelector';

// Standard step values for refraction
const SPHERE_STEPS = { standard: 0.25, fine: 0.12 };
const CYLINDER_STEPS = { standard: 0.25, fine: 0.12 };
const ADD_STEPS = { standard: 0.25, fine: 0.25 };
const AXIS_STEPS = { standard: 5, fine: 1 };

// Common sphere values for quick selection
const COMMON_SPHERES = [-6, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 6];

// Transpose cylinder notation (plus to minus or vice versa)
const transposeCylinder = (sphere, cylinder, axis) => {
  if (!cylinder || cylinder === 0) return { sphere, cylinder, axis };

  const newSphere = sphere + cylinder;
  const newCylinder = -cylinder;
  let newAxis = axis + 90;
  if (newAxis > 180) newAxis -= 180;

  return {
    sphere: Math.round(newSphere * 100) / 100,
    cylinder: Math.round(newCylinder * 100) / 100,
    axis: newAxis,
  };
};

// Calculate spherical equivalent
const calculateSphericalEquivalent = (sphere, cylinder) => {
  if (sphere === null || sphere === undefined) return null;
  const cyl = cylinder || 0;
  return Math.round((sphere + cyl / 2) * 100) / 100;
};

// Format prescription for display
const formatPrescription = (sphere, cylinder, axis, add) => {
  let parts = [];

  if (sphere !== null && sphere !== undefined) {
    parts.push(sphere >= 0 ? `+${sphere.toFixed(2)}` : sphere.toFixed(2));
  }

  if (cylinder && cylinder !== 0) {
    parts.push(cylinder >= 0 ? `+${cylinder.toFixed(2)}` : cylinder.toFixed(2));
    if (axis !== null && axis !== undefined) {
      parts.push(`x${axis}°`);
    }
  }

  if (add && add > 0) {
    parts.push(`Add +${add.toFixed(2)}`);
  }

  return parts.join(' ') || '—';
};

/**
 * Single Eye Refraction Input
 */
const SingleEyeRefraction = ({
  eye = 'OD',
  sphere,
  cylinder,
  axis,
  add,
  onSphereChange,
  onCylinderChange,
  onAxisChange,
  onAddChange,
  showAdd = true,
  showAxisWheel = false,
  fineSteps = false,
  disabled = false,
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  const sphereStep = fineSteps ? SPHERE_STEPS.fine : SPHERE_STEPS.standard;
  const cylinderStep = fineSteps ? CYLINDER_STEPS.fine : CYLINDER_STEPS.standard;

  const sphericalEquivalent = calculateSphericalEquivalent(sphere, cylinder);

  return (
    <Box
      p={4}
      bg={bgColor}
      borderRadius="lg"
      border="1px solid"
      borderColor={borderColor}
    >
      <VStack spacing={4} align="stretch">
        {/* Eye header */}
        <HStack justify="space-between">
          <Badge
            colorScheme={eye === 'OD' ? 'blue' : 'green'}
            fontSize="lg"
            px={3}
            py={1}
          >
            <HStack spacing={1}>
              <FiEye />
              <Text>{eye === 'OD' ? 'Œil Droit' : 'Œil Gauche'}</Text>
            </HStack>
          </Badge>

          {sphericalEquivalent !== null && (
            <Tooltip label="Équivalent sphérique">
              <Badge colorScheme="purple" variant="outline">
                ES: {sphericalEquivalent >= 0 ? '+' : ''}{sphericalEquivalent.toFixed(2)}
              </Badge>
            </Tooltip>
          )}
        </HStack>

        {/* Main inputs grid */}
        <Grid templateColumns="repeat(4, 1fr)" gap={3}>
          {/* Sphere */}
          <GridItem>
            <FormControl>
              <FormLabel fontSize="xs" color={labelColor}>
                Sphère (D)
              </FormLabel>
              <NumberInput
                value={sphere ?? ''}
                onChange={(_, val) => onSphereChange?.(isNaN(val) ? null : val)}
                min={-30}
                max={30}
                step={sphereStep}
                precision={2}
                size="sm"
                isDisabled={disabled}
              >
                <NumberInputField
                  textAlign="center"
                  fontWeight="bold"
                  color={sphere > 0 ? 'green.500' : sphere < 0 ? 'red.500' : undefined}
                />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </GridItem>

          {/* Cylinder */}
          <GridItem>
            <FormControl>
              <FormLabel fontSize="xs" color={labelColor}>
                Cylindre (D)
              </FormLabel>
              <NumberInput
                value={cylinder ?? ''}
                onChange={(_, val) => onCylinderChange?.(isNaN(val) ? null : val)}
                min={-10}
                max={10}
                step={cylinderStep}
                precision={2}
                size="sm"
                isDisabled={disabled}
              >
                <NumberInputField
                  textAlign="center"
                  fontWeight="bold"
                  color={cylinder !== 0 && cylinder !== null ? 'orange.500' : undefined}
                />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </GridItem>

          {/* Axis */}
          <GridItem>
            <FormControl>
              <FormLabel fontSize="xs" color={labelColor}>
                Axe (°)
              </FormLabel>
              {showAxisWheel ? (
                <Popover placement="bottom">
                  <PopoverTrigger>
                    <Button
                      size="sm"
                      variant="outline"
                      width="100%"
                      isDisabled={disabled || !cylinder}
                      rightIcon={<FiChevronDown />}
                    >
                      {axis ?? '—'}°
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent width="auto">
                    <PopoverArrow />
                    <PopoverBody>
                      <AxisWheelSelector
                        value={axis || 90}
                        onChange={onAxisChange}
                        eye={eye}
                        size={160}
                        showPresets
                        showNumericInput
                        showAstigmatismType={false}
                      />
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              ) : (
                <NumberInput
                  value={axis ?? ''}
                  onChange={(_, val) => onAxisChange?.(isNaN(val) ? null : val)}
                  min={0}
                  max={180}
                  step={fineSteps ? 1 : 5}
                  size="sm"
                  isDisabled={disabled || !cylinder}
                >
                  <NumberInputField textAlign="center" fontWeight="bold" />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              )}
            </FormControl>
          </GridItem>

          {/* Addition */}
          {showAdd && (
            <GridItem>
              <FormControl>
                <FormLabel fontSize="xs" color={labelColor}>
                  Addition (D)
                </FormLabel>
                <NumberInput
                  value={add ?? ''}
                  onChange={(_, val) => onAddChange?.(isNaN(val) ? null : val)}
                  min={0}
                  max={4}
                  step={ADD_STEPS.standard}
                  precision={2}
                  size="sm"
                  isDisabled={disabled}
                >
                  <NumberInputField
                    textAlign="center"
                    fontWeight="bold"
                    color={add > 0 ? 'blue.500' : undefined}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>
            </GridItem>
          )}
        </Grid>

        {/* Prescription summary */}
        <Box
          p={2}
          bg={useColorModeValue('gray.50', 'gray.700')}
          borderRadius="md"
          textAlign="center"
        >
          <Text fontSize="lg" fontFamily="mono" fontWeight="bold">
            {formatPrescription(sphere, cylinder, axis, add)}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
};

/**
 * Main RefractionPanel Component
 */
const RefractionPanel = ({
  data = {},
  onChange,
  showAdd = true,
  showPD = true,
  showAxisWheel = true,
  showTranspose = true,
  showAutoRefractor = true,
  autoRefractorData = null,
  disabled = false,
  compact = false,
}) => {
  const [fineSteps, setFineSteps] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Handle individual field changes
  const handleChange = useCallback((field, value) => {
    onChange?.({
      ...data,
      [field]: value,
    });
  }, [data, onChange]);

  // Transpose OD
  const handleTransposeOD = useCallback(() => {
    const transposed = transposeCylinder(data.odSphere, data.odCylinder, data.odAxis);
    onChange?.({
      ...data,
      odSphere: transposed.sphere,
      odCylinder: transposed.cylinder,
      odAxis: transposed.axis,
    });
  }, [data, onChange]);

  // Transpose OS
  const handleTransposeOS = useCallback(() => {
    const transposed = transposeCylinder(data.osSphere, data.osCylinder, data.osAxis);
    onChange?.({
      ...data,
      osSphere: transposed.sphere,
      osCylinder: transposed.cylinder,
      osAxis: transposed.axis,
    });
  }, [data, onChange]);

  // Copy OD to OS
  const handleCopyODtoOS = useCallback(() => {
    onChange?.({
      ...data,
      osSphere: data.odSphere,
      osCylinder: data.odCylinder,
      osAxis: data.odAxis ? (180 - data.odAxis) : data.odAxis, // Mirror axis for OS
      osAdd: data.odAdd,
    });
  }, [data, onChange]);

  // Import auto-refractor data
  const handleImportAutoRefractor = useCallback(() => {
    if (!autoRefractorData) return;
    onChange?.({
      ...data,
      odSphere: autoRefractorData.odSphere,
      odCylinder: autoRefractorData.odCylinder,
      odAxis: autoRefractorData.odAxis,
      osSphere: autoRefractorData.osSphere,
      osCylinder: autoRefractorData.osCylinder,
      osAxis: autoRefractorData.osAxis,
    });
  }, [autoRefractorData, data, onChange]);

  if (compact) {
    return (
      <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
        <VStack spacing={2} align="stretch">
          <Text fontWeight="medium" fontSize="sm">Réfraction</Text>
          <SimpleGrid columns={2} spacing={2}>
            <HStack>
              <Badge colorScheme="blue" size="sm">OD</Badge>
              <Text fontSize="sm" fontFamily="mono">
                {formatPrescription(data.odSphere, data.odCylinder, data.odAxis, data.odAdd)}
              </Text>
            </HStack>
            <HStack>
              <Badge colorScheme="green" size="sm">OS</Badge>
              <Text fontSize="sm" fontFamily="mono">
                {formatPrescription(data.osSphere, data.osCylinder, data.osAxis, data.osAdd)}
              </Text>
            </HStack>
          </SimpleGrid>
        </VStack>
      </Box>
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
          <Text fontWeight="bold" fontSize="lg">Réfraction</Text>

          <HStack spacing={2}>
            {/* Fine steps toggle */}
            <Tooltip label="Pas fins (0.12 D)">
              <FormControl display="flex" alignItems="center" width="auto">
                <FormLabel fontSize="xs" mb={0} mr={1}>Précis</FormLabel>
                <Switch
                  size="sm"
                  isChecked={fineSteps}
                  onChange={(e) => setFineSteps(e.target.checked)}
                  isDisabled={disabled}
                />
              </FormControl>
            </Tooltip>

            {/* Actions */}
            {showTranspose && (
              <ButtonGroup size="sm" variant="ghost">
                <Tooltip label="Transposer OD (±)">
                  <IconButton
                    icon={<FiRefreshCw />}
                    onClick={handleTransposeOD}
                    isDisabled={disabled || !data.odCylinder}
                    aria-label="Transposer OD"
                  />
                </Tooltip>
                <Tooltip label="Copier OD → OS">
                  <IconButton
                    icon={<FiCopy />}
                    onClick={handleCopyODtoOS}
                    isDisabled={disabled}
                    aria-label="Copier vers OS"
                  />
                </Tooltip>
              </ButtonGroup>
            )}

            {showAutoRefractor && autoRefractorData && (
              <Tooltip label="Importer auto-réfractomètre">
                <IconButton
                  icon={<FiDownload />}
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleImportAutoRefractor}
                  isDisabled={disabled}
                  aria-label="Importer AR"
                />
              </Tooltip>
            )}

            {/* Advanced toggle */}
            <IconButton
              icon={showAdvanced ? <FiChevronUp /> : <FiSettings />}
              size="sm"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-label="Options avancées"
            />
          </HStack>
        </HStack>

        {/* Auto-refractor data display */}
        {showAutoRefractor && autoRefractorData && (
          <Alert status="info" size="sm" borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={0} flex={1}>
              <Text fontSize="sm" fontWeight="medium">Données Auto-réfractomètre disponibles</Text>
              <HStack spacing={4}>
                <Text fontSize="xs">
                  OD: {formatPrescription(autoRefractorData.odSphere, autoRefractorData.odCylinder, autoRefractorData.odAxis)}
                </Text>
                <Text fontSize="xs">
                  OS: {formatPrescription(autoRefractorData.osSphere, autoRefractorData.osCylinder, autoRefractorData.osAxis)}
                </Text>
              </HStack>
            </VStack>
          </Alert>
        )}

        {/* Main refraction inputs */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
          <SingleEyeRefraction
            eye="OD"
            sphere={data.odSphere}
            cylinder={data.odCylinder}
            axis={data.odAxis}
            add={data.odAdd}
            onSphereChange={(v) => handleChange('odSphere', v)}
            onCylinderChange={(v) => handleChange('odCylinder', v)}
            onAxisChange={(v) => handleChange('odAxis', v)}
            onAddChange={(v) => handleChange('odAdd', v)}
            showAdd={showAdd}
            showAxisWheel={showAxisWheel}
            fineSteps={fineSteps}
            disabled={disabled}
          />

          <SingleEyeRefraction
            eye="OS"
            sphere={data.osSphere}
            cylinder={data.osCylinder}
            axis={data.osAxis}
            add={data.osAdd}
            onSphereChange={(v) => handleChange('osSphere', v)}
            onCylinderChange={(v) => handleChange('osCylinder', v)}
            onAxisChange={(v) => handleChange('osAxis', v)}
            onAddChange={(v) => handleChange('osAdd', v)}
            showAdd={showAdd}
            showAxisWheel={showAxisWheel}
            fineSteps={fineSteps}
            disabled={disabled}
          />
        </SimpleGrid>

        {/* Advanced options */}
        <Collapse in={showAdvanced}>
          <Box p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
              {/* Pupillary distance */}
              {showPD && (
                <>
                  <FormControl>
                    <FormLabel fontSize="sm">Écart Pupillaire (EP)</FormLabel>
                    <HStack>
                      <NumberInput
                        value={data.pdBinocular ?? ''}
                        onChange={(_, val) => handleChange('pdBinocular', val)}
                        min={50}
                        max={80}
                        step={0.5}
                        precision={1}
                        size="sm"
                        isDisabled={disabled}
                      >
                        <NumberInputField placeholder="Binoculaire" />
                      </NumberInput>
                      <Text fontSize="sm" color="gray.500">mm</Text>
                    </HStack>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">EP Monoculaire</FormLabel>
                    <HStack spacing={2}>
                      <NumberInput
                        value={data.pdOD ?? ''}
                        onChange={(_, val) => handleChange('pdOD', val)}
                        min={25}
                        max={40}
                        step={0.5}
                        precision={1}
                        size="sm"
                        width="70px"
                        isDisabled={disabled}
                      >
                        <NumberInputField placeholder="OD" textAlign="center" />
                      </NumberInput>
                      <Text>/</Text>
                      <NumberInput
                        value={data.pdOS ?? ''}
                        onChange={(_, val) => handleChange('pdOS', val)}
                        min={25}
                        max={40}
                        step={0.5}
                        precision={1}
                        size="sm"
                        width="70px"
                        isDisabled={disabled}
                      >
                        <NumberInputField placeholder="OS" textAlign="center" />
                      </NumberInput>
                    </HStack>
                  </FormControl>
                </>
              )}

              {/* Vertex distance */}
              <FormControl>
                <FormLabel fontSize="sm">Distance Verre-Œil</FormLabel>
                <HStack>
                  <NumberInput
                    value={data.vertexDistance ?? 12}
                    onChange={(_, val) => handleChange('vertexDistance', val)}
                    min={8}
                    max={20}
                    step={1}
                    size="sm"
                    isDisabled={disabled}
                  >
                    <NumberInputField />
                  </NumberInput>
                  <Text fontSize="sm" color="gray.500">mm</Text>
                </HStack>
              </FormControl>
            </Grid>
          </Box>
        </Collapse>

        {/* Summary */}
        <Divider />
        <Box>
          <Grid templateColumns="1fr auto 1fr" gap={4} alignItems="center">
            <Box textAlign="center">
              <Badge colorScheme="blue" mb={1}>OD</Badge>
              <Text fontFamily="mono" fontWeight="bold">
                {formatPrescription(data.odSphere, data.odCylinder, data.odAxis, data.odAdd)}
              </Text>
              {data.odCylinder && (
                <HStack justify="center" mt={1}>
                  <AxisDisplay value={data.odAxis || 90} eye="OD" size={30} />
                </HStack>
              )}
            </Box>

            <Box textAlign="center">
              <FiArrowRight color="gray" />
            </Box>

            <Box textAlign="center">
              <Badge colorScheme="green" mb={1}>OS</Badge>
              <Text fontFamily="mono" fontWeight="bold">
                {formatPrescription(data.osSphere, data.osCylinder, data.osAxis, data.osAdd)}
              </Text>
              {data.osCylinder && (
                <HStack justify="center" mt={1}>
                  <AxisDisplay value={data.osAxis || 90} eye="OS" size={30} />
                </HStack>
              )}
            </Box>
          </Grid>
        </Box>
      </VStack>
    </Box>
  );
};

/**
 * Compact Refraction Display
 */
export const RefractionSummary = ({
  odSphere,
  odCylinder,
  odAxis,
  odAdd,
  osSphere,
  osCylinder,
  osAxis,
  osAdd,
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box p={3} bg={bgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <SimpleGrid columns={2} spacing={3}>
        <HStack>
          <Badge colorScheme="blue" size="sm">OD</Badge>
          <Text fontSize="sm" fontFamily="mono" fontWeight="medium">
            {formatPrescription(odSphere, odCylinder, odAxis, odAdd)}
          </Text>
        </HStack>
        <HStack>
          <Badge colorScheme="green" size="sm">OS</Badge>
          <Text fontSize="sm" fontFamily="mono" fontWeight="medium">
            {formatPrescription(osSphere, osCylinder, osAxis, osAdd)}
          </Text>
        </HStack>
      </SimpleGrid>
    </Box>
  );
};

// Export utilities
export {
  transposeCylinder,
  calculateSphericalEquivalent,
  formatPrescription,
  SPHERE_STEPS,
  CYLINDER_STEPS,
  ADD_STEPS,
  COMMON_SPHERES,
};

export default RefractionPanel;
