const { google } = require('googleapis');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const CalendarIntegration = require('../models/CalendarIntegration');
const Appointment = require('../models/Appointment');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('CalendarIntegration');

/**
 * Calendar Integration Service
 * Handles OAuth and sync for Google Calendar and Microsoft Outlook
 */
class CalendarIntegrationService {
  constructor() {
    // Google OAuth2 Client
    this.googleOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/calendar/google/callback`
    );

    // Microsoft OAuth config
    this.microsoftConfig = {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || `${process.env.APP_URL}/api/calendar/outlook/callback`,
      scopes: ['Calendars.ReadWrite', 'offline_access', 'User.Read']
    };
  }

  // ===========================
  // GOOGLE CALENDAR
  // ===========================

  /**
   * Get Google OAuth URL for authorization
   */
  getGoogleAuthUrl(userId, state = null) {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || userId,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange Google auth code for tokens
   */
  async handleGoogleCallback(code, userId) {
    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);
      this.googleOAuth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({ version: 'v2', auth: this.googleOAuth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Get calendar list
      const calendar = google.calendar({ version: 'v3', auth: this.googleOAuth2Client });
      const calendarList = await calendar.calendarList.list();

      const calendars = calendarList.data.items.map(cal => ({
        calendarId: cal.id,
        name: cal.summary,
        primary: cal.primary || false,
        syncEnabled: cal.primary || false,
        color: cal.backgroundColor
      }));

      // Find or create integration
      let integration = await CalendarIntegration.findOne({
        user: userId,
        provider: 'google'
      });

      if (integration) {
        integration.accessToken = tokens.access_token;
        integration.refreshToken = tokens.refresh_token || integration.refreshToken;
        integration.tokenExpiresAt = new Date(tokens.expiry_date);
        integration.scope = tokens.scope;
        integration.calendars = calendars;
        integration.providerAccountEmail = userInfo.data.email;
        integration.status = 'active';
      } else {
        integration = new CalendarIntegration({
          user: userId,
          provider: 'google',
          providerAccountId: userInfo.data.id,
          providerAccountEmail: userInfo.data.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(tokens.expiry_date),
          scope: tokens.scope,
          calendars,
          defaultCalendarId: calendars.find(c => c.primary)?.calendarId
        });
      }

      await integration.save();
      return integration;
    } catch (error) {
      log.error('Google OAuth callback error:', { error: error });
      throw new Error(`Failed to connect Google Calendar: ${error.message}`);
    }
  }

  /**
   * Refresh Google access token
   */
  async refreshGoogleToken(integration) {
    try {
      this.googleOAuth2Client.setCredentials({
        refresh_token: integration.getRefreshToken()
      });

      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();

      await integration.updateTokens(
        credentials.access_token,
        credentials.refresh_token,
        Math.floor((credentials.expiry_date - Date.now()) / 1000)
      );

      return integration;
    } catch (error) {
      log.error('Google token refresh error:', { error: error });
      integration.status = 'expired';
      await integration.save();
      throw new Error('Google token refresh failed');
    }
  }

  /**
   * Get authenticated Google Calendar client
   */
  async getGoogleCalendarClient(integration) {
    if (integration.isTokenExpired()) {
      await this.refreshGoogleToken(integration);
    }

    this.googleOAuth2Client.setCredentials({
      access_token: integration.getAccessToken(),
      refresh_token: integration.getRefreshToken()
    });

    return google.calendar({ version: 'v3', auth: this.googleOAuth2Client });
  }

  /**
   * Create event in Google Calendar
   */
  async createGoogleEvent(integration, appointment) {
    try {
      const calendar = await this.getGoogleCalendarClient(integration);
      const calendarId = integration.defaultCalendarId || 'primary';

      const event = this.appointmentToGoogleEvent(appointment, integration.syncSettings);

      const response = await calendar.events.insert({
        calendarId,
        resource: event,
        sendNotifications: false
      });

      integration.upsertEventMapping(appointment._id, response.data.id, calendarId);
      await integration.save();

      return response.data;
    } catch (error) {
      log.error('Google create event error:', { error: error });
      throw error;
    }
  }

  /**
   * Update event in Google Calendar
   */
  async updateGoogleEvent(integration, appointment) {
    try {
      const calendar = await this.getGoogleCalendarClient(integration);
      const mapping = integration.getEventMapping(appointment._id);

      if (!mapping) {
        return this.createGoogleEvent(integration, appointment);
      }

      const event = this.appointmentToGoogleEvent(appointment, integration.syncSettings);

      const response = await calendar.events.update({
        calendarId: mapping.calendarId,
        eventId: mapping.externalEventId,
        resource: event
      });

      mapping.lastSyncAt = new Date();
      mapping.syncStatus = 'synced';
      await integration.save();

      return response.data;
    } catch (error) {
      if (error.code === 404) {
        // Event was deleted externally, recreate
        integration.removeEventMapping(appointment._id);
        return this.createGoogleEvent(integration, appointment);
      }
      log.error('Google update event error:', { error: error });
      throw error;
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteGoogleEvent(integration, appointmentId) {
    try {
      const calendar = await this.getGoogleCalendarClient(integration);
      const mapping = integration.getEventMapping(appointmentId);

      if (!mapping) return;

      await calendar.events.delete({
        calendarId: mapping.calendarId,
        eventId: mapping.externalEventId
      });

      integration.removeEventMapping(appointmentId);
      await integration.save();
    } catch (error) {
      if (error.code !== 404) {
        log.error('Google delete event error:', { error: error });
        throw error;
      }
      // Event already deleted, just remove mapping
      integration.removeEventMapping(appointmentId);
      await integration.save();
    }
  }

  /**
   * Convert appointment to Google Calendar event format
   */
  appointmentToGoogleEvent(appointment, settings = {}) {
    const patient = appointment.patient;
    const prefix = settings.eventPrefix || '[MedFlow]';

    let summary = `${prefix} `;
    if (settings.includePatientNames && patient) {
      summary += `${patient.firstName} ${patient.lastName}`;
    } else {
      summary += 'Rendez-vous médical';
    }

    let description = `Type: ${appointment.type || 'Consultation'}\n`;
    description += `Statut: ${appointment.status}\n`;

    if (settings.includeDetails) {
      if (appointment.reason) description += `Raison: ${appointment.reason}\n`;
      if (appointment.notes) description += `Notes: ${appointment.notes}\n`;
    }

    description += '\n---\nSynchronisé depuis MedFlow';

    const startTime = new Date(appointment.appointmentDate);
    const endTime = new Date(startTime.getTime() + (appointment.duration || 30) * 60000);

    return {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Africa/Kinshasa'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Africa/Kinshasa'
      },
      reminders: settings.syncReminders ? {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 }
        ]
      } : { useDefault: true },
      colorId: this.getGoogleColorId(appointment.type),
      extendedProperties: {
        private: {
          medflowId: appointment._id.toString(),
          medflowType: 'appointment'
        }
      }
    };
  }

  /**
   * Get Google Calendar color ID based on appointment type
   */
  getGoogleColorId(appointmentType) {
    const colorMap = {
      'consultation': '1', // Blue
      'follow-up': '2', // Green
      'emergency': '11', // Red
      'surgery': '4', // Pink
      'examination': '9', // Bold blue
      'vaccination': '10', // Green
      'lab': '5', // Yellow
      'imaging': '6' // Orange
    };
    return colorMap[appointmentType] || '1';
  }

  // ===========================
  // MICROSOFT OUTLOOK
  // ===========================

  /**
   * Get Microsoft OAuth URL for authorization
   */
  getMicrosoftAuthUrl(userId, state = null) {
    const scopes = this.microsoftConfig.scopes.join(' ');
    const params = new URLSearchParams({
      client_id: this.microsoftConfig.clientId,
      response_type: 'code',
      redirect_uri: this.microsoftConfig.redirectUri,
      scope: scopes,
      state: state || userId,
      prompt: 'consent'
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  /**
   * Exchange Microsoft auth code for tokens
   */
  async handleMicrosoftCallback(code, userId) {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

      const params = new URLSearchParams({
        client_id: this.microsoftConfig.clientId,
        client_secret: this.microsoftConfig.clientSecret,
        code,
        redirect_uri: this.microsoftConfig.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Token exchange failed');
      }

      const tokens = await response.json();

      // Get user profile
      const client = this.getMicrosoftGraphClient(tokens.access_token);
      const user = await client.api('/me').get();

      // Get calendars
      const calendarsResponse = await client.api('/me/calendars').get();

      const calendars = calendarsResponse.value.map(cal => ({
        calendarId: cal.id,
        name: cal.name,
        primary: cal.isDefaultCalendar || false,
        syncEnabled: cal.isDefaultCalendar || false,
        color: cal.hexColor
      }));

      // Find or create integration
      let integration = await CalendarIntegration.findOne({
        user: userId,
        provider: 'outlook'
      });

      if (integration) {
        integration.accessToken = tokens.access_token;
        integration.refreshToken = tokens.refresh_token || integration.refreshToken;
        integration.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        integration.scope = tokens.scope;
        integration.calendars = calendars;
        integration.providerAccountEmail = user.mail || user.userPrincipalName;
        integration.status = 'active';
      } else {
        integration = new CalendarIntegration({
          user: userId,
          provider: 'outlook',
          providerAccountId: user.id,
          providerAccountEmail: user.mail || user.userPrincipalName,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
          calendars,
          defaultCalendarId: calendars.find(c => c.primary)?.calendarId
        });
      }

      await integration.save();
      return integration;
    } catch (error) {
      log.error('Microsoft OAuth callback error:', { error: error });
      throw new Error(`Failed to connect Outlook Calendar: ${error.message}`);
    }
  }

  /**
   * Refresh Microsoft access token
   */
  async refreshMicrosoftToken(integration) {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

      const params = new URLSearchParams({
        client_id: this.microsoftConfig.clientId,
        client_secret: this.microsoftConfig.clientSecret,
        refresh_token: integration.getRefreshToken(),
        grant_type: 'refresh_token'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Token refresh failed');
      }

      const tokens = await response.json();

      await integration.updateTokens(
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in
      );

      return integration;
    } catch (error) {
      log.error('Microsoft token refresh error:', { error: error });
      integration.status = 'expired';
      await integration.save();
      throw new Error('Microsoft token refresh failed');
    }
  }

  /**
   * Get Microsoft Graph client
   */
  getMicrosoftGraphClient(accessToken) {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Get authenticated Microsoft Graph client
   */
  async getAuthenticatedMicrosoftClient(integration) {
    if (integration.isTokenExpired()) {
      await this.refreshMicrosoftToken(integration);
    }
    return this.getMicrosoftGraphClient(integration.getAccessToken());
  }

  /**
   * Create event in Outlook Calendar
   */
  async createOutlookEvent(integration, appointment) {
    try {
      const client = await this.getAuthenticatedMicrosoftClient(integration);
      const calendarId = integration.defaultCalendarId;

      const event = this.appointmentToOutlookEvent(appointment, integration.syncSettings);

      const endpoint = calendarId
        ? `/me/calendars/${calendarId}/events`
        : '/me/events';

      const response = await client.api(endpoint).post(event);

      integration.upsertEventMapping(appointment._id, response.id, calendarId || 'default');
      await integration.save();

      return response;
    } catch (error) {
      log.error('Outlook create event error:', { error: error });
      throw error;
    }
  }

  /**
   * Update event in Outlook Calendar
   */
  async updateOutlookEvent(integration, appointment) {
    try {
      const client = await this.getAuthenticatedMicrosoftClient(integration);
      const mapping = integration.getEventMapping(appointment._id);

      if (!mapping) {
        return this.createOutlookEvent(integration, appointment);
      }

      const event = this.appointmentToOutlookEvent(appointment, integration.syncSettings);

      const response = await client
        .api(`/me/events/${mapping.externalEventId}`)
        .patch(event);

      mapping.lastSyncAt = new Date();
      mapping.syncStatus = 'synced';
      await integration.save();

      return response;
    } catch (error) {
      if (error.statusCode === 404) {
        integration.removeEventMapping(appointment._id);
        return this.createOutlookEvent(integration, appointment);
      }
      log.error('Outlook update event error:', { error: error });
      throw error;
    }
  }

  /**
   * Delete event from Outlook Calendar
   */
  async deleteOutlookEvent(integration, appointmentId) {
    try {
      const client = await this.getAuthenticatedMicrosoftClient(integration);
      const mapping = integration.getEventMapping(appointmentId);

      if (!mapping) return;

      await client.api(`/me/events/${mapping.externalEventId}`).delete();

      integration.removeEventMapping(appointmentId);
      await integration.save();
    } catch (error) {
      if (error.statusCode !== 404) {
        log.error('Outlook delete event error:', { error: error });
        throw error;
      }
      integration.removeEventMapping(appointmentId);
      await integration.save();
    }
  }

  /**
   * Convert appointment to Outlook event format
   */
  appointmentToOutlookEvent(appointment, settings = {}) {
    const patient = appointment.patient;
    const prefix = settings.eventPrefix || '[MedFlow]';

    let subject = `${prefix} `;
    if (settings.includePatientNames && patient) {
      subject += `${patient.firstName} ${patient.lastName}`;
    } else {
      subject += 'Rendez-vous médical';
    }

    let body = `<p><strong>Type:</strong> ${appointment.type || 'Consultation'}</p>`;
    body += `<p><strong>Statut:</strong> ${appointment.status}</p>`;

    if (settings.includeDetails) {
      if (appointment.reason) body += `<p><strong>Raison:</strong> ${appointment.reason}</p>`;
      if (appointment.notes) body += `<p><strong>Notes:</strong> ${appointment.notes}</p>`;
    }

    body += '<hr><p><em>Synchronisé depuis MedFlow</em></p>';

    const startTime = new Date(appointment.appointmentDate);
    const endTime = new Date(startTime.getTime() + (appointment.duration || 30) * 60000);

    return {
      subject,
      body: {
        contentType: 'HTML',
        content: body
      },
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Africa/Kinshasa'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Africa/Kinshasa'
      },
      categories: [this.getOutlookCategory(appointment.type)],
      reminderMinutesBeforeStart: settings.syncReminders ? 30 : 0,
      isReminderOn: settings.syncReminders
    };
  }

  /**
   * Get Outlook category based on appointment type
   */
  getOutlookCategory(appointmentType) {
    const categoryMap = {
      'consultation': 'Blue category',
      'follow-up': 'Green category',
      'emergency': 'Red category',
      'surgery': 'Purple category',
      'examination': 'Blue category',
      'vaccination': 'Green category',
      'lab': 'Yellow category',
      'imaging': 'Orange category'
    };
    return categoryMap[appointmentType] || 'Blue category';
  }

  // ===========================
  // UNIFIED SYNC METHODS
  // ===========================

  /**
   * Sync appointment to external calendar
   */
  async syncAppointment(userId, appointment, action = 'upsert') {
    const integrations = await CalendarIntegration.find({
      user: userId,
      status: 'active',
      'syncSettings.enabled': true
    });

    const results = [];

    for (const integration of integrations) {
      try {
        let result;

        if (action === 'delete') {
          if (integration.provider === 'google') {
            await this.deleteGoogleEvent(integration, appointment._id);
          } else if (integration.provider === 'outlook') {
            await this.deleteOutlookEvent(integration, appointment._id);
          }
          result = { provider: integration.provider, action: 'deleted', success: true };
        } else {
          // Check if event exists
          const mapping = integration.getEventMapping(appointment._id);

          if (integration.provider === 'google') {
            result = mapping
              ? await this.updateGoogleEvent(integration, appointment)
              : await this.createGoogleEvent(integration, appointment);
          } else if (integration.provider === 'outlook') {
            result = mapping
              ? await this.updateOutlookEvent(integration, appointment)
              : await this.createOutlookEvent(integration, appointment);
          }

          result = {
            provider: integration.provider,
            action: mapping ? 'updated' : 'created',
            success: true,
            eventId: result?.id
          };
        }

        results.push(result);
      } catch (error) {
        results.push({
          provider: integration.provider,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Full sync for a user's appointments
   */
  async fullSync(userId) {
    const integrations = await CalendarIntegration.find({
      user: userId,
      status: 'active',
      'syncSettings.enabled': true
    });

    const results = [];

    for (const integration of integrations) {
      try {
        const syncPastDays = integration.syncSettings.syncPastDays || 7;
        const syncFutureDays = integration.syncSettings.syncFutureDays || 90;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - syncPastDays);

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + syncFutureDays);

        // Get appointments for this provider (doctor)
        const appointments = await Appointment.find({
          provider: userId,
          appointmentDate: { $gte: startDate, $lte: endDate },
          status: { $nin: ['cancelled', 'no-show'] }
        }).populate('patient', 'firstName lastName patientId');

        let created = 0, updated = 0, errors = 0;

        for (const appointment of appointments) {
          try {
            const mapping = integration.getEventMapping(appointment._id);

            if (integration.provider === 'google') {
              if (mapping) {
                await this.updateGoogleEvent(integration, appointment);
                updated++;
              } else {
                await this.createGoogleEvent(integration, appointment);
                created++;
              }
            } else if (integration.provider === 'outlook') {
              if (mapping) {
                await this.updateOutlookEvent(integration, appointment);
                updated++;
              } else {
                await this.createOutlookEvent(integration, appointment);
                created++;
              }
            }
          } catch (error) {
            log.error(`Sync error for appointment ${appointment._id}:`, error.message);
            errors++;
          }
        }

        integration.updateSyncState('success', null, { created, updated });
        await integration.save();

        results.push({
          provider: integration.provider,
          success: true,
          stats: { created, updated, errors, total: appointments.length }
        });
      } catch (error) {
        integration.updateSyncState('failed', error.message);
        await integration.save();

        results.push({
          provider: integration.provider,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Disconnect calendar integration
   */
  async disconnect(userId, provider) {
    const integration = await CalendarIntegration.findOne({ user: userId, provider });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Revoke tokens if possible
    try {
      if (provider === 'google') {
        this.googleOAuth2Client.setCredentials({
          access_token: integration.getAccessToken()
        });
        await this.googleOAuth2Client.revokeCredentials();
      }
      // Microsoft doesn't have a simple revoke endpoint
    } catch (error) {
      log.error('Token revoke error:', { error: error });
    }

    await CalendarIntegration.deleteOne({ _id: integration._id });

    return { success: true, message: `${provider} calendar disconnected` };
  }

  /**
   * Get user's calendar integrations status
   */
  async getUserIntegrations(userId) {
    const integrations = await CalendarIntegration.find({ user: userId });

    return integrations.map(int => ({
      provider: int.provider,
      status: int.status,
      email: int.providerAccountEmail,
      calendars: int.calendars,
      defaultCalendar: int.defaultCalendarId,
      syncSettings: int.syncSettings,
      syncState: {
        lastSyncAt: int.syncState.lastSyncAt,
        lastSyncStatus: int.syncState.lastSyncStatus,
        eventsCreated: int.syncState.eventsCreated,
        eventsUpdated: int.syncState.eventsUpdated
      },
      connectedAt: int.connectedAt
    }));
  }

  // ===========================
  // iCAL (.ics) EXPORT
  // ===========================

  /**
   * Generate iCal UID for an appointment
   */
  generateICalUID(appointmentId) {
    return `${appointmentId}@medflow.health`;
  }

  /**
   * Format date for iCal format (YYYYMMDDTHHMMSSZ)
   */
  formatICalDate(date) {
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for iCal
   */
  escapeICalText(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Fold long lines for iCal (max 75 chars per line)
   */
  foldICalLine(line) {
    const maxLength = 75;
    if (line.length <= maxLength) return line;

    let folded = '';
    let remaining = line;

    while (remaining.length > maxLength) {
      folded += `${remaining.substring(0, maxLength)}\r\n `;
      remaining = remaining.substring(maxLength);
    }
    folded += remaining;

    return folded;
  }

  /**
   * Convert appointment to iCal VEVENT
   */
  appointmentToICalEvent(appointment, includePatientNames = true) {
    const patient = appointment.patient;
    const provider = appointment.provider;
    const uid = this.generateICalUID(appointment._id);
    const now = this.formatICalDate(new Date());

    const startTime = new Date(appointment.appointmentDate);
    const endTime = new Date(startTime.getTime() + (appointment.duration || 30) * 60000);

    let summary = 'Rendez-vous médical';
    if (includePatientNames && patient) {
      summary = `${patient.firstName || ''} ${patient.lastName || ''} - ${appointment.type || 'Consultation'}`;
    } else {
      summary = `${appointment.type || 'Consultation'}`;
    }

    let description = `Type: ${appointment.type || 'Consultation'}\\n`;
    description += `Statut: ${appointment.status || 'scheduled'}\\n`;
    if (appointment.reason) {
      description += `Raison: ${this.escapeICalText(appointment.reason)}\\n`;
    }
    if (appointment.notes) {
      description += `Notes: ${this.escapeICalText(appointment.notes)}\\n`;
    }
    description += '\\n---\\nExporté depuis MedFlow';

    let location = '';
    if (appointment.location) {
      location = this.escapeICalText(
        typeof appointment.location === 'object'
          ? appointment.location.name || appointment.location.address || ''
          : appointment.location
      );
    }

    let organizer = '';
    if (provider) {
      const providerEmail = provider.email || 'noreply@medflow.health';
      const providerName = `Dr. ${provider.firstName || ''} ${provider.lastName || ''}`.trim();
      organizer = `ORGANIZER;CN=${this.escapeICalText(providerName)}:mailto:${providerEmail}`;
    }

    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${this.formatICalDate(startTime)}`,
      `DTEND:${this.formatICalDate(endTime)}`,
      `SUMMARY:${this.escapeICalText(summary)}`,
      `DESCRIPTION:${description}`,
      `STATUS:${this.mapStatusToIcal(appointment.status)}`,
      'TRANSP:OPAQUE',
      'SEQUENCE:0'
    ];

