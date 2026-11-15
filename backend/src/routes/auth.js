const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y password requeridos' });
  }

  try {
    const result = await db.query(
      'SELECT id, email, nombre, rol, password_hash FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// POST /api/auth/registro (solo admin)
router.post('/registro', async (req, res) => {
  const { email, password, nombre, rol = 'ejecutivo' } = req.body;
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol)
       VALUES ($1, $2, $3, $4) RETURNING id, email, nombre, rol`,
      [email, hashed, nombre, rol]
    );
    res.status(201).json({ usuario: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error('Error registro:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

module.exports = router;
