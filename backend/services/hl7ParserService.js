/**
 * HL7 v2.x Parser Service
 * Parses and generates HL7 messages for LIS integration
 *
 * Supported message types:
 * - ORM (Order Message) - Lab orders from clinic to LIS
 * - ORU (Observation Result) - Lab results from LIS to clinic
 * - ADT (Admit/Discharge/Transfer) - Patient demographics
 * - ACK (Acknowledgment) - Message acknowledgments
 */

class HL7ParserService {
  constructor() {
    // HL7 delimiters (default)
    this.fieldSeparator = '|';
    this.componentSeparator = '^';
    this.repetitionSeparator = '~';
    this.escapeCharacter = '\\';
    this.subcomponentSeparator = '&';

    // Standard encoding characters string
    this.encodingCharacters = '^~\\&';
  }

  /**
   * Parse an HL7 message string into structured data
   * @param {string} message - Raw HL7 message
   * @returns {object} Parsed message structure
   */
  parse(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid HL7 message: message must be a non-empty string');
    }

    // Normalize line endings
    const normalizedMessage = message.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
    const segments = normalizedMessage.split('\r').filter(s => s.trim());

    if (segments.length === 0) {
      throw new Error('Invalid HL7 message: no segments found');
    }

    // Parse MSH segment first to get delimiters
    const mshSegment = segments.find(s => s.startsWith('MSH'));
    if (!mshSegment) {
      throw new Error('Invalid HL7 message: MSH segment not found');
    }

    // Extract delimiters from MSH
    this.fieldSeparator = mshSegment[3];
    this.encodingCharacters = mshSegment.substring(4, 8);
    this.componentSeparator = this.encodingCharacters[0];
    this.repetitionSeparator = this.encodingCharacters[1];
    this.escapeCharacter = this.encodingCharacters[2];
    this.subcomponentSeparator = this.encodingCharacters[3];

    const parsedSegments = segments.map(segment => this.parseSegment(segment));
    const msh = parsedSegments.find(s => s.name === 'MSH');

