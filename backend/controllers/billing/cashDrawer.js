const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const { asyncHandler } = require('../../middleware/errorHandler');

// @desc    Get cash drawer status
// @route   GET /api/billing/cash-drawer
// @access  Private (Admin, Accountant, Receptionist)
exports.getCashDrawerStatus = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Get today's cash transactions
  const cashData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: today, $lte: endOfDay },
        'payments.method': 'cash'
      }
    },
    {
      $group: {
        _id: null,
        received: {
          $sum: {
            $cond: [{ $gte: ['$payments.amount', 0] }, '$payments.amountInBaseCurrency', 0]
          }
        },
        refunded: {
          $sum: {
            $cond: [{ $lt: ['$payments.amount', 0] }, { $abs: '$payments.amountInBaseCurrency' }, 0]
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  const cash = cashData[0] || { received: 0, refunded: 0, count: 0 };

  res.status(200).json({
    success: true,
    data: {
      date: today.toISOString().split('T')[0],
      cashReceived: cash.received,
      cashRefunded: cash.refunded,
      netCash: cash.received - cash.refunded,
      transactionCount: cash.count,
      currency: process.env.BASE_CURRENCY || 'CDF'
    }
  });
});

// @desc    Record cash drawer closing
// @route   POST /api/billing/cash-drawer/close
// @access  Private (Admin, Accountant)
exports.closeCashDrawer = asyncHandler(async (req, res) => {
  const { actualAmount, notes, denominations } = req.body;

  if (actualAmount === undefined || actualAmount === null) {
    return res.status(400).json({
      success: false,
      error: 'Actual cash amount is required'
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Get expected cash from today's transactions
  const cashData = await Invoice.aggregate([
    { $unwind: '$payments' },
    {
      $match: {
        'payments.date': { $gte: today, $lte: endOfDay },
        'payments.method': 'cash'
      }
    },
    {
      $group: {
        _id: null,
        received: {
          $sum: {
            $cond: [{ $gte: ['$payments.amount', 0] }, '$payments.amountInBaseCurrency', 0]
          }
        },
        refunded: {
          $sum: {
            $cond: [{ $lt: ['$payments.amount', 0] }, { $abs: '$payments.amountInBaseCurrency' }, 0]
          }
        }
      }
    }
  ]);

  const cash = cashData[0] || { received: 0, refunded: 0 };
  const expectedAmount = cash.received - cash.refunded;
  const variance = actualAmount - expectedAmount;

  // Log the cash drawer closing
  await AuditLog.create({
    user: req.user.id,
    action: 'CASH_DRAWER_CLOSE',
    resource: '/api/billing/cash-drawer/close',
    ipAddress: req.ip,
    metadata: {
      date: today.toISOString().split('T')[0],
      expectedAmount,
      actualAmount,
      variance,
      notes,
      denominations,
      closedBy: req.user.name || req.user.email
    }
  });

  res.status(200).json({
    success: true,
    data: {
      date: today.toISOString().split('T')[0],
      expectedAmount,
      actualAmount,
      variance,
      variancePercentage: expectedAmount > 0 ? Math.round((variance / expectedAmount) * 10000) / 100 : 0,
      status: Math.abs(variance) < 1 ? 'balanced' : variance > 0 ? 'over' : 'short',
      closedAt: new Date(),
      closedBy: req.user.id
    }
  });
});
