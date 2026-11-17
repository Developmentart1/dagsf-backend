const express = require('express');
const db = require('../config/database');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();

const ROLES_LECTURA = ['admin', 'director', 'ejecutivo', 'fiduciario', 'comite', 'legal'];
const ROLES_ESCRITURA = ['admin', 'director', 'ejecutivo'];

// ------------------------------------------------------------------
// POST /api/leads  (publico: solicitudes desde los micrositios)
// ------------------------------------------------------------------
router.post('/', async (req, res) => {
  const {
    tipo = 'lead',
    nombre,
    empresa,
    email,
    telefono,
    necesidad,
    producto,
    mensaje,
    origen,
    website // honeypot: los bots lo llenan, los humanos no
  } = req.body || {};

  // Honeypot: responder OK pero no guardar
  if (website && String(website).trim()) {
    return res.status(202).json({ ok: true, lead: null });
  }

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  if (tipo === 'newsletter') {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Correo electronico invalido' });
    }
  }

  try {
    const result = await db.query(
      `INSERT INTO leads (
         tipo, nombre, empresa, email, telefono, necesidad, producto, mensaje, origen, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'nuevo')
       RETURNING id, tipo, nombre, empresa, email, necesidad, producto, mensaje, origen, status, creado_en`,
      [
        tipo === 'newsletter' ? 'newsletter' : 'lead',
        String(nombre).trim(),
        empresa ? String(empresa).trim() : null,
        email ? String(email).trim() : null,
        telefono ? String(telefono).trim() : null,
        necesidad ? String(necesidad).trim() : null,
        producto ? String(producto).trim() : null,
        mensaje ? String(mensaje).trim() : null,
        origen ? String(origen).trim() : null
      ]
    );

    res.status(201).json({ ok: true, lead: result.rows[0] });
  } catch (err) {
    console.error('Error creando lead:', err);
    res.status(500).json({ error: 'Error al registrar la solicitud' });
  }
});

// ------------------------------------------------------------------
// GET /api/leads  (interno)
// ------------------------------------------------------------------
router.get('/', verificarToken, verificarRol(ROLES_LECTURA), async (req, res) => {
  const { status, tipo, origen, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const where = [];
    const params = [];
    let idx = 1;

    if (status) { where.push(`status = $${idx++}`); params.push(status); }
    if (tipo) { where.push(`tipo = $${idx++}`); params.push(tipo); }
    if (origen) { where.push(`origen = $${idx++}`); params.push(origen); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = await db.query(`SELECT COUNT(*) FROM leads ${whereSql}`, params);
    const total = parseInt(count.rows[0].count);

    const rows = await db.query(
      `SELECT * FROM leads ${whereSql}
       ORDER BY creado_en DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: rows.rows,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Error listando leads:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// ------------------------------------------------------------------
// GET /api/leads/:id
// ------------------------------------------------------------------
router.get('/:id', verificarToken, verificarRol(ROLES_LECTURA), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo lead:', err);
    res.status(500).json({ error: 'Error al obtener la solicitud' });
  }
});

// ------------------------------------------------------------------
// PATCH /api/leads/:id  (actualizar estado / notas)
// ------------------------------------------------------------------
router.patch('/:id', verificarToken, verificarRol(ROLES_ESCRITURA), async (req, res) => {
  const { status, notas } = req.body || {};
  const validos = ['nuevo', 'en_revision', 'atendido', 'descartado'];

  if (status && !validos.includes(status)) {
    return res.status(400).json({ error: 'Estado invalido' });
  }

  try {
    const result = await db.query(
      `UPDATE leads
       SET status = COALESCE($1, status),
           notas = COALESCE($2, notas),
           actualizado_en = NOW()
       WHERE id = $3
       RETURNING *`,
      [status || null, notas || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando lead:', err);
    res.status(500).json({ error: 'Error al actualizar la solicitud' });
  }
});

module.exports = router;
