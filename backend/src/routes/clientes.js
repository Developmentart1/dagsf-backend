const express = require('express');
const db = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/clientes - Listar clientes (con paginación)
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, tipo, busqueda } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = [];
    let params = [];
    let paramIdx = 1;

    if (tipo) {
      where.push(`tipo_persona = $${paramIdx++}`);
      params.push(tipo);
    }
    if (busqueda) {
      where.push(`(nombre ILIKE $${paramIdx} OR rfc ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
      params.push(`%${busqueda}%`);
      paramIdx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM clientes ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT id, nombre, tipo_persona, rfc, email, telefono, ciudad, estado, creado_en
       FROM clientes ${whereClause}
       ORDER BY creado_en DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: result.rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Error listando clientes:', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
        (SELECT json_agg(json_build_object('id', e.id, 'tipo', e.tipo, 'estatus', e.estatus, 'creado_en', e.creado_en))
         FROM expedientes e WHERE e.cliente_id = c.id) as expedientes
       FROM clientes c WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo cliente:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

// POST /api/clientes - Crear cliente (ejecutivo o admin)
router.post('/', verificarRol(['admin', 'ejecutivo', 'fiduciario']), async (req, res) => {
  const {
    nombre, tipo_persona, rfc, curp, email, telefono, telefono_alt,
    calle, num_ext, num_int, colonia, ciudad, estado, cp,
    origen_recursos, pep, actividad_economica
  } = req.body;

  if (!nombre || !tipo_persona || !rfc) {
    return res.status(400).json({ error: 'Nombre, tipo_persona y RFC son requeridos' });
  }

  try {
    const result = await db.query(
      `INSERT INTO clientes (
        nombre, tipo_persona, rfc, curp, email, telefono, telefono_alt,
        calle, num_ext, num_int, colonia, ciudad, estado, cp,
        origen_recursos, pep, actividad_economica, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        nombre, tipo_persona, rfc, curp, email, telefono, telefono_alt,
        calle, num_ext, num_int, colonia, ciudad, estado, cp,
        origen_recursos, pep, actividad_economica, req.usuario.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El RFC o email ya está registrado' });
    }
    console.error('Error creando cliente:', err);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

module.exports = router;
