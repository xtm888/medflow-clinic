const CalendarIntegration = require('../models/CalendarIntegration');
const calendarService = require('../services/calendarIntegrationService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Get user's calendar integrations
 * @route   GET /api/calendar/integrations
 * @access  Private
 */
exports.getIntegrations = asyncHandler(async (req, res) => {
  const integrations = await calendarService.getUserIntegrations(req.user.id);

  res.status(200).json({
    success: true,
    data: integrations
  });
});

/**
 * @desc    Get Google OAuth URL
 * @route   GET /api/calendar/google/auth
 * @access  Private
 */
exports.getGoogleAuthUrl = asyncHandler(async (req, res) => {
  const authUrl = calendarService.getGoogleAuthUrl(req.user.id);

  res.status(200).json({
    success: true,
    data: { authUrl }
  });
});

/**
 * @desc    Handle Google OAuth callback
 * @route   GET /api/calendar/google/callback
 * @access  Public (OAuth redirect)
 */
exports.googleCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    // Redirect to frontend with error
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=missing_params`);
  }

  try {
    await calendarService.handleGoogleCallback(code, state);
    res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?connected=google`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * @desc    Get Microsoft OAuth URL
 * @route   GET /api/calendar/outlook/auth
 * @access  Private
 */
exports.getMicrosoftAuthUrl = asyncHandler(async (req, res) => {
  const authUrl = calendarService.getMicrosoftAuthUrl(req.user.id);

  res.status(200).json({
    success: true,
    data: { authUrl }
  });
});

/**
 * @desc    Handle Microsoft OAuth callback
 * @route   GET /api/calendar/outlook/callback
 * @access  Public (OAuth redirect)
 */
exports.microsoftCallback = asyncHandler(async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=missing_params`);
  }

  try {
    await calendarService.handleMicrosoftCallback(code, state);
    res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?connected=outlook`);
  } catch (err) {
    console.error('Microsoft callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * @desc    Disconnect calendar integration
 * @route   DELETE /api/calendar/integrations/:provider
 * @access  Private
 */
exports.disconnectIntegration = asyncHandler(async (req, res) => {
  const { provider } = req.params;

  if (!['google', 'outlook', 'apple'].includes(provider)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid provider'
    });
  }

  const result = await calendarService.disconnect(req.user.id, provider);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Update calendar sync settings
 * @route   PUT /api/calendar/integrations/:provider/settings
 * @access  Private
 */
exports.updateSyncSettings = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { syncSettings, defaultCalendarId, calendars } = req.body;

  const integration = await CalendarIntegration.findOne({
    user: req.user.id,
    provider
  });

  if (!integration) {
    return res.status(404).json({
      success: false,
      error: 'Integration not found'
    });
  }

  if (syncSettings) {
    integration.syncSettings = {
      ...integration.syncSettings,
      ...syncSettings
    };
  }

  if (defaultCalendarId) {
    integration.defaultCalendarId = defaultCalendarId;
  }

  if (calendars) {
    // Update syncEnabled status for calendars
    integration.calendars = integration.calendars.map(cal => {
      const update = calendars.find(c => c.calendarId === cal.calendarId);
      if (update) {
        return { ...cal, ...update };
      }
      return cal;
    });
  }

  await integration.save();

  res.status(200).json({
    success: true,
    data: {
      syncSettings: integration.syncSettings,
      defaultCalendarId: integration.defaultCalendarId,
      calendars: integration.calendars
    }
  });
});

/**
 * @desc    Trigger manual sync
 * @route   POST /api/calendar/sync
 * @access  Private
 */
exports.triggerSync = asyncHandler(async (req, res) => {
  const results = await calendarService.fullSync(req.user.id);

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Sync single appointment
 * @route   POST /api/calendar/sync/:appointmentId
 * @access  Private
 */
exports.syncAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const Appointment = require('../models/Appointment');

  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName patientId');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  // Sync to provider's calendar (the doctor)
  const results = await calendarService.syncAppointment(
    appointment.provider,
    appointment,
    'upsert'
  );

  res.status(200).json({
    success: true,
    data: results
  });
});

/**
 * @desc    Get sync status for an appointment
 * @route   GET /api/calendar/status/:appointmentId
 * @access  Private
 */
exports.getAppointmentSyncStatus = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const integrations = await CalendarIntegration.find({
    user: req.user.id,
    status: 'active'
  });

  const statuses = integrations.map(integration => {
    const mapping = integration.getEventMapping(appointmentId);
    return {
      provider: integration.provider,
      synced: !!mapping,
      lastSyncAt: mapping?.lastSyncAt,
      syncStatus: mapping?.syncStatus,
      externalEventId: mapping?.externalEventId
    };
  });

  res.status(200).json({
    success: true,
    data: statuses
  });
});

/**
 * @desc    Get available calendars from connected accounts
 * @route   GET /api/calendar/calendars
 * @access  Private
 */
exports.getCalendars = asyncHandler(async (req, res) => {
  const integrations = await CalendarIntegration.find({
    user: req.user.id,
    status: 'active'
  });

  const calendars = integrations.map(integration => ({
    provider: integration.provider,
    email: integration.providerAccountEmail,
    calendars: integration.calendars,
    defaultCalendarId: integration.defaultCalendarId
  }));

  res.status(200).json({
    success: true,
    data: calendars
  });
});

