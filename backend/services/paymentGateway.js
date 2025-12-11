/**
 * Payment Gateway Service
 * Handles integration with payment providers: Stripe, Mobile Money (Orange Money, MTN, etc.)
 */

const crypto = require('crypto');

class PaymentGatewayService {
  constructor() {
    this.stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
    this.mobileMoneyEnabled = !!process.env.MOBILE_MONEY_API_KEY;

    // Mobile Money simulation mode: 'full' (always succeed), 'realistic' (random outcomes), 'fail' (always fail), 'off' (real API)
    this.mobileMoneySimulationMode = process.env.MOBILE_MONEY_SIMULATION_MODE || 'realistic';

    // Track simulated transactions for verification
    this.simulatedTransactions = new Map();

    if (this.stripeEnabled) {
      this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
  }

  /**
   * Process a payment through the appropriate gateway
   */
  async processPayment(paymentData) {
    const { method, amount, currency = 'CDF', patientId, invoiceId, metadata = {} } = paymentData;

    switch (method) {
      case 'card':
      case 'stripe':
        return this.processStripePayment(paymentData);
      case 'mobile-money':
      case 'orange-money':
      case 'mtn-money':
        return this.processMobileMoneyPayment(paymentData);
      case 'cash':
        return this.processCashPayment(paymentData);
      case 'bank-transfer':
        return this.processBankTransfer(paymentData);
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }

  /**
   * Process Stripe payment (card)
   */
  async processStripePayment(paymentData) {
    if (!this.stripeEnabled) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    const {
      amount,
      currency = 'cdf',
      paymentMethodId,
      customerId,
      patientId,
      invoiceId,
      description,
      metadata = {}
    } = paymentData;

    try {
      // Create or retrieve customer
      let stripeCustomerId = customerId;
      if (!stripeCustomerId && paymentData.email) {
        const customer = await this.stripe.customers.create({
          email: paymentData.email,
          name: paymentData.patientName,
          metadata: { patientId }
        });
        stripeCustomerId = customer.id;
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses smallest currency unit
        currency: currency.toLowerCase(),
        payment_method: paymentMethodId,
        customer: stripeCustomerId,
        description: description || `Payment for Invoice ${invoiceId}`,
        metadata: {
          patientId,
          invoiceId,
          ...metadata
        },
        confirm: true,
        return_url: `${process.env.FRONTEND_URL}/billing/payment-complete`
      });

      return {
        success: true,
        provider: 'stripe',
        transactionId: paymentIntent.id,
        status: paymentIntent.status,
        amount: amount,
        currency: currency,
        paymentMethod: 'card',
        reference: paymentIntent.id,
        receiptUrl: paymentIntent.charges?.data[0]?.receipt_url,
        metadata: {
          stripeCustomerId,
          last4: paymentIntent.payment_method_details?.card?.last4,
          brand: paymentIntent.payment_method_details?.card?.brand
        }
      };
    } catch (error) {
      console.error('Stripe payment error:', error);
      return {
        success: false,
        provider: 'stripe',
        error: error.message,
        code: error.code,
        declineCode: error.decline_code
      };
    }
  }

  /**
   * Create Stripe Payment Intent (for client-side confirmation)
   */
  async createPaymentIntent(paymentData) {
    if (!this.stripeEnabled) {
      throw new Error('Stripe is not configured');
    }

    const { amount, currency = 'cdf', patientId, invoiceId, metadata = {} } = paymentData;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: {
        patientId,
        invoiceId,
        ...metadata
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  }

  /**
   * Process Mobile Money payment (Orange Money, MTN, etc.)
   */
  async processMobileMoneyPayment(paymentData) {
    const {
      amount,
      currency = 'CDF',
      phoneNumber,
      provider = 'orange-money', // orange-money, mtn-money, wave
      patientId,
      invoiceId,
      metadata = {}
    } = paymentData;

    // Generate unique transaction reference
    const transactionRef = `MM${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    try {
      // This is a simulation - replace with actual Mobile Money API integration
      // Each provider (Orange Money, MTN, Wave) has their own API

      const apiConfig = this.getMobileMoneyConfig(provider);

      // Simulated API call - replace with actual implementation
      const response = await this.callMobileMoneyAPI(apiConfig, {
        amount,
        currency,
        phoneNumber,
        reference: transactionRef,
        description: `Payment for Invoice ${invoiceId}`,
        callbackUrl: `${process.env.BACKEND_URL}/api/payments/webhook/mobile-money`
      });

      return {
        success: true,
        provider: provider,
        transactionId: transactionRef,
        status: 'pending', // Mobile money usually requires user confirmation
        amount,
        currency,
        paymentMethod: 'mobile-money',
        reference: transactionRef,
        phoneNumber: phoneNumber.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'), // Mask phone
        instructions: `Please confirm the payment on your ${provider} app or by dialing the USSD code`,
        metadata: {
          provider,
          phoneNumber: phoneNumber.slice(-4) // Store only last 4 digits
        }
      };
    } catch (error) {
      console.error('Mobile Money payment error:', error);
      return {
        success: false,
        provider: provider,
        error: error.message
      };
    }
  }

  getMobileMoneyConfig(provider) {
    const configs = {
      'orange-money': {
        apiUrl: process.env.ORANGE_MONEY_API_URL,
        apiKey: process.env.ORANGE_MONEY_API_KEY,
        merchantId: process.env.ORANGE_MONEY_MERCHANT_ID
      },
      'mtn-money': {
        apiUrl: process.env.MTN_MONEY_API_URL,
        apiKey: process.env.MTN_MONEY_API_KEY,
        merchantId: process.env.MTN_MONEY_MERCHANT_ID
      },
      'wave': {
        apiUrl: process.env.WAVE_API_URL,
        apiKey: process.env.WAVE_API_KEY,
        merchantId: process.env.WAVE_MERCHANT_ID
      }
    };

    return configs[provider] || configs['orange-money'];
  }

  async callMobileMoneyAPI(config, data) {
    // PRODUCTION TODO: Replace this entire method with actual HTTP call to provider's API
    // when MOBILE_MONEY_SIMULATION_MODE is set to 'off' or not set

    if (this.mobileMoneySimulationMode === 'off') {
      // Real API implementation - uncomment and configure when credentials are available
      /*
      const axios = require('axios');

      // Example for Orange Money API - adjust based on actual provider documentation
      const response = await axios.post(`${config.apiUrl}/v1/webpayment`, {
        merchant_key: config.merchantId,
        currency: data.currency,
        order_id: data.reference,
        amount: data.amount,
        return_url: data.callbackUrl,
        cancel_url: data.callbackUrl,
        notif_url: data.callbackUrl,
        lang: 'fr',
        reference: data.description
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      // MTN Mobile Money API example
      // const response = await axios.post(`${config.apiUrl}/collection/v1_0/requesttopay`, {
      //   amount: data.amount.toString(),
      //   currency: data.currency,
      //   externalId: data.reference,
      //   payer: {
      //     partyIdType: 'MSISDN',
      //     partyId: data.phoneNumber
      //   },
      //   payerMessage: data.description,
      //   payeeNote: data.description
      // }, {
      //   headers: {
      //     'X-Reference-Id': data.reference,
      //     'X-Target-Environment': process.env.MTN_ENVIRONMENT || 'sandbox',
      //     'Ocp-Apim-Subscription-Key': config.apiKey,
      //     'Authorization': `Bearer ${config.accessToken}`,
      //     'Content-Type': 'application/json'
      //   }
      // });

      return {
        transactionId: response.data.payment_token || response.data.transactionId || data.reference,
        status: this._mapProviderStatus(response.data.status),
        message: response.data.message || 'Payment request sent to customer',
        providerReference: response.data.pay_token || response.data.referenceId
      };
      */

      throw new Error('Real Mobile Money API not yet configured. Set MOBILE_MONEY_SIMULATION_MODE to enable testing.');
    }

    // SIMULATION MODE - For development and testing
    const simulationResult = this._simulateAPICall(data);

    // Store transaction for later verification
    this.simulatedTransactions.set(data.reference, {
      ...simulationResult,
      amount: data.amount,
      currency: data.currency,
      phoneNumber: data.phoneNumber,
      timestamp: new Date(),
      description: data.description
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    return simulationResult;
  }

  /**
   * Simulate Mobile Money API responses based on simulation mode
   * @private
   */
  _simulateAPICall(data) {
    const mode = this.mobileMoneySimulationMode;

    switch (mode) {
      case 'full':
        // Always succeed - useful for demos
        return {
          transactionId: data.reference,
          status: 'pending',
          message: 'Payment request sent to customer (simulated - always succeeds)'
        };

      case 'fail':
        // Always fail - useful for testing error handling
        throw new Error('Mobile Money API temporarily unavailable (simulated failure)');

      case 'realistic':
      default:
        // Realistic simulation with random outcomes
        const random = Math.random();

        if (random < 0.05) {
          // 5% chance of API error
          throw new Error('Network timeout connecting to Mobile Money provider');
        }

        if (random < 0.10) {
          // Additional 5% chance of immediate rejection
          return {
            transactionId: data.reference,
            status: 'rejected',
            message: 'Phone number not registered for Mobile Money',
            errorCode: 'INVALID_PHONE'
          };
        }

        if (random < 0.15) {
          // Additional 5% chance of insufficient funds (detected later)
          return {
            transactionId: data.reference,
            status: 'pending',
            message: 'Payment request sent to customer',
            simulatedOutcome: 'insufficient_funds' // Internal flag for verification
          };
        }

        if (random < 0.20) {
          // Additional 5% chance of user cancellation (detected later)
          return {
            transactionId: data.reference,
            status: 'pending',
            message: 'Payment request sent to customer',
            simulatedOutcome: 'user_cancelled' // Internal flag for verification
          };
        }

        // 80% success rate
        return {
          transactionId: data.reference,
          status: 'pending',
          message: 'Payment request sent to customer',
          simulatedOutcome: 'success' // Internal flag for verification
        };
    }
  }

  /**
   * Process cash payment (record only)
   */
  async processCashPayment(paymentData) {
    const { amount, currency = 'CDF', receivedBy, patientId, invoiceId } = paymentData;

    const transactionRef = `CASH${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    return {
      success: true,
      provider: 'cash',
      transactionId: transactionRef,
      status: 'completed',
      amount,
      currency,
      paymentMethod: 'cash',
      reference: transactionRef,
      receivedBy,
      timestamp: new Date()
    };
  }

  /**
   * Process bank transfer (record pending transfer)
   */
  async processBankTransfer(paymentData) {
    const { amount, currency = 'CDF', bankReference, patientId, invoiceId } = paymentData;

    const transactionRef = `BT${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    return {
      success: true,
      provider: 'bank-transfer',
      transactionId: transactionRef,
      status: 'pending',
      amount,
      currency,
      paymentMethod: 'bank-transfer',
      reference: bankReference || transactionRef,
      bankDetails: {
        bankName: process.env.CLINIC_BANK_NAME || 'Bank Name',
        accountNumber: process.env.CLINIC_BANK_ACCOUNT || 'XXXX-XXXX-XXXX',
        iban: process.env.CLINIC_IBAN || 'MA00-0000-0000-0000-0000-0000',
        swift: process.env.CLINIC_SWIFT || 'XXXXX'
      },
      instructions: 'Please include the reference number in your transfer description'
    };
  }

  /**
   * Verify payment status
   */
  async verifyPayment(transactionId, provider) {
    switch (provider) {
      case 'stripe':
        return this.verifyStripePayment(transactionId);
      case 'orange-money':
      case 'mtn-money':
      case 'mobile-money':
        return this.verifyMobileMoneyPayment(transactionId, provider);
      default:
        return { verified: true, status: 'completed' };
    }
  }

  async verifyStripePayment(paymentIntentId) {
    if (!this.stripeEnabled) {
      throw new Error('Stripe is not configured');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      verified: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    };
  }

  async verifyMobileMoneyPayment(transactionId, provider) {
    // PRODUCTION TODO: Replace with actual verification API call
    // when MOBILE_MONEY_SIMULATION_MODE is set to 'off' or not set

    if (this.mobileMoneySimulationMode === 'off') {
      // Real API implementation - uncomment and configure when credentials are available
      /*
      const axios = require('axios');
      const config = this.getMobileMoneyConfig(provider);

      // Example for Orange Money verification
      const response = await axios.get(`${config.apiUrl}/v1/transaction/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'X-Merchant-Id': config.merchantId,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      // Example for MTN Mobile Money verification
      // const response = await axios.get(
      //   `${config.apiUrl}/collection/v1_0/requesttopay/${transactionId}`,
      //   {
      //     headers: {
      //       'X-Target-Environment': process.env.MTN_ENVIRONMENT || 'sandbox',
      //       'Ocp-Apim-Subscription-Key': config.apiKey,
      //       'Authorization': `Bearer ${config.accessToken}`
      //     }
      //   }
      // );

      return {
        verified: true,
        status: this._mapProviderStatus(response.data.status),
        amount: parseFloat(response.data.amount),
        currency: response.data.currency,
        transactionId: response.data.transaction_id || transactionId,
        completedAt: response.data.completed_at || response.data.timestamp,
        providerReference: response.data.provider_reference
      };
      */

      throw new Error('Real Mobile Money API not yet configured. Set MOBILE_MONEY_SIMULATION_MODE to enable testing.');
    }

    // SIMULATION MODE - For development and testing
    const storedTransaction = this.simulatedTransactions.get(transactionId);

    if (!storedTransaction) {
      // Transaction not found - could be old or invalid
      return {
        verified: false,
        status: 'not_found',
        transactionId,
        error: 'Transaction not found in system'
      };
    }

    // Simulate realistic status transitions based on time elapsed
    const elapsedSeconds = (Date.now() - storedTransaction.timestamp.getTime()) / 1000;
    let currentStatus = storedTransaction.status;

    // If transaction was initially pending, determine final status
    if (currentStatus === 'pending') {
      const simulatedOutcome = storedTransaction.simulatedOutcome;

      // Simulate user confirmation time (typically 10-120 seconds)
      if (elapsedSeconds < 10) {
        // Still pending - user hasn't confirmed yet
        currentStatus = 'pending';
      } else if (simulatedOutcome === 'insufficient_funds') {
        currentStatus = 'failed';
        storedTransaction.status = 'failed';
        storedTransaction.errorCode = 'INSUFFICIENT_FUNDS';
        storedTransaction.errorMessage = 'Insufficient balance in Mobile Money account';
      } else if (simulatedOutcome === 'user_cancelled') {
        currentStatus = 'cancelled';
        storedTransaction.status = 'cancelled';
        storedTransaction.errorCode = 'USER_CANCELLED';
        storedTransaction.errorMessage = 'Payment cancelled by user';
      } else {
        // Success case
        currentStatus = 'completed';
        storedTransaction.status = 'completed';
        storedTransaction.completedAt = new Date();
      }
    }

    // After 5 minutes, if still pending, mark as expired
    if (currentStatus === 'pending' && elapsedSeconds > 300) {
      currentStatus = 'expired';
      storedTransaction.status = 'expired';
      storedTransaction.errorCode = 'TIMEOUT';
      storedTransaction.errorMessage = 'Payment request expired - user did not confirm within time limit';
    }

    const result = {
      verified: true,
      status: currentStatus,
      transactionId,
      amount: storedTransaction.amount,
      currency: storedTransaction.currency,
      phoneNumber: storedTransaction.phoneNumber?.slice(-4),
      timestamp: storedTransaction.timestamp,
      completedAt: storedTransaction.completedAt
    };

    // Include error details if payment failed
    if (['failed', 'cancelled', 'expired'].includes(currentStatus)) {
      result.errorCode = storedTransaction.errorCode;
      result.errorMessage = storedTransaction.errorMessage;
    }

    return result;
  }

  /**
   * Map provider-specific status codes to standardized status
   * @private
   */
  _mapProviderStatus(providerStatus) {
    // Normalize different provider status codes
    const statusMap = {
      // Orange Money
      'PENDING': 'pending',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',
      'EXPIRED': 'expired',

      // MTN Mobile Money
      'PENDING': 'pending',
      'SUCCESSFUL': 'completed',
      'FAILED': 'failed',

      // Wave
      'pending': 'pending',
      'completed': 'completed',
      'failed': 'failed',
      'cancelled': 'cancelled'
    };

    return statusMap[providerStatus] || providerStatus.toLowerCase();
  }

  /**
   * Process refund
   */
  async processRefund(refundData) {
    const { originalTransactionId, amount, reason, provider } = refundData;

    switch (provider) {
      case 'stripe':
        return this.processStripeRefund(originalTransactionId, amount, reason);
      case 'mobile-money':
      case 'orange-money':
      case 'mtn-money':
        return this.processMobileMoneyRefund(originalTransactionId, amount, reason, provider);
      default:
        // For cash/check refunds, just record
        return {
          success: true,
          provider: 'manual',
          refundId: `REF${Date.now()}`,
          amount,
          status: 'pending',
          instructions: 'Process refund manually'
        };
    }
  }

  async processStripeRefund(paymentIntentId, amount, reason) {
    if (!this.stripeEnabled) {
      throw new Error('Stripe is not configured');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // If no amount, full refund
        reason: reason || 'requested_by_customer'
      });

      return {
        success: true,
        provider: 'stripe',
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        currency: refund.currency
      };
    } catch (error) {
      return {
        success: false,
        provider: 'stripe',
        error: error.message
      };
    }
  }

