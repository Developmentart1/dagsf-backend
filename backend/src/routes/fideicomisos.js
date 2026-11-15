const express = require('express');
const db = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/fideicomisos
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, estatus, tipo } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = [];
    let params = [];
    let paramIdx = 1;

    if (estatus) { where.push(`estatus = $${paramIdx++}`); params.push(estatus); }
    if (tipo) { where.push(`tipo_aplicacion = $${paramIdx++}`); params.push(tipo); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM fideicomisos ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT f.*,
        (SELECT json_agg(json_build_object('nombre', p.nombre, 'rol', p.rol, 'rfc', p.rfc))
         FROM participantes_fideicomiso p WHERE p.fideicomiso_id = f.id) as participantes
       FROM fideicomisos f
       ${whereClause}
       ORDER BY f.creado_en DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Error listando fideicomisos:', err);
    res.status(500).json({ error: 'Error al obtener fideicomisos' });
  }
});

// POST /api/fideicomisos
router.post('/', verificarRol(['admin', 'ejecutivo', 'fiduciario']), async (req, res) => {
  const {
    numero_fideicomiso, tipo_aplicacion, denominacion,
    monto_inicial, moneda, fecha_constitucion, notario, notaria_numero,
    estado, ciudad, proposito, instrucciones_especiales
  } = req.body;

  if (!numero_fideicomiso || !tipo_aplicacion || !denominacion) {
    return res.status(400).json({ error: 'numero_fideicomiso, tipo_aplicacion y denominacion son requeridos' });
  }

  try {
    const result = await db.query(
      `INSERT INTO fideicomisos (
        numero_fideicomiso, tipo_aplicacion, denominacion,
        monto_inicial, moneda, fecha_constitucion, notario, notaria_numero,
        estado, ciudad, proposito, instrucciones_especiales, estatus, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        numero_fideicomiso, tipo_aplicacion, denominacion,
        monto_inicial, moneda, fecha_constitucion, notario, notaria_numero,
        estado, ciudad, proposito, instrucciones_especiales,
        'en_constitucion', req.usuario.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El número de fideicomiso ya existe' });
    }
    console.error('Error creando fideicomiso:', err);
    res.status(500).json({ error: 'Error al crear fideicomiso' });
  }
});

module.exports = router;
