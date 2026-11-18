const express = require('express');
const db = require('../config/database');
const redis = require('../config/redis');
const { verificarToken, verificarRol } = require('../middleware/auth');

const router = express.Router();
const ROLES = ['admin', 'director', 'ejecutivo', 'legal'];
const TIPOS = new Set(['acceso', 'rectificacion', 'cancelacion', 'oposicion']);
const ESTADOS = new Set(['recibida', 'en_revision', 'respondida', 'rechazada']);

function texto(value, max = 10000) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max) || null;
}

function folio() {
  const fecha = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ARCO-${fecha}-${sufijo}`;
}

function publicarEvento(evento) {
  return redis.publish('dag:arco', JSON.stringify(evento));
}

// POST /api/arco — recepción pública de una solicitud ARCO.
router.post('/', async (req, res) => {
  const body = req.body || {};
  const tipoDerecho = texto(body.tipoDerecho, 30);
  const nombre = texto(body.nombre, 500);
  const correo = texto(body.correo, 255)?.toLowerCase();
  const domicilio = texto(body.domicilio, 1000);
  const idTipo = texto(body.idTipo, 100);
  const idNumero = texto(body.idNumero, 200);
  const medioRespuesta = texto(body.medioRespuesta, 200);
  const lugar = texto(body.lugar, 200);
  const fechaSolicitud = texto(body.fechaSolicitud, 30);

  if (!TIPOS.has(tipoDerecho) || !nombre || !correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo) ||
      !domicilio || !idTipo || !idNumero || !medioRespuesta || !lugar || !fechaSolicitud) {
    return res.status(400).json({ error: 'Faltan datos obligatorios de la solicitud ARCO' });
  }

  const datos = body.campos && typeof body.campos === 'object' && !Array.isArray(body.campos)
    ? body.campos
    : {};
  const client = await db.getClient();
  const solicitudFolio = folio();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO solicitudes_arco
        (folio, tipo_derecho, nombre, correo, telefono, domicilio, id_tipo, id_numero,
         representante, medio_respuesta, lugar, fecha_solicitud, campos, estado, bus_estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'recibida','pendiente')
       RETURNING id, folio, tipo_derecho, estado, creado_en`,
      [
        solicitudFolio,
        tipoDerecho,
        nombre,
        correo,
        texto(body.telefono, 50),
        domicilio,
        idTipo,
        idNumero,
        texto(body.representante, 1000),
        medioRespuesta,
        lugar,
        fechaSolicitud,
        JSON.stringify(datos)
      ]
    );
    await client.query('COMMIT');

    const solicitud = result.rows[0];
    let busEstado = 'publicado';
    try {
      // El bus lleva metadatos; los datos personales permanecen en PostgreSQL.
      await publicarEvento({
        event: 'arco.solicitud.recibida',
        solicitudId: solicitud.id,
        folio: solicitud.folio,
        tipoDerecho,
        occurredAt: solicitud.creado_en
      });
      await db.query('UPDATE solicitudes_arco SET bus_estado = $1, bus_publicado_en = NOW() WHERE id = $2', ['publicado', solicitud.id]);
    } catch (busError) {
      busEstado = 'error';
      await db.query('UPDATE solicitudes_arco SET bus_estado = $1, bus_error = $2 WHERE id = $3', ['error', busError.message.slice(0, 500), solicitud.id]);
      console.error('Error publicando evento ARCO:', busError);
    }

    res.status(201).json({ ok: true, folio: solicitud.folio, bus: busEstado });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creando solicitud ARCO:', error);
    res.status(500).json({ error: 'Error al registrar la solicitud ARCO' });
  } finally {
    client.release();
  }
});

// GET /api/arco — consulta interna para el panel operativo.
router.get('/', verificarToken, verificarRol(ROLES), async (req, res) => {
  const { estado, tipo, page = 1, limit = 50 } = req.query;
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const where = [];
  const params = [];
  let index = 1;
  if (estado && ESTADOS.has(estado)) { where.push(`estado = $${index++}`); params.push(estado); }
  if (tipo && TIPOS.has(tipo)) { where.push(`tipo_derecho = $${index++}`); params.push(tipo); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const count = await db.query(`SELECT COUNT(*) FROM solicitudes_arco ${whereSql}`, params);
    const rows = await db.query(
      `SELECT id, folio, tipo_derecho, nombre, correo, telefono, domicilio, medio_respuesta,
              estado, bus_estado, creado_en, actualizado_en
         FROM solicitudes_arco ${whereSql}
        ORDER BY creado_en DESC LIMIT $${index++} OFFSET $${index++}`,
      [...params, pageLimit, (pageNumber - 1) * pageLimit]
    );
    const total = Number(count.rows[0].count);
    res.json({ data: rows.rows, meta: { total, page: pageNumber, limit: pageLimit, pages: Math.ceil(total / pageLimit) } });
  } catch (error) {
    console.error('Error listando solicitudes ARCO:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes ARCO' });
  }
});

module.exports = router;
