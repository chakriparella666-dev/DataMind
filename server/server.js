// DataMind AI Platform Server - Updated 2026
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initAppDb } = require('./config/db');

const dataSourcesRouter = require('./routes/dataSources');
const agentRouter = require('./routes/agent');
const trainingRouter = require('./routes/training');
const authRouter = require('./routes/auth');
const statsRouter = require('./routes/stats');
const dashboardsRouter = require('./routes/dashboards');

const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from frontend build if client/dist exists
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'DataMind AI Server (PostgreSQL App DB)', time: new Date() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/datasources', dataSourcesRouter);
app.use('/api/agent', agentRouter);
app.use('/api/training', trainingRouter);
app.use('/api/stats', statsRouter);
app.use('/api/dashboards', dashboardsRouter);

// Catch-all route to serve Frontend index.html or dynamic info page
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: #f8fafc; min-height: 100vh;">
      <h2>🚀 DataMind AI Server API is Running</h2>
      <p style="color: #94a3b8;">Service URL: ${protocol}://${host}</p>
      <p style="color: #64748b;">Frontend build static files serve automatically when deployed.</p>
    </div>
  `);
});

// Start Server
const startServer = async () => {
  await initAppDb();
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 DataMind AI Server running on http://localhost:${PORT}`);
    console.log(`====================================================`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${PORT} in use] Retrying server on fallback port ${Number(PORT) + 1}...`);
      const fallbackPort = Number(PORT) + 1;
      app.listen(fallbackPort, () => {
        console.log(`====================================================`);
        console.log(`🚀 DataMind AI Server running on http://localhost:${fallbackPort}`);
        console.log(`====================================================`);
      });
    }
  });
};

startServer();
