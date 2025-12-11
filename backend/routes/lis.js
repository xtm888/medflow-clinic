const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const lisService = require('../services/lisIntegrationService');
const hl7Parser = require('../services/hl7ParserService');
const fhirService = require('../services/fhirService');
const { LISIntegration, LISMessageLog } = require('../models/LISIntegration');

// ============ Integration Management ============

/**
 * @route   GET /api/lis/integrations
 * @desc    Get all LIS integrations
 * @access  Private (Admin)
 */
router.get('/integrations', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const integrations = await lisService.getIntegrations();

    // Remove sensitive data
    const safeIntegrations = integrations.map(int => ({
      ...int.toObject(),
      connection: {
        ...int.connection,
        credentialsEncrypted: undefined
      },
      fhirSettings: int.fhirSettings ? {
        ...int.fhirSettings,
        oauth2: int.fhirSettings.oauth2 ? {
          ...int.fhirSettings.oauth2,
          clientSecretEncrypted: undefined
        } : undefined
      } : undefined,
      displayUrl: int.getDisplayUrl()
    }));

    res.json(safeIntegrations);
  } catch (error) {
    console.error('Get integrations error:', error);
    res.status(500).json({ error: 'Failed to get integrations' });
  }
});

/**
 * @route   GET /api/lis/integrations/:id
 * @desc    Get single integration by ID
 * @access  Private (Admin)
 */
router.get('/integrations/:id', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const integration = await lisService.getIntegration(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const safeIntegration = {
      ...integration.toObject(),
      connection: {
        ...integration.connection,
        credentialsEncrypted: undefined,
        hasCredentials: !!integration.connection.credentialsEncrypted
      },
      displayUrl: integration.getDisplayUrl()
    };

    res.json(safeIntegration);
  } catch (error) {
    console.error('Get integration error:', error);
    res.status(500).json({ error: 'Failed to get integration' });
  }
});

/**
 * @route   POST /api/lis/integrations
 * @desc    Create new LIS integration
 * @access  Private (Admin)
 */
router.post('/integrations', protect, authorize('admin'), async (req, res) => {
  try {
    const integration = await lisService.createIntegration(req.body, req.user._id);
    res.status(201).json(integration);
  } catch (error) {
    console.error('Create integration error:', error);
    res.status(500).json({ error: error.message || 'Failed to create integration' });
  }
});

/**
 * @route   PUT /api/lis/integrations/:id
 * @desc    Update LIS integration
 * @access  Private (Admin)
 */
router.put('/integrations/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const integration = await lisService.updateIntegration(req.params.id, req.body, req.user._id);
    res.json(integration);
  } catch (error) {
    console.error('Update integration error:', error);
    res.status(500).json({ error: error.message || 'Failed to update integration' });
  }
});

/**
 * @route   DELETE /api/lis/integrations/:id
 * @desc    Delete LIS integration
 * @access  Private (Admin)
 */
router.delete('/integrations/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await lisService.deleteIntegration(req.params.id);
    res.json({ success: true, message: 'Integration deleted' });
  } catch (error) {
    console.error('Delete integration error:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

/**
 * @route   POST /api/lis/integrations/:id/test
 * @desc    Test integration connection
 * @access  Private (Admin)
 */
router.post('/integrations/:id/test', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await lisService.testConnection(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(400).json({ error: error.message || 'Connection test failed' });
  }
});

/**
 * @route   POST /api/lis/integrations/:id/activate
 * @desc    Activate integration
 * @access  Private (Admin)
 */
router.post('/integrations/:id/activate', protect, authorize('admin'), async (req, res) => {
  try {
    const integration = await LISIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    integration.status = 'active';
    await integration.save();

    res.json({ success: true, status: 'active' });
  } catch (error) {
    console.error('Activate integration error:', error);
    res.status(500).json({ error: 'Failed to activate integration' });
  }
});

/**
 * @route   POST /api/lis/integrations/:id/deactivate
 * @desc    Deactivate integration
 * @access  Private (Admin)
 */
router.post('/integrations/:id/deactivate', protect, authorize('admin'), async (req, res) => {
  try {
    const integration = await LISIntegration.findById(req.params.id);
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    integration.status = 'inactive';
    await integration.save();
    lisService.closeConnection(req.params.id);

    res.json({ success: true, status: 'inactive' });
  } catch (error) {
    console.error('Deactivate integration error:', error);
    res.status(500).json({ error: 'Failed to deactivate integration' });
  }
});

/**
 * @route   GET /api/lis/integrations/:id/statistics
 * @desc    Get integration statistics
 * @access  Private (Admin, Technician)
 */
router.get('/integrations/:id/statistics', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const stats = await lisService.getStatistics(req.params.id);
    res.json(stats);
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// ============ Message Logs ============

/**
 * @route   GET /api/lis/integrations/:id/messages
 * @desc    Get message logs for integration
 * @access  Private (Admin, Technician)
 */
router.get('/integrations/:id/messages', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const options = {
      direction: req.query.direction,
      status: req.query.status,
      messageType: req.query.messageType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 50,
      skip: parseInt(req.query.skip) || 0
    };

    const result = await lisService.getMessageLogs(req.params.id, options);
    res.json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get message logs' });
  }
});

