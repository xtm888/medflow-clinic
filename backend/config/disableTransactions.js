// Temporary configuration to disable transactions for development
// This allows the app to run on a standalone MongoDB instance

const config = {
  // Set to false to disable transactions (for standalone MongoDB)
  // Set to true to enable transactions (requires MongoDB replica set)
  USE_TRANSACTIONS: false,

  // Helper function to wrap operations with optional transactions
  withTransaction: async function(operation, session = null) {
    if (this.USE_TRANSACTIONS && session) {
      return await operation(session);
    } else {
      // Run without transaction
      return await operation(null);
    }
  }
};

module.exports = config;
