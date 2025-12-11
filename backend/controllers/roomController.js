const Room = require('../models/Room');
const { asyncHandler } = require('../middleware/errorHandler');
const websocketService = require('../services/websocketService');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Private
exports.getRooms = asyncHandler(async (req, res) => {
  const { department, type, status, displayBoard } = req.query;

  const query = { isActive: true };
  if (department) query.department = department;
  if (type) query.type = type;
  if (status) query.status = status;
  if (displayBoard === 'true') query['displaySettings.showOnDisplayBoard'] = true;

  const rooms = await Room.find(query)
    .populate('currentPatient', 'firstName lastName patientId')
    .populate('currentProvider', 'firstName lastName')
    .populate('currentAppointment', 'queueNumber status')
    .populate('assignedProviders', 'firstName lastName')
    .sort('displaySettings.displayOrder roomNumber');

  res.status(200).json({
    success: true,
    count: rooms.length,
    data: rooms
  });
});

// @desc    Get available rooms
// @route   GET /api/rooms/available
// @access  Private
exports.getAvailableRooms = asyncHandler(async (req, res) => {
  const { department, type } = req.query;

  const rooms = await Room.getAvailableRooms(department, type);

  res.status(200).json({
    success: true,
    count: rooms.length,
    data: rooms
  });
});

// @desc    Get room by ID
// @route   GET /api/rooms/:id
// @access  Private
exports.getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate('currentPatient', 'firstName lastName patientId dateOfBirth')
    .populate('currentProvider', 'firstName lastName')
    .populate('currentAppointment')
    .populate('assignedProviders', 'firstName lastName role');

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  res.status(200).json({
    success: true,
    data: room
  });
});

// @desc    Create room
// @route   POST /api/rooms
// @access  Private (Admin)
exports.createRoom = asyncHandler(async (req, res) => {
  const room = await Room.create(req.body);

  // Emit room update via WebSocket
  websocketService.emitQueueUpdate({ type: 'room_created', room });

  res.status(201).json({
    success: true,
    data: room
  });
});

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private (Admin)
exports.updateRoom = asyncHandler(async (req, res) => {
  let room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  room = await Room.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  // Emit room update via WebSocket
  websocketService.emitQueueUpdate({ type: 'room_updated', room });

  res.status(200).json({
    success: true,
    data: room
  });
});

// @desc    Update room status
// @route   PUT /api/rooms/:id/status
// @access  Private
exports.updateRoomStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  const oldStatus = room.status;
  room.status = status;

  // If changing to available, clear occupancy
  if (status === 'available') {
    await room.release();
  } else {
    await room.save();
  }

  // Emit room status change via WebSocket
  websocketService.emitQueueUpdate({
    type: 'room_status_changed',
    roomId: room._id,
    roomNumber: room.roomNumber,
    oldStatus,
    newStatus: status
  });

  res.status(200).json({
    success: true,
    data: room
  });
});

// @desc    Occupy room
// @route   POST /api/rooms/:id/occupy
// @access  Private
exports.occupyRoom = asyncHandler(async (req, res) => {
  const { patientId, appointmentId, providerId } = req.body;

  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  if (!room.isAvailable()) {
    return res.status(400).json({
      success: false,
      error: 'Room is not available'
    });
  }

  await room.occupy(patientId, appointmentId, providerId || req.user.id);

  // Populate for response
  await room.populate([
    { path: 'currentPatient', select: 'firstName lastName patientId' },
    { path: 'currentProvider', select: 'firstName lastName' }
  ]);

  // Emit room occupied via WebSocket
  websocketService.emitQueueUpdate({
    type: 'room_occupied',
    room: {
      _id: room._id,
      roomNumber: room.roomNumber,
      name: room.name,
      currentPatient: room.currentPatient,
      currentProvider: room.currentProvider
    }
  });

  res.status(200).json({
    success: true,
    data: room
  });
});

// @desc    Release room
// @route   POST /api/rooms/:id/release
// @access  Private
exports.releaseRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  const previousPatient = room.currentPatient;
  await room.release();

  // Emit room released via WebSocket
  websocketService.emitQueueUpdate({
    type: 'room_released',
    roomId: room._id,
    roomNumber: room.roomNumber,
    previousPatient
  });

  res.status(200).json({
    success: true,
    message: 'Room released successfully',
    data: room
  });
});