/**
 * @route   GET /api/lis/messages/:id
 * @desc    Get single message log with full details
 * @access  Private (Admin, Technician)
 */
router.get('/messages/:id', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const message = await lisService.getMessageLog(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Failed to get message' });
  }
});

/**
 * @route   POST /api/lis/messages/:id/reprocess
 * @desc    Reprocess a failed message
 * @access  Private (Admin)
 */
router.post('/messages/:id/reprocess', protect, authorize('admin'), async (req, res) => {
  try {
    const message = await LISMessageLog.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.direction !== 'inbound') {
      return res.status(400).json({ error: 'Can only reprocess inbound messages' });
    }

    const result = await lisService.processInboundHL7(
      message.integration,
      message.rawMessage,
      message.metadata
    );

    // Update original message
    message.processingDetails.attempts = (message.processingDetails.attempts || 1) + 1;
    await message.save();

    res.json(result);
  } catch (error) {
    console.error('Reprocess message error:', error);
    res.status(500).json({ error: 'Failed to reprocess message' });
  }
});

// ============ Test Mappings ============

/**
 * @route   GET /api/lis/integrations/:id/mappings
 * @desc    Get test code mappings for integration
 * @access  Private (Admin, Technician)
 */
router.get('/integrations/:id/mappings', protect, authorize('admin', 'technician'), async (req, res) => {
  try {
    const mappings = await lisService.getTestMappings(req.params.id);
    res.json(mappings);
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ error: 'Failed to get test mappings' });
  }
});

/**
 * @route   POST /api/lis/integrations/:id/mappings
 * @desc    Create or update test mapping
 * @access  Private (Admin)
 */
router.post('/integrations/:id/mappings', protect, authorize('admin'), async (req, res) => {
  try {
    const mapping = await lisService.upsertTestMapping(req.params.id, req.body);
    res.json(mapping);
  } catch (error) {
    console.error('Create mapping error:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

/**
 * @route   DELETE /api/lis/mappings/:id
 * @desc    Delete test mapping
 * @access  Private (Admin)
 */
router.delete('/mappings/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await lisService.deleteTestMapping(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

// ============ HL7 Webhook (for receiving messages) ============

/**
 * @route   POST /api/lis/webhook/hl7/:integrationId
 * @desc    Receive HL7 messages via HTTP POST
 * @access  Public (validated by integration settings)
 */
router.post('/webhook/hl7/:integrationId', async (req, res) => {
  try {
    const integration = await LISIntegration.findById(req.params.integrationId);
    if (!integration) {
      return res.status(404).send(hl7Parser.generateACK({ messageControlId: 'UNKNOWN' }, 'AR', 'Integration not found'));
    }

    if (integration.status !== 'active') {
      return res.status(503).send(hl7Parser.generateACK({ messageControlId: 'UNKNOWN' }, 'AR', 'Integration inactive'));
    }

    // Get raw HL7 message from body
    let rawMessage = req.body;
    if (typeof rawMessage === 'object') {
      rawMessage = rawMessage.message || JSON.stringify(rawMessage);
    }

    const metadata = {
      sourceIp: req.ip,
      userAgent: req.get('user-agent')
    };

    const result = await lisService.processInboundHL7(req.params.integrationId, rawMessage, metadata);

    // Return ACK or NAK
    const contentType = result.success ? 'application/hl7-v2' : 'application/hl7-v2';
    res.set('Content-Type', contentType);

    if (result.success && result.ack) {
      res.send(result.ack);
    } else if (!result.success && result.nak) {
      res.status(400).send(result.nak);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('HL7 webhook error:', error);
    res.status(500).send(hl7Parser.generateACK({ messageControlId: 'UNKNOWN' }, 'AE', error.message));
  }
});

// ============ FHIR Endpoints ============

/**
 * @route   POST /api/lis/webhook/fhir/:integrationId
 * @desc    Receive FHIR resources
 * @access  Public (validated by integration)
 */
router.post('/webhook/fhir/:integrationId', async (req, res) => {
  try {
    const integration = await LISIntegration.findById(req.params.integrationId);
    if (!integration || integration.type !== 'fhir-rest') {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Integration not found' }]
      });
    }

    const resource = req.body;

    // Log the received resource
    await lisService.logMessage(
      req.params.integrationId,
      'inbound',
      'fhir',
      JSON.stringify(resource)
    );

    // Process based on resource type
    let result;
    switch (resource.resourceType) {
      case 'DiagnosticReport':
        result = await processFHIRDiagnosticReport(integration, resource);
        break;
      case 'Observation':
        result = await processFHIRObservation(integration, resource);
        break;
      case 'Bundle':
        result = await processFHIRBundle(integration, resource);
        break;
      default:
        return res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{ severity: 'error', code: 'not-supported', diagnostics: `Resource type ${resource.resourceType} not supported` }]
        });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('FHIR webhook error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }]
    });
  }
});

/**
 * @route   GET /api/lis/fhir/Patient/:id
 * @desc    Get patient as FHIR resource
 * @access  Private
 */
router.get('/fhir/Patient/:id', protect, async (req, res) => {
  try {
    const Patient = require('../models/Patient');
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }]
      });
    }

    const fhirPatient = fhirService.generatePatient(patient);
    res.set('Content-Type', 'application/fhir+json');
    res.json(fhirPatient);
  } catch (error) {
    console.error('FHIR Patient error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }]
    });
  }
});

