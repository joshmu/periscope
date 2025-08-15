import { Button } from './components/Button';
import { Header } from './components/Header';
import { getUserById, formatDate } from './utils/helpers';
import { Logger } from './utils/logger';

// Application entry point
export function initializeApp() {
  const logger = new Logger('Main');
  logger.log('Application starting...');

  const user = getUserById('123');
  const today = formatDate(new Date());

  return {
    user,
    date: today,
    components: {
      Button,
      Header,
    },
  };
}

// Export all modules
export { Button, Header };
export * from './utils/helpers';
export { Logger } from './utils/logger';
