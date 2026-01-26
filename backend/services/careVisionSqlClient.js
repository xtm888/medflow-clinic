/**
 * CareVision SQL Client Service
 *
 * Dedicated SQL Server client for accessing CareVision database (read-only).
 * Uses isolated ConnectionPool to avoid connection conflicts with other SQL services.
 *
 * Technical Notes:
 * - SQL Server: 192.168.4.8:1433
 * - Database: CareVisionBD20
 * - encrypt: false (local network - do not change without security review)
 * - Date format: CareVision uses DD/MM/YYYY, must convert to ISO 8601 for MedFlow
 *
 * @module services/careVisionSqlClient
 */

require('dotenv').config();
const sql = require('mssql');
const log = require('../config/logger');

// SQL Server configuration for CareVision database
const sqlConfig = {
  user: process.env.CAREVISION_SQL_USER || 'sa',
  password: process.env.CAREVISION_SQL_PASSWORD || 'server',
  server: process.env.CAREVISION_SQL_SERVER || '192.168.4.8',
  database: process.env.CAREVISION_SQL_DATABASE || 'CareVisionBD20',
  port: parseInt(process.env.CAREVISION_SQL_PORT) || 1433,
  options: {
    encrypt: false, // Local network - see Technical Gotchas in spec.md
    trustServerCertificate: true,
    requestTimeout: 60000, // 60 seconds for large queries
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000
  }
};

// Singleton connection pool - isolated from other SQL services
let pool = null;
let connectionPromise = null;

/**
 * Get or create the dedicated CareVision connection pool
 * Uses singleton pattern to avoid multiple connection pools
 *
 * @returns {Promise<sql.ConnectionPool>} Connected pool
 */
async function getPool() {
  // Return existing pool if connected
  if (pool && pool.connected) {
    return pool;
  }

  // Avoid race condition - reuse existing connection promise
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      // Check if CareVision SQL is enabled
      if (process.env.CAREVISION_SQL_ENABLED === 'false') {
        throw new Error('CareVision SQL access is disabled (CAREVISION_SQL_ENABLED=false)');
      }

      // Create new isolated pool (not using global sql.connect)
      pool = new sql.ConnectionPool(sqlConfig);

      // Set up error handler
      pool.on('error', (err) => {
        log.error('[CareVisionSQL] Pool error:', { error: err.message });
        pool = null;
        connectionPromise = null;
      });

      await pool.connect();
      log.info('[CareVisionSQL] Connected to CareVision database', {
        server: sqlConfig.server,
        database: sqlConfig.database
      });

      return pool;
    } catch (err) {
      pool = null;
      connectionPromise = null;
      log.error('[CareVisionSQL] Connection failed:', { error: err.message });
      throw err;
    }
  })();

  return connectionPromise;
}

/**
 * Close the CareVision connection pool
 * Should be called during graceful shutdown
 */
async function closePool() {
  if (pool) {
    try {
      await pool.close();
      log.info('[CareVisionSQL] Connection pool closed');
    } catch (err) {
      log.error('[CareVisionSQL] Error closing pool:', { error: err.message });
    } finally {
      pool = null;
      connectionPromise = null;
    }
  }
}

/**
 * Test the CareVision database connection
 *
 * @returns {Promise<{connected: boolean, server: string, database: string, message: string}>}
 */
async function testConnection() {
  try {
    const connPool = await getPool();
    const result = await connPool.request().query('SELECT 1 as test');
    return {
      connected: true,
      server: sqlConfig.server,
      database: sqlConfig.database,
      message: 'CareVision database connection successful'
    };
  } catch (err) {
    return {
      connected: false,
      server: sqlConfig.server,
      database: sqlConfig.database,
      message: `Connection failed: ${err.message}`
    };
  }
}

// ============================================================
// Appointments (Ag_Rdv table)
// ============================================================

/**
 * Get appointments from CareVision Ag_Rdv table
 *
 * Table: Ag_Rdv (Agenda Rendez-vous)
 * ~32,000+ records in production
 *
 * @param {Object} options - Query options
 * @param {Date|string} [options.startDate] - Filter by date >= startDate
 * @param {Date|string} [options.endDate] - Filter by date <= endDate
 * @param {string|number} [options.patientId] - Filter by CareVision patient ID
 * @param {number} [options.limit=1000] - Maximum records to return
 * @param {number} [options.offset=0] - Skip first N records (pagination)
 * @returns {Promise<{records: Array, total: number}>}
 */