/**
 * @route   GET /api/lis/fhir/DiagnosticReport/:id
 * @desc    Get lab order as FHIR DiagnosticReport
 * @access  Private
 */
router.get('/fhir/DiagnosticReport/:id', protect, async (req, res) => {
  try {
    const Visit = require('../models/Visit');
    const order = await Visit.findById(req.params.id).populate('patient');

    if (!order) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Order not found' }]
      });
    }

    const report = fhirService.generateDiagnosticReport(order, order.patient, order.labTests || []);
    res.set('Content-Type', 'application/fhir+json');
    res.json(report);
  } catch (error) {
    console.error('FHIR DiagnosticReport error:', error);
    res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }]
    });
  }
});

// ============ Manual Send ============

/**
 * @route   POST /api/lis/integrations/:id/send-order
 * @desc    Manually send a lab order to LIS
 * @access  Private (Admin, Doctor)
 */
router.post('/integrations/:id/send-order', protect, authorize('admin', 'doctor'), async (req, res) => {
  try {
    const { orderId } = req.body;

    const Visit = require('../models/Visit');
    const order = await Visit.findById(orderId).populate('patient');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const result = await lisService.sendLabOrder(req.params.id, order, order.patient, req.user);
    res.json(result);
  } catch (error) {
    console.error('Send order error:', error);
    res.status(500).json({ error: error.message || 'Failed to send order' });
  }
});

// ============ HL7 Parser Utilities ============

/**
 * @route   POST /api/lis/parse/hl7
 * @desc    Parse an HL7 message (utility endpoint)
 * @access  Private (Admin)
 */
router.post('/parse/hl7', protect, authorize('admin'), async (req, res) => {
  try {
    const { message } = req.body;
    const parsed = hl7Parser.parse(message);
    const validation = hl7Parser.validate(message);

    res.json({
      parsed,
      validation,
      segments: parsed.segments.map(s => s.name)
    });
  } catch (error) {
    console.error('Parse HL7 error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   POST /api/lis/generate/hl7
 * @desc    Generate an HL7 message (utility endpoint)
 * @access  Private (Admin)
 */
router.post('/generate/hl7', protect, authorize('admin'), async (req, res) => {
  try {
    const message = hl7Parser.generate(req.body);
    res.set('Content-Type', 'application/hl7-v2');
    res.send(message);
  } catch (error) {
    console.error('Generate HL7 error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Helper functions for FHIR processing
async function processFHIRDiagnosticReport(integration, resource) {
  const parsed = fhirService.parseDiagnosticReport(resource);

  // Find patient
  const Patient = require('../models/Patient');
  const patient = await Patient.findOne({
    $or: [
      { _id: parsed.patientId },
      { externalId: parsed.patientId }
    ]
  });

  // Find or create order
  const Visit = require('../models/Visit');
  let order = await Visit.findOne({
    $or: [
      { _id: parsed.externalId },
      { externalId: parsed.externalId }
    ]
  });

  if (order && parsed.status === 'completed') {
    order.status = 'completed';
    order.completedAt = parsed.completedAt;
    await order.save();
  }

  return resource;
}

async function processFHIRObservation(integration, resource) {
  const parsed = fhirService.parseObservation(resource);

  // Find related order and update with result
  // Implementation depends on how observations reference orders

  return resource;
}

async function processFHIRBundle(integration, bundle) {
  const results = [];

  for (const entry of bundle.entry || []) {
    if (entry.resource) {
      switch (entry.resource.resourceType) {
        case 'DiagnosticReport':
          results.push(await processFHIRDiagnosticReport(integration, entry.resource));
          break;
        case 'Observation':
          results.push(await processFHIRObservation(integration, entry.resource));
          break;
      }
    }
  }

  return {
    resourceType: 'Bundle',
    type: 'batch-response',
    entry: results.map(r => ({ resource: r, response: { status: '201 Created' } }))
  };
}

module.exports = router;
