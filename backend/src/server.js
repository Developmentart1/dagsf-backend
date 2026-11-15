require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const db = require('./config/database');
const redis = require('./config/redis');

const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const creditosRoutes = require('./routes/creditos');
const fideicomisosRoutes = require('./routes/fideicomisos');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// Seguridad básica
// ------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost', 'http://localhost:80'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Demasiadas peticiones. Intenta más tarde.' }
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------------
// Health check
// ------------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', db: 'connected', redis: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ------------------------------------------------------------------
// Rutas API
// ------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/creditos', creditosRoutes);
app.use('/api/fideicomisos', fideicomisosRoutes);
app.use('/api/upload', uploadRoutes);

// ------------------------------------------------------------------
// Error handler global
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ------------------------------------------------------------------
// Iniciar servidor
// ------------------------------------------------------------------
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DAG SF Backend corriendo en http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    db.end();
    redis.disconnect();
    process.exit(0);
  });
});
