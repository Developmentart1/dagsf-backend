const db = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Poblando datos de prueba...\n');

  // Usuario admin por defecto
  const hashedPassword = await bcrypt.hash('AdminDAG2026!', 12);
  try {
    await db.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@dagsf.com.mx', hashedPassword, 'Administrador DAG SF', 'admin']
    );
    console.log('✅ Usuario admin creado: admin@dagsf.com.mx / AdminDAG2026!');
  } catch (err) {
    console.error('Error creando admin:', err.message);
  }

  // Cliente de ejemplo
  try {
    const cliente = await db.query(
      `INSERT INTO clientes (nombre, tipo_persona, rfc, curp, email, telefono, ciudad, estado, origen_recursos, pep, actividad_economica, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, (SELECT id FROM usuarios WHERE email = 'admin@dagsf.com.mx'))
       ON CONFLICT (rfc) DO NOTHING
       RETURNING id`,
      [
        'Constructora Ejemplo S.A. de C.V.',
        'moral',
        'CEX010101ABC',
        null,
        'contacto@constructoraejemplo.com',
        '6691234567',
        'Mazatlán',
        'Sinaloa',
        'Actividad empresarial constructora',
        false,
        'Construcción de inmuebles'
      ]
    );

    if (cliente.rows.length > 0) {
      console.log('✅ Cliente de ejemplo creado');

      // Expediente de ejemplo
      await db.query(
        `INSERT INTO expedientes (cliente_id, tipo, estatus, notas, creado_por)
         VALUES ($1, $2, $3, $4, (SELECT id FROM usuarios WHERE email = 'admin@dagsf.com.mx'))`,
        [cliente.rows[0].id, 'identificacion', 'completo', 'Acta constitutiva y poderes revisados']
      );
      console.log('✅ Expediente de ejemplo creado');
    }
  } catch (err) {
    console.error('Error creando datos de ejemplo:', err.message);
  }

  console.log('\n🎉 Seed completado.');
  await db.end();
}

seed();
