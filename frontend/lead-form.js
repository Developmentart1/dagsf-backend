/**
 * DAG SF - Conexion de los formularios de los micrositios con la API.
 *
 * Se carga despues de /api.js. Intercepta el submit en fase de captura
 * (document, capture=true) para Ganarle al handler original del micrositio,
 * que solo preparaba un mensaje de WhatsApp sin enviarlo.
 *
 * Map automatico de campos por name:
 *   n / nombre   -> nombre
 *   e / empresa  -> empresa
 *   s            -> necesidad
 *   a            -> producto
 *   m / mensaje  -> mensaje
 *   email        -> email
 *   telefono     -> telefono
 *   cualquier otro campo con name -> se acumula en mensaje
 */
(function (global) {
  'use strict';

  var API = global.DAGSF && global.DAGSF.api;
  if (!API) {
    console.warn('[DAGSF] api.js no cargo; los formularios no se conectaran.');
    return;
  }

  var MAP = {
    n: 'nombre', nombre: 'nombre',
    e: 'empresa', empresa: 'empresa',
    s: 'necesidad', necesidad: 'necesidad',
    a: 'producto', producto: 'producto',
    m: 'mensaje', mensaje: 'mensaje',
    email: 'email', correo: 'email',
    telefono: 'telefono', tel: 'telefono'
  };

  function origenDe() {
    var p = (global.location && global.location.pathname) || '';
    if (/credito/i.test(p)) return 'creditos';
    if (/fideicomiso/i.test(p)) return 'fideicomisos';
    if (/^\/$|index\.html?$/i.test(p) || p === '') return 'home';
    return p.replace(/^\//, '').replace(/\.html?$/i, '') || 'web';
  }

  function salidaDe(form) {
    if (form.id === 'news') return document.getElementById('news-msg');
    return document.getElementById('cf-out') || document.getElementById('form-out');
  }

  function collecting(form) {
    var data = { tipo: 'lead', origen: origenDe(), website: '' };
    var extra = [];

    var fields = form.querySelectorAll('input, select, textarea');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var name = (el.name || '').trim();
      var type = (el.type || '').toLowerCase();

      // Honeypot anti-bots
      if (type === 'text' && (el.getAttribute('data-hp') === '1' || name === 'website')) {
        data.website = el.value || '';
        continue;
      }

      var value = (el.value || '').trim();
      if (!name) {
        // Campo sin name: solo nos sirve el email del newsletter
        if (type === 'email' && value) data.email = data.email || value;
        continue;
      }
      if (!value) continue;

      var key = MAP[name.toLowerCase()];
      if (key) {
        if (!data[key]) data[key] = value;
      } else {
        extra.push(name + ': ' + value);
      }
    }

    // Newsletter: sin name, solo el input[type=email]
    if (form.id === 'news') {
      var mail = form.querySelector('input[type="email"]');
      if (mail && mail.value && !data.email) data.email = mail.value.trim();
      data.tipo = 'newsletter';
      // El backend exige nombre: usamos el correo
      if (!data.nombre && data.email) data.nombre = data.email;
    }

    if (extra.length) {
      data.mensaje = ((data.mensaje || '') + (data.mensaje ? '\n' : '') + extra.join('\n')).trim();
    }

    return data;
  }

  function pinta(el, html) {
    if (!el) return;
    el.hidden = false;
    el.innerHTML = html;
  }

  function texto(sel, contenido) {
    return '<p style="margin-bottom:10px">' + contenido + '</p>';
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.id !== 'cf' && form.id !== 'news') return;

    // Ganarle al handler original del micrositio
    e.preventDefault();
    e.stopPropagation();

    var out = salidaDe(form);
    var data = collecting(form);
    var btn = form.querySelector('button[type="submit"]');
    var labelOriginal = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = 'Enviando...'; }

    API.post('/leads', data)
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.innerHTML = labelOriginal; }
        if (data.tipo === 'newsletter') {
          pinta(out, texto('sel', '<b>Listo.</b> Te suscribiste al boletin de DAG SF.'));
        } else {
          pinta(out, texto('sel', '<b>Solicitud recibida.</b> Un ejecutivo de DAG SF te contactara pronto.'));
        }
        if (global.console && console.log) console.log('[DAGSF] lead registrado', res);
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = labelOriginal; }
        pinta(out, texto('sel',
          '<b>No pudimos registrar tu solicitud.</b> ' +
          (err && err.message ? err.message : 'Intenta de nuevo.') +
          ' Si prefieres, <a href="https://wa.me/523349423012" target="_blank" rel="noopener">escribenos por WhatsApp</a>.'
        ));
        if (global.console && console.error) console.error('[DAGSF] lead fallo', err);
      });
  }, true);
})(window);