async function getAppointments(options = {}) {
  const {
    startDate,
    endDate,
    patientId,
    limit = 1000,
    offset = 0
  } = options;

  try {
    const connPool = await getPool();
    const request = connPool.request();

    // Build WHERE conditions
    const conditions = [];

    if (startDate) {
      // CareVision uses DD/MM/YYYY format - use CONVERT for date comparison
      request.input('startDate', sql.DateTime, new Date(startDate));
      conditions.push('daterdv >= @startDate');
    }

    if (endDate) {
      request.input('endDate', sql.DateTime, new Date(endDate));
      conditions.push('daterdv <= @endDate');
    }

    if (patientId) {
      request.input('patientId', sql.VarChar, String(patientId));
      conditions.push('numclient = @patientId');
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count first
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Ag_Rdv
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    // Get paginated records
    // Create new request for data query (can't reuse request with inputs)
    const dataRequest = connPool.request();

    if (startDate) {
      dataRequest.input('startDate', sql.DateTime, new Date(startDate));
    }
    if (endDate) {
      dataRequest.input('endDate', sql.DateTime, new Date(endDate));
    }
    if (patientId) {
      dataRequest.input('patientId', sql.VarChar, String(patientId));
    }

    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);

    const dataQuery = `
      SELECT
        id,
        numclient,
        daterdv,
        heurerdv,
        duree,
        motif,
        status,
        medecin,
        note,
        typerdv,
        salle,
        rappel,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Ag_Rdv
      ${whereClause}
      ORDER BY daterdv DESC, heurerdv DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const dataResult = await dataRequest.query(dataQuery);

    // Transform records to MedFlow format
    const records = dataResult.recordset.map(row => transformAppointment(row));

    log.info('[CareVisionSQL] getAppointments completed', {
      total,
      returned: records.length,
      offset,
      limit
    });

    return { records, total };
  } catch (err) {
    log.error('[CareVisionSQL] getAppointments failed:', { error: err.message });
    throw err;
  }
}

/**
 * Get a single appointment by CareVision ID
 *
 * @param {number|string} appointmentId - CareVision appointment ID
 * @returns {Promise<Object|null>} Appointment record or null
 */
async function getAppointmentById(appointmentId) {
  try {
    const connPool = await getPool();
    const request = connPool.request();

    request.input('id', sql.Int, parseInt(appointmentId));

    const result = await request.query(`
      SELECT
        id,
        numclient,
        daterdv,
        heurerdv,
        duree,
        motif,
        status,
        medecin,
        note,
        typerdv,
        salle,
        rappel,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Ag_Rdv
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return transformAppointment(result.recordset[0]);
  } catch (err) {
    log.error('[CareVisionSQL] getAppointmentById failed:', {
      appointmentId,
      error: err.message
    });
    throw err;
  }
}

/**
 * Get all appointments for a specific patient
 *
 * @param {string|number} careVisionPatientId - CareVision patient ID (numclient)
 * @param {Object} options - Query options
 * @param {number} [options.limit=100] - Maximum records
 * @returns {Promise<Array>} Array of appointments
 */
