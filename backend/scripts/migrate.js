const db = require('../src/config/database');

const schemas = [
  // ------------------------------------------------------------------
  // Usuarios internos
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL DEFAULT 'ejecutivo' CHECK (rol IN ('admin', 'director', 'fiduciario', 'ejecutivo', 'comite', 'legal')),
    activo BOOLEAN NOT NULL DEFAULT true,
    ultimo_acceso TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Clientes (PLD/FT)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(500) NOT NULL,
    tipo_persona VARCHAR(20) NOT NULL CHECK (tipo_persona IN ('fisica', 'moral')),
    rfc VARCHAR(13) UNIQUE NOT NULL,
    curp VARCHAR(18) UNIQUE,
    email VARCHAR(255),
    telefono VARCHAR(50),
    telefono_alt VARCHAR(50),
    calle VARCHAR(255),
    num_ext VARCHAR(50),
    num_int VARCHAR(50),
    colonia VARCHAR(255),
    ciudad VARCHAR(255),
    estado VARCHAR(100),
    cp VARCHAR(10),
    origen_recursos TEXT,
    pep BOOLEAN NOT NULL DEFAULT false,
    actividad_economica VARCHAR(255),
    estatus VARCHAR(50) NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo', 'bloqueado', 'lista_ofac')),
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Expedientes (documentos PLD)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS expedientes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL,
    estatus VARCHAR(50) NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'completo', 'en_revision', 'aprobado', 'rechazado')),
    notas TEXT,
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Créditos
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS creditos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    producto VARCHAR(100) NOT NULL CHECK (producto IN ('pyme', 'micro', 'nomina', 'deposito_garantizado', 'intermediacion', 'factoraje')),
    monto_solicitado DECIMAL(15,2) NOT NULL,
    monto_aprobado DECIMAL(15,2),
    plazo_meses INTEGER,
    tasa_anual DECIMAL(5,2),
    tasa_cat DECIMAL(5,2),
    destino TEXT,
    fuente_pago TEXT,
    garantia_tipo VARCHAR(100),
    comentarios TEXT,
    estatus VARCHAR(50) NOT NULL DEFAULT 'solicitud' CHECK (estatus IN ('solicitud', 'en_evaluacion', 'comite', 'aprobado', 'rechazado', 'contratado', 'activo', 'vencido', 'liquidado')),
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Fideicomisos
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS fideicomisos (
    id SERIAL PRIMARY KEY,
    numero_fideicomiso VARCHAR(100) UNIQUE NOT NULL,
    tipo_aplicacion VARCHAR(100) NOT NULL CHECK (tipo_aplicacion IN ('desarrollo', 'escrow', 'garantia', 'deposito', 'zona_restringida', 'administracion')),
    denominacion VARCHAR(500) NOT NULL,
    monto_inicial DECIMAL(15,2),
    moneda VARCHAR(10) NOT NULL DEFAULT 'MXN',
    fecha_constitucion DATE,
    notario VARCHAR(255),
    notaria_numero VARCHAR(50),
    estado VARCHAR(100),
    ciudad VARCHAR(100),
    proposito TEXT,
    instrucciones_especiales TEXT,
    estatus VARCHAR(50) NOT NULL DEFAULT 'en_constitucion' CHECK (estatus IN ('en_constitucion', 'constituido', 'activo', 'modificado', 'en_liquidacion', 'liquidado', 'cancelado')),
    creado_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Participantes de fideicomiso
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS participantes_fideicomiso (
    id SERIAL PRIMARY KEY,
    fideicomiso_id INTEGER NOT NULL REFERENCES fideicomisos(id) ON DELETE CASCADE,
    nombre VARCHAR(500) NOT NULL,
    rol VARCHAR(100) NOT NULL CHECK (rol IN ('fideicomitente', 'fideicomisario', 'beneficiario', 'comite_tecnico', 'fiduciario')),
    rfc VARCHAR(13),
    email VARCHAR(255),
    telefono VARCHAR(50),
    porcentaje DECIMAL(5,2),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Documentos almacenados (referencias a MinIO)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS documentos (
    id SERIAL PRIMARY KEY,
    entidad_tipo VARCHAR(50) NOT NULL CHECK (entidad_tipo IN ('cliente', 'credito', 'fideicomiso', 'expediente')),
    entidad_id INTEGER NOT NULL,
    nombre_original VARCHAR(500) NOT NULL,
    nombre_almacenado VARCHAR(1000) NOT NULL,
    categoria VARCHAR(100),
    mime_type VARCHAR(100),
    tamano_bytes INTEGER,
    subido_por INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Logs de auditoría
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    entidad_tipo VARCHAR(50),
    entidad_id INTEGER,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address INET,
    user_agent TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Leads (solicitudes desde los micrositios)
  // ------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL DEFAULT 'lead' CHECK (tipo IN ('lead', 'newsletter')),
    nombre VARCHAR(500) NOT NULL,
    empresa VARCHAR(500),
    email VARCHAR(255),
    telefono VARCHAR(50),
    necesidad VARCHAR(255),
    producto VARCHAR(100),
    mensaje TEXT,
    origen VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'en_revision', 'atendido', 'descartado')),
    notas TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  // ------------------------------------------------------------------
  // Índices
  // ------------------------------------------------------------------
  `CREATE INDEX IF NOT EXISTS idx_clientes_rfc ON clientes(rfc);`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_estatus ON clientes(estatus);`,
  `CREATE INDEX IF NOT EXISTS idx_creditos_cliente ON creditos(cliente_id);`,
  `CREATE INDEX IF NOT EXISTS idx_creditos_estatus ON creditos(estatus);`,
  `CREATE INDEX IF NOT EXISTS idx_fideicomisos_numero ON fideicomisos(numero_fideicomiso);`,
  `CREATE INDEX IF NOT EXISTS idx_documentos_entidad ON documentos(entidad_tipo, entidad_id);`,
  `CREATE INDEX IF NOT EXISTS idx_logs_auditoria ON logs_auditoria(creado_en DESC);`,
];

async function migrate() {
  console.log('🗄️  Ejecutando migraciones...\n');
  for (const sql of schemas) {
    try {
      await db.query(sql);
      console.log('✅ OK:', sql.substring(0, 60).replace(/\n/g, ' ') + '...');
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  console.log('\n🎉 Migraciones completadas.');
  await db.end();
}

migrate();
