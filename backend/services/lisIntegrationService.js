/**
 * LIS Integration Service
 * Handles communication with external Laboratory Information Systems
 */

const { LISIntegration, LISMessageLog, LISTestMapping } = require('../models/LISIntegration');
const hl7Parser = require('./hl7ParserService');
const fhirService = require('./fhirService');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const axios = require('axios');
const net = require('net');
const tls = require('tls');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('LisIntegration');

class LISIntegrationService {
  constructor() {
    this.activeConnections = new Map();
    this.messageQueue = [];
  }

  // ============ Integration Management ============

  /**
   * Get all integrations
   */
  async getIntegrations() {
    return LISIntegration.find().sort({ createdAt: -1 });
  }

  /**
   * Get integration by ID
   */
  async getIntegration(id) {
    return LISIntegration.findById(id);
  }

  /**
   * Create a new integration
   */
  async createIntegration(data, userId) {
    const integration = new LISIntegration({
      ...data,
      createdBy: userId,
      modifiedBy: userId
    });

    // Encrypt credentials if provided
    if (data.credentials) {
      integration.setCredentials(data.credentials);
    }

    if (data.oauthSecret) {
      integration.setOAuthSecret(data.oauthSecret);
    }

    await integration.save();
    return integration;
  }

  /**
   * Update an integration
   */
  async updateIntegration(id, data, userId) {
    const integration = await LISIntegration.findById(id);
    if (!integration) {
      throw new Error('Integration not found');
    }

    // Update fields
    Object.assign(integration, data, { modifiedBy: userId });

    // Handle credential updates
    if (data.credentials) {
      integration.setCredentials(data.credentials);
    }

    if (data.oauthSecret) {
      integration.setOAuthSecret(data.oauthSecret);
    }

    await integration.save();
    return integration;
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(id) {
    // Close any active connection
    this.closeConnection(id);

    // Delete related logs and mappings
    await Promise.all([
      LISMessageLog.deleteMany({ integration: id }),
      LISTestMapping.deleteMany({ integration: id }),
      LISIntegration.findByIdAndDelete(id)
    ]);

    return { success: true };
  }

  /**
   * Test integration connection
   */
  async testConnection(id) {
    const integration = await LISIntegration.findById(id);
    if (!integration) {
      throw new Error('Integration not found');
    }

    try {
      switch (integration.type) {
        case 'hl7-mllp':
          return await this.testMLLPConnection(integration);
        case 'hl7-http':
        case 'fhir-rest':
        case 'custom-api':
          return await this.testHTTPConnection(integration);
        case 'file-based':
          return await this.testFileConnection(integration);
        default:
          throw new Error(`Unknown integration type: ${integration.type}`);
      }
    } catch (error) {
      integration.updateSyncState(false, error.message);
      await integration.save();
      throw error;
    }
  }

  // ============ HL7 MLLP Connection ============

  /**
   * Test MLLP connection
   */
  async testMLLPConnection(integration) {
    return new Promise((resolve, reject) => {
      const timeout = integration.connection.connectionTimeout || 10000;
      const socketOptions = {
        host: integration.connection.host,
        port: integration.connection.port
      };

      const connect = integration.connection.useTLS
        ? () => tls.connect(socketOptions)
        : () => net.connect(socketOptions);

      const socket = connect();
      let connected = false;

      const timer = setTimeout(() => {
        if (!connected) {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }
      }, timeout);

      socket.on('connect', () => {
        connected = true;
        clearTimeout(timer);
        socket.destroy();
        integration.updateSyncState(true);
        integration.save();
        resolve({ success: true, message: 'Connection successful' });
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });
  }

  /**
   * Send HL7 message via MLLP
   */
  async sendHL7Message(integrationId, message) {
    const integration = await LISIntegration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    if (integration.type !== 'hl7-mllp') {
      throw new Error('Integration is not MLLP type');
    }

    // Frame message with MLLP delimiters
    const framedMessage = this.frameMLLPMessage(message);

    return new Promise((resolve, reject) => {
      const timeout = integration.connection.requestTimeout || 30000;
      const socketOptions = {
        host: integration.connection.host,
        port: integration.connection.port
      };

      const connect = integration.connection.useTLS
        ? () => tls.connect(socketOptions)
        : () => net.connect(socketOptions);

      const socket = connect();
      let responseData = '';

      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Response timeout'));
      }, timeout);

      socket.on('connect', () => {
        socket.write(framedMessage);
      });

      socket.on('data', (data) => {
        responseData += data.toString();

        // Check for end of MLLP message
        if (responseData.includes('\x1c\r')) {
          clearTimeout(timer);
          socket.destroy();

          // Extract message from MLLP frame
          const response = this.unframeMLLPMessage(responseData);

          // Log the message
          this.logMessage(integration._id, 'outbound', 'hl7', message, response);

          integration.incrementCounter('sent');
          integration.updateSyncState(true);
          integration.save();

          resolve({ success: true, response });
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        integration.incrementCounter('error');
        integration.updateSyncState(false, err.message);
        integration.save();
        reject(new Error(`Send failed: ${err.message}`));
      });
    });
  }

  /**
   * Frame message with MLLP delimiters
   * Start: \x0b (VT)
   * End: \x1c\r (FS + CR)
   */
  frameMLLPMessage(message) {
    return `\x0b${message}\x1c\r`;
  }

  /**
   * Remove MLLP framing from message
   */
  unframeMLLPMessage(framedMessage) {
    return framedMessage
      .replace(/^\x0b/, '')
      .replace(/\x1c\r$/, '')
      .trim();
  }

  // ============ HTTP/REST Connection ============

  /**
   * Test HTTP connection
   */
  async testHTTPConnection(integration) {
    const baseUrl = integration.connection.baseUrl || integration.fhirSettings?.baseUrl;
    if (!baseUrl) {
      throw new Error('No base URL configured');
    }

    const config = await this.buildHTTPConfig(integration);

    try {
      // For FHIR, test metadata endpoint
      if (integration.type === 'fhir-rest') {
        const response = await axios.get(`${baseUrl}/metadata`, config);
        integration.updateSyncState(true);
        await integration.save();
        return {
          success: true,
          message: 'Connection successful',
          serverInfo: {
            fhirVersion: response.data?.fhirVersion,
            software: response.data?.software?.name
          }
        };
      }

      // For other HTTP types, just test base URL
      const response = await axios.get(baseUrl, config);
      integration.updateSyncState(true);
      await integration.save();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      throw new Error(`HTTP connection failed: ${error.message}`);
    }
  }

  /**
   * Build axios config from integration settings
   */
  async buildHTTPConfig(integration) {
    const config = {
      timeout: integration.connection.requestTimeout || 30000,
      headers: {}
    };

    // Handle authentication
    switch (integration.connection.authType) {
      case 'basic': {
        const creds = integration.getCredentials();
        if (creds) {
          config.auth = {
            username: creds.username,
            password: creds.password
          };
        }
        break;
      }
      case 'bearer': {
        const creds = integration.getCredentials();
        if (creds?.token) {
          config.headers['Authorization'] = `Bearer ${creds.token}`;
        }
        break;
      }
      case 'api-key': {
        const creds = integration.getCredentials();
        if (creds?.apiKey) {
          const headerName = integration.connection.apiKeyHeader || 'X-API-Key';
          config.headers[headerName] = creds.apiKey;
        }
        break;
      }
      case 'oauth2': {
        const token = await this.getOAuth2Token(integration);
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        break;
      }
    }

    // Add TLS options if needed
    if (integration.connection.useTLS && integration.connection.tlsOptions) {
      config.httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: integration.connection.tlsOptions.rejectUnauthorized
      });
    }

    return config;
  }

