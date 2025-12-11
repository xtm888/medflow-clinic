/**
 * FHIR R4 Service
 * Provides FHIR resource generation and parsing for healthcare interoperability
 *
 * Supported resources:
 * - Patient
 * - DiagnosticReport
 * - Observation
 * - ServiceRequest (Lab Orders)
 * - Specimen
 * - Practitioner
 * - Organization
 * - Bundle
 */

const crypto = require('crypto');

class FHIRService {
  constructor() {
    this.baseUrl = process.env.FHIR_BASE_URL || 'http://localhost:5001/api/fhir';
    this.organizationId = process.env.CLINIC_ID || 'medflow-clinic';
    this.organizationName = process.env.CLINIC_NAME || 'MedFlow Clinic';
  }

  // ============ Resource Generators ============

  /**
   * Generate a FHIR Patient resource
   */
  generatePatient(patient) {
    const resource = {
      resourceType: 'Patient',
      id: patient._id?.toString() || patient.id,
      meta: {
        versionId: '1',
        lastUpdated: (patient.updatedAt || new Date()).toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
      },
      identifier: [
        {
          use: 'usual',
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number'
            }]
          },
          system: `${this.baseUrl}/patient-id`,
          value: patient._id?.toString() || patient.id
        }
      ],
      active: patient.status !== 'inactive',
      name: [{
        use: 'official',
        family: patient.lastName || '',
        given: [patient.firstName, patient.middleName].filter(Boolean),
        prefix: patient.title ? [patient.title] : undefined
      }],
      telecom: [],
      gender: this.mapGenderToFHIR(patient.gender),
      birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: [],
      contact: [],
      communication: []
    };

    // Add phone
    if (patient.phone) {
      resource.telecom.push({
        system: 'phone',
        value: patient.phone,
        use: 'home'
      });
    }

    // Add mobile
    if (patient.mobile) {
      resource.telecom.push({
        system: 'phone',
        value: patient.mobile,
        use: 'mobile'
      });
    }

    // Add email
    if (patient.email) {
      resource.telecom.push({
        system: 'email',
        value: patient.email,
        use: 'home'
      });
    }

    // Add address
    if (patient.address) {
      resource.address.push({
        use: 'home',
        type: 'physical',
        line: [patient.address.street, patient.address.street2].filter(Boolean),
        city: patient.address.city,
        state: patient.address.state,
        postalCode: patient.address.zip || patient.address.postalCode,
        country: patient.address.country || 'FR'
      });
    }

    // Add emergency contact
    if (patient.emergencyContact) {
      resource.contact.push({
        relationship: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'C',
            display: 'Emergency Contact'
          }]
        }],
        name: {
          text: patient.emergencyContact.name
        },
        telecom: [{
          system: 'phone',
          value: patient.emergencyContact.phone,
          use: 'home'
        }]
      });
    }

    // Add SSN if present
    if (patient.ssn || patient.nationalId) {
      resource.identifier.push({
        use: 'official',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
            code: 'SS',
            display: 'Social Security Number'
          }]
        },
        system: 'http://hl7.org/fhir/sid/ssn',
        value: patient.ssn || patient.nationalId
      });
    }

    return resource;
  }

  /**
   * Generate a FHIR ServiceRequest (Lab Order)
   */
  generateServiceRequest(order, patient, practitioner) {
    const resource = {
      resourceType: 'ServiceRequest',
      id: order._id?.toString() || order.id,
      meta: {
        versionId: '1',
        lastUpdated: (order.updatedAt || new Date()).toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/ServiceRequest']
      },
      identifier: [{
        use: 'usual',
        system: `${this.baseUrl}/order-id`,
        value: order._id?.toString() || order.id
      }],
      status: this.mapOrderStatusToFHIR(order.status),
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '108252007',
          display: 'Laboratory procedure'
        }]
      }],
      priority: this.mapPriorityToFHIR(order.priority),
      code: {
        coding: order.tests?.map(test => ({
          system: test.codingSystem || 'http://loinc.org',
          code: test.code || test.templateId,
          display: test.name
        })) || [],
        text: order.tests?.map(t => t.name).join(', ') || 'Laboratory tests'
      },
      subject: {
        reference: `Patient/${patient._id || patient.id}`,
        display: `${patient.firstName} ${patient.lastName}`
      },
      authoredOn: (order.createdAt || new Date()).toISOString(),
      reasonCode: order.clinicalIndication ? [{
        text: order.clinicalIndication
      }] : undefined,
      note: order.notes ? [{ text: order.notes }] : undefined
    };

    // Add requester if practitioner provided
    if (practitioner) {
      resource.requester = {
        reference: `Practitioner/${practitioner._id || practitioner.id}`,
        display: `${practitioner.firstName} ${practitioner.lastName}`
      };
    }

    // Add specimen requirements
    if (order.fasting) {
      resource.patientInstruction = 'Patient must fast before specimen collection';
    }

    return resource;
  }

  /**
   * Generate a FHIR Specimen resource
   */
  generateSpecimen(specimen, patient) {
    const resource = {
      resourceType: 'Specimen',
      id: specimen._id?.toString() || specimen.id,
      meta: {
        versionId: '1',
        lastUpdated: (specimen.updatedAt || new Date()).toISOString()
      },
      identifier: [{
        use: 'usual',
        system: `${this.baseUrl}/specimen-id`,
        value: specimen.barcode || specimen._id?.toString()
      }],
      accessionIdentifier: {
        system: `${this.baseUrl}/accession`,
        value: specimen.accessionNumber || specimen.barcode
      },
      status: this.mapSpecimenStatusToFHIR(specimen.status),
      type: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: this.mapSpecimenTypeCode(specimen.specimenType),
          display: specimen.specimenType
        }]
      },
      subject: {
        reference: `Patient/${patient._id || patient.id}`,
        display: `${patient.firstName} ${patient.lastName}`
      },
      collection: {
        collectedDateTime: specimen.collectionTime ? new Date(specimen.collectionTime).toISOString() : undefined,
        quantity: specimen.volume ? {
          value: parseFloat(specimen.volume),
          unit: 'mL',
          system: 'http://unitsofmeasure.org',
          code: 'mL'
        } : undefined,
        bodySite: specimen.source ? {
          text: specimen.source
        } : undefined
      },
      container: specimen.tubeType ? [{
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0373',
            code: this.mapTubeTypeCode(specimen.tubeType),
            display: specimen.tubeType
          }]
        }
      }] : undefined,
      note: specimen.notes ? [{ text: specimen.notes }] : undefined
    };

    return resource;
  }

  /**
   * Generate a FHIR DiagnosticReport resource
   */
  generateDiagnosticReport(labOrder, patient, results = []) {
    const resource = {
      resourceType: 'DiagnosticReport',
      id: labOrder._id?.toString() || labOrder.id,
      meta: {
        versionId: '1',
        lastUpdated: (labOrder.updatedAt || new Date()).toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport']
      },
      identifier: [{
        use: 'usual',
        system: `${this.baseUrl}/report-id`,
        value: labOrder._id?.toString() || labOrder.id
      }],
      basedOn: [{
        reference: `ServiceRequest/${labOrder._id || labOrder.id}`
      }],
      status: this.mapReportStatusToFHIR(labOrder.status),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'LAB',
          display: 'Laboratory'
        }]
      }],
      code: {
        coding: labOrder.tests?.map(test => ({
          system: test.codingSystem || 'http://loinc.org',
          code: test.code || '',
          display: test.name
        })) || [],
        text: labOrder.tests?.map(t => t.name).join(', ') || 'Laboratory Report'
      },
      subject: {
        reference: `Patient/${patient._id || patient.id}`,
        display: `${patient.firstName} ${patient.lastName}`
      },
      effectiveDateTime: (labOrder.completedAt || labOrder.updatedAt || new Date()).toISOString(),
      issued: (labOrder.completedAt || new Date()).toISOString(),
      result: results.map(r => ({
        reference: `Observation/${r._id || r.id}`
      })),
      conclusion: labOrder.conclusion || undefined,
      presentedForm: labOrder.pdfUrl ? [{
        contentType: 'application/pdf',
        url: labOrder.pdfUrl
      }] : undefined
    };

    return resource;
  }

  /**
   * Generate a FHIR Observation resource
   */
  generateObservation(result, patient, labOrder) {
    const resource = {
      resourceType: 'Observation',
      id: result._id?.toString() || result.id || crypto.randomUUID(),
      meta: {
        versionId: '1',
        lastUpdated: (result.updatedAt || new Date()).toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
      },
      identifier: [{
        use: 'usual',
        system: `${this.baseUrl}/observation-id`,
        value: result._id?.toString() || result.id || crypto.randomUUID()
      }],
      status: this.mapObservationStatusToFHIR(result.status || 'final'),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory'
        }]
      }],
      code: {
        coding: [{
          system: result.codingSystem || 'http://loinc.org',
          code: result.code || '',
          display: result.name || result.testName
        }],
        text: result.name || result.testName
      },
      subject: {
        reference: `Patient/${patient._id || patient.id}`,
        display: `${patient.firstName} ${patient.lastName}`
      },
      effectiveDateTime: (result.observationDateTime || result.completedAt || new Date()).toISOString(),
      issued: (result.completedAt || new Date()).toISOString()
    };

    // Add value based on type
    if (result.value !== undefined && result.value !== null) {
      if (typeof result.value === 'number' || !isNaN(parseFloat(result.value))) {
        resource.valueQuantity = {
          value: parseFloat(result.value),
          unit: result.unit || '',
          system: 'http://unitsofmeasure.org',
          code: result.unitCode || result.unit || ''
        };
      } else if (typeof result.value === 'string') {
        resource.valueString = result.value;
      } else if (typeof result.value === 'object' && result.value.code) {
        resource.valueCodeableConcept = {
          coding: [{
            system: result.value.codingSystem || '',
            code: result.value.code,
            display: result.value.text
          }]
        };
      }
    }

    // Add reference range
    if (result.referenceRange) {
      const range = this.parseReferenceRange(result.referenceRange);
      resource.referenceRange = [{
        low: range.low !== undefined ? {
          value: range.low,
          unit: result.unit || ''
        } : undefined,
        high: range.high !== undefined ? {
          value: range.high,
          unit: result.unit || ''
        } : undefined,
        text: result.referenceRange
      }];
    }

    // Add interpretation (abnormal flags)
    if (result.abnormalFlag && result.abnormalFlag !== 'normal') {
      resource.interpretation = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: this.mapAbnormalFlagToFHIR(result.abnormalFlag),
          display: this.mapAbnormalFlagDisplay(result.abnormalFlag)
        }]
      }];
    }

    // Add note
    if (result.notes) {
      resource.note = [{ text: result.notes }];
    }

    // Link to diagnostic report
    if (labOrder) {
      resource.derivedFrom = [{
        reference: `DiagnosticReport/${labOrder._id || labOrder.id}`
      }];
    }

    return resource;
  }

  /**
   * Generate a FHIR Practitioner resource
   */
  generatePractitioner(user) {
    return {
      resourceType: 'Practitioner',
      id: user._id?.toString() || user.id,
      meta: {
        versionId: '1',
        lastUpdated: (user.updatedAt || new Date()).toISOString()
      },
      identifier: [{
        use: 'usual',
        system: `${this.baseUrl}/practitioner-id`,
        value: user._id?.toString() || user.id
      }],
      active: user.isActive !== false,
      name: [{
        use: 'official',
        family: user.lastName || '',
        given: [user.firstName].filter(Boolean),
        prefix: user.title ? [user.title] : undefined
      }],
      telecom: [
        user.email ? { system: 'email', value: user.email, use: 'work' } : null,
        user.phone ? { system: 'phone', value: user.phone, use: 'work' } : null
      ].filter(Boolean),
      qualification: user.credentials ? [{
        code: {
          text: user.credentials
        }
      }] : undefined
    };
  }

  /**
   * Generate a FHIR Organization resource
   */
  generateOrganization(org = {}) {
    return {
      resourceType: 'Organization',
      id: org._id?.toString() || this.organizationId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString()
      },
      identifier: [{
        use: 'official',
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: org.npi || this.organizationId
      }],
      active: true,
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/organization-type',
          code: 'prov',
          display: 'Healthcare Provider'
        }]
      }],
      name: org.name || this.organizationName,
      telecom: [
        org.phone ? { system: 'phone', value: org.phone, use: 'work' } : null,
        org.email ? { system: 'email', value: org.email, use: 'work' } : null
      ].filter(Boolean),
      address: org.address ? [{
        use: 'work',
        line: [org.address.street].filter(Boolean),
        city: org.address.city,
        state: org.address.state,
        postalCode: org.address.zip,
        country: org.address.country || 'FR'
      }] : undefined
    };
  }

  /**
   * Generate a FHIR Bundle
   */
  generateBundle(entries, type = 'collection') {
    return {
      resourceType: 'Bundle',
      id: crypto.randomUUID(),
      meta: {
        lastUpdated: new Date().toISOString()
      },
      type: type, // collection, batch, transaction, searchset, etc.
      total: entries.length,
      entry: entries.map(resource => ({
        fullUrl: `${this.baseUrl}/${resource.resourceType}/${resource.id}`,
        resource: resource
      }))
    };
  }

  // ============ Resource Parsers ============

  /**
   * Parse a FHIR Patient resource to internal format
   */
  parsePatient(fhirPatient) {
    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};
    const phones = fhirPatient.telecom?.filter(t => t.system === 'phone') || [];
    const emails = fhirPatient.telecom?.filter(t => t.system === 'email') || [];

    return {
      externalId: fhirPatient.id,
      firstName: name.given?.[0] || '',
      lastName: name.family || '',
      middleName: name.given?.[1] || '',
      title: name.prefix?.[0] || '',
      dateOfBirth: fhirPatient.birthDate ? new Date(fhirPatient.birthDate) : null,
      gender: this.mapGenderFromFHIR(fhirPatient.gender),
      phone: phones.find(p => p.use === 'home')?.value || phones[0]?.value || '',
      mobile: phones.find(p => p.use === 'mobile')?.value || '',
      email: emails[0]?.value || '',
      address: {
        street: address.line?.[0] || '',
        street2: address.line?.[1] || '',
        city: address.city || '',
        state: address.state || '',
        zip: address.postalCode || '',
        country: address.country || ''
      },
      ssn: fhirPatient.identifier?.find(i => i.type?.coding?.[0]?.code === 'SS')?.value || '',
      status: fhirPatient.active ? 'active' : 'inactive'
    };
  }

  /**
   * Parse a FHIR DiagnosticReport to internal format
   */
  parseDiagnosticReport(fhirReport) {
    return {
      externalId: fhirReport.id,
      patientId: fhirReport.subject?.reference?.split('/')[1],
      status: this.mapReportStatusFromFHIR(fhirReport.status),
      tests: fhirReport.code?.coding?.map(c => ({
        code: c.code,
        name: c.display,
        codingSystem: c.system
      })) || [],
      completedAt: fhirReport.effectiveDateTime ? new Date(fhirReport.effectiveDateTime) : null,
      issuedAt: fhirReport.issued ? new Date(fhirReport.issued) : null,
      conclusion: fhirReport.conclusion,
      observationIds: fhirReport.result?.map(r => r.reference?.split('/')[1]) || []
    };
  }

  /**
   * Parse a FHIR Observation to internal format
   */
  parseObservation(fhirObs) {
    let value = null;
    let unit = '';

    if (fhirObs.valueQuantity) {
      value = fhirObs.valueQuantity.value;
      unit = fhirObs.valueQuantity.unit || fhirObs.valueQuantity.code || '';
    } else if (fhirObs.valueString) {
      value = fhirObs.valueString;
    } else if (fhirObs.valueCodeableConcept) {
      value = {
        code: fhirObs.valueCodeableConcept.coding?.[0]?.code,
        text: fhirObs.valueCodeableConcept.coding?.[0]?.display || fhirObs.valueCodeableConcept.text
      };
    }

    return {
      externalId: fhirObs.id,
      code: fhirObs.code?.coding?.[0]?.code || '',
      name: fhirObs.code?.coding?.[0]?.display || fhirObs.code?.text || '',
      codingSystem: fhirObs.code?.coding?.[0]?.system || '',
      value: value,
      unit: unit,
      status: this.mapObservationStatusFromFHIR(fhirObs.status),
      abnormalFlag: this.mapAbnormalFlagFromFHIR(fhirObs.interpretation?.[0]?.coding?.[0]?.code),
      referenceRange: fhirObs.referenceRange?.[0]?.text || '',
      observationDateTime: fhirObs.effectiveDateTime ? new Date(fhirObs.effectiveDateTime) : null,
      notes: fhirObs.note?.[0]?.text || '',
      patientId: fhirObs.subject?.reference?.split('/')[1]
    };
  }

  // ============ Mapping Helpers ============

  mapGenderToFHIR(gender) {
    const map = { 'male': 'male', 'female': 'female', 'other': 'other', 'unknown': 'unknown' };
    return map[gender] || 'unknown';
  }

  mapGenderFromFHIR(fhirGender) {
    const map = { 'male': 'male', 'female': 'female', 'other': 'other', 'unknown': 'unknown' };
    return map[fhirGender] || 'unknown';
  }

  mapOrderStatusToFHIR(status) {
    const map = {
      'pending': 'draft',
      'ordered': 'active',
      'in-progress': 'active',
      'completed': 'completed',
      'cancelled': 'revoked',
      'on-hold': 'on-hold'
    };
    return map[status] || 'draft';
  }

  mapPriorityToFHIR(priority) {
    const map = {
      'routine': 'routine',
      'urgent': 'urgent',
      'stat': 'stat',
      'asap': 'asap'
    };
    return map[priority] || 'routine';
  }

  mapSpecimenStatusToFHIR(status) {
    const map = {
      'ordered': 'available',
      'registered': 'available',
      'collected': 'available',
      'processing': 'available',
      'completed': 'available',
      'rejected': 'unsatisfactory',
      'unavailable': 'unavailable'
    };
    return map[status] || 'available';
  }

  mapSpecimenTypeCode(specimenType) {
    const map = {
      'blood': '119297000',
      'serum': '119364003',
      'plasma': '119361006',
      'urine': '122575003',
      'stool': '119339001',
      'csf': '258450006',
      'swab': '257261003',
      'tissue': '119376003',
      'other': '123038009'
    };
    return map[specimenType?.toLowerCase()] || '123038009';
  }

  mapTubeTypeCode(tubeType) {
    const map = {
      'red': 'RTT',
      'purple': 'LAV',
      'blue': 'CTB',
      'green': 'LHP',
      'gray': 'GTS',
      'yellow': 'SST',
      'gold': 'SST'
    };
    return map[tubeType?.toLowerCase()] || 'OTH';
  }

  mapReportStatusToFHIR(status) {
    const map = {
      'pending': 'registered',
      'ordered': 'registered',
      'in-progress': 'partial',
      'preliminary': 'preliminary',
      'completed': 'final',
      'corrected': 'corrected',
      'cancelled': 'cancelled'
    };
    return map[status] || 'registered';
  }

  mapReportStatusFromFHIR(fhirStatus) {
    const map = {
      'registered': 'pending',
      'partial': 'in-progress',
      'preliminary': 'preliminary',
      'final': 'completed',
      'corrected': 'corrected',
      'cancelled': 'cancelled',
      'entered-in-error': 'cancelled'
    };
    return map[fhirStatus] || 'pending';
  }

  mapObservationStatusToFHIR(status) {
    const map = {
      'pending': 'registered',
      'preliminary': 'preliminary',
      'final': 'final',
      'completed': 'final',
      'corrected': 'corrected',
      'cancelled': 'cancelled'
    };
    return map[status] || 'final';
  }

  mapObservationStatusFromFHIR(fhirStatus) {
    const map = {
      'registered': 'pending',
      'preliminary': 'preliminary',
      'final': 'final',
      'amended': 'corrected',
      'corrected': 'corrected',
      'cancelled': 'cancelled',
      'entered-in-error': 'cancelled'
    };
    return map[fhirStatus] || 'final';
  }

  mapAbnormalFlagToFHIR(flag) {
    const map = {
      'low': 'L',
      'high': 'H',
      'critical_low': 'LL',
      'critical_high': 'HH',
      'abnormal': 'A',
      'critical_abnormal': 'AA',
      'normal': 'N'
    };
    return map[flag] || 'N';
  }

  mapAbnormalFlagDisplay(flag) {
    const map = {
      'low': 'Low',
      'high': 'High',
      'critical_low': 'Critical Low',
      'critical_high': 'Critical High',
      'abnormal': 'Abnormal',
      'critical_abnormal': 'Critical Abnormal',
      'normal': 'Normal'
    };
    return map[flag] || 'Normal';
  }

  mapAbnormalFlagFromFHIR(fhirCode) {
    const map = {
      'L': 'low',
      'H': 'high',
      'LL': 'critical_low',
      'HH': 'critical_high',
      'A': 'abnormal',
      'AA': 'critical_abnormal',
      'N': 'normal'
    };
    return map[fhirCode] || 'normal';
  }

  parseReferenceRange(rangeStr) {
    if (!rangeStr) return {};

    // Try to parse "low - high" format
    const dashMatch = rangeStr.match(/^([\d.]+)\s*-\s*([\d.]+)/);
    if (dashMatch) {
      return {
        low: parseFloat(dashMatch[1]),
        high: parseFloat(dashMatch[2])
      };
    }

    // Try to parse "< value" format
    const ltMatch = rangeStr.match(/^<\s*([\d.]+)/);
    if (ltMatch) {
      return { high: parseFloat(ltMatch[1]) };
    }

    // Try to parse "> value" format
    const gtMatch = rangeStr.match(/^>\s*([\d.]+)/);
    if (gtMatch) {
      return { low: parseFloat(gtMatch[1]) };
    }

    return {};
  }

  /**
   * Validate a FHIR resource
   */
  validate(resource) {
    const errors = [];

    if (!resource.resourceType) {
      errors.push('Missing resourceType');
    }

    if (!resource.id) {
      errors.push('Missing resource id');
    }

    // Validate based on resource type
    switch (resource.resourceType) {
      case 'Patient':
        if (!resource.name || resource.name.length === 0) {
          errors.push('Patient must have at least one name');
        }
        break;
      case 'Observation':
        if (!resource.code) {
          errors.push('Observation must have a code');
        }
        if (!resource.subject) {
          errors.push('Observation must have a subject');
        }
        break;
      case 'DiagnosticReport':
        if (!resource.code) {
          errors.push('DiagnosticReport must have a code');
        }
        if (!resource.subject) {
          errors.push('DiagnosticReport must have a subject');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new FHIRService();
