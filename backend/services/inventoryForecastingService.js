/**
 * Inventory Forecasting Service
 *
 * Predicts inventory depletion using exponential smoothing with trend detection.
 * Provides reorder recommendations based on consumption patterns, seasonality,
 * and configurable lead times.
 *
 * Features:
 * - Consumption history analysis (90-day rolling window)
 * - Day-of-week seasonality factors
 * - Linear trend detection via regression
 * - Depletion date prediction
 * - Reorder quantity and urgency recommendations
 * - Confidence scoring based on data availability
 *
 * @module services/inventoryForecastingService
 */

const mongoose = require('mongoose');
const { Inventory } = require('../models/Inventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('InventoryForecasting');

/**
 * Transaction types that represent consumption (stock going out)
 */
const CONSUMPTION_TYPES = ['dispensed', 'transferred', 'expired', 'damaged', 'written_off'];

/**
 * Default lead time in days if not specified on inventory item
 */
const DEFAULT_LEAD_TIME_DAYS = 7;

/**
 * Safety factor multiplier for safety stock calculation
 */
const SAFETY_FACTOR = 1.5;

/**
 * Minimum days of data required for reliable forecasting
 */
const MIN_DATA_DAYS = 7;

/**
 * Days of history to analyze for consumption patterns
 */
const HISTORY_DAYS = 90;

class InventoryForecastingService {
  /**
   * Predict when inventory will reach reorder point
   * Uses exponential smoothing with trend detection
   *
   * @param {ObjectId|string} inventoryId - ID of the inventory item
   * @param {number} daysToForecast - Number of days to project into the future (default: 30)
   * @returns {Promise<Object>} Forecast result with depletion date and recommendations
   */
  async forecastDepletion(inventoryId, daysToForecast = 30) {
    try {
      const inventory = await Inventory.findById(inventoryId)
        .select('name sku inventory.currentStock inventory.reorderPoint inventory.minimumStock inventory.maximumStock clinic')
        .lean();

      if (!inventory) {
        log.warn('Inventory not found for forecasting:', { inventoryId: String(inventoryId) });
        return {
          success: false,
          error: 'Article non trouvé',
          inventory: null,
          forecast: null
        };
      }

    const currentStock = inventory.inventory?.currentStock || 0;
    const reorderPoint = inventory.inventory?.reorderPoint || inventory.inventory?.minimumStock || 0;
    const optimalStock = inventory.inventory?.maximumStock || currentStock * 2;

    // Get consumption history (last 90 days)
    const historyStartDate = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

    const consumptionHistory = await InventoryTransaction.aggregate([
      {
        $match: {
          inventory: new mongoose.Types.ObjectId(inventoryId),
          type: { $in: CONSUMPTION_TYPES },
          createdAt: { $gte: historyStartDate },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalConsumed: { $sum: { $abs: '$quantity' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

      // Check if we have enough data for reliable forecasting
      if (consumptionHistory.length < MIN_DATA_DAYS) {
        log.info('Insufficient consumption history:', {
          inventoryId: String(inventoryId),
          dataPoints: consumptionHistory.length,
          required: MIN_DATA_DAYS
        });

        return {
          success: true,
          inventory: {
            _id: inventory._id,
            name: inventory.name,
            currentStock,
            reorderPoint,
            optimalStock
          },
          analysis: null,
          forecast: null,
          depletionDate: null,
          daysUntilReorderPoint: null,
          reorderRecommendation: null,
          confidence: 'low',
          message: `Historique de consommation insuffisant. ${consumptionHistory.length} jours de données, minimum ${MIN_DATA_DAYS} requis.`
        };
      }

    // Calculate average, trend, and seasonality
    const dailyConsumption = consumptionHistory.map(d => d.totalConsumed);
    const { average, trend, seasonality } = this.analyzeConsumption(dailyConsumption);

    // Forecast future consumption
    const forecastedConsumption = [];
    let projectedStock = currentStock;
    let depletionDate = null;
    let daysUntilReorderPoint = null;
    const today = new Date();

    for (let day = 1; day <= daysToForecast; day++) {
      const futureDate = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
      const dayOfWeek = futureDate.getDay();
      const seasonalFactor = seasonality[dayOfWeek] || 1;

      // Project daily consumption with trend adjustment
      const projectedDaily = Math.max(0, (average + trend * day) * seasonalFactor);

      projectedStock = Math.max(0, projectedStock - projectedDaily);

      forecastedConsumption.push({
        day,
        date: futureDate,
        projectedConsumption: Math.round(projectedDaily * 100) / 100,
        projectedStock: Math.round(projectedStock)
      });

      // Track when we hit reorder point
      if (projectedStock <= reorderPoint && daysUntilReorderPoint === null) {
        daysUntilReorderPoint = day;
        depletionDate = futureDate;
      }
    }

    // Get lead time from inventory suppliers or use default
    const leadTimeDays = inventory.suppliers?.[0]?.leadTimeDays || DEFAULT_LEAD_TIME_DAYS;

    // Calculate reorder recommendation
    const reorderRecommendation = this.calculateReorderRecommendation(
      { currentStock, reorderPoint, optimalStock },
      average,
      trend,
      leadTimeDays
    );

      // Determine confidence level based on data quality
      const confidence = this.calculateConfidence(consumptionHistory.length, average);

      log.info('Forecast generated:', {
        inventoryId: String(inventoryId),
        inventoryName: inventory.name,
        currentStock,
        averageDaily: Math.round(average * 100) / 100,
        trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
        daysUntilReorderPoint,
        confidence
      });

      return {
        success: true,
        inventory: {
          _id: inventory._id,
          name: inventory.name,
          currentStock,
          reorderPoint,
          optimalStock
        },
        analysis: {
          averageDailyConsumption: Math.round(average * 100) / 100,
          trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
          trendValue: Math.round(trend * 1000) / 1000
        },
        forecast: forecastedConsumption,
        depletionDate,
        daysUntilReorderPoint,
        reorderRecommendation,
        confidence
      };
    } catch (error) {
      log.error('Forecast depletion failed:', {
        error: error.message,
        inventoryId: String(inventoryId),
        daysToForecast
      });
      // Return conservative forecast on error
      return {
        success: false,
        error: 'Erreur lors de la prévision',
        inventory: null,
        analysis: null,
        forecast: null,
        depletionDate: null,
        daysUntilReorderPoint: null,
        reorderRecommendation: { urgency: 'unknown', quantity: 0 },
        confidence: 'low'
      };
    }
  }

  /**
   * Analyze consumption patterns to extract average, trend, and seasonality
   *
   * @param {number[]} dailyData - Array of daily consumption values
   * @returns {Object} Analysis results with average, trend, and seasonality
   */
  analyzeConsumption(dailyData) {
    if (!dailyData || dailyData.length === 0) {
      return { average: 0, trend: 0, seasonality: {} };
    }

    // Simple moving average
    const average = dailyData.reduce((sum, val) => sum + val, 0) / dailyData.length;

    // Linear trend (simple linear regression)
    // Using least squares: trend = sum((x - xMean)(y - yMean)) / sum((x - xMean)^2)
    const n = dailyData.length;
    const xMean = (n - 1) / 2;
    const yMean = average;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (dailyData[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const trend = denominator !== 0 ? numerator / denominator : 0;

    // Day-of-week seasonality
    // Calculate average consumption for each day of the week
    // Then express as a ratio to overall average
    const seasonality = {};
    const dayTotals = {};
    const dayCounts = {};

    dailyData.forEach((value, index) => {
      const dayOfWeek = index % 7;
      dayTotals[dayOfWeek] = (dayTotals[dayOfWeek] || 0) + value;
      dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
    });

    // Calculate seasonality factor for each day
    // Factor > 1 means higher than average consumption
    // Factor < 1 means lower than average consumption
    for (let day = 0; day < 7; day++) {
      if (dayCounts[day] && average > 0) {
        const dayAverage = dayTotals[day] / dayCounts[day];
        seasonality[day] = dayAverage / average;
      } else {
        seasonality[day] = 1; // Default to neutral if no data
      }
    }

    return { average, trend, seasonality };
  }

  /**
   * Calculate reorder recommendation based on consumption analysis
   *
   * @param {Object} inventory - Inventory stock levels
   * @param {number} inventory.currentStock - Current stock level
   * @param {number} inventory.reorderPoint - Reorder trigger point
   * @param {number} inventory.optimalStock - Optimal stock level
   * @param {number} averageDaily - Average daily consumption
   * @param {number} trend - Consumption trend (positive = increasing)
   * @param {number} leadTimeDays - Supplier lead time in days
   * @returns {Object} Reorder recommendation
   */
  calculateReorderRecommendation(inventory, averageDaily, trend, leadTimeDays) {
    const { currentStock, reorderPoint, optimalStock } = inventory;

    // Safety stock = average daily consumption * lead time * safety factor
    // This provides buffer against variability and unexpected demand
    const safetyStock = Math.ceil(averageDaily * leadTimeDays * SAFETY_FACTOR);

    // Lead time consumption with trend adjustment
    // Account for increasing/decreasing demand during lead time
    // Using trapezoidal approximation: base consumption + trend acceleration
    const leadTimeConsumption = averageDaily * leadTimeDays + (trend * leadTimeDays * leadTimeDays / 2);

    // Calculate optimal order quantity
    // Target: bring stock to optimal level considering lead time consumption
    let optimalOrderQuantity;
    if (optimalStock > 0) {
      optimalOrderQuantity = optimalStock - currentStock + leadTimeConsumption;
    } else {
      optimalOrderQuantity = leadTimeConsumption + safetyStock;
    }

    // Ensure non-negative quantity
    optimalOrderQuantity = Math.max(0, Math.ceil(optimalOrderQuantity));

    // Determine urgency
    // immediate: already at or below reorder point
    // soon: within 20% of reorder point
    // normal: stock is healthy
    let urgency;
    if (currentStock <= reorderPoint) {
      urgency = 'immediate';
    } else if (currentStock <= reorderPoint * 1.2) {
      urgency = 'soon';
    } else {
      urgency = 'normal';
    }

    return {
      quantity: optimalOrderQuantity,
      urgency,
      estimatedLeadTime: leadTimeDays,
      safetyStock
    };
  }

  /**
   * Calculate confidence level based on data quality
   *
   * @param {number} dataPoints - Number of days of consumption data
   * @param {number} average - Average daily consumption
   * @returns {string} Confidence level: 'high', 'medium', or 'low'
   */
  calculateConfidence(dataPoints, average) {
    // High confidence: 30+ days of data with meaningful consumption
    if (dataPoints >= 30 && average > 0) {
      return 'high';
    }

    // Medium confidence: 7-29 days of data
    if (dataPoints >= MIN_DATA_DAYS) {
      return 'medium';
    }

    // Low confidence: insufficient data
    return 'low';
  }

  /**
   * Get forecasts for all low-stock items in a clinic
   *
   * @param {ObjectId|string} clinicId - Clinic ID
   * @param {number} daysToForecast - Number of days to forecast
   * @returns {Promise<Object[]>} Array of forecasts for low-stock items
   */
  async getForecastsForLowStock(clinicId, daysToForecast = 30) {
    try {
      const lowStockItems = await Inventory.find({
        clinic: clinicId,
        active: true,
        'inventory.status': { $in: ['low_stock', 'out_of_stock'] }
      }).select('_id name sku').lean();

      const forecasts = [];
      const errors = [];

      for (const item of lowStockItems) {
        try {
          const forecast = await this.forecastDepletion(item._id, daysToForecast);
          forecasts.push({
            ...forecast,
            sku: item.sku
          });
        } catch (error) {
          log.warn('Failed to forecast item:', {
            inventoryId: String(item._id),
            name: item.name,
            error: error.message
          });
          errors.push({ inventoryId: String(item._id), name: item.name, error: error.message });
        }
      }

      // Sort by urgency and days until reorder
      const sortedForecasts = forecasts.sort((a, b) => {
        const urgencyOrder = { immediate: 0, soon: 1, normal: 2 };
        const aUrgency = urgencyOrder[a.reorderRecommendation?.urgency] ?? 3;
        const bUrgency = urgencyOrder[b.reorderRecommendation?.urgency] ?? 3;

        if (aUrgency !== bUrgency) {
          return aUrgency - bUrgency;
        }

        // Within same urgency, sort by days until reorder point
        const aDays = a.daysUntilReorderPoint ?? Infinity;
        const bDays = b.daysUntilReorderPoint ?? Infinity;
        return aDays - bDays;
      });

      return {
        success: true,
        forecasts: sortedForecasts,
        totalItems: lowStockItems.length,
        forecastedCount: forecasts.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      log.error('Failed to get forecasts for low stock:', {
        error: error.message,
        clinicId: String(clinicId),
        daysToForecast
      });
      return {
        success: false,
        error: 'Erreur lors de la récupération des prévisions',
        forecasts: [],
        totalItems: 0,
        forecastedCount: 0
      };
    }
  }

  /**
   * Get consumption trend summary for an inventory item
   *
   * @param {ObjectId|string} inventoryId - Inventory ID
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise<Object>} Consumption summary
   */
  async getConsumptionSummary(inventoryId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [inventory, transactions] = await Promise.all([
        Inventory.findById(inventoryId).select('name sku inventory.currentStock').lean(),
        InventoryTransaction.aggregate([
          {
            $match: {
              inventory: new mongoose.Types.ObjectId(inventoryId),
              createdAt: { $gte: startDate },
              isDeleted: { $ne: true }
            }
          },
          {
            $group: {
              _id: '$type',
              total: { $sum: { $abs: '$quantity' } },
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      if (!inventory) {
        log.warn('Inventory not found for consumption summary:', { inventoryId: String(inventoryId) });
        return {
          success: false,
          error: 'Article non trouvé',
          inventoryId: String(inventoryId)
        };
      }

      const summary = {
        success: true,
        inventoryId,
        name: inventory.name,
        sku: inventory.sku,
        currentStock: inventory.inventory?.currentStock || 0,
        periodDays: days,
        transactions: {}
      };

      let totalIn = 0;
      let totalOut = 0;

      for (const tx of transactions) {
        summary.transactions[tx._id] = {
          total: tx.total,
          count: tx.count
        };

        if (['received', 'returned', 'released'].includes(tx._id)) {
          totalIn += tx.total;
        } else if (CONSUMPTION_TYPES.includes(tx._id)) {
          totalOut += tx.total;
        }
      }

      summary.totalIn = totalIn;
      summary.totalOut = totalOut;
      summary.netChange = totalIn - totalOut;
      summary.averageDailyConsumption = Math.round((totalOut / days) * 100) / 100;

      return summary;
    } catch (error) {
      log.error('Failed to get consumption summary:', {
        error: error.message,
        inventoryId: String(inventoryId),
        days
      });
      return {
        success: false,
        error: 'Erreur lors de la récupération du résumé de consommation',
        inventoryId: String(inventoryId),
        periodDays: days,
        totalIn: 0,
        totalOut: 0,
        netChange: 0,
        averageDailyConsumption: 0
      };
    }
  }
}

// Export singleton instance
const inventoryForecastingService = new InventoryForecastingService();
module.exports = inventoryForecastingService;