  /**
   * Get OAuth2 access token
   */
  async getOAuth2Token(integration) {
    const oauth = integration.fhirSettings?.oauth2;
    if (!oauth?.enabled || !oauth.tokenUrl) {
      return null;
    }

    try {
      const response = await axios.post(oauth.tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: oauth.clientId,
        client_secret: integration.getOAuthSecret(),
        scope: oauth.scope || ''
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      return response.data.access_token;
    } catch (error) {
      log.error('OAuth2 token error:', error.message);
      throw new Error('Failed to obtain OAuth2 token');
    }
  }

  /**
   * Test file-based connection
   */
  async testFileConnection(integration) {
    const fs = require('fs').promises;

    const dirs = [
      integration.fileSettings.inputDirectory,
      integration.fileSettings.outputDirectory,
      integration.fileSettings.archiveDirectory
    ].filter(Boolean);

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        throw new Error(`Directory not accessible: ${dir}`);
      }
    }

    integration.updateSyncState(true);
    await integration.save();
    return { success: true, message: 'All directories accessible' };
  }

  // ============ Message Handling ============

  /**
   * Process incoming HL7 message
   */
  async processInboundHL7(integrationId, rawMessage, metadata = {}) {
    const integration = await LISIntegration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const startTime = Date.now();
    let logEntry;

    try {
      // Parse the message
      const parsed = hl7Parser.parse(rawMessage);

      // Create log entry
      logEntry = await LISMessageLog.create({
        integration: integrationId,
        direction: 'inbound',
        format: 'hl7',
        messageType: `${parsed.messageType.type}^${parsed.messageType.trigger}`,
        messageId: parsed.messageControlId,
        status: 'processing',
        rawMessage,
        parsedMessage: parsed,
        metadata: {
          sendingApplication: parsed.sendingApplication,
          sendingFacility: parsed.sendingFacility,
          receivingApplication: parsed.receivingApplication,
          receivingFacility: parsed.receivingFacility,
          ...metadata
        },
        processingDetails: {
          startedAt: new Date()
        }
      });

      // Process based on message type
      let result;
      switch (parsed.messageType.type) {
        case 'ORU':
          result = await this.processORUMessage(integration, parsed, logEntry);
          break;
        case 'ADT':
          result = await this.processADTMessage(integration, parsed, logEntry);
          break;
        case 'ACK':
          result = await this.processACKMessage(integration, parsed, logEntry);
          break;
        default:
          throw new Error(`Unsupported message type: ${parsed.messageType.type}`);
      }

      // Generate ACK if required
      let ackMessage = null;
      if (integration.hl7Settings.requireAck) {
        ackMessage = hl7Parser.generateACK(parsed, 'AA');
      }

      // Update log entry
      logEntry.status = 'processed';
      logEntry.responseMessage = ackMessage;
      logEntry.processingDetails.completedAt = new Date();
      logEntry.processingDetails.duration = Date.now() - startTime;
      await logEntry.save();

      integration.incrementCounter('received');
      integration.updateSyncState(true);
      await integration.save();

      return {
        success: true,
        messageId: parsed.messageControlId,
        ack: ackMessage,
        result
      };

    } catch (error) {
      // Generate NAK
      let nakMessage = null;
      if (integration.hl7Settings.requireAck) {
        try {
          const parsed = hl7Parser.parse(rawMessage);
          nakMessage = hl7Parser.generateACK(parsed, 'AE', error.message);
        } catch {
          // If we can't parse, create minimal NAK
          nakMessage = null;
        }
      }

      // Update or create log entry
      if (logEntry) {
        logEntry.status = 'error';
        logEntry.error = {
          message: error.message,
          stack: error.stack
        };
        logEntry.responseMessage = nakMessage;
        logEntry.processingDetails.completedAt = new Date();
        logEntry.processingDetails.duration = Date.now() - startTime;
        await logEntry.save();
      } else {
        await LISMessageLog.create({
          integration: integrationId,
          direction: 'inbound',
          format: 'hl7',
          status: 'error',
          rawMessage,
          responseMessage: nakMessage,
          error: {
            message: error.message,
            stack: error.stack
          },
          metadata
        });
      }

      integration.incrementCounter('error');
      integration.updateSyncState(false, error.message);
      await integration.save();

      return {
        success: false,
        error: error.message,
        nak: nakMessage
      };
    }
  }

  /**
   * Process ORU (Observation Result) message - Lab results
   */
  async processORUMessage(integration, parsed, logEntry) {
    // Find or create patient
    const patient = await this.findOrCreatePatient(integration, parsed.patient);
    if (patient) {
      logEntry.relatedPatient = patient._id;
    }

    // Find matching order
    const order = await this.findMatchingOrder(integration, parsed.order, patient);
    if (order) {
      logEntry.relatedOrder = order._id;
    }

    // Process results
    const results = [];
    for (const result of parsed.results) {
      const processedResult = {
        code: result.observationId.code,
        name: result.observationId.name,
        value: result.value,
        unit: result.units?.text || result.units?.code,
        referenceRange: result.referenceRange,
        abnormalFlag: result.abnormalFlag,
        status: result.resultStatus,
        observationDateTime: result.observationDateTime,
        notes: result.raw?.value
      };
      results.push(processedResult);

      // Update the order/visit with results if found
      if (order) {
        await this.updateOrderWithResult(order, processedResult, parsed.order);
      }
    }

    return {
      patient: patient?._id,
      order: order?._id,
      resultsCount: results.length,
      results
    };
  }

  /**
   * Process ADT (Patient Demographics) message
   */
  async processADTMessage(integration, parsed, logEntry) {
    const patient = await this.findOrCreatePatient(integration, parsed.patient, true);
    if (patient) {
      logEntry.relatedPatient = patient._id;
    }

    return {
      patient: patient?._id,
      action: parsed.messageType.trigger
    };
  }

  /**
   * Process ACK message
   */
  async processACKMessage(integration, parsed, logEntry) {
    // Find the original message this ACK is for
    const originalMessageId = parsed.segments
      .find(s => s.name === 'MSA')?.fields?.[1]?.value;

    if (originalMessageId) {
      // Update the original message status
      await LISMessageLog.findOneAndUpdate(
        { integration: integration._id, messageId: originalMessageId },
        { status: 'acknowledged' }
      );
    }

    return {
      originalMessageId,
      ackCode: parsed.segments.find(s => s.name === 'MSA')?.fields?.[0]?.value
    };
  }

  /**
   * Find or create patient from HL7 data
   */
  async findOrCreatePatient(integration, patientData, forceCreate = false) {
    if (!patientData) return null;

    // Try to find existing patient
    const matchFields = integration.autoImport?.matchFields || ['patientId', 'name', 'dateOfBirth'];
    let patient = null;

    // Try matching by ID first
    if (matchFields.includes('patientId') && patientData.patientId) {
      patient = await Patient.findOne({
        $or: [
          { _id: patientData.patientId },
          { externalId: patientData.patientId },
          { 'externalIds.lis': patientData.patientId }
        ]
      });
    }

    // Try matching by name + DOB
    if (!patient && matchFields.includes('name') && matchFields.includes('dateOfBirth')) {
      const query = {
        firstName: new RegExp(`^${patientData.firstName}$`, 'i'),
        lastName: new RegExp(`^${patientData.lastName}$`, 'i')
      };
      if (patientData.dateOfBirth) {
        query.dateOfBirth = patientData.dateOfBirth;
      }
      patient = await Patient.findOne(query);
    }

    // Create patient if not found and auto-create is enabled
    if (!patient && (integration.autoImport?.createPatients || forceCreate)) {
      patient = await Patient.create({
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender,
        phone: patientData.phone,
        email: patientData.email,
        address: patientData.address,
        externalId: patientData.patientId,
        externalIds: {
          lis: patientData.patientId
        },
        source: 'lis-import'
      });
    }

    return patient;
  }

  /**
   * Find matching lab order
   */
  async findMatchingOrder(integration, orderData, patient) {
    if (!orderData) return null;

    const query = {};

    // Match by order number
    if (orderData.placerOrderNumber) {
      query.$or = [
        { _id: orderData.placerOrderNumber },
        { 'externalIds.lis': orderData.placerOrderNumber },
        { orderNumber: orderData.placerOrderNumber }
      ];
    }

    // Also filter by patient if available
    if (patient) {
      query.patient = patient._id;
    }

    return Visit.findOne(query);
  }

  /**
   * Update order/visit with lab result
   */
  async updateOrderWithResult(order, result, orderData) {
    // Find or add the test to the visit
    const testIndex = order.labTests?.findIndex(t =>
      t.code === result.code || t.templateId?.code === result.code
    );

    if (testIndex >= 0) {
      // Update existing test
      order.labTests[testIndex].results = result.value;
      order.labTests[testIndex].unit = result.unit;
      order.labTests[testIndex].referenceRange = result.referenceRange;
      order.labTests[testIndex].abnormalFlag = result.abnormalFlag;
      order.labTests[testIndex].status = 'completed';
      order.labTests[testIndex].completedAt = result.observationDateTime || new Date();
    } else {
      // Add new test result
      order.labTests = order.labTests || [];
      order.labTests.push({
        code: result.code,
        name: result.name,
        results: result.value,
        unit: result.unit,
        referenceRange: result.referenceRange,
        abnormalFlag: result.abnormalFlag,
        status: 'completed',
        completedAt: result.observationDateTime || new Date(),
        source: 'lis-import'
      });
    }

    // Auto-complete order if all tests are done
    const allComplete = order.labTests?.every(t => t.status === 'completed');
    if (allComplete && order.status !== 'completed') {
      order.status = 'completed';
      order.completedAt = new Date();
    }

    await order.save();
  }

  // ============ Outbound Messages ============

  /**
   * Send lab order to LIS
   */
  async sendLabOrder(integrationId, order, patient, practitioner) {
    const integration = await LISIntegration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    // Map test codes if mappings exist
    const mappedTests = await this.mapTestCodes(integrationId, order.tests);

    // Generate HL7 or FHIR message based on integration type
    let message;
    let format;

    if (integration.type.startsWith('hl7')) {
      format = 'hl7';
      message = hl7Parser.generate({
        messageType: { type: 'ORM', trigger: 'O01' },
        sendingApplication: integration.hl7Settings.sendingApplication,
        sendingFacility: integration.hl7Settings.sendingFacility,
        receivingApplication: integration.hl7Settings.receivingApplication,
        receivingFacility: integration.hl7Settings.receivingFacility,
        version: integration.hl7Settings.version,
        patient: {
          patientId: patient._id.toString(),
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          phone: patient.phone,
          address: patient.address
        },
        order: {
          placerOrderNumber: order._id.toString(),
          orderControl: 'NW', // New order
          priority: order.priority,
          orderedDateTime: order.createdAt,
          orderingProvider: practitioner ? {
            id: practitioner._id.toString(),
            firstName: practitioner.firstName,
            lastName: practitioner.lastName
          } : null,
          tests: mappedTests
        }
      });
    } else if (integration.type === 'fhir-rest') {
      format = 'fhir';
      const serviceRequest = fhirService.generateServiceRequest(
        { ...order, tests: mappedTests },
        patient,
        practitioner
      );
      message = JSON.stringify(serviceRequest);
    }

    // Send the message
    let result;
    if (integration.type === 'hl7-mllp') {
      result = await this.sendHL7Message(integrationId, message);
    } else if (integration.type === 'hl7-http' || integration.type === 'fhir-rest') {
      result = await this.sendHTTPMessage(integration, message, format);
    }

    // Log the message
    await this.logMessage(integrationId, 'outbound', format, message, result?.response);

    return result;
  }

  /**
   * Send message via HTTP
   */
  async sendHTTPMessage(integration, message, format) {
    const config = await this.buildHTTPConfig(integration);
    const baseUrl = integration.connection.baseUrl || integration.fhirSettings?.baseUrl;

    config.headers['Content-Type'] = format === 'fhir'
      ? 'application/fhir+json'
      : 'application/hl7-v2';

    try {
      const response = await axios.post(baseUrl, message, config);

      integration.incrementCounter('sent');
      integration.updateSyncState(true);
      await integration.save();

      return {
        success: true,
        response: response.data,
        status: response.status
      };
    } catch (error) {
      integration.incrementCounter('error');
      integration.updateSyncState(false, error.message);
      await integration.save();

      throw new Error(`HTTP send failed: ${error.message}`);
    }
  }

  /**
   * Map internal test codes to external codes
   */
  async mapTestCodes(integrationId, tests) {
    const mappings = await LISTestMapping.find({
      integration: integrationId,
      isActive: true
    });

    const mappingMap = new Map(mappings.map(m => [m.internalCode, m]));

    return tests.map(test => {
      const mapping = mappingMap.get(test.code || test.templateId);
      if (mapping) {
        return {
          ...test,
          code: mapping.externalCode,
          name: mapping.externalName || test.name,
          codingSystem: mapping.codingSystem
        };
      }
      return test;
    });
  }

  // ============ Message Logging ============

  /**
   * Log a message
   */
  async logMessage(integrationId, direction, format, message, response = null) {
    let parsed = null;
    let messageType = null;
    let messageId = null;

    try {
      if (format === 'hl7') {
        parsed = hl7Parser.parse(message);
        messageType = `${parsed.messageType.type}^${parsed.messageType.trigger}`;
        messageId = parsed.messageControlId;
      } else if (format === 'fhir') {
        parsed = JSON.parse(message);
        messageType = parsed.resourceType;
        messageId = parsed.id;
      }
    } catch {
      // Parsing failed, log raw message anyway
    }

    return LISMessageLog.create({
      integration: integrationId,
      direction,
      format,
      messageType,
      messageId,
      status: 'processed',
      rawMessage: message,
      parsedMessage: parsed,
      responseMessage: typeof response === 'string' ? response : JSON.stringify(response)
    });
  }

  /**
   * Get message logs
   */
  async getMessageLogs(integrationId, options = {}) {
    const query = { integration: integrationId };

    if (options.direction) query.direction = options.direction;
    if (options.status) query.status = options.status;
    if (options.messageType) query.messageType = options.messageType;
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = new Date(options.startDate);
      if (options.endDate) query.createdAt.$lte = new Date(options.endDate);
    }

    const limit = options.limit || 50;
    const skip = options.skip || 0;

    const [logs, total] = await Promise.all([
      LISMessageLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('relatedPatient', 'firstName lastName')
        .lean(),
      LISMessageLog.countDocuments(query)
    ]);

    return { logs, total, limit, skip };
  }

  /**
   * Get message by ID
   */
  async getMessageLog(logId) {
    return LISMessageLog.findById(logId)
      .populate('relatedPatient', 'firstName lastName')
      .populate('relatedOrder');
  }

  // ============ Test Mappings ============

  /**
   * Get test mappings for an integration
   */
  async getTestMappings(integrationId) {
    return LISTestMapping.find({ integration: integrationId })
      .populate('internalTemplate', 'name code category')
      .sort({ internalCode: 1 });
  }

  /**
   * Create or update test mapping
   */
  async upsertTestMapping(integrationId, mappingData) {
    const existing = await LISTestMapping.findOne({
      integration: integrationId,
      internalCode: mappingData.internalCode
    });

    if (existing) {
      Object.assign(existing, mappingData);
      return existing.save();
    }

    return LISTestMapping.create({
      integration: integrationId,
      ...mappingData
    });
  }

  /**
   * Delete test mapping
   */
  async deleteTestMapping(mappingId) {
    return LISTestMapping.findByIdAndDelete(mappingId);
  }

  // ============ Connection Management ============

  /**
   * Close connection for an integration
   */
  closeConnection(integrationId) {
    const connection = this.activeConnections.get(integrationId.toString());
    if (connection) {
      connection.destroy?.();
      this.activeConnections.delete(integrationId.toString());
    }
  }

  /**
   * Get integration statistics
   */
  async getStatistics(integrationId) {
    const integration = await LISIntegration.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, weekStats, errorStats] = await Promise.all([
      // Today's stats
      LISMessageLog.aggregate([
        { $match: { integration: integration._id, createdAt: { $gte: today } } },
        { $group: {
          _id: { direction: '$direction', status: '$status' },
          count: { $sum: 1 }
        } }
      ]),
      // Last 7 days
      LISMessageLog.aggregate([
        { $match: {
          integration: integration._id,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          inbound: { $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] } },
          outbound: { $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] } },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
        } },
        { $sort: { _id: 1 } }
      ]),
      // Recent errors
      LISMessageLog.find({
        integration: integration._id,
        status: 'error'
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('messageType error createdAt')
        .lean()
    ]);

    return {
      integration: {
        id: integration._id,
        name: integration.name,
        type: integration.type,
        status: integration.status
      },
      totals: {
        messagesReceived: integration.syncState.messagesReceived,
        messagesSent: integration.syncState.messagesSent,
        messagesErrored: integration.syncState.messagesErrored
      },
      today: todayStats,
      weeklyTrend: weekStats,
      recentErrors: errorStats,
      lastSync: integration.syncState.lastSyncAt,
      lastError: integration.syncState.lastError
    };
  }
}

module.exports = new LISIntegrationService();