// @desc    Get display board data
// @route   GET /api/rooms/display-board
// @access  Public (for display screens)
exports.getDisplayBoardData = asyncHandler(async (req, res) => {
  const { department } = req.query;

  const rooms = await Room.getDisplayBoardData(department);

  // Format for display board
  const displayData = rooms.map(room => ({
    roomNumber: room.roomNumber,
    name: room.name,
    status: room.status,
    color: room.displaySettings.displayColor,
    queueNumber: room.currentAppointment?.queueNumber || null,
    patientName: room.currentPatient
      ? `${room.currentPatient.firstName} ${room.currentPatient.lastName}`
      : null,
    providerName: room.currentProvider
      ? `Dr. ${room.currentProvider.firstName} ${room.currentProvider.lastName}`
      : null
  }));

  res.status(200).json({
    success: true,
    data: displayData,
    timestamp: new Date()
  });
});

// @desc    Get room statistics
// @route   GET /api/rooms/stats
// @access  Private
exports.getRoomStats = asyncHandler(async (req, res) => {
  const { department } = req.query;

  const query = { isActive: true };
  if (department) query.department = department;

  const rooms = await Room.find(query);

  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    byDepartment: {},
    byType: {},
    averageConsultationTime: 0
  };

  // Group by department
  rooms.forEach(room => {
    const dept = room.department || 'general';
    if (!stats.byDepartment[dept]) {
      stats.byDepartment[dept] = { total: 0, available: 0, occupied: 0 };
    }
    stats.byDepartment[dept].total++;
    if (room.status === 'available') stats.byDepartment[dept].available++;
    if (room.status === 'occupied') stats.byDepartment[dept].occupied++;

    // Group by type
    const type = room.type;
    if (!stats.byType[type]) {
      stats.byType[type] = { total: 0, available: 0, occupied: 0 };
    }
    stats.byType[type].total++;
    if (room.status === 'available') stats.byType[type].available++;
    if (room.status === 'occupied') stats.byType[type].occupied++;
  });

  // Calculate average consultation time
  const roomsWithStats = rooms.filter(r => r.stats?.averageConsultationTime > 0);
  if (roomsWithStats.length > 0) {
    stats.averageConsultationTime = Math.round(
      roomsWithStats.reduce((sum, r) => sum + r.stats.averageConsultationTime, 0) / roomsWithStats.length
    );
  }

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private (Admin)
exports.deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: 'Room not found'
    });
  }

  // Soft delete - just mark as inactive
  room.isActive = false;
  await room.save();

  res.status(200).json({
    success: true,
    message: 'Room deactivated successfully'
  });
});

// @desc    Seed default rooms
// @route   POST /api/rooms/seed
// @access  Private (Admin)
exports.seedDefaultRooms = asyncHandler(async (req, res) => {
  const existingRooms = await Room.countDocuments();

  if (existingRooms > 0) {
    return res.status(400).json({
      success: false,
      error: 'Rooms already exist. Use force=true to override.'
    });
  }

  const defaultRooms = [
    { roomNumber: 'C01', name: 'Consultation 1', type: 'consultation', department: 'general', floor: 0 },
    { roomNumber: 'C02', name: 'Consultation 2', type: 'consultation', department: 'general', floor: 0 },
    { roomNumber: 'C03', name: 'Consultation 3', type: 'consultation', department: 'general', floor: 0 },
    { roomNumber: 'OPH01', name: 'Ophtalmologie 1', type: 'ophthalmology', department: 'ophthalmology', floor: 1, features: ['slit_lamp', 'tonometer'] },
    { roomNumber: 'OPH02', name: 'Ophtalmologie 2', type: 'ophthalmology', department: 'ophthalmology', floor: 1, features: ['slit_lamp', 'autorefractor'] },
    { roomNumber: 'OPH03', name: 'Réfraction', type: 'ophthalmology', department: 'ophthalmology', floor: 1, features: ['autorefractor', 'exam_chair'] },
    { roomNumber: 'ORTH01', name: 'Orthoptie', type: 'orthoptic', department: 'ophthalmology', floor: 1 },
    { roomNumber: 'PROC01', name: 'Procédures', type: 'procedure', department: 'ophthalmology', floor: 1 },
    { roomNumber: 'LAB01', name: 'Laboratoire', type: 'laboratory', department: 'laboratory', floor: 0 },
    { roomNumber: 'IMG01', name: 'Imagerie OCT', type: 'imaging', department: 'ophthalmology', floor: 1, features: ['oct'] },
    { roomNumber: 'URG01', name: 'Urgences', type: 'emergency', department: 'emergency', floor: 0 },
    { roomNumber: 'REC01', name: 'Réception', type: 'reception', department: 'general', floor: 0, displaySettings: { showOnDisplayBoard: false } }
  ];

  const rooms = await Room.insertMany(defaultRooms);

  res.status(201).json({
    success: true,
    message: `Created ${rooms.length} default rooms`,
    data: rooms
  });
});
