const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CONSTANTS = require('../config/constants');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('Websocket');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map user IDs to socket IDs
    this.userLastSeen = new Map(); // Track when users were last connected

    // Message replay buffer configuration
    this.messageBuffer = new Map(); // room -> [{event, data, timestamp}]
    this.bufferMaxSize = 100; // Max messages per room
    this.bufferMaxAge = 15 * 60 * 1000; // 15 minutes

    // User-specific message buffer for missed notifications
    this.userMessageBuffer = new Map(); // userId -> [{event, data, timestamp}]
    this.userBufferMaxSize = 50;

    // Cleanup interval
    this.cleanupInterval = null;

    // Connection health monitoring
    this.pingInterval = null;
    this.connectionErrors = new Map(); // Track errors per connection
    this.maxConnectionErrors = 5; // Disconnect after 5 consecutive errors

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      totalMessagesEmitted: 0,
      totalMessagesFailed: 0
    };
  }

  initialize(server, corsOptions) {
    this.io = socketIO(server, {
      cors: corsOptions,
      path: '/socket.io/',
      transports: ['websocket', 'polling'],

      // Connection health settings
      pingTimeout: CONSTANTS.WEBSOCKET.PONG_TIMEOUT_MS,
      pingInterval: CONSTANTS.WEBSOCKET.PING_INTERVAL_MS,

      // Performance settings
      maxHttpBufferSize: 1e6, // 1 MB
      connectTimeout: 10000, // 10 seconds

      // Error handling
      allowEIO3: true,
      serveClient: false
    });

    // Global error handler for socket.io
    this.io.engine.on('connection_error', (err) => {
      log.error('Socket.IO connection error:', {
        message: err.message,
        code: err.code,
        context: err.context
      });
      this.stats.totalErrors++;
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.setupErrorHandlers();
    this.startCleanupInterval();
    this.startPingInterval();
    log.info('✅ WebSocket service initialized (with enhanced error handling)');
  }

  // Start periodic cleanup of old messages
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupOldMessages();
      } catch (error) {
        log.error('WebSocket cleanup error:', error.message);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Stop cleanup interval
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Start ping interval for connection health monitoring
  startPingInterval() {
    // Socket.io handles pings automatically, but we add manual ping for additional monitoring
    this.pingInterval = setInterval(() => {
      if (this.io) {
        // Get all connected sockets
        this.io.sockets.sockets.forEach((socket) => {
          // Check socket health
          if (socket.connected) {
            try {
              socket.emit('ping', { timestamp: Date.now() });
            } catch (error) {
              log.error(`Ping error for socket ${socket.id}:`, error.message);
              this.handleSocketError(socket, error);
            }
          }
        });
      }
    }, CONSTANTS.WEBSOCKET.PING_INTERVAL_MS);
  }

  // Stop ping interval
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Setup global error handlers
  setupErrorHandlers() {
    if (!this.io) return;

    // Handle socket.io errors
    this.io.on('error', (error) => {
      log.error('Socket.IO error:', { error: error });
      this.stats.totalErrors++;
    });

    // Monitor all sockets for errors
    this.io.on('connection', (socket) => {
      // Socket-specific error handler
      socket.on('error', (error) => {
        log.error(`Socket error for user ${socket.userId}:`, {
          error: error.message,
          socketId: socket.id,
          userId: socket.userId
        });
        this.handleSocketError(socket, error);
      });

      // Handle connection errors
      socket.on('connect_error', (error) => {
        log.error(`Connection error for socket ${socket.id}:`, error.message);
        this.handleSocketError(socket, error);
      });

      // Handle reconnection attempts
      socket.on('reconnect_attempt', (attemptNumber) => {
        log.info(`Reconnection attempt ${attemptNumber} for socket ${socket.id}`);
      });

      // Handle reconnection failure
      socket.on('reconnect_failed', () => {
        log.error(`Reconnection failed for socket ${socket.id}`);
        this.handleSocketDisconnect(socket, 'reconnect_failed');
      });
    });
  }

  // Handle socket errors with exponential backoff
  handleSocketError(socket, error) {
    if (!socket || !socket.id) return;

    const errorCount = (this.connectionErrors.get(socket.id) || 0) + 1;
    this.connectionErrors.set(socket.id, errorCount);
    this.stats.totalErrors++;

    // Disconnect socket if too many errors
    if (errorCount >= this.maxConnectionErrors) {
      log.error(`Socket ${socket.id} exceeded max errors (${errorCount}). Disconnecting.`);
      try {
        socket.disconnect(true);
      } catch (err) {
        log.error('Error disconnecting socket:', err.message);
      }
      this.connectionErrors.delete(socket.id);
    }
  }

  // Handle socket disconnect cleanup
  handleSocketDisconnect(socket, reason) {
    if (!socket) return;

    log.info(`Socket ${socket.id} disconnected: ${reason}`);
    this.stats.totalDisconnections++;

    // Clean up error tracking
    this.connectionErrors.delete(socket.id);

    // Clean up user socket mapping
    if (socket.userId) {
      this.userSockets.delete(socket.userId);
      this.userLastSeen.set(socket.userId, Date.now());
    }

    this.stats.activeConnections = this.userSockets.size;
  }

  // Clean up old messages from buffers
  cleanupOldMessages() {
    const cutoff = Date.now() - this.bufferMaxAge;

    // Clean room buffers
    for (const [room, messages] of this.messageBuffer.entries()) {
      const filtered = messages.filter(msg => msg.timestamp > cutoff);
      if (filtered.length === 0) {
        this.messageBuffer.delete(room);
      } else {
        this.messageBuffer.set(room, filtered);
      }
    }

    // Clean user buffers
    for (const [userId, messages] of this.userMessageBuffer.entries()) {
      const filtered = messages.filter(msg => msg.timestamp > cutoff);
      if (filtered.length === 0) {
        this.userMessageBuffer.delete(userId);
      } else {
        this.userMessageBuffer.set(userId, filtered);
      }
    }

    // MEMORY LEAK FIX: Clean up old userLastSeen entries
    // Remove entries for users who haven't been seen in over 24 hours
    const lastSeenCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [userId, lastSeen] of this.userLastSeen.entries()) {
      // Only clean up if user is not currently connected
      if (!this.userSockets.has(userId) && lastSeen < lastSeenCutoff) {
        this.userLastSeen.delete(userId);
        // Also clean up their message buffer
        this.userMessageBuffer.delete(userId);
      }
    }

    // Log cleanup stats periodically
    if (Math.random() < 0.1) { // 10% chance to log
      log.info(`WebSocket cleanup: ${this.messageBuffer.size} room buffers, ${this.userMessageBuffer.size} user buffers, ${this.userLastSeen.size} lastSeen entries, ${this.userSockets.size} connected users`);
    }
  }

  // Store a message in the replay buffer
  bufferMessage(room, event, data) {
    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (!this.messageBuffer.has(room)) {
      this.messageBuffer.set(room, []);
    }

    const buffer = this.messageBuffer.get(room);
    buffer.push(message);

    // Trim if over max size
    if (buffer.length > this.bufferMaxSize) {
      buffer.shift();
    }
  }

  // Store a user-specific message
  bufferUserMessage(userId, event, data) {
    const message = {
      event,
      data,
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    if (!this.userMessageBuffer.has(userId)) {
      this.userMessageBuffer.set(userId, []);
    }

    const buffer = this.userMessageBuffer.get(userId);
    buffer.push(message);

    // Trim if over max size
    if (buffer.length > this.userBufferMaxSize) {
      buffer.shift();
    }
  }

  // Get missed messages for a room since a timestamp
  getMissedMessages(room, since) {
    const buffer = this.messageBuffer.get(room) || [];
    return buffer.filter(msg => msg.timestamp > since);
  }

  // Get missed user messages since a timestamp
  getMissedUserMessages(userId, since) {
    const buffer = this.userMessageBuffer.get(userId) || [];
    return buffer.filter(msg => msg.timestamp > since);
  }

  setupAuthentication() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      log.info(`User ${socket.user.firstName} ${socket.user.lastName} connected`);

      // Update statistics
      this.stats.totalConnections++;
      this.stats.activeConnections++;

      // Store user socket mapping
      this.userSockets.set(socket.userId, socket.id);

      // Clear error count for reconnecting user
      this.connectionErrors.delete(socket.id);

      // Check if user was previously connected and get their last seen time
      const lastSeen = this.userLastSeen.get(socket.userId);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      // Join user to their role-based room
      socket.join(`role:${socket.user.role}`);

      // Join user to department room if applicable
      if (socket.user.department) {
        socket.join(`department:${socket.user.department}`);
      }

      // Store clinic context on socket for clinic-scoped operations
      socket.clinicId = socket.user.currentClinicId?.toString() || null;

      // Join user to clinic-scoped rooms for real-time updates
      if (socket.clinicId) {
        socket.join(`clinic:${socket.clinicId}`);
        socket.join(`queue:updates:${socket.clinicId}`);
        socket.join(`appointments:updates:${socket.clinicId}`);
        socket.join(`patients:updates:${socket.clinicId}`);
        socket.join(`pharmacy:updates:${socket.clinicId}`);
        socket.join(`inventory:updates:${socket.clinicId}`);
        log.info(`User ${socket.userId} joined clinic-scoped rooms for clinic ${socket.clinicId}`);
      }

      // Send any missed notifications on reconnect
      if (lastSeen) {
        const missedMessages = this.getMissedUserMessages(socket.userId, lastSeen);
        if (missedMessages.length > 0) {
          socket.emit('replay:start', { count: missedMessages.length, since: lastSeen });
          missedMessages.forEach(msg => {
            socket.emit(msg.event, { ...msg.data, _replayed: true, _originalTimestamp: msg.timestamp });
          });
          socket.emit('replay:complete', { count: missedMessages.length });
          log.info(`Replayed ${missedMessages.length} missed messages for user ${socket.userId}`);
        }
      }

      // Handle custom events
      socket.on('subscribe:queue', (data) => {
        // Use clinic-scoped room if clinicId available, fallback to socket's clinic
        const clinicId = data?.clinicId || socket.clinicId;
        if (clinicId) {
          socket.join(`queue:updates:${clinicId}`);
          log.info(`User ${socket.userId} subscribed to queue:updates:${clinicId}`);

          // Send missed queue updates if client provides lastSeen
          if (data?.lastSeen) {
            const missedQueue = this.getMissedMessages(`queue:updates:${clinicId}`, data.lastSeen);
            if (missedQueue.length > 0) {
              socket.emit('replay:queue', missedQueue);
            }
          }
        } else {
          log.warn(`User ${socket.userId} attempted to subscribe to queue without clinic context`);
        }
      });

      socket.on('subscribe:patient', (patientId) => {
        socket.join(`patient:${patientId}`);
      });

      socket.on('subscribe:notifications', () => {
        socket.join(`notifications:${socket.userId}`);
      });

      // Handle clinic-scoped room subscriptions
      socket.on('subscribe:appointments', (data) => {
        const clinicId = data?.clinicId || socket.clinicId;
        if (clinicId) {
          socket.join(`appointments:updates:${clinicId}`);
          log.info(`User ${socket.userId} subscribed to appointments:updates:${clinicId}`);
        }
      });

      socket.on('subscribe:patients', (data) => {
        const clinicId = data?.clinicId || socket.clinicId;
        if (clinicId) {
          socket.join(`patients:updates:${clinicId}`);
          log.info(`User ${socket.userId} subscribed to patients:updates:${clinicId}`);
        }
      });

      socket.on('subscribe:pharmacy', (data) => {
        const clinicId = data?.clinicId || socket.clinicId;
        if (clinicId) {
          socket.join(`pharmacy:updates:${clinicId}`);
          log.info(`User ${socket.userId} subscribed to pharmacy:updates:${clinicId}`);
        }
      });

      socket.on('subscribe:inventory', (data) => {
        const clinicId = data?.clinicId || socket.clinicId;
        if (clinicId) {
          socket.join(`inventory:updates:${clinicId}`);
          log.info(`User ${socket.userId} subscribed to inventory:updates:${clinicId}`);
        }
      });

      // Handle clinic switch - leave old clinic rooms and join new ones
      socket.on('switch:clinic', (data) => {
        const newClinicId = data?.clinicId?.toString();
        const oldClinicId = socket.clinicId;

        if (!newClinicId) {
          log.warn(`User ${socket.userId} attempted clinic switch without new clinic ID`);
          return;
        }

        if (oldClinicId === newClinicId) {
          return; // No change needed
        }

        // Leave old clinic-scoped rooms
        if (oldClinicId) {
          socket.leave(`clinic:${oldClinicId}`);
          socket.leave(`queue:updates:${oldClinicId}`);
          socket.leave(`appointments:updates:${oldClinicId}`);
          socket.leave(`patients:updates:${oldClinicId}`);
          socket.leave(`pharmacy:updates:${oldClinicId}`);
          socket.leave(`inventory:updates:${oldClinicId}`);
          log.info(`User ${socket.userId} left clinic-scoped rooms for clinic ${oldClinicId}`);
        }

        // Update socket's clinic context
        socket.clinicId = newClinicId;

        // Join new clinic-scoped rooms
        socket.join(`clinic:${newClinicId}`);
        socket.join(`queue:updates:${newClinicId}`);
        socket.join(`appointments:updates:${newClinicId}`);
        socket.join(`patients:updates:${newClinicId}`);
        socket.join(`pharmacy:updates:${newClinicId}`);
        socket.join(`inventory:updates:${newClinicId}`);
        log.info(`User ${socket.userId} switched to clinic ${newClinicId}`);

        // Acknowledge the switch
        socket.emit('clinic:switched', { clinicId: newClinicId });
      });

      // Handle replay request from client
      socket.on('replay:request', (data) => {
        const { room, since, type } = data;

        if (type === 'user') {
          // Replay user-specific messages
          const messages = this.getMissedUserMessages(socket.userId, since || 0);
          socket.emit('replay:response', {
            room: 'user',
            messages,
            count: messages.length
          });
        } else if (room) {
          // Replay room messages (only if user is in that room)
          const messages = this.getMissedMessages(room, since || 0);
          socket.emit('replay:response', {
            room,
            messages,
            count: messages.length
          });
        }
      });

      // Handle generic room join/leave for frontend compatibility
      socket.on('join_room', (room) => {
        if (room && typeof room === 'string') {
          socket.join(room);
          log.info(`User ${socket.userId} joined room: ${room}`);
        }
      });

      socket.on('leave_room', (room) => {
        if (room && typeof room === 'string') {
          socket.leave(room);
          log.info(`User ${socket.userId} left room: ${room}`);
        }
      });

      // Handle both ping formats for frontend compatibility
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('heartbeat', () => {
        socket.emit('pong');
      });

      // Handle private messages
      socket.on('private_message', (data) => {
        if (data.to && data.message) {
          this.sendDirectMessage(socket.userId, data.to, data.message);
        }
      });

      // Handle patient called notification (clinic-scoped)
      socket.on('patient_called', (data) => {
        if (data.patientId) {
          const clinicId = data.clinicId?.toString() || socket.clinicId;
          const payload = {
            ...data,
            clinicId,
            calledBy: socket.userId,
            timestamp: new Date()
          };

          if (clinicId) {
            // Emit only to the specific clinic's queue room
            this.io.to(`queue:updates:${clinicId}`).emit('patient_called', payload);
            log.info(`Patient called notification emitted to clinic ${clinicId}`);
          } else {
            log.warn('patient_called event without clinic context - not broadcast');
          }
        }
      });

      // Handle assistance request (clinic-scoped)
      socket.on('assistance_request', (data) => {
        const clinicId = data.clinicId?.toString() || socket.clinicId;
        const payload = {
          ...data,
          clinicId,
          requestedBy: socket.userId,
          userName: `${socket.user.firstName} ${socket.user.lastName}`,
          timestamp: new Date()
        };

        if (clinicId) {
          // Emit to clinic-scoped room so only staff at the same clinic receive it
          this.io.to(`clinic:${clinicId}`).emit('assistance_requested', payload);
          log.info(`Assistance request emitted to clinic ${clinicId}`);
        } else {
          // Fallback to role-based rooms if no clinic context
          this.io.to('role:admin').emit('assistance_requested', payload);
          this.io.to('role:nurse').emit('assistance_requested', payload);
          log.warn('assistance_request without clinic context - using role-based fallback');
        }
      });

      socket.on('disconnect', (reason) => {
        log.info(`User ${socket.user.firstName} ${socket.user.lastName} disconnected: ${reason}`);
        this.handleSocketDisconnect(socket, reason);
      });
    });
  }

  // Emit queue update to all subscribed clients (clinic-scoped)
  emitQueueUpdate(queueData) {
    if (this.io) {
      const data = { ...queueData, timestamp: Date.now() };
      const clinicId = queueData.clinicId?.toString() || queueData.clinic?.toString();

      if (clinicId) {
        // Buffer for replay (clinic-scoped)
        this.bufferMessage(`queue:updates:${clinicId}`, 'queue_update', data);

        // Emit to clinic-scoped room only to prevent cross-clinic data leakage
        this.io.to(`queue:updates:${clinicId}`).emit('queue_update', data);
        log.info(`Queue update emitted to clinic ${clinicId}`);
      } else {
        // Fallback: If no clinicId provided, log warning but don't broadcast globally
        log.warn('emitQueueUpdate called without clinicId - update not broadcast', {
          dataKeys: Object.keys(queueData)
        });
      }
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    if (this.io) {
      const data = { ...notification, timestamp: Date.now() };

      // Buffer for replay if user is offline
      if (!this.isUserOnline(userId)) {
        this.bufferUserMessage(userId, 'notification', data);
      }

      // OPTIMIZED: Emit only 'notification' event (frontend listens to this)
      // Removed duplicate notification:new and notification:update emissions
      this.io.to(`user:${userId}`).emit('notification', data);
      this.io.to(`notifications:${userId}`).emit('notification', data);
    }
  }

  // Send notification to all users with specific role
  sendNotificationToRole(role, notification) {
    if (this.io) {
      this.io.to(`role:${role}`).emit('notification:new', notification);
    }
  }

  // Send notification to department
  sendNotificationToDepartment(department, notification) {
    if (this.io) {
      this.io.to(`department:${department}`).emit('notification:new', notification);
    }
  }

  // Emit patient update (clinic-scoped)
  emitPatientUpdate(patientId, updateData) {
    if (this.io) {
      const data = { ...updateData, patientId, timestamp: Date.now() };
      const clinicId = updateData.clinicId?.toString() || updateData.homeClinic?.toString() || updateData.clinic?.toString();

      // Always emit to patient-specific room for those viewing this patient
      this.io.to(`patient:${patientId}`).emit('patient_update', data);

      // Emit to clinic-scoped room for patient list views
      if (clinicId) {
        this.io.to(`patients:updates:${clinicId}`).emit('patient_update', data);
        log.info(`Patient update emitted to clinic ${clinicId} for patient ${patientId}`);
      } else {
        log.warn('emitPatientUpdate called without clinicId - only patient-specific room notified', {
          patientId
        });
      }
    }
  }

  // Emit appointment update (clinic-scoped)
  emitAppointmentUpdate(appointmentData) {
    if (this.io) {
      const data = { ...appointmentData, timestamp: Date.now() };
      const clinicId = appointmentData.clinicId?.toString() || appointmentData.clinic?.toString();

      if (clinicId) {
        // Buffer for replay (clinic-scoped)
        this.bufferMessage(`appointments:updates:${clinicId}`, 'appointment_update', data);

        // Emit to clinic-scoped room only
        this.io.to(`appointments:updates:${clinicId}`).emit('appointment_update', data);
        log.info(`Appointment update emitted to clinic ${clinicId}`);
      } else {
        log.warn('emitAppointmentUpdate called without clinicId - update not broadcast', {
          appointmentId: appointmentData._id || appointmentData.id
        });
      }
    }
  }

  // Emit billing/invoice update (clinic-scoped)
  emitBillingUpdate(billingData) {
    if (this.io) {
      const data = { ...billingData, timestamp: Date.now() };
      const { patientId, invoiceId, event } = billingData;
      const clinicId = billingData.clinicId?.toString() || billingData.clinic?.toString();

      // Notify patient-specific room
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('billing_update', data);
      }

      // Emit to clinic-scoped room for billing dashboards
      if (clinicId) {
        this.io.to(`clinic:${clinicId}`).emit('billing_update', data);
        log.info(`Billing update emitted to clinic ${clinicId}: ${event || 'update'} for invoice ${invoiceId}`);
      } else {
        // Fallback to role-based rooms if no clinic context (not recommended)
        this.io.to('role:accountant').emit('billing_update', data);
        this.io.to('role:receptionist').emit('billing_update', data);
        log.warn('emitBillingUpdate called without clinicId - using role-based fallback', {
          invoiceId
        });
      }
    }
  }

  // Emit prescription update (clinic-scoped)
  emitPrescriptionUpdate(prescriptionData) {
    if (this.io) {
      const { patientId, prescriberId } = prescriptionData;
      const data = { ...prescriptionData, timestamp: Date.now() };
      const clinicId = prescriptionData.clinicId?.toString() || prescriptionData.clinic?.toString();

      // Notify patient-specific room
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('prescription:updated', data);
      }

      // Notify prescriber
      if (prescriberId) {
        this.io.to(`user:${prescriberId}`).emit('prescription:updated', data);
      }

      // Notify pharmacy (clinic-scoped)
      if (clinicId) {
        this.io.to(`pharmacy:updates:${clinicId}`).emit('prescription:new', data);
        log.info(`Prescription update emitted to pharmacy at clinic ${clinicId}`);
      } else {
        // Fallback to role-based room (not recommended - potential cross-clinic leak)
        this.io.to('role:pharmacist').emit('prescription:new', data);
        log.warn('emitPrescriptionUpdate called without clinicId - using role-based fallback');
      }
    }
  }

  // Emit lab result update
  emitLabResultUpdate(labData) {
    if (this.io) {
      const { patientId, providerId } = labData;

      // OPTIMIZED: Emit only 'lab_results' (frontend listens to this)
      if (patientId) {
        this.io.to(`patient:${patientId}`).emit('lab_results', labData);
      }

      if (providerId) {
        this.io.to(`user:${providerId}`).emit('lab_results', labData);
      }

      // Notify lab technicians (frontend listens to lab_worklist_update)
      this.io.to('role:lab_technician').emit('lab_worklist_update', labData);
    }
  }

  // Emit critical alert (clinic-scoped for most alerts)
  emitCriticalAlert(alertData) {
    if (this.io) {
      const data = { ...alertData, timestamp: Date.now() };
      const clinicId = alertData.clinicId?.toString() || alertData.clinic?.toString();

      // Critical urgency alerts still go clinic-wide but only to that clinic
      if (alertData.urgency === 'critical') {
        if (clinicId) {
          this.io.to(`clinic:${clinicId}`).emit('alert:critical', data);
          log.info(`Critical alert emitted to clinic ${clinicId}`);
        } else {
          // Without clinic context, restrict to admin only
          this.io.to('role:admin').emit('alert:critical', data);
          log.warn('emitCriticalAlert (critical) called without clinicId - restricted to admin');
        }
      } else if (alertData.department) {
        // Department alerts are scoped to clinic + department
        if (clinicId) {
          // Note: We don't have clinic-scoped department rooms, so use clinic room
          this.io.to(`clinic:${clinicId}`).emit('alert:department', data);
        } else {
          this.io.to(`department:${alertData.department}`).emit('alert:department', data);
        }
      } else if (alertData.role) {
        // Role alerts should also be clinic-scoped when possible
        if (clinicId) {
          this.io.to(`clinic:${clinicId}`).emit('alert:role', data);
        } else {
          this.io.to(`role:${alertData.role}`).emit('alert:role', data);
        }
      }
    }
  }

  // Emit inventory alert (clinic-scoped)
  emitInventoryAlert(alertData) {
    if (this.io) {
      const data = { ...alertData, timestamp: Date.now() };
      const clinicId = alertData.clinicId?.toString() || alertData.clinic?.toString();

      if (clinicId) {
        // Emit to clinic-scoped inventory room
        this.io.to(`inventory:updates:${clinicId}`).emit('inventory:alert', data);
        // Also notify clinic-scoped pharmacy room for drug-related alerts
        this.io.to(`pharmacy:updates:${clinicId}`).emit('inventory:alert', data);
        log.info(`Inventory alert emitted to clinic ${clinicId}: ${alertData.type || 'alert'}`);
      } else {
        // Fallback to role-based rooms (not recommended)
        this.io.to('role:pharmacist').emit('inventory:alert', data);
        this.io.to('role:admin').emit('inventory:alert', data);
        log.warn('emitInventoryAlert called without clinicId - using role-based fallback');
      }
    }
  }

  // Emit dashboard update (clinic-scoped)
  emitDashboardUpdate(updateType, data, clinicId = null) {
    if (this.io) {
      const payload = {
        type: updateType,
        data: data,
        timestamp: new Date()
      };

      // Extract clinicId from data if not provided directly
      const targetClinicId = clinicId?.toString() || data?.clinicId?.toString() || data?.clinic?.toString();

      if (targetClinicId) {
        // Emit to clinic-scoped room
        this.io.to(`clinic:${targetClinicId}`).emit('dashboard:update', payload);
        log.info(`Dashboard update emitted to clinic ${targetClinicId}: ${updateType}`);
      } else {
        // For truly global dashboard updates (e.g., system-wide metrics for admins)
        // Only emit to admin role to prevent cross-clinic data exposure
        this.io.to('role:admin').emit('dashboard:update', payload);
        log.warn('emitDashboardUpdate called without clinicId - restricted to admin role');
      }
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  // Get all online users
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  // Send direct message to user
  sendDirectMessage(fromUserId, toUserId, message) {
    if (this.io && this.userSockets.has(toUserId)) {
      this.io.to(`user:${toUserId}`).emit('message:direct', {
        from: fromUserId,
        message: message,
        timestamp: new Date()
      });
    }
  }

  // Generic broadcast - CLINIC-SCOPED by default to prevent data leakage
  // For truly global broadcasts (e.g., system maintenance), use broadcastGlobal()
  broadcast(payload) {
    if (this.io && payload) {
      const event = payload.type || 'system:notification';
      const clinicId = payload.clinicId?.toString() || payload.clinic?.toString();
      const data = {
        ...payload,
        timestamp: new Date()
      };

      if (clinicId) {
        // Clinic-scoped broadcast
        this.io.to(`clinic:${clinicId}`).emit(event, data);
        log.info(`Broadcast emitted to clinic ${clinicId}: ${event}`);
      } else {
        // Without clinicId, restrict to admin only to prevent cross-clinic exposure
        this.io.to('role:admin').emit(event, data);
        log.warn(`broadcast() called without clinicId - restricted to admin: ${event}`);
      }
    }
  }

  // Truly global broadcast - USE SPARINGLY, only for system-wide notifications
  // Examples: system maintenance, server shutdown, global announcements
  broadcastGlobal(payload) {
    if (this.io && payload) {
      const event = payload.type || 'system:notification';
      this.io.emit(event, {
        ...payload,
        timestamp: new Date()
      });
      log.info(`Global broadcast emitted: ${event}`);
    }
  }

  // Emit to a specific clinic room
  emitToClinic(clinicId, event, data) {
    if (this.io && clinicId) {
      this.io.to(`clinic:${clinicId}`).emit(event, {
        ...data,
        clinicId,
        timestamp: new Date()
      });
      return true;
    }
    return false;
  }

  // Emit to multiple clinics (for multi-clinic users or admin views)
  emitToMultipleClinics(clinicIds, event, data) {
    if (this.io && Array.isArray(clinicIds) && clinicIds.length > 0) {
      clinicIds.forEach(clinicId => {
        this.emitToClinic(clinicId.toString(), event, data);
      });
      return true;
    }
    return false;
  }

  // Emit device-related events (clinic-scoped)
  emitDeviceUpdate(eventType, data) {
    if (this.io) {
      const clinicId = data.clinicId?.toString() || data.clinic?.toString();
      const payload = {
        ...data,
        timestamp: new Date()
      };

      if (clinicId) {
        // Device updates should only go to the clinic where the device is located
        this.io.to(`clinic:${clinicId}`).emit(eventType, payload);
        log.info(`Device update emitted to clinic ${clinicId}: ${eventType}`);
      } else {
        // Fallback: emit only to admin for device events without clinic context
        this.io.to('role:admin').emit(eventType, payload);
        log.warn(`emitDeviceUpdate called without clinicId: ${eventType}`);
      }
    }
  }

  // ============================================
  // LABORATORY WORKLIST UPDATES
  // ============================================

  // Emit lab worklist update (clinic-scoped for real-time lab dashboard)
  emitLabWorklistUpdate(updateData) {
    if (this.io) {
      const data = {
        ...updateData,
        timestamp: new Date()
      };
      const clinicId = updateData.clinicId?.toString() || updateData.clinic?.toString();

      if (clinicId) {
        // Emit to clinic-scoped room for lab dashboard
        this.io.to(`clinic:${clinicId}`).emit('lab_worklist_update', data);

        // Buffer for replay (clinic-scoped)
        this.bufferMessage(`lab:worklist:${clinicId}`, 'lab_worklist_update', data);

        log.info(`Lab worklist update emitted to clinic ${clinicId}`);
      } else {
        // Fallback to role-based rooms (not recommended)
        this.io.to('role:lab_technician').emit('lab_worklist_update', data);
        this.io.to('role:doctor').emit('lab_worklist_update', data);
        this.io.to('role:ophthalmologist').emit('lab_worklist_update', data);
        log.warn('emitLabWorklistUpdate called without clinicId - using role-based fallback');
      }
    }
  }

  // Emit specific lab order status change (clinic-scoped)
  emitLabOrderStatusChange(orderId, oldStatus, newStatus, additionalData = {}) {
    if (this.io) {
      const data = {
        orderId,
        oldStatus,
        newStatus,
        ...additionalData,
        timestamp: new Date()
      };
      const clinicId = additionalData.clinicId?.toString() || additionalData.clinic?.toString();

      if (clinicId) {
        // Broadcast to clinic-scoped room
        this.io.to(`clinic:${clinicId}`).emit('lab:order:status', data);
      } else {
        // Fallback to role-based room
        this.io.to('role:lab_technician').emit('lab:order:status', data);
        log.warn('emitLabOrderStatusChange called without clinicId');
      }

      // Notify ordering provider if result is ready (user-specific, not clinic-scoped)
      if (newStatus === 'completed' && additionalData.orderedBy) {
        this.io.to(`user:${additionalData.orderedBy}`).emit('lab:results:ready', data);
      }

      // Critical value alert - user-specific notifications are safe
      if (additionalData.hasCritical) {
        // Notify ordering provider directly
        if (additionalData.orderedBy) {
          this.io.to(`user:${additionalData.orderedBy}`).emit('lab:critical', data);
        }
        // For clinic-wide critical alerts, use clinic-scoped room
        if (clinicId) {
          this.io.to(`clinic:${clinicId}`).emit('lab:critical', data);
        }
      }
    }
  }

  // Emit specimen collection event (clinic-scoped)
  emitSpecimenCollected(specimenData) {
    if (this.io) {
      const data = {
        ...specimenData,
        timestamp: new Date()
      };
      const clinicId = specimenData.clinicId?.toString() || specimenData.clinic?.toString();

      if (clinicId) {
        // Notify lab at specific clinic to expect specimen
        this.io.to(`clinic:${clinicId}`).emit('lab:specimen:collected', data);
      } else {
        // Fallback to role-based room
        this.io.to('role:lab_technician').emit('lab:specimen:collected', data);
        log.warn('emitSpecimenCollected called without clinicId');
      }

      // Update worklist (already clinic-scoped)
      this.emitLabWorklistUpdate({
        action: 'specimen_collected',
        clinicId, // Pass clinicId through
        ...data
      });
    }
  }

  // Emit QC failure alert (clinic-scoped)
  emitQCFailure(qcData) {
    if (this.io) {
      const data = {
        ...qcData,
        priority: 'urgent',
        timestamp: new Date()
      };
      const clinicId = qcData.clinicId?.toString() || qcData.clinic?.toString();

      if (clinicId) {
        // Alert clinic-specific lab staff
        this.safeEmit(`clinic:${clinicId}`, 'lab:qc:failure', data);
        log.info(`QC failure alert emitted to clinic ${clinicId}`);
      } else {
        // Fallback to role-based rooms (not recommended - potential cross-clinic leak)
        this.safeEmit('role:lab_technician', 'lab:qc:failure', data);
        this.safeEmit('role:admin', 'lab:qc:failure', data);
        log.warn('emitQCFailure called without clinicId - using role-based fallback');
      }
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Safe emit with error handling
   * Wraps socket.io emit with try-catch and statistics tracking
   * IMPORTANT: Always provide a room to prevent cross-clinic data leakage
   */
  safeEmit(room, event, data) {
    if (!this.io) {
      log.warn('WebSocket not initialized, cannot emit event:', { data: event });
      return false;
    }

    try {
      if (room) {
        this.io.to(room).emit(event, data);
      } else {
        // Log warning for global emits - these should be avoided in multi-clinic environments
        log.warn(`safeEmit called without room for event ${event} - potential cross-clinic leak`);
        this.io.emit(event, data);
      }
      this.stats.totalMessagesEmitted++;
      return true;
    } catch (error) {
      log.error(`Failed to emit event ${event}:`, error.message);
      this.stats.totalMessagesFailed++;
      return false;
    }
  }

  /**
   * Get WebSocket service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeConnections: this.userSockets.size,
      bufferedRooms: this.messageBuffer.size,
      bufferedUsers: this.userMessageBuffer.size,
      trackedUsers: this.userLastSeen.size,
      pendingErrors: this.connectionErrors.size,
      uptime: process.uptime()
    };
  }

  /**
   * Reset statistics (useful for monitoring)
   */
  resetStats() {
    this.stats.totalMessagesEmitted = 0;
    this.stats.totalMessagesFailed = 0;
    this.stats.totalErrors = 0;
    // Keep connection counts
  }

  /**
   * Graceful shutdown
   * Clean up all resources and close connections
   */
  async shutdown() {
    log.info('🔌 Shutting down WebSocket service...');

    // Stop intervals
    this.stopCleanupInterval();
    this.stopPingInterval();

    // Notify all connected clients
    if (this.io) {
      this.io.emit('server:shutdown', {
        message: 'Server is shutting down. Please reconnect in a moment.',
        timestamp: new Date()
      });

      // Give clients time to receive the message
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Disconnect all clients
      const sockets = await this.io.fetchSockets();
      sockets.forEach(socket => {
        try {
          socket.disconnect(true);
        } catch (error) {
          log.error('Error disconnecting socket:', error.message);
        }
      });

      // Close the server
      this.io.close();
    }

    // Clear all maps
    this.userSockets.clear();
    this.messageBuffer.clear();
    this.userMessageBuffer.clear();
    this.connectionErrors.clear();

    log.info('✅ WebSocket service shut down gracefully');
  }

  /**
   * Health check
   * Returns true if WebSocket service is healthy
   */
  isHealthy() {
    return this.io !== null && this.stats.activeConnections >= 0;
  }
}

module.exports = new WebSocketService();
