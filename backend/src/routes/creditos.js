const express = require('express');
const db = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/creditos
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, estatus, cliente_id } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = [];
    let params = [];
    let paramIdx = 1;

    if (estatus) {
      where.push(`estatus = $${paramIdx++}`);
      params.push(estatus);
    }
    if (cliente_id) {
      where.push(`cliente_id = $${paramIdx++}`);
      params.push(cliente_id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM creditos ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT c.*, cl.nombre as cliente_nombre
       FROM creditos c
       JOIN clientes cl ON cl.id = c.cliente_id
       ${whereClause}
       ORDER BY c.creado_en DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Error listando creditos:', err);
    res.status(500).json({ error: 'Error al obtener créditos' });
  }
});

// POST /api/creditos - Crear solicitud de crédito
router.post('/', verificarRol(['admin', 'ejecutivo']), async (req, res) => {
  const {
    cliente_id, producto, monto_solicitado, plazo_meses, tasa_anual,
    destino, fuente_pago, garantia_tipo, comentarios
  } = req.body;

  if (!cliente_id || !producto || !monto_solicitado) {
    return res.status(400).json({ error: 'cliente_id, producto y monto_solicitado son requeridos' });
  }

  try {
    const result = await db.query(
      `INSERT INTO creditos (
        cliente_id, producto, monto_solicitado, plazo_meses, tasa_anual,
        destino, fuente_pago, garantia_tipo, comentarios, estatus, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        cliente_id, producto, monto_solicitado, plazo_meses, tasa_anual,
        destino, fuente_pago, garantia_tipo, comentarios,
        'solicitud', req.usuario.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creando crédito:', err);
    res.status(500).json({ error: 'Error al crear solicitud de crédito' });
  }
});

// PATCH /api/creditos/:id/estatus - Cambiar estatus (workflow)
router.patch('/:id/estatus', verificarRol(['admin', 'ejecutivo', 'comite']), async (req, res) => {
  const { estatus } = req.body;
  const estatusValidos = ['solicitud', 'en_evaluacion', 'comite', 'aprobado', 'rechazado', 'contratado', 'activo', 'vencido', 'liquidado'];

  if (!estatusValidos.includes(estatus)) {
    return res.status(400).json({ error: 'Estatus no válido' });
  }

  try {
    const result = await db.query(
      `UPDATE creditos SET estatus = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *`,
      [estatus, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crédito no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando crédito:', err);
    res.status(500).json({ error: 'Error al actualizar crédito' });
  }
});

module.exports = router;
