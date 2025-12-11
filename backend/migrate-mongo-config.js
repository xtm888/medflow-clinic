require('dotenv').config();

/**
 * migrate-mongo Configuration
 *
 * Database migration framework for MongoDB schema changes
 *
 * Usage:
 * - Create migration: npx migrate-mongo create <migration-name>
 * - Run migrations: npx migrate-mongo up
 * - Rollback: npx migrate-mongo down
 * - Status: npx migrate-mongo status
 */

const config = {
  mongodb: {
    // MongoDB connection URL
    url: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',

    // Database name
    databaseName: process.env.MONGODB_URI?.split('/').pop().split('?')[0] || 'medflow',

    // Connection options
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },

  // The migrations dir
  migrationsDir: 'migrations',

  // The mongodb collection where the applied changes are stored
  changelogCollectionName: 'changelog',

  // The file extension to create migrations and search for in migration dir
  migrationFileExtension: '.js',

  // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determin
  // if the file should be run.  Requires that scripts are coded to be run multiple times.
  useFileHash: false,

  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs'
};

module.exports = config;
