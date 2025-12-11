const IVTVial = require('../models/IVTVial');

// Get all vials with filtering
exports.getVials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      medication,
      status,
      clinic
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    } else if (clinic) {
      query.clinic = clinic;
    }

    if (medication && medication !== 'all') {
      query.medication = medication;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const [vials, total] = await Promise.all([
      IVTVial.find(query)
        .populate('openedBy', 'firstName lastName')
        .populate('clinic', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      IVTVial.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: vials,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching vials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single vial
exports.getVial = async (req, res) => {
  try {
    const vial = await IVTVial.findById(req.params.id)
      .populate('openedBy', 'firstName lastName')
      .populate('clinic', 'name')
      .populate('usage.patient', 'firstName lastName')
      .populate('usage.administeredBy', 'firstName lastName');

    if (!vial) {
      return res.status(404).json({ success: false, error: 'Vial not found' });
    }

    res.json({ success: true, data: vial });
  } catch (error) {
    console.error('Error fetching vial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new vial (receive from inventory)
exports.createVial = async (req, res) => {
  try {
    const vial = new IVTVial({
      ...req.body,
      clinic: req.clinicId || req.body.clinic,
      receivedBy: req.user._id
    });

    await vial.save();

    res.status(201).json({ success: true, data: vial });
  } catch (error) {
    console.error('Error creating vial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Open vial
exports.openVial = async (req, res) => {
  try {
    const vial = await IVTVial.findById(req.params.id);

    if (!vial) {
      return res.status(404).json({ success: false, error: 'Vial not found' });
    }

    await vial.openVial(req.user._id);

    res.json({ success: true, data: vial });
  } catch (error) {
    console.error('Error opening vial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Record dose
exports.recordDose = async (req, res) => {
  try {
    const vial = await IVTVial.findById(req.params.id);

    if (!vial) {
      return res.status(404).json({ success: false, error: 'Vial not found' });
    }

    const { patientId, ivtInjectionId, doseVolume, eye, administeredBy } = req.body;

    await vial.recordDose(
      patientId,
      ivtInjectionId,
      doseVolume,
      eye,
      administeredBy || req.user._id
    );

    res.json({ success: true, data: vial });
  } catch (error) {
    console.error('Error recording dose:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Record temperature
exports.recordTemperature = async (req, res) => {
  try {
    const vial = await IVTVial.findById(req.params.id);

    if (!vial) {
      return res.status(404).json({ success: false, error: 'Vial not found' });
    }

    const { temperature, location, recordedBy, notes } = req.body;

    await vial.recordTemperature(
      temperature,
      location,
      recordedBy || req.user._id,
      notes
    );

    res.json({ success: true, data: vial });
  } catch (error) {
    console.error('Error recording temperature:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Dispose vial
exports.disposeVial = async (req, res) => {
  try {
    const vial = await IVTVial.findById(req.params.id);

    if (!vial) {
      return res.status(404).json({ success: false, error: 'Vial not found' });
    }

    const { reason, disposedBy, witnessedBy, notes } = req.body;

    await vial.dispose(
      reason,
      disposedBy || req.user._id,
      witnessedBy,
      notes
    );

    res.json({ success: true, data: vial });
  } catch (error) {
    console.error('Error disposing vial:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get usable vials for a medication
exports.getUsableVials = async (req, res) => {
  try {
    const { medication } = req.params;
    const query = {
      medication,
      status: 'open'
    };

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const vials = await IVTVial.find(query)
      .sort({ openedAt: 1 })
      .lean();

    // Filter to only return truly usable vials
    const usableVials = vials.filter(vial => {
      const now = new Date();
      const beyondUseDate = new Date(vial.beyondUseDate);
      return beyondUseDate > now && vial.currentVolume > 0;
    });

    res.json({ success: true, data: usableVials });
  } catch (error) {
    console.error('Error fetching usable vials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get expiring vials
exports.getExpiringVials = async (req, res) => {
  try {
    const { hoursAhead = 4 } = req.query;
    const query = { status: 'open' };

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() + parseInt(hoursAhead));

    query.beyondUseDate = { $lte: cutoffTime };

    const expiringVials = await IVTVial.find(query)
      .populate('clinic', 'name')
      .sort({ beyondUseDate: 1 })
      .lean();

    res.json({ success: true, data: expiringVials });
  } catch (error) {
    console.error('Error fetching expiring vials:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get temperature excursions
exports.getTemperatureExcursions = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    if (startDate || endDate) {
      query['temperatureLogs.recordedAt'] = {};
      if (startDate) query['temperatureLogs.recordedAt'].$gte = new Date(startDate);
      if (endDate) query['temperatureLogs.recordedAt'].$lte = new Date(endDate);
    }

    const vialsWithExcursions = await IVTVial.find({
      ...query,
      'temperatureLogs.inRange': false
    })
    .populate('clinic', 'name')
    .lean();

    const excursions = [];
    vialsWithExcursions.forEach(vial => {
      const outOfRangeLogs = vial.temperatureLogs.filter(log => !log.inRange);
      outOfRangeLogs.forEach(log => {
        excursions.push({
          vialId: vial._id,
          vialNumber: vial.vialNumber,
          medication: vial.medication,
          clinic: vial.clinic,
          temperature: log.temperature,
          recordedAt: log.recordedAt,
          location: log.location
        });
      });
    });

    res.json({ success: true, data: excursions });
  } catch (error) {
    console.error('Error fetching temperature excursions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get statistics
exports.getStats = async (req, res) => {
  try {
    const query = {};
    if (req.clinicId) {
      query.clinic = req.clinicId;
    }

    const [
      totalVials,
      unopenedVials,
      openVials,
      disposedToday,
      temperatureExcursions
    ] = await Promise.all([
      IVTVial.countDocuments(query),
      IVTVial.countDocuments({ ...query, status: 'unopened' }),
      IVTVial.countDocuments({ ...query, status: 'open' }),
      IVTVial.countDocuments({
        ...query,
        status: 'disposed',
        'disposal.disposedAt': { $gte: new Date().setHours(0, 0, 0, 0) }
      }),
      IVTVial.countDocuments({
        ...query,
        'temperatureLogs.inRange': false
      })
    ]);

    // Get medication breakdown
    const medicationBreakdown = await IVTVial.aggregate([
      { $match: { ...query, status: { $in: ['unopened', 'open'] } } },
      { $group: { _id: '$medication', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalVials,
        unopenedVials,
        openVials,
        disposedToday,
        temperatureExcursions,
        medicationBreakdown: medicationBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