async function getPatientAppointments(careVisionPatientId, options = {}) {
  const { limit = 100 } = options;

  try {
    const connPool = await getPool();
    const request = connPool.request();

    request.input('patientId', sql.VarChar, String(careVisionPatientId));
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        id,
        numclient,
        daterdv,
        heurerdv,
        duree,
        motif,
        status,
        medecin,
        note,
        typerdv,
        salle,
        rappel,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Ag_Rdv
      WHERE numclient = @patientId
      ORDER BY daterdv DESC, heurerdv DESC
    `);

    return result.recordset.map(row => transformAppointment(row));
  } catch (err) {
    log.error('[CareVisionSQL] getPatientAppointments failed:', {
      careVisionPatientId,
      error: err.message
    });
    throw err;
  }
}

/**
 * Get appointment count from Ag_Rdv table
 *
 * @returns {Promise<number>} Total count
 */
async function getAppointmentCount() {
  try {
    const connPool = await getPool();
    const result = await connPool.request().query('SELECT COUNT(*) as count FROM Ag_Rdv');
    return result.recordset[0].count;
  } catch (err) {
    log.error('[CareVisionSQL] getAppointmentCount failed:', { error: err.message });
    throw err;
  }
}

/**
 * Transform CareVision Ag_Rdv record to MedFlow appointment format
 *
 * @param {Object} row - Raw SQL Server row
 * @returns {Object} Transformed appointment object
 */
function transformAppointment(row) {
  // Convert date + time to ISO datetime
  let appointmentDateTime = null;
  if (row.daterdv) {
    appointmentDateTime = new Date(row.daterdv);
    // Add time if available (heurerdv format: HH:MM)
    if (row.heurerdv) {
      const timeParts = String(row.heurerdv).split(':');
      if (timeParts.length >= 2) {
        appointmentDateTime.setHours(parseInt(timeParts[0]) || 0);
        appointmentDateTime.setMinutes(parseInt(timeParts[1]) || 0);
      }
    }
  }

  // Map CareVision status to MedFlow status
  const statusMap = {
    'PLANIFIE': 'scheduled',
    'CONFIRME': 'confirmed',
    'ARRIVE': 'checked-in',
    'EN_COURS': 'in-progress',
    'TERMINE': 'completed',
    'ANNULE': 'cancelled',
    'NO_SHOW': 'no-show',
    'ABSENT': 'no-show'
  };

  const rawStatus = (row.status || '').toUpperCase().trim();
  const mappedStatus = statusMap[rawStatus] || 'scheduled';

  return {
    // CareVision identifiers
    legacyId: row.id,
    legacySource: 'carevision_ag_rdv',

    // Patient link (will need to be mapped to MedFlow patient ID)
    careVisionPatientId: row.numclient,

    // Appointment details
    scheduledAt: appointmentDateTime,
    duration: row.duree || 15, // Default 15 minutes
    reason: row.motif || null,
    status: mappedStatus,
    originalStatus: row.status,

    // Provider and location
    provider: row.medecin || null,
    room: row.salle || null,
    appointmentType: row.typerdv || 'consultation',

    // Notes and metadata
    notes: row.note || null,
    reminderSent: row.rappel === 1 || row.rappel === true,

    // Audit fields
    createdAt: row.datecreation || null,
    updatedAt: row.datemodification || null,
    createdBy: row.createdby || null,
    modifiedBy: row.modifiedby || null,

    // Raw data for debugging/validation
    _raw: {
      daterdv: row.daterdv,
      heurerdv: row.heurerdv
    }
  };
}

// ============================================================
// Invoices (Facture table)
// ============================================================

/**
 * Get invoices from CareVision Facture table
 *
 * Table: Facture (Invoices)
 * ~94,000+ records in production
 *
 * @param {Object} options - Query options
 * @param {Date|string} [options.startDate] - Filter by date >= startDate
 * @param {Date|string} [options.endDate] - Filter by date <= endDate
 * @param {string|number} [options.patientId] - Filter by CareVision patient ID
 * @param {string} [options.status] - Filter by invoice status
 * @param {number} [options.limit=1000] - Maximum records to return
 * @param {number} [options.offset=0] - Skip first N records (pagination)
 * @returns {Promise<{records: Array, total: number}>}
 */
async function getInvoices(options = {}) {
  const {
    startDate,
    endDate,
    patientId,
    status,
    limit = 1000,
    offset = 0
  } = options;

  try {
    const connPool = await getPool();
    const request = connPool.request();

    // Build WHERE conditions
    const conditions = [];

    if (startDate) {
      request.input('startDate', sql.DateTime, new Date(startDate));
      conditions.push('datefacture >= @startDate');
    }

    if (endDate) {
      request.input('endDate', sql.DateTime, new Date(endDate));
      conditions.push('datefacture <= @endDate');
    }

    if (patientId) {
      request.input('patientId', sql.VarChar, String(patientId));
      conditions.push('numclient = @patientId');
    }

    if (status) {
      request.input('status', sql.VarChar, String(status));
      conditions.push('etat = @status');
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Get total count first
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Facture
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    // Get paginated records
    // Create new request for data query (can't reuse request with inputs)
    const dataRequest = connPool.request();

    if (startDate) {
      dataRequest.input('startDate', sql.DateTime, new Date(startDate));
    }
    if (endDate) {
      dataRequest.input('endDate', sql.DateTime, new Date(endDate));
    }
    if (patientId) {
      dataRequest.input('patientId', sql.VarChar, String(patientId));
    }
    if (status) {
      dataRequest.input('status', sql.VarChar, String(status));
    }

    dataRequest.input('offset', sql.Int, offset);
    dataRequest.input('limit', sql.Int, limit);

    const dataQuery = `
      SELECT
        numfacture,
        numclient,
        datefacture,
        montant,
        montantpaye,
        resteapayer,
        etat,
        observations,
        modepaiement,
        numconsultation,
        numcommande,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Facture
      ${whereClause}
      ORDER BY datefacture DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const dataResult = await dataRequest.query(dataQuery);

    // Transform records to MedFlow format
    const records = dataResult.recordset.map(row => transformInvoice(row));

    log.info('[CareVisionSQL] getInvoices completed', {
      total,
      returned: records.length,
      offset,
      limit
    });

    return { records, total };
  } catch (err) {
    log.error('[CareVisionSQL] getInvoices failed:', { error: err.message });
    throw err;
  }
}

