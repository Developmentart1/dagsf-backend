const express = require('express');
const multer = require('multer');
const Minio = require('minio');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// Configurar MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT ? process.env.MINIO_ENDPOINT.split(':')[0] : 'localhost',
  port: process.env.MINIO_ENDPOINT ? parseInt(process.env.MINIO_ENDPOINT.split(':')[1]) : 9000,
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'minio123',
});

const BUCKET_NAME = 'dagsf-expedientes';

// Asegurar que el bucket existe
(async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Bucket ${BUCKET_NAME} creado`);
    }
  } catch (err) {
    console.error('Error verificando bucket MinIO:', err);
  }
})();

// Configurar multer (memoria temporal)
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo PDF, JPG, PNG, WEBP'));
    }
  }
});

// POST /api/upload - Subir archivo a MinIO
router.post('/', verificarToken, upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const { entidad_tipo, entidad_id, categoria } = req.body;
  if (!entidad_tipo || !entidad_id) {
    return res.status(400).json({ error: 'entidad_tipo y entidad_id son requeridos' });
  }

  try {
    const filename = `${entidad_tipo}/${entidad_id}/${categoria || 'general'}/${Date.now()}_${req.file.originalname}`;

    await minioClient.putObject(
      BUCKET_NAME,
      filename,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    // Guardar referencia en PostgreSQL
    const db = require('../config/database');
    const result = await db.query(
      `INSERT INTO documentos (entidad_tipo, entidad_id, nombre_original, nombre_almacenado, categoria, mime_type, tamano_bytes, subido_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [entidad_tipo, entidad_id, req.file.originalname, filename, categoria, req.file.mimetype, req.file.size, req.usuario.id]
    );

    res.status(201).json({
      documento: result.rows[0],
      url: `/api/upload/${result.rows[0].id}`
    });
  } catch (err) {
    console.error('Error subiendo archivo:', err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

// GET /api/upload/:id - Descargar/obtener URL de archivo
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const db = require('../config/database');
    const result = await db.query('SELECT * FROM documentos WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const doc = result.rows[0];
    const url = await minioClient.presignedGetObject(BUCKET_NAME, doc.nombre_almacenado, 60 * 60); // 1 hora

    res.json({ documento: doc, url });
  } catch (err) {
    console.error('Error obteniendo archivo:', err);
    res.status(500).json({ error: 'Error al obtener archivo' });
  }
});

module.exports = router;