/**
 * @desc    Refresh calendar list from provider
 * @route   POST /api/calendar/integrations/:provider/refresh-calendars
 * @access  Private
 */
exports.refreshCalendarList = asyncHandler(async (req, res) => {
  const { provider } = req.params;

  const integration = await CalendarIntegration.findOne({
    user: req.user.id,
    provider
  });

  if (!integration) {
    return res.status(404).json({
      success: false,
      error: 'Integration not found'
    });
  }

  try {
    let calendars;

    if (provider === 'google') {
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: integration.getAccessToken(),
        refresh_token: integration.getRefreshToken()
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();

      calendars = calendarList.data.items.map(cal => ({
        calendarId: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        syncEnabled: integration.calendars.find(c => c.calendarId === cal.id)?.syncEnabled || false,
        color: cal.backgroundColor
      }));
    } else if (provider === 'outlook') {
      const { Client } = require('@microsoft/microsoft-graph-client');
      const client = Client.init({
        authProvider: (done) => done(null, integration.getAccessToken())
      });

      const calendarsResponse = await client.api('/me/calendars').get();

      calendars = calendarsResponse.value.map(cal => ({
        calendarId: cal.id,
        name: cal.name,
        primary: cal.isDefaultCalendar || false,
        syncEnabled: integration.calendars.find(c => c.calendarId === cal.id)?.syncEnabled || false,
        color: cal.hexColor
      }));
    }

    integration.calendars = calendars;
    await integration.save();

    res.status(200).json({
      success: true,
      data: calendars
    });
  } catch (error) {
    console.error('Refresh calendars error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh calendar list'
    });
  }
});

// ===========================
// iCAL EXPORT ENDPOINTS
// ===========================

/**
 * @desc    Export single appointment to .ics file
 * @route   GET /api/calendar/ical/appointment/:appointmentId
 * @access  Private
 */
exports.exportAppointmentToICal = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const { includePatientNames = 'true' } = req.query;
  const Appointment = require('../models/Appointment');

  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName patientId email phoneNumber')
    .populate('provider', 'firstName lastName email specialization');

  if (!appointment) {
    return res.status(404).json({
      success: false,
      error: 'Appointment not found'
    });
  }

  // Check if user has access to this appointment
  const hasAccess =
    appointment.provider?._id?.toString() === req.user.id ||
    appointment.patient?._id?.toString() === req.user.id ||
    req.user.role === 'admin';

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  const icalContent = calendarService.generateICalForAppointment(appointment, {
    includePatientNames: includePatientNames === 'true',
    clinicName: 'MedFlow Clinic'
  });

  // Set headers for .ics file download
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointmentId}.ics"`);

  res.send(icalContent);
});

/**
 * @desc    Export multiple appointments to .ics file
 * @route   GET /api/calendar/ical/export
 * @access  Private
 */
exports.exportAppointmentsToICal = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    includePast = 'false',
    includePatientNames = 'true',
    patientId
  } = req.query;

  let icalContent;

  if (patientId) {
    // Export patient's appointments
    icalContent = await calendarService.exportPatientAppointmentsToICal(patientId, {
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      includePast: includePast === 'true',
      clinicName: 'Mes Rendez-vous MedFlow'
    });
  } else {
    // Export provider's appointments
    icalContent = await calendarService.exportUserAppointmentsToICal(req.user.id, {
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      includePast: includePast === 'true',
      includePatientNames: includePatientNames === 'true',
      clinicName: 'MedFlow Clinic'
    });
  }

  // Set headers for .ics file download
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="appointments.ics"');

  res.send(icalContent);
});

/**
 * @desc    Get or generate iCal subscription URL
 * @route   GET /api/calendar/ical/subscription
 * @access  Private
 */
exports.getICalSubscription = asyncHandler(async (req, res) => {
  const { regenerate = 'false' } = req.query;

  // Check for existing subscription
  const integration = await CalendarIntegration.findOne({
    user: req.user.id,
    provider: 'ical'
  });

  if (integration && regenerate !== 'true') {
    // Return existing subscription URL
    const token = integration.getAccessToken();
    return res.status(200).json({
      success: true,
      data: {
        subscriptionUrl: `${process.env.APP_URL || 'https://app.medflow.health'}/api/calendar/ical/${token}/feed.ics`,
        createdAt: integration.connectedAt,
        settings: integration.syncSettings
      }
    });
  }

  // Generate new subscription
  const subscription = await calendarService.generateICalSubscriptionToken(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      subscriptionUrl: subscription.subscriptionUrl,
      message: 'iCal subscription URL generated. Add this URL to your calendar app (Google Calendar, Apple Calendar, Outlook) to subscribe.'
    }
  });
});

/**
 * @desc    Get iCal feed (public endpoint with token auth)
 * @route   GET /api/calendar/ical/:token/feed.ics
 * @access  Public (token-based auth)
 */
exports.getICalFeed = asyncHandler(async (req, res) => {
  const { token } = req.params;

  try {
    const icalContent = await calendarService.getICalFeed(token);

    // Set headers for iCal feed
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.send(icalContent);
  } catch (error) {
    console.error('iCal feed error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired subscription'
    });
  }
});
