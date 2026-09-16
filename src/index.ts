import { config } from './config.js';
import { createApp } from './app.js';
import { chatStore } from './store/chatStore.js';

const { httpServer } = createApp();

httpServer.listen(config.port, config.host, () => {
  console.log(
    `[chat-socket] listening on http://${config.host}:${config.port} (env=${config.nodeEnv})`,
  );
  console.log(`[chat-socket] CORS allowlist: ${config.corsOrigins.join(', ')}`);
});

function shutdown(signal: string) {
  console.log(`[chat-socket] ${signal} received, flushing store…`);
  chatStore.stop();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