    if (location) {
      lines.push(`LOCATION:${location}`);
    }

    if (organizer) {
      lines.push(organizer);
    }

    // Add categories based on type
    if (appointment.type) {
      lines.push(`CATEGORIES:${appointment.type.toUpperCase()}`);
    }

    // Add alarm/reminder (30 min before)
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT30M');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:Rappel: ${this.escapeICalText(summary)}`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');

    return lines.map(line => this.foldICalLine(line)).join('\r\n');
  }

  /**
   * Map appointment status to iCal status
   */
  mapStatusToIcal(status) {
    const statusMap = {
      'scheduled': 'CONFIRMED',
      'confirmed': 'CONFIRMED',
      'checked-in': 'CONFIRMED',
      'in-progress': 'CONFIRMED',
      'completed': 'CONFIRMED',
      'cancelled': 'CANCELLED',
      'no-show': 'CANCELLED',
      'rescheduled': 'TENTATIVE'
    };
    return statusMap[status] || 'CONFIRMED';
  }

  /**
   * Generate iCal (.ics) file content for a single appointment
   */
  generateICalForAppointment(appointment, options = {}) {
    const { includePatientNames = true, clinicName = 'MedFlow Clinic' } = options;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MedFlow//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeICalText(clinicName)}`,
      'X-WR-TIMEZONE:Africa/Kinshasa',
      // Timezone definition
      'BEGIN:VTIMEZONE',
      'TZID:Africa/Kinshasa',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
      this.appointmentToICalEvent(appointment, includePatientNames),
      'END:VCALENDAR'
    ];

    return lines.join('\r\n');
  }

  /**
   * Generate iCal (.ics) file content for multiple appointments
   */
  generateICalForAppointments(appointments, options = {}) {
    const { includePatientNames = true, clinicName = 'MedFlow Clinic' } = options;

    const events = appointments
      .map(apt => this.appointmentToICalEvent(apt, includePatientNames))
      .join('\r\n');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MedFlow//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.escapeICalText(clinicName)}`,
      'X-WR-TIMEZONE:Africa/Kinshasa',
      // Timezone definition
      'BEGIN:VTIMEZONE',
      'TZID:Africa/Kinshasa',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
      events,
      'END:VCALENDAR'
    ];

    return lines.join('\r\n');
  }

  /**
   * Export user's appointments to iCal format
   */
  async exportUserAppointmentsToICal(userId, options = {}) {
    const {
      startDate = new Date(),
      endDate = null,
      includePast = false,
      includePatientNames = true,
      clinicName = 'MedFlow Clinic',
      statuses = ['scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed']
    } = options;

    const query = {
      provider: userId,
      status: { $in: statuses }
    };

    if (includePast) {
      if (endDate) {
        query.appointmentDate = { $lte: endDate };
      }
    } else {
      query.appointmentDate = { $gte: startDate };
      if (endDate) {
        query.appointmentDate.$lte = endDate;
      }
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName patientId email phone')
      .populate('provider', 'firstName lastName email')
      .sort({ appointmentDate: 1 });

    return this.generateICalForAppointments(appointments, { includePatientNames, clinicName });
  }

  /**
   * Export patient's appointments to iCal format
   */
  async exportPatientAppointmentsToICal(patientId, options = {}) {
    const {
      startDate = new Date(),
      endDate = null,
      includePast = false,
      clinicName = 'Mes Rendez-vous MedFlow',
      statuses = ['scheduled', 'confirmed', 'checked-in']
    } = options;

    const query = {
      patient: patientId,
      status: { $in: statuses }
    };

    if (includePast) {
      if (endDate) {
        query.appointmentDate = { $lte: endDate };
      }
    } else {
      query.appointmentDate = { $gte: startDate };
      if (endDate) {
        query.appointmentDate.$lte = endDate;
      }
    }

    const appointments = await Appointment.find(query)
      .populate('provider', 'firstName lastName email specialty')
      .sort({ appointmentDate: 1 });

    // For patient export, don't include other patient names
    return this.generateICalForAppointments(appointments, {
      includePatientNames: false,
      clinicName
    });
  }

  /**
   * Generate iCal subscription URL token
   */
  async generateICalSubscriptionToken(userId) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Store token in integration or user settings
    let integration = await CalendarIntegration.findOne({
      user: userId,
      provider: 'ical'
    });

    if (!integration) {
      integration = new CalendarIntegration({
        user: userId,
        provider: 'ical',
        providerAccountId: token,
        accessToken: token, // Using accessToken field to store subscription token
        status: 'active',
        syncSettings: {
          enabled: true,
          includePatientNames: true
        }
      });
    } else {
      integration.accessToken = token;
      integration.status = 'active';
    }

    await integration.save();

    return {
      token,
      subscriptionUrl: `${process.env.APP_URL || 'https://app.medflow.health'}/api/calendar/ical/${token}/feed.ics`
    };
  }

  /**
   * Validate iCal subscription token and get user
   */
  async validateICalSubscriptionToken(token) {
    const integration = await CalendarIntegration.findOne({
      provider: 'ical',
      accessToken: token,
      status: 'active'
    }).populate('user', '_id firstName lastName role');

    if (!integration) {
      return null;
    }

    return integration;
  }

  /**
   * Get iCal feed by subscription token
   */
  async getICalFeed(token, options = {}) {
    const integration = await this.validateICalSubscriptionToken(token);

    if (!integration) {
      throw new Error('Invalid or expired subscription token');
    }

    const feedOptions = {
      includePatientNames: integration.syncSettings?.includePatientNames !== false,
      clinicName: options.clinicName || 'MedFlow Clinic',
      ...options
    };

    return this.exportUserAppointmentsToICal(integration.user._id, feedOptions);
  }
}

// Export singleton instance
module.exports = new CalendarIntegrationService();
