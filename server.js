// SERVER
process.env.TZ = 'Asia/Manila';

const app = require('./src/app');
const { startCronJobs } = require('./src/shared/utils/cron');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startCronJobs();
});