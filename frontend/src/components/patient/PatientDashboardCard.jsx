/**
 * PatientDashboardCard Component
 *
 * StudioVision Parity: Dark-themed patient information card
 *
 * Layout:
 * - Black header with last name (yellow) + first name (white)
 * - Dark gray body with large age display
 * - Demographics section
 * - Medical history (Antecedents, Diagnosis, Treatment, Allergies)
 * - Correspondent/referring doctor
 * - Remarks section (light purple)
 * - Transport/alert notices
 */

import React, { useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
  Divider,
  Icon,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiPhone,
  FiMail,
  FiMapPin,
  FiUser,
  FiCalendar,
  FiAlertTriangle,
  FiHeart,
  FiActivity,
  FiShield,
  FiFileText,
} from 'react-icons/fi';

// Calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// Format date in French format
const formatDateFr = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Format phone number
const formatPhone = (phone) => {
  if (!phone) return '';
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Format as XX XX XX XX XX for French numbers
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  return phone;
};

/**
 * Main PatientDashboardCard Component
 */
const PatientDashboardCard = ({
  patient,
  showRemarks = true,
  showAlerts = true,
  compact = false,
}) => {
  // Colors matching StudioVision dark theme
  const headerBg = 'black';
  const bodyBg = useColorModeValue('#4A4A4A', 'gray.800');
  const remarksBg = useColorModeValue('#C8C8E8', 'purple.800');
  const alertBg = useColorModeValue('#FFE0E0', 'red.900');
  const textColor = 'white';
  const mutedColor = 'gray.300';
  const accentColor = 'yellow.400';

  // Calculate age
  const age = useMemo(() => calculateAge(patient?.dateOfBirth), [patient?.dateOfBirth]);

  // Get title (Mr/Mme/Mlle)
  const title = useMemo(() => {
    if (!patient?.gender) return '';
    return patient.gender === 'male' ? 'Monsieur' :
           patient.gender === 'female' ? 'Madame' : '';
  }, [patient?.gender]);

  if (!patient) {
    return (
      <Box bg={bodyBg} p={4} borderRadius="md" color={textColor}>
        <Text textAlign="center" color={mutedColor}>Aucun patient sélectionné</Text>
      </Box>
    );
  }

  if (compact) {
    return (
      <PatientDashboardCardCompact patient={patient} age={age} title={title} />
    );
  }

  return (
    <Box
      bg={bodyBg}
      borderRadius="md"
      overflow="hidden"
      boxShadow="lg"
      minW="250px"
    >
      {/* Header - Black with name */}
      <Box bg={headerBg} px={3} py={2}>
        <Text
          fontSize="xl"
          fontWeight="bold"
          color={accentColor}
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {patient.lastName || 'NOM'}
        </Text>
        <Text fontSize="lg" color={textColor}>
          {patient.firstName || 'Prénom'}
        </Text>
      </Box>

      {/* Age display - right side */}
      <Flex justify="flex-end" px={3} mt={-6}>
        <Box
          bg="blackAlpha.600"
          px={3}
          py={1}
          borderRadius="md"
        >
          <Text fontSize="2xl" fontWeight="bold" color={textColor}>
            {age !== null ? `${age} Ans` : '— Ans'}
          </Text>
        </Box>
      </Flex>

      {/* Patient Details */}
      <VStack align="stretch" spacing={0} px={3} py={2} color={textColor} fontSize="sm">
        {/* Full name with title */}
        <Text fontWeight="medium">
          {title} {patient.lastName?.toUpperCase()} {patient.firstName}
        </Text>

        {/* Date of birth */}
        <HStack spacing={1} color={mutedColor}>
          <Icon as={FiCalendar} boxSize={3} />
          <Text>Né(e) le {formatDateFr(patient.dateOfBirth)}</Text>
        </HStack>

        {/* Address */}
        {(patient.address || patient.city) && (
          <HStack spacing={1} color={mutedColor} align="flex-start">
            <Icon as={FiMapPin} boxSize={3} mt={0.5} />
            <VStack align="start" spacing={0}>
              {patient.address && <Text>{patient.address}</Text>}
              {(patient.postalCode || patient.city) && (
                <Text>{[patient.postalCode, patient.city].filter(Boolean).join(' ')}</Text>
              )}
            </VStack>
          </HStack>
        )}

        {/* Phone numbers */}
        {patient.phoneNumber && (
          <HStack spacing={1} color={mutedColor}>
            <Icon as={FiPhone} boxSize={3} />
            <Text>Tél 1: {formatPhone(patient.phoneNumber)}</Text>
          </HStack>
        )}
        {patient.mobileNumber && (
          <HStack spacing={1} color={mutedColor}>
            <Icon as={FiPhone} boxSize={3} />
            <Text>Tél 2: {formatPhone(patient.mobileNumber)}</Text>
          </HStack>
        )}

        {/* Email */}
        {patient.email && (
          <HStack spacing={1} color={mutedColor}>
            <Icon as={FiMail} boxSize={3} />
            <Text>{patient.email}</Text>
          </HStack>
        )}

        {/* Social Security / National ID */}
        {patient.nationalId && (
          <HStack spacing={1} color={mutedColor}>
            <Icon as={FiShield} boxSize={3} />
            <Text>N° SS: {patient.nationalId}</Text>
          </HStack>
        )}

        {/* Profession */}
        {patient.profession && (
          <HStack spacing={1} color={mutedColor}>
            <Icon as={FiUser} boxSize={3} />
            <Text>Profess: {patient.profession}</Text>
          </HStack>
        )}

        {/* Separator stars (StudioVision style) */}
        <Text textAlign="center" color={mutedColor} py={1}>* * * *</Text>

        {/* Medical History Section */}
        <VStack align="stretch" spacing={1}>
          {/* Antecedents */}
          {patient.medicalHistory?.pastMedicalHistory && (
            <Text>
              <Text as="span" color={accentColor}>- Antcd:</Text>{' '}
              {patient.medicalHistory.pastMedicalHistory}
            </Text>
          )}

          {/* Main diagnosis */}
          {patient.medicalHistory?.currentConditions && (
            <Text>
              <Text as="span" color={accentColor}>- Diag:</Text>{' '}
              {Array.isArray(patient.medicalHistory.currentConditions)
                ? patient.medicalHistory.currentConditions.join(', ')
                : patient.medicalHistory.currentConditions}
            </Text>
          )}

          {/* Current treatment */}
          {patient.medicalHistory?.currentMedications && (
            <Text>
              <Text as="span" color={accentColor}>- TT:</Text>{' '}
              {Array.isArray(patient.medicalHistory.currentMedications)
                ? patient.medicalHistory.currentMedications.map(m => m.name || m).join(', ')
                : patient.medicalHistory.currentMedications}
            </Text>
          )}

          {/* Allergies */}
          <HStack align="flex-start">
            <Text color={accentColor}>- Allergies:</Text>
            {patient.allergies?.length > 0 ? (
              <VStack align="start" spacing={0}>
                {patient.allergies.map((allergy, i) => (
                  <Badge
                    key={i}
                    colorScheme="red"
                    variant="solid"
                    fontSize="xs"
                  >
                    {allergy.allergen || allergy.name || allergy}
                  </Badge>
                ))}
              </VStack>
            ) : (
              <Text color={mutedColor}>ras</Text>
            )}
          </HStack>

          {/* Correspondent / Referring doctor */}
          {patient.referringDoctor && (
            <Text>
              <Text as="span" color={accentColor}>- Corresp 1:</Text>{' '}
              Dr {patient.referringDoctor.lastName} {patient.referringDoctor.firstName}
            </Text>
          )}
        </VStack>
      </VStack>

      {/* Remarks Section (Light Purple) */}
      {showRemarks && patient.notes && (
        <Box bg={remarksBg} px={3} py={2} mt={2}>
          <Text fontSize="xs" fontWeight="bold" color="gray.700">
            Remarques:
          </Text>
          <Text fontSize="xs" color="gray.700">
            {patient.notes}
          </Text>
        </Box>
      )}

      {/* Alerts Section */}
      {showAlerts && patient.alerts?.length > 0 && (
        <Box bg={alertBg} px={3} py={2}>
          {patient.alerts.map((alert, i) => (
            <HStack key={i} spacing={1}>
              <Icon as={FiAlertTriangle} color="red.500" boxSize={3} />
              <Text fontSize="xs" color="red.700" fontWeight="medium">
                {alert.message || alert}
              </Text>
            </HStack>
          ))}
        </Box>
      )}

      {/* Convention/Insurance Badge */}
      {patient.insurance?.provider && (
        <Box px={3} py={2} borderTop="1px solid" borderColor="gray.600">
          <Badge colorScheme="green" fontSize="xs">
            {patient.insurance.provider}
          </Badge>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact version of PatientDashboardCard
 */
const PatientDashboardCardCompact = ({ patient, age, title }) => {
  return (
    <Box
      bg="gray.800"
      borderRadius="md"
      overflow="hidden"
      p={2}
    >
      <HStack justify="space-between" align="flex-start">
        <VStack align="start" spacing={0}>
          <Text fontSize="sm" fontWeight="bold" color="yellow.400">
            {patient.lastName?.toUpperCase()}
          </Text>
          <Text fontSize="sm" color="white">
            {patient.firstName}
          </Text>
        </VStack>
        <Badge colorScheme="blue" fontSize="sm">
          {age !== null ? `${age} Ans` : '—'}
        </Badge>
      </HStack>

      <Divider my={1} borderColor="gray.600" />

      <HStack spacing={2} fontSize="xs" color="gray.300">
        {patient.phoneNumber && (
          <HStack spacing={1}>
            <Icon as={FiPhone} boxSize={3} />
            <Text>{formatPhone(patient.phoneNumber)}</Text>
          </HStack>
        )}
        {patient.allergies?.length > 0 && (
          <Badge colorScheme="red" fontSize="2xs">
            Allergies: {patient.allergies.length}
          </Badge>
        )}
      </HStack>
    </Box>
  );
};

/**
 * Patient Info Header Bar (for page headers)
 */
export const PatientInfoHeader = ({ patient }) => {
  const age = useMemo(() => calculateAge(patient?.dateOfBirth), [patient?.dateOfBirth]);
  const bgColor = useColorModeValue('gray.100', 'gray.700');

  if (!patient) return null;

  return (
    <Flex
      bg={bgColor}
      px={4}
      py={2}
      borderRadius="md"
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={2}
    >
      <HStack spacing={3}>
        <Box>
          <Text fontWeight="bold">
            {patient.lastName?.toUpperCase()} {patient.firstName}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {age !== null ? `${age} ans` : ''} • {formatDateFr(patient.dateOfBirth)}
          </Text>
        </Box>
      </HStack>

      <HStack spacing={2}>
        {patient.allergies?.length > 0 && (
          <Tooltip label={patient.allergies.map(a => a.allergen || a.name || a).join(', ')}>
            <Badge colorScheme="red" variant="solid">
              <HStack spacing={1}>
                <Icon as={FiAlertTriangle} />
                <Text>Allergies ({patient.allergies.length})</Text>
              </HStack>
            </Badge>
          </Tooltip>
        )}
        {patient.insurance?.provider && (
          <Badge colorScheme="green">{patient.insurance.provider}</Badge>
        )}
        {patient.patientId && (
          <Badge variant="outline">{patient.patientId}</Badge>
        )}
      </HStack>
    </Flex>
  );
};

/**
 * Mini Patient Badge (for inline use)
 */
export const PatientBadge = ({ patient }) => {
  const age = useMemo(() => calculateAge(patient?.dateOfBirth), [patient?.dateOfBirth]);

  if (!patient) return null;

  return (
    <Badge colorScheme="blue" px={2} py={1}>
      <HStack spacing={1}>
        <Icon as={FiUser} />
        <Text>
          {patient.lastName?.toUpperCase()} {patient.firstName}
          {age !== null && ` (${age})`}
        </Text>
      </HStack>
    </Badge>
  );
};

// Export utilities
export { calculateAge, formatDateFr, formatPhone };

export default PatientDashboardCard;