  async processMobileMoneyRefund(transactionId, amount, reason, provider) {
    // PRODUCTION TODO: Implement actual Mobile Money refund API
    // Note: Most Mobile Money providers require manual refund processing or have separate refund APIs

    // Validate inputs
    if (!transactionId) {
      return {
        success: false,
        provider: provider,
        error: 'Original transaction ID is required for refund',
        errorCode: 'MISSING_TRANSACTION_ID'
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false,
        provider: provider,
        error: 'Refund amount must be greater than zero',
        errorCode: 'INVALID_AMOUNT'
      };
    }

    // First verify the original transaction exists and was successful
    const verification = await this.verifyMobileMoneyPayment(transactionId, provider);

    if (!verification.verified || verification.status !== 'completed') {
      return {
        success: false,
        provider: provider,
        error: `Cannot refund transaction with status: ${verification.status}`,
        errorCode: 'INVALID_TRANSACTION_STATUS',
        originalStatus: verification.status
      };
    }

    // Validate refund amount doesn't exceed original payment
    if (amount > verification.amount) {
      return {
        success: false,
        provider: provider,
        error: `Refund amount (${amount}) exceeds original payment amount (${verification.amount})`,
        errorCode: 'AMOUNT_EXCEEDS_ORIGINAL',
        originalAmount: verification.amount
      };
    }

    if (this.mobileMoneySimulationMode === 'off') {
      // Real API implementation - uncomment and configure when credentials are available
      /*
      const axios = require('axios');
      const config = this.getMobileMoneyConfig(provider);
      const refundId = `REF${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Note: API varies significantly by provider
      // Orange Money example - may require pre-approval or manual processing
      try {
        const response = await axios.post(`${config.apiUrl}/v1/refund`, {
          transaction_id: transactionId,
          refund_id: refundId,
          amount: amount,
          reason: reason,
          merchant_id: config.merchantId
        }, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        return {
          success: true,
          provider: provider,
          refundId: response.data.refund_id || refundId,
          amount: amount,
          status: this._mapProviderStatus(response.data.status),
          originalTransactionId: transactionId,
          estimatedCompletion: response.data.estimated_completion,
          providerReference: response.data.reference
        };
      } catch (error) {
        console.error('Mobile Money refund API error:', error);
        return {
          success: false,
          provider: provider,
          error: error.response?.data?.message || error.message,
          errorCode: error.response?.data?.code || 'API_ERROR'
        };
      }
      */

      throw new Error('Real Mobile Money refund API not yet configured. Set MOBILE_MONEY_SIMULATION_MODE to enable testing.');
    }

    // SIMULATION MODE - For development and testing
    const refundId = `REF${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Simulate refund processing based on simulation mode
    let refundStatus = 'pending';
    let instructions = 'Mobile Money refund will be processed within 3-5 business days';

    if (this.mobileMoneySimulationMode === 'full') {
      // Instant success for demos
      refundStatus = 'completed';
      instructions = 'Refund processed successfully (simulated)';
    } else if (this.mobileMoneySimulationMode === 'realistic') {
      // Realistic simulation - 90% pending, 10% requires manual processing
      if (Math.random() < 0.10) {
        refundStatus = 'requires_approval';
        instructions = 'Refund amount exceeds automatic limit. Manual approval required.';
      }
    } else if (this.mobileMoneySimulationMode === 'fail') {
      // Simulate failure
      return {
        success: false,
        provider: provider,
        error: 'Mobile Money provider temporarily unavailable',
        errorCode: 'PROVIDER_UNAVAILABLE'
      };
    }

    // Store refund transaction
    this.simulatedTransactions.set(refundId, {
      type: 'refund',
      refundId,
      originalTransactionId: transactionId,
      amount,
      reason,
      status: refundStatus,
      timestamp: new Date(),
      estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    });

    return {
      success: true,
      provider: provider,
      refundId,
      amount,
      status: refundStatus,
      originalTransactionId: transactionId,
      currency: verification.currency,
      instructions,
      estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        reason,
        originalAmount: verification.amount,
        refundType: amount === verification.amount ? 'full' : 'partial',
        simulationMode: this.mobileMoneySimulationMode
      }
    };
  }

  /**
   * Handle webhook from payment provider
   */
  async handleWebhook(provider, payload, signature) {
    switch (provider) {
      case 'stripe':
        return this.handleStripeWebhook(payload, signature);
      case 'mobile-money':
        return this.handleMobileMoneyWebhook(payload);
      default:
        throw new Error(`Unknown webhook provider: ${provider}`);
    }
  }

  async handleStripeWebhook(payload, signature) {
    if (!this.stripeEnabled) {
      throw new Error('Stripe is not configured');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        return {
          type: 'payment_success',
          transactionId: event.data.object.id,
          amount: event.data.object.amount / 100,
          metadata: event.data.object.metadata
        };
      case 'payment_intent.payment_failed':
        return {
          type: 'payment_failed',
          transactionId: event.data.object.id,
          error: event.data.object.last_payment_error?.message
        };
      case 'refund.created':
        return {
          type: 'refund_created',
          refundId: event.data.object.id,
          amount: event.data.object.amount / 100
        };
      default:
        return { type: 'unhandled', eventType: event.type };
    }
  }

  async handleMobileMoneyWebhook(payload) {
    // PRODUCTION TODO: Implement proper webhook signature verification
    // Each provider has different signature schemes

    if (this.mobileMoneySimulationMode === 'off') {
      /*
      // Example webhook signature verification for Orange Money
      const config = this.getMobileMoneyConfig(payload.provider || 'orange-money');
      const receivedSignature = payload.signature || payload.hash;
      const expectedSignature = crypto
        .createHmac('sha256', config.webhookSecret)
        .update(JSON.stringify(payload.data))
        .digest('hex');

      if (receivedSignature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }
      */
    }

    // Extract webhook data - format varies by provider
    const {
      transactionId,
      transaction_id,
      reference,
      status,
      amount,
      currency,
      phone_number,
      timestamp,
      error_code,
      error_message
    } = payload;

    // Normalize transaction ID (different providers use different field names)
    const normalizedTransactionId = transactionId || transaction_id || reference;

    if (!normalizedTransactionId) {
      throw new Error('Transaction ID not found in webhook payload');
    }

    // Normalize status
    const normalizedStatus = this._mapProviderStatus(status);

    // Update simulated transaction if in simulation mode
    if (this.mobileMoneySimulationMode !== 'off') {
      const storedTransaction = this.simulatedTransactions.get(normalizedTransactionId);
      if (storedTransaction) {
        storedTransaction.status = normalizedStatus;
        if (normalizedStatus === 'completed') {
          storedTransaction.completedAt = new Date(timestamp || Date.now());
        }
        if (error_code) {
          storedTransaction.errorCode = error_code;
          storedTransaction.errorMessage = error_message;
        }
      }
    }

    // Prepare standardized webhook response
    const webhookResponse = {
      transactionId: normalizedTransactionId,
      amount: parseFloat(amount),
      currency: currency || 'CDF',
      status: normalizedStatus,
      provider: 'mobile-money',
      timestamp: timestamp || new Date().toISOString()
    };

    // Determine webhook type based on status
    if (normalizedStatus === 'completed') {
      return {
        type: 'payment_success',
        ...webhookResponse,
        phoneNumber: phone_number ? phone_number.slice(-4) : undefined
      };
    } else if (['failed', 'cancelled', 'expired'].includes(normalizedStatus)) {
      return {
        type: 'payment_failed',
        ...webhookResponse,
        errorCode: error_code,
        errorMessage: error_message
      };
    } else if (normalizedStatus === 'pending') {
      return {
        type: 'payment_pending',
        ...webhookResponse
      };
    } else {
      return {
        type: 'status_update',
        ...webhookResponse
      };
    }
  }

  /**
   * Get available payment methods
   */
  getAvailableMethods() {
    const methods = [
      { id: 'cash', name: 'Especes', icon: 'banknote', enabled: true },
      { id: 'check', name: 'Cheque', icon: 'receipt', enabled: true },
      { id: 'bank-transfer', name: 'Virement bancaire', icon: 'building-2', enabled: true }
    ];

    if (this.stripeEnabled) {
      methods.push({
        id: 'card',
        name: 'Carte bancaire',
        icon: 'credit-card',
        enabled: true,
        provider: 'stripe'
      });
    }

    if (this.mobileMoneyEnabled) {
      methods.push(
        { id: 'orange-money', name: 'Orange Money', icon: 'smartphone', enabled: true },
        { id: 'mtn-money', name: 'MTN Mobile Money', icon: 'smartphone', enabled: true },
        { id: 'wave', name: 'Wave', icon: 'smartphone', enabled: true }
      );
    }

    return methods;
  }
}

module.exports = new PaymentGatewayService();
