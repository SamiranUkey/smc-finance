class ComplianceManager {
   constructor(queries) {
      this.queries = queries;
      // Default Prop Firm Limits
      this.LIMITS = {
         MAX_DAILY_LOSS_PERCENT: 5.0, // 5%
         MAX_DRAWDOWN_PERCENT: 10.0,  // 10%
         MAX_LOT_SIZE: 10.0           // Max lot size allowed per trade
      };
   }

   /**
    * Checks if a user is compliant with prop firm rules.
    * @param {number} userId 
    * @returns {Object} { allowed: boolean, reason: string|null, details: Object|null }
    */
   async checkCompliance(userId) {
      const stats = this.queries.getTodayStats(userId);

      if (!stats) {
         // If no stats exist, we assume the account is fresh and compliant
         return { allowed: true, reason: null, details: null };
      }

      const { balance, equity, daily_pnl, max_drawdown } = stats;

      // 1. Daily Loss Limit Check
      // daily_pnl is absolute value from start of day
      const dailyLossPercent = (daily_pnl / balance) * 100;
      if (dailyLossPercent <= -this.LIMITS.MAX_DAILY_LOSS_PERCENT) {
         return {
            allowed: false,
            reason: 'DAILY_LOSS_LIMIT',
            details: {
               limit: this.LIMITS.MAX_DAILY_LOSS_PERCENT,
               current: Math.abs(dailyLossPercent)
            }
         };
      }

      // 2. Max Drawdown Check
      if (max_drawdown >= this.LIMITS.MAX_DRAWDOWN_PERCENT) {
         return {
            allowed: false,
            reason: 'MAX_DRAWDOWN_LIMIT',
            details: {
               limit: this.LIMITS.MAX_DRAWDOWN_PERCENT,
               current: max_drawdown
            }
         };
      }

      return { allowed: true, reason: null, details: null };
   }

   /**
    * Validates a specific trade signal against lot size limits.
    * @param {number} lotSize 
    * @returns {boolean}
    */
   validateLotSize(lotSize) {
      return lotSize <= this.LIMITS.MAX_LOT_SIZE;
   }
}

module.exports = ComplianceManager;