/**
 * Get a single invoice by CareVision invoice number
 *
 * @param {string|number} invoiceId - CareVision invoice ID (numfacture)
 * @returns {Promise<Object|null>} Invoice record or null
 */
async function getInvoiceById(invoiceId) {
  try {
    const connPool = await getPool();
    const request = connPool.request();

    request.input('numfacture', sql.VarChar, String(invoiceId));

    const result = await request.query(`
      SELECT
        numfacture,
        numclient,
        datefacture,
        montant,
        montantpaye,
        resteapayer,
        etat,
        observations,
        modepaiement,
        numconsultation,
        numcommande,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Facture
      WHERE numfacture = @numfacture
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return transformInvoice(result.recordset[0]);
  } catch (err) {
    log.error('[CareVisionSQL] getInvoiceById failed:', {
      invoiceId,
      error: err.message
    });
    throw err;
  }
}

/**
 * Get all invoices for a specific patient
 *
 * @param {string|number} careVisionPatientId - CareVision patient ID (numclient)
 * @param {Object} options - Query options
 * @param {number} [options.limit=100] - Maximum records
 * @returns {Promise<Array>} Array of invoices
 */
async function getPatientInvoices(careVisionPatientId, options = {}) {
  const { limit = 100 } = options;

  try {
    const connPool = await getPool();
    const request = connPool.request();

    request.input('patientId', sql.VarChar, String(careVisionPatientId));
    request.input('limit', sql.Int, limit);

    const result = await request.query(`
      SELECT TOP (@limit)
        numfacture,
        numclient,
        datefacture,
        montant,
        montantpaye,
        resteapayer,
        etat,
        observations,
        modepaiement,
        numconsultation,
        numcommande,
        datecreation,
        datemodification,
        createdby,
        modifiedby
      FROM Facture
      WHERE numclient = @patientId
      ORDER BY datefacture DESC
    `);

    return result.recordset.map(row => transformInvoice(row));
  } catch (err) {
    log.error('[CareVisionSQL] getPatientInvoices failed:', {
      careVisionPatientId,
      error: err.message
    });
    throw err;
  }
}

/**
 * Get invoice count from Facture table
 *
 * @returns {Promise<number>} Total count
 */
async function getInvoiceCount() {
  try {
    const connPool = await getPool();
    const result = await connPool.request().query('SELECT COUNT(*) as count FROM Facture');
    return result.recordset[0].count;
  } catch (err) {
    log.error('[CareVisionSQL] getInvoiceCount failed:', { error: err.message });
    throw err;
  }
}

/**
 * Transform CareVision Facture record to MedFlow invoice format
 *
 * @param {Object} row - Raw SQL Server row
 * @returns {Object} Transformed invoice object
 */
function transformInvoice(row) {
  // Map CareVision status to MedFlow status
  const statusMap = {
    'PAYE': 'paid',
    'PAYEE': 'paid',
    'PARTIEL': 'partial',
    'IMPAYE': 'unpaid',
    'IMPAYEE': 'unpaid',
    'ANNULE': 'cancelled',
    'ANNULEE': 'cancelled',
    'EN_ATTENTE': 'pending',
    'ATTENTE': 'pending'
  };

  const rawStatus = (row.etat || '').toUpperCase().trim();
  const mappedStatus = statusMap[rawStatus] || 'pending';

  // Map payment method to MedFlow payment method
  const paymentMethodMap = {
    'ESPECES': 'cash',
    'ESPECE': 'cash',
    'CASH': 'cash',
    'CARTE': 'card',
    'CB': 'card',
    'CHEQUE': 'check',
    'VIREMENT': 'bank-transfer',
    'ASSURANCE': 'insurance',
    'CONVENTION': 'insurance',
    'MOBILE': 'mobile-payment',
    'ORANGE': 'orange-money',
    'MTN': 'mtn-money',
    'WAVE': 'wave'
  };

  const rawPaymentMethod = (row.modepaiement || '').toUpperCase().trim();
  const mappedPaymentMethod = paymentMethodMap[rawPaymentMethod] || 'other';

  // Parse amounts - CareVision uses CDF as integers
  const amount = parseFloat(row.montant) || 0;
  const amountPaid = parseFloat(row.montantpaye) || 0;
  const amountDue = parseFloat(row.resteapayer) || (amount - amountPaid);

  return {
    // CareVision identifiers
    legacyId: row.numfacture,
    legacySource: 'carevision_facture',

    // Patient link (will need to be mapped to MedFlow patient ID)
    careVisionPatientId: row.numclient,

    // Invoice details
    invoiceNumber: row.numfacture,
    invoiceDate: row.datefacture ? new Date(row.datefacture) : null,

    // Financial data - CareVision uses CDF
    currency: 'CDF',
    total: amount,
    amountPaid: amountPaid,
    amountDue: amountDue,

    // Status
    status: mappedStatus,
    originalStatus: row.etat,

    // Payment
    paymentMethod: mappedPaymentMethod,
    originalPaymentMethod: row.modepaiement,

    // Related records
    careVisionConsultationId: row.numconsultation || null,
    careVisionOrderId: row.numcommande || null,

    // Notes
    notes: row.observations || null,

    // Audit fields
    createdAt: row.datecreation || null,
    updatedAt: row.datemodification || null,
    createdBy: row.createdby || null,
    modifiedBy: row.modifiedby || null,

    // Raw data for debugging/validation
    _raw: {
      numfacture: row.numfacture,
      datefacture: row.datefacture,
      montant: row.montant,
      etat: row.etat
    }
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Execute a raw SQL query against CareVision database
 * Use sparingly - prefer specific methods
 *
 * @param {string} query - SQL query string
 * @param {Object} [params={}] - Named parameters
 * @returns {Promise<sql.IResult>} Query result
 */
async function executeQuery(query, params = {}) {
  try {
    const connPool = await getPool();
    const request = connPool.request();

    // Add parameters
    for (const [name, value] of Object.entries(params)) {
      if (value instanceof Date) {
        request.input(name, sql.DateTime, value);
      } else if (typeof value === 'number') {
        request.input(name, Number.isInteger(value) ? sql.Int : sql.Float, value);
      } else {
        request.input(name, sql.NVarChar, String(value));
      }
    }

    return await request.query(query);
  } catch (err) {
    log.error('[CareVisionSQL] executeQuery failed:', { error: err.message });
    throw err;
  }
}

/**
 * Get table record count
 *
 * @param {string} tableName - Table name
 * @returns {Promise<number>} Record count
 */
async function getTableCount(tableName) {
  // Validate table name to prevent SQL injection
  const validTables = [
    'Patients', 'Consultation', 'tREFRACTION', 'Ag_Rdv', 'Facture',
    'Photos', 'Commande', 'DetailCommande', 'TCorespon', 'COURRIER',
    'TKorespondant', 'Tarif', 'CareConsult', 'Medikament', 'LentillesNew',
    'Courriertexte', 'Maquettes', 'Makete'
  ];

  if (!validTables.includes(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  try {
    const connPool = await getPool();
    const result = await connPool.request().query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return result.recordset[0].count;
  } catch (err) {
    // Table might not exist
    if (err.message.includes('Invalid object name')) {
      return 0;
    }
    throw err;
  }
}

// Export module
module.exports = {
  // Connection management
  getPool,
  closePool,
  testConnection,

  // Appointments (Ag_Rdv)
  getAppointments,
  getAppointmentById,
  getPatientAppointments,
  getAppointmentCount,

  // Invoices (Facture)
  getInvoices,
  getInvoiceById,
  getPatientInvoices,
  getInvoiceCount,

  // Utilities
  executeQuery,
  getTableCount,

  // Internal (for testing)
  _transformAppointment: transformAppointment,
  _transformInvoice: transformInvoice
};
