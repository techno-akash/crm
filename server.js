const server = require('./src/server');
const logger = require('./src/utils/logger');

if (require.main === module) {
  server.start()
    .then((httpServer) => {
      const shutdown = async (signal) => {
        logger.info({ signal }, 'Shutdown requested');
        httpServer.close(async () => {
          const mongoose = require('mongoose');
          await mongoose.connection.close(false);
          process.exit(0);
        });
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    })
    .catch((error) => {
      logger.error({ err: error }, 'Unable to start server');
      process.exit(1);
    });
}

module.exports = server;
