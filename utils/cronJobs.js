const cron = require('node-cron');
const { resetDailyTripCounts } = require('./tripTracking');

/**
 * Initialize all cron jobs
 */
function initializeCronJobs() {
  console.log('Initializing cron jobs...');
  
  // Daily trip count reset at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily trip count reset...');
    try {
      await resetDailyTripCounts();
      console.log('Daily trip count reset completed successfully');
    } catch (error) {
      console.error('Error in daily trip count reset:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // Adjust timezone as needed
  });
  
  // Optional: Hourly health check for trip tracking system
  cron.schedule('0 * * * *', () => {
    console.log('Trip tracking system health check - running normally');
  });
  
  console.log('Cron jobs initialized successfully');
}

/**
 * Stop all cron jobs
 */
function stopCronJobs() {
  console.log('Stopping cron jobs...');
  cron.getTasks().forEach(task => {
    task.stop();
  });
  console.log('All cron jobs stopped');
}

module.exports = {
  initializeCronJobs,
  stopCronJobs
};