    return {
      raw: message,
      messageType: this.getMessageType(msh),
      messageControlId: this.getField(msh, 10),
      sendingApplication: this.getField(msh, 3),
      sendingFacility: this.getField(msh, 4),
      receivingApplication: this.getField(msh, 5),
      receivingFacility: this.getField(msh, 6),
      dateTime: this.parseHL7DateTime(this.getField(msh, 7)),
      version: this.getField(msh, 12),
      segments: parsedSegments,
      // Convenience accessors for common segments
      patient: this.extractPatientInfo(parsedSegments),
      order: this.extractOrderInfo(parsedSegments),
      results: this.extractResults(parsedSegments)
    };
  }

  /**
   * Parse a single segment
   */
  parseSegment(segmentStr) {
    const fields = segmentStr.split(this.fieldSeparator);
    const name = fields[0];

    // MSH segment is special - field 1 is the separator itself
    const segmentFields = name === 'MSH'
      ? [this.fieldSeparator, this.encodingCharacters, ...fields.slice(2)]
      : fields.slice(1);

    return {
      name,
      fields: segmentFields.map((field, index) => this.parseField(field, index + 1)),
      raw: segmentStr
    };
  }

  /**
   * Parse a field into components
   */
  parseField(fieldStr, fieldIndex) {
    if (!fieldStr) return { value: '', components: [], index: fieldIndex };

    // Handle repetitions
    const repetitions = fieldStr.split(this.repetitionSeparator);

    const parseComponents = (str) => {
      const components = str.split(this.componentSeparator);
      return components.map((comp, idx) => ({
        value: this.unescape(comp),
        subcomponents: comp.split(this.subcomponentSeparator).map(s => this.unescape(s)),
        index: idx + 1
      }));
    };

    return {
      value: this.unescape(repetitions[0].split(this.componentSeparator)[0]),
      components: parseComponents(repetitions[0]),
      repetitions: repetitions.length > 1 ? repetitions.map(parseComponents) : null,
      index: fieldIndex,
      raw: fieldStr
    };
  }

  /**
   * Get field value from parsed segment
   */
  getField(segment, fieldIndex, componentIndex = 1, subcomponentIndex = 1) {
    if (!segment || !segment.fields) return '';

    const field = segment.fields[fieldIndex - 1];
    if (!field) return '';

    if (componentIndex === 1 && subcomponentIndex === 1) {
      return field.value || '';
    }

    const component = field.components?.[componentIndex - 1];
    if (!component) return '';

    if (subcomponentIndex === 1) {
      return component.value || '';
    }

    return component.subcomponents?.[subcomponentIndex - 1] || '';
  }

  /**
   * Get message type from MSH segment
   */
  getMessageType(msh) {
    const field9 = msh?.fields?.[8];
    if (!field9) return { type: 'UNKNOWN', trigger: '' };

    return {
      type: field9.components?.[0]?.value || '',
      trigger: field9.components?.[1]?.value || '',
      structure: field9.components?.[2]?.value || ''
    };
  }

  /**
   * Extract patient information from PID segment
   */
  extractPatientInfo(segments) {
    const pid = segments.find(s => s.name === 'PID');
    if (!pid) return null;

    return {
      patientId: this.getField(pid, 3, 1),
      externalId: this.getField(pid, 2, 1),
      lastName: this.getField(pid, 5, 1),
      firstName: this.getField(pid, 5, 2),
      middleName: this.getField(pid, 5, 3),
      dateOfBirth: this.parseHL7DateTime(this.getField(pid, 7)),
      gender: this.mapGender(this.getField(pid, 8)),
      address: {
        street: this.getField(pid, 11, 1),
        city: this.getField(pid, 11, 3),
        state: this.getField(pid, 11, 4),
        zip: this.getField(pid, 11, 5),
        country: this.getField(pid, 11, 6)
      },
      phone: this.getField(pid, 13, 1),
      email: this.getField(pid, 13, 4),
      ssn: this.getField(pid, 19)
    };
  }

  /**
   * Extract order information from ORC/OBR segments
   */
  extractOrderInfo(segments) {
    const orc = segments.find(s => s.name === 'ORC');
    const obr = segments.find(s => s.name === 'OBR');

    if (!orc && !obr) return null;

    return {
      orderControl: orc ? this.getField(orc, 1) : null,
      placerOrderNumber: orc ? this.getField(orc, 2) : (obr ? this.getField(obr, 2) : null),
      fillerOrderNumber: orc ? this.getField(orc, 3) : (obr ? this.getField(obr, 3) : null),
      orderStatus: orc ? this.mapOrderStatus(this.getField(orc, 5)) : null,
      priority: obr ? this.mapPriority(this.getField(obr, 5)) : 'routine',
      orderedDateTime: orc ? this.parseHL7DateTime(this.getField(orc, 9)) : null,
      orderingProvider: orc ? {
        id: this.getField(orc, 12, 1),
        lastName: this.getField(orc, 12, 2),
        firstName: this.getField(orc, 12, 3)
      } : null,
      // OBR specific
      testCode: obr ? this.getField(obr, 4, 1) : null,
      testName: obr ? this.getField(obr, 4, 2) : null,
      testCodingSystem: obr ? this.getField(obr, 4, 3) : null,
      specimenReceivedDateTime: obr ? this.parseHL7DateTime(this.getField(obr, 14)) : null,
      specimenSource: obr ? this.getField(obr, 15) : null,
      resultStatus: obr ? this.mapResultStatus(this.getField(obr, 25)) : null,
      clinicalInfo: obr ? this.getField(obr, 13) : null
    };
  }

  /**
   * Extract results from OBX segments
   */
  extractResults(segments) {
    const obxSegments = segments.filter(s => s.name === 'OBX');
    if (obxSegments.length === 0) return [];

    return obxSegments.map((obx, index) => ({
      setId: this.getField(obx, 1) || (index + 1).toString(),
      valueType: this.getField(obx, 2),
      observationId: {
        code: this.getField(obx, 3, 1),
        name: this.getField(obx, 3, 2),
        codingSystem: this.getField(obx, 3, 3)
      },
      observationSubId: this.getField(obx, 4),
      value: this.parseObservationValue(obx),
      units: {
        code: this.getField(obx, 6, 1),
        text: this.getField(obx, 6, 2)
      },
      referenceRange: this.getField(obx, 7),
      abnormalFlag: this.mapAbnormalFlag(this.getField(obx, 8)),
      resultStatus: this.mapObservationStatus(this.getField(obx, 11)),
      observationDateTime: this.parseHL7DateTime(this.getField(obx, 14)),
      producerId: this.getField(obx, 15, 1),
      performingOrganization: this.getField(obx, 23, 1),
      // Original raw values
      raw: {
        value: this.getField(obx, 5),
        units: this.getField(obx, 6),
        abnormalFlag: this.getField(obx, 8),
        status: this.getField(obx, 11)
      }
    }));
  }

  /**
   * Parse observation value based on value type
   */
  parseObservationValue(obx) {
    const valueType = this.getField(obx, 2);
    const rawValue = this.getField(obx, 5);

    switch (valueType) {
      case 'NM': // Numeric
        return parseFloat(rawValue) || rawValue;
      case 'SN': // Structured Numeric
        return {
          comparator: this.getField(obx, 5, 1),
          value1: parseFloat(this.getField(obx, 5, 2)) || this.getField(obx, 5, 2),
          separator: this.getField(obx, 5, 3),
          value2: parseFloat(this.getField(obx, 5, 4)) || this.getField(obx, 5, 4)
        };
      case 'DT': // Date
      case 'TS': // Timestamp
        return this.parseHL7DateTime(rawValue);
      case 'CE': // Coded Entry
      case 'CWE': // Coded With Exceptions
        return {
          code: this.getField(obx, 5, 1),
          text: this.getField(obx, 5, 2),
          codingSystem: this.getField(obx, 5, 3)
        };
      case 'TX': // Text
      case 'ST': // String
      case 'FT': // Formatted Text
      default:
        return rawValue;
    }
  }

  /**
   * Generate an HL7 message
   */
  generate(messageData) {
    const segments = [];

    // MSH segment
    segments.push(this.generateMSH(messageData));

    // PID segment if patient data present
    if (messageData.patient) {
      segments.push(this.generatePID(messageData.patient));
    }

    // PV1 segment if visit data present
    if (messageData.visit) {
      segments.push(this.generatePV1(messageData.visit));
    }

    // ORC segment for orders
    if (messageData.order) {
      segments.push(this.generateORC(messageData.order));
    }

    // OBR segment for order details
    if (messageData.order?.tests) {
      messageData.order.tests.forEach((test, index) => {
        segments.push(this.generateOBR(test, index + 1, messageData.order));
      });
    }

    // OBX segments for results
    if (messageData.results) {
      messageData.results.forEach((result, index) => {
        segments.push(this.generateOBX(result, index + 1));
      });
    }

    return segments.join('\r');
  }

  /**
   * Generate MSH segment
   */
  generateMSH(data) {
    const timestamp = this.formatHL7DateTime(data.dateTime || new Date());
    const messageType = data.messageType || { type: 'ORM', trigger: 'O01' };
    const controlId = data.messageControlId || this.generateControlId();

    return [
      'MSH',
      this.encodingCharacters,
      data.sendingApplication || 'MEDFLOW',
      data.sendingFacility || 'CLINIC',
      data.receivingApplication || 'LIS',
      data.receivingFacility || 'LAB',
      timestamp,
      '', // Security
      `${messageType.type}^${messageType.trigger}`,
      controlId,
      'P', // Processing ID (P=Production, T=Training, D=Debug)
      data.version || '2.5.1',
      '', // Sequence number
      '', // Continuation pointer
      '', // Accept acknowledgment type
      '', // Application acknowledgment type
      data.countryCode || 'FRA'
    ].join(this.fieldSeparator);
  }

  /**
   * Generate PID segment
   */
  generatePID(patient) {
    const dob = patient.dateOfBirth ? this.formatHL7DateTime(patient.dateOfBirth, 'date') : '';
    const gender = this.reverseMapGender(patient.gender);
    const address = patient.address || {};

    return [
      'PID',
      '1', // Set ID
      patient.externalId || '', // External ID
      patient.patientId || patient._id || '', // Patient ID
      '', // Alternate Patient ID
      `${patient.lastName || ''}^${patient.firstName || ''}^${patient.middleName || ''}`, // Patient Name
      '', // Mother's Maiden Name
      dob, // Date of Birth
      gender, // Gender
      '', // Patient Alias
      '', // Race
      `${address.street || ''}^^${address.city || ''}^${address.state || ''}^${address.zip || ''}^${address.country || ''}`, // Address
      '', // County Code
      patient.phone || '', // Phone Home
      patient.phoneWork || '', // Phone Work
      '', // Primary Language
      '', // Marital Status
      '', // Religion
      '', // Patient Account Number
      patient.ssn || '' // SSN
    ].join(this.fieldSeparator);
  }

  /**
   * Generate PV1 segment
   */
  generatePV1(visit) {
    return [
      'PV1',
      '1', // Set ID
      visit.patientClass || 'O', // O=Outpatient, I=Inpatient, E=Emergency
      visit.location || '', // Assigned Patient Location
      '', // Admission Type
      '', // Preadmit Number
      '', // Prior Patient Location
      visit.attendingDoctor ? `${visit.attendingDoctor.id || ''}^${visit.attendingDoctor.lastName || ''}^${visit.attendingDoctor.firstName || ''}` : '', // Attending Doctor
      '', // Referring Doctor
      '', // Consulting Doctor
      '', // Hospital Service
      '', // Temporary Location
      '', // Preadmit Test Indicator
      '', // Readmission Indicator
      '', // Admit Source
      '', // Ambulatory Status
      '', // VIP Indicator
      '', // Admitting Doctor
      '', // Patient Type
      visit.visitNumber || '' // Visit Number
    ].join(this.fieldSeparator);
  }

  /**
   * Generate ORC segment
   */
  generateORC(order) {
    const orderDateTime = this.formatHL7DateTime(order.orderedDateTime || new Date());

    return [
      'ORC',
      order.orderControl || 'NW', // NW=New Order, CA=Cancel, XO=Change
      order.placerOrderNumber || '', // Placer Order Number
      order.fillerOrderNumber || '', // Filler Order Number
      '', // Placer Group Number
      this.reverseMapOrderStatus(order.status) || 'SC', // Order Status
      '', // Response Flag
      '', // Quantity/Timing
      '', // Parent
      orderDateTime, // Date/Time of Transaction
      '', // Entered By
      '', // Verified By
      order.orderingProvider ? `${order.orderingProvider.id || ''}^${order.orderingProvider.lastName || ''}^${order.orderingProvider.firstName || ''}` : '', // Ordering Provider
      '', // Enterer's Location
      '', // Callback Phone Number
      '', // Order Effective Date/Time
      '', // Order Control Code Reason
      '', // Entering Organization
      '', // Entering Device
      '', // Action By
      '', // Advanced Beneficiary Notice Code
      '', // Ordering Facility Name
      '', // Ordering Facility Address
      '', // Ordering Facility Phone Number
      '', // Ordering Provider Address
      '' // Order Status Modifier
    ].join(this.fieldSeparator);
  }

  /**
   * Generate OBR segment
   */
  generateOBR(test, setId, order = {}) {
    const requestedDateTime = this.formatHL7DateTime(order.requestedDateTime || new Date());

    return [
      'OBR',
      setId.toString(), // Set ID
      order.placerOrderNumber || '', // Placer Order Number
      order.fillerOrderNumber || '', // Filler Order Number
      `${test.code || ''}^${test.name || ''}^${test.codingSystem || 'L'}`, // Universal Service ID
      this.reverseMapPriority(test.priority || order.priority) || 'R', // Priority
      requestedDateTime, // Requested Date/Time
      '', // Observation Date/Time
      '', // Observation End Date/Time
      '', // Collection Volume
      '', // Collector Identifier
      '', // Specimen Action Code
      '', // Danger Code
      test.clinicalInfo || order.clinicalInfo || '', // Relevant Clinical Info
      '', // Specimen Received Date/Time
      test.specimenSource || '', // Specimen Source
      order.orderingProvider ? `${order.orderingProvider.id || ''}^${order.orderingProvider.lastName || ''}^${order.orderingProvider.firstName || ''}` : '', // Ordering Provider
      '', // Order Callback Phone Number
      '', // Placer Field 1
      '', // Placer Field 2
      '', // Filler Field 1
      '', // Filler Field 2
      '', // Results Report/Status Change Date/Time
      '', // Charge to Practice
      '', // Diagnostic Service Sect ID
      this.reverseMapResultStatus(test.resultStatus) || 'O', // Result Status
      '', // Parent Result
      '', // Quantity/Timing
      '', // Result Copies To
      '', // Parent
      '', // Transportation Mode
      '', // Reason for Study
      '', // Principal Result Interpreter
      '', // Assistant Result Interpreter
      '', // Technician
      '', // Transcriptionist
      '', // Scheduled Date/Time
      '' // Number of Sample Containers
    ].join(this.fieldSeparator);
  }

  /**
   * Generate OBX segment
   */
  generateOBX(result, setId) {
    const valueType = this.determineValueType(result.value);
    const formattedValue = this.formatObservationValue(result.value, valueType);
    const observationDateTime = this.formatHL7DateTime(result.observationDateTime || new Date());

    return [
      'OBX',
      setId.toString(), // Set ID
      valueType, // Value Type
      `${result.code || ''}^${result.name || ''}^${result.codingSystem || 'L'}`, // Observation Identifier
      result.subId || '', // Observation Sub-ID
      formattedValue, // Observation Value
      `${result.unit || ''}^${result.unitText || ''}`, // Units
      result.referenceRange || '', // Reference Range
      this.reverseMapAbnormalFlag(result.abnormalFlag) || '', // Abnormal Flags
      '', // Probability
      '', // Nature of Abnormal Test
      this.reverseMapObservationStatus(result.status) || 'F', // Observation Result Status
      '', // Effective Date of Reference Range
      '', // User Defined Access Checks
      observationDateTime, // Date/Time of the Observation
      result.producerId || '', // Producer's ID
      '', // Responsible Observer
      '', // Observation Method
      '', // Equipment Instance Identifier
      '', // Date/Time of the Analysis
      '', // Reserved
      '', // Reserved
      '', // Reserved
      result.performingOrganization || '' // Performing Organization Name
    ].join(this.fieldSeparator);
  }

  /**
   * Generate ACK message
   */
  generateACK(originalMessage, ackCode = 'AA', errorMessage = '') {
    const msh = this.generateMSH({
      sendingApplication: originalMessage.receivingApplication,
      sendingFacility: originalMessage.receivingFacility,
      receivingApplication: originalMessage.sendingApplication,
      receivingFacility: originalMessage.sendingFacility,
      messageType: { type: 'ACK', trigger: originalMessage.messageType?.trigger || '' },
      messageControlId: this.generateControlId()
    });

    const msa = [
      'MSA',
      ackCode, // AA=Accept, AE=Error, AR=Reject
      originalMessage.messageControlId || '',
      errorMessage
    ].join(this.fieldSeparator);

    const segments = [msh, msa];

    // Add ERR segment if there's an error
    if (ackCode !== 'AA' && errorMessage) {
      const err = [
        'ERR',
        '', // Error Code and Location
        '', // Error Location
        `${ackCode === 'AR' ? '207' : '102'}`, // HL7 Error Code
        'E', // Severity (E=Error, W=Warning, I=Info)
        '', // Application Error Code
        errorMessage, // Application Error Parameter
        '', // Diagnostic Information
        '' // User Message
      ].join(this.fieldSeparator);
      segments.push(err);
    }

    return segments.join('\r');
  }

  // ============ Helper Methods ============

  /**
   * Parse HL7 datetime format (YYYYMMDDHHMMSS)
   */
  parseHL7DateTime(hl7Date) {
    if (!hl7Date) return null;

    const str = hl7Date.toString();
    if (str.length < 8) return null;

    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    const hour = str.substring(8, 10) || '00';
    const minute = str.substring(10, 12) || '00';
    const second = str.substring(12, 14) || '00';

    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  }

  /**
   * Format date to HL7 format
   */
  formatHL7DateTime(date, format = 'datetime') {
    if (!date) return '';
    const d = new Date(date);

    const pad = (n) => n.toString().padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());

    if (format === 'date') {
      return `${year}${month}${day}`;
    }

    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());

    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  /**
   * Generate unique message control ID
   */
  generateControlId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `MF${timestamp}${random}`.toUpperCase();
  }

  /**
   * Unescape HL7 escape sequences
   */
  unescape(str) {
    if (!str) return '';
    return str
      .replace(/\\F\\/g, this.fieldSeparator)
      .replace(/\\S\\/g, this.componentSeparator)
      .replace(/\\T\\/g, this.subcomponentSeparator)
      .replace(/\\R\\/g, this.repetitionSeparator)
      .replace(/\\E\\/g, this.escapeCharacter)
      .replace(/\\.br\\/g, '\n');
  }

  /**
   * Escape special characters for HL7
   */
  escape(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\E\\')
      .replace(new RegExp(`\\${this.fieldSeparator}`, 'g'), '\\F\\')
      .replace(new RegExp(`\\${this.componentSeparator}`, 'g'), '\\S\\')
      .replace(new RegExp(`\\${this.subcomponentSeparator}`, 'g'), '\\T\\')
      .replace(new RegExp(`\\${this.repetitionSeparator}`, 'g'), '\\R\\')
      .replace(/\n/g, '\\.br\\');
  }

  // ============ Mapping Methods ============

  mapGender(hl7Gender) {
    const map = { 'M': 'male', 'F': 'female', 'O': 'other', 'U': 'unknown' };
    return map[hl7Gender] || 'unknown';
  }

  reverseMapGender(gender) {
    const map = { 'male': 'M', 'female': 'F', 'other': 'O', 'unknown': 'U' };
    return map[gender] || 'U';
  }

  mapOrderStatus(hl7Status) {
    const map = {
      'SC': 'scheduled',
      'IP': 'in-progress',
      'CM': 'completed',
      'CA': 'cancelled',
      'HD': 'on-hold',
      'ER': 'error',
      'DC': 'discontinued'
    };
    return map[hl7Status] || 'pending';
  }

  reverseMapOrderStatus(status) {
    const map = {
      'scheduled': 'SC',
      'pending': 'SC',
      'in-progress': 'IP',
      'completed': 'CM',
      'cancelled': 'CA',
      'on-hold': 'HD',
      'error': 'ER'
    };
    return map[status] || 'SC';
  }

  mapPriority(hl7Priority) {
    const map = {
      'S': 'stat',
      'A': 'asap',
      'R': 'routine',
      'P': 'preop',
      'C': 'callback',
      'T': 'timing-critical'
    };
    return map[hl7Priority] || 'routine';
  }

  reverseMapPriority(priority) {
    const map = {
      'stat': 'S',
      'urgent': 'S',
      'asap': 'A',
      'routine': 'R',
      'preop': 'P'
    };
    return map[priority] || 'R';
  }

  mapResultStatus(hl7Status) {
    const map = {
      'O': 'ordered',
      'I': 'pending',
      'S': 'in-progress',
      'A': 'partial',
      'P': 'preliminary',
      'C': 'corrected',
      'R': 'results-entered',
      'F': 'final',
      'X': 'cancelled'
    };
    return map[hl7Status] || 'pending';
  }

  reverseMapResultStatus(status) {
    const map = {
      'ordered': 'O',
      'pending': 'I',
      'in-progress': 'S',
      'partial': 'A',
      'preliminary': 'P',
      'corrected': 'C',
      'final': 'F',
      'completed': 'F',
      'cancelled': 'X'
    };
    return map[status] || 'O';
  }

  mapObservationStatus(hl7Status) {
    const map = {
      'C': 'corrected',
      'D': 'deleted',
      'F': 'final',
      'I': 'pending',
      'N': 'not-asked',
      'O': 'ordered',
      'P': 'preliminary',
      'R': 'results-entered',
      'S': 'partial',
      'U': 'unavailable',
      'W': 'wrong',
      'X': 'cancelled'
    };
    return map[hl7Status] || 'pending';
  }

  reverseMapObservationStatus(status) {
    const map = {
      'final': 'F',
      'completed': 'F',
      'corrected': 'C',
      'preliminary': 'P',
      'pending': 'I',
      'cancelled': 'X'
    };
    return map[status] || 'F';
  }

  mapAbnormalFlag(flag) {
    const map = {
      'L': 'low',
      'H': 'high',
      'LL': 'critical_low',
      'HH': 'critical_high',
      'N': 'normal',
      'A': 'abnormal',
      'AA': 'critical_abnormal',
      '<': 'below_lower_limit',
      '>': 'above_upper_limit'
    };
    return map[flag] || (flag ? 'abnormal' : 'normal');
  }

  reverseMapAbnormalFlag(flag) {
    const map = {
      'low': 'L',
      'high': 'H',
      'critical_low': 'LL',
      'critical_high': 'HH',
      'normal': 'N',
      'abnormal': 'A',
      'critical_abnormal': 'AA'
    };
    return map[flag] || '';
  }

  determineValueType(value) {
    if (value === null || value === undefined) return 'ST';
    if (typeof value === 'number') return 'NM';
    if (value instanceof Date) return 'TS';
    if (typeof value === 'object' && value.code) return 'CE';
    return 'ST';
  }

  formatObservationValue(value, valueType) {
    if (value === null || value === undefined) return '';

    switch (valueType) {
      case 'NM':
        return value.toString();
      case 'TS':
        return this.formatHL7DateTime(value);
      case 'CE':
        return `${value.code || ''}^${value.text || ''}^${value.codingSystem || ''}`;
      default:
        return this.escape(value.toString());
    }
  }

  /**
   * Validate an HL7 message
   */
  validate(message) {
    const errors = [];

    try {
      const parsed = typeof message === 'string' ? this.parse(message) : message;

      // Check required MSH fields
      if (!parsed.messageType?.type) {
        errors.push('Missing message type in MSH-9');
      }
      if (!parsed.messageControlId) {
        errors.push('Missing message control ID in MSH-10');
      }
      if (!parsed.version) {
        errors.push('Missing HL7 version in MSH-12');
      }

      // Validate based on message type
      const msgType = parsed.messageType?.type;

      if (msgType === 'ORM' || msgType === 'ORU') {
        if (!parsed.patient) {
          errors.push('Missing PID segment');
        }
        if (!parsed.order) {
          errors.push('Missing ORC/OBR segment');
        }
        if (msgType === 'ORU' && (!parsed.results || parsed.results.length === 0)) {
          errors.push('Missing OBX segments for ORU message');
        }
      }

      if (msgType === 'ADT') {
        if (!parsed.patient) {
          errors.push('Missing PID segment');
        }
      }

    } catch (err) {
      errors.push(`Parse error: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new HL7ParserService();
