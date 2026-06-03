import { createServer } from 'http';
import app from './app';
import { initSocket } from './services/socket.service';
import { startDelayedMessageScheduler } from './services/delayed.service';
import { startWeeklyReportScheduler } from './services/couple.service';

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);

initSocket(httpServer);
startDelayedMessageScheduler();
startWeeklyReportScheduler();

httpServer.listen(PORT, () => {
  console.log(`Echo server running on http://localhost:${PORT}`);
});
