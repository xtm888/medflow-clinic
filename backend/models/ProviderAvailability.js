const mongoose = require('mongoose');

const providerAvailabilitySchema = new mongoose.Schema({
  // Multi-Clinic: Which clinic this availability schedule applies to
  // A provider can have different schedules at different clinics
  clinic: {
    type: mongoose.Schema.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },

  // Provider reference
  provider: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },

  // Regular working hours (per day of week)
  regularSchedule: [{
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6 // 0 = Sunday, 6 = Saturday
    },
    isWorkingDay: {
      type: Boolean,
      default: true
    },
    shifts: [{
      startTime: {
        type: String,
        required: true,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      },
      endTime: {
        type: String,
        required: true,
        match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      }
    }],
    breaks: [{
      startTime: String,
      endTime: String,
      name: String // e.g., 'Lunch', 'Prayer'
    }]
  }],

  // Default appointment duration in minutes
  defaultAppointmentDuration: {
    type: Number,
    default: 30
  },

  // Buffer time between appointments (minutes)
  bufferTime: {
    type: Number,
    default: 0
  },

  // Maximum appointments per day
  maxAppointmentsPerDay: {
    type: Number,
    default: 20
  },

  // Appointment types this provider handles
  appointmentTypes: [{
    type: String,
    enum: [
      'consultation',
      'follow-up',
      'emergency',
      'routine-checkup',
      'vaccination',
      'lab-test',
      'imaging',
      'procedure',
      'surgery',
      'ophthalmology',
      'refraction',
      'telemedicine'
    ]
  }],

  // Custom durations per appointment type
  customDurations: [{
    appointmentType: String,
    duration: Number
  }],

  // Location/Room assignments
  locations: [{
    room: String,
    floor: String,
    building: String,
    isDefault: Boolean
  }],

  // Date-specific overrides (vacations, special hours)
  overrides: [{
    date: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['day-off', 'modified-hours', 'extra-hours'],
      required: true
    },
    reason: String,
    shifts: [{
      startTime: String,
      endTime: String
    }]
  }],

  // Recurring time-off (e.g., every Friday afternoon off)
  recurringTimeOff: [{
    dayOfWeek: Number,
    startTime: String,
    endTime: String,
    reason: String
  }],

  // Effective dates
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: Date,

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
// MULTI-CLINIC: Compound unique index - provider can have one schedule per clinic
providerAvailabilitySchema.index({ clinic: 1, provider: 1 }, { unique: true });
providerAvailabilitySchema.index({ clinic: 1, isActive: 1 });
// Index for looking up all schedules for a provider across clinics
providerAvailabilitySchema.index({ provider: 1 });

// Get working hours for a specific date
providerAvailabilitySchema.methods.getWorkingHoursForDate = function(date) {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  // Check for date-specific override first
  const override = this.overrides.find(o => {
    const overrideDate = new Date(o.date);
    return overrideDate.toDateString() === targetDate.toDateString();
  });

  if (override) {
    if (override.type === 'day-off') {
      return { isWorkingDay: false, shifts: [], breaks: [] };
    }
    return {
      isWorkingDay: true,
      shifts: override.shifts || [],
      breaks: []
    };
  }

  // Get regular schedule for this day
  const regularDay = this.regularSchedule.find(s => s.dayOfWeek === dayOfWeek);

  if (!regularDay || !regularDay.isWorkingDay) {
    return { isWorkingDay: false, shifts: [], breaks: [] };
  }

  // Apply recurring time-off
  const breaks = [...(regularDay.breaks || [])];
  const recurringOff = this.recurringTimeOff.filter(r => r.dayOfWeek === dayOfWeek);
  recurringOff.forEach(r => {
    breaks.push({
      startTime: r.startTime,
      endTime: r.endTime,
      name: r.reason
    });
  });

  return {
    isWorkingDay: true,
    shifts: regularDay.shifts,
    breaks
  };
};

// Check if provider is available at a specific time
providerAvailabilitySchema.methods.isAvailableAt = function(date, startTime, endTime) {
  const workingHours = this.getWorkingHoursForDate(date);

  if (!workingHours.isWorkingDay) {
    return false;
  }

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // Check if time falls within any shift
  const withinShift = workingHours.shifts.some(shift => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return startMin >= shiftStart && endMin <= shiftEnd;
  });

  if (!withinShift) return false;

  // Check if time overlaps with any break
  const overlapsBreak = workingHours.breaks.some(brk => {
    const breakStart = timeToMinutes(brk.startTime);
    const breakEnd = timeToMinutes(brk.endTime);
    return startMin < breakEnd && endMin > breakStart;
  });

  return !overlapsBreak;
};

// Get appointment duration for a type
providerAvailabilitySchema.methods.getDurationForType = function(appointmentType) {
  const customDuration = this.customDurations.find(cd => cd.appointmentType === appointmentType);
  return customDuration ? customDuration.duration : this.defaultAppointmentDuration;
};

// Static method to get or create default availability for a provider at a specific clinic
providerAvailabilitySchema.statics.getOrCreateDefault = async function(providerId, clinicId) {
  if (!clinicId) {
    throw new Error('clinicId is required for provider availability');
  }

  let availability = await this.findOne({ provider: providerId, clinic: clinicId });

  if (!availability) {
    // Create default Monday-Friday 9-5 schedule
    const defaultSchedule = [];
    for (let day = 0; day <= 6; day++) {
      defaultSchedule.push({
        dayOfWeek: day,
        isWorkingDay: day >= 1 && day <= 5, // Mon-Fri
        shifts: day >= 1 && day <= 5 ? [
          { startTime: '09:00', endTime: '17:00' }
        ] : [],
        breaks: day >= 1 && day <= 5 ? [
          { startTime: '12:00', endTime: '13:00', name: 'Lunch' }
        ] : []
      });
    }

    availability = await this.create({
      clinic: clinicId,
      provider: providerId,
      regularSchedule: defaultSchedule,
      defaultAppointmentDuration: 30,
      appointmentTypes: ['consultation', 'follow-up', 'routine-checkup']
    });
  }

  return availability;
};

// Static method to get all availability schedules for a provider across clinics
providerAvailabilitySchema.statics.getAllForProvider = async function(providerId) {
  return this.find({ provider: providerId, isActive: true })
    .populate('clinic', 'clinicId name shortName')
    .sort({ 'clinic.name': 1 });
};

// Static method to get all providers available at a clinic
providerAvailabilitySchema.statics.getProvidersAtClinic = async function(clinicId) {
  return this.find({ clinic: clinicId, isActive: true })
    .populate('provider', 'firstName lastName role specialty')
    .sort({ 'provider.lastName': 1 });
};

// Helper function
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

module.exports = mongoose.model('ProviderAvailability', providerAvailabilitySchema);
