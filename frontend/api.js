/**
 * DAG SF - Cliente de API
 * Uso basico en los micrositios:
 *
 *   <script src="/api.js"></script>
 *   <script>
 *     DAGSF.api.post('/clientes', { nombre: '...', tipo_persona: 'fisica', rfc: '...' })
 *       .then(cliente => console.log('Cliente creado', cliente));
 *   </script>
 */
(function (global) {
  'use strict';

  var BASE = global.DAGSF_API_BASE || '/api';
  var TOKEN_KEY = 'dagsf_token';

  function token() {
    try { return global.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function setToken(t) {
    try { global.localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }

  function clearToken() {
    try { global.localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function headers(extra) {
    var h = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return Object.assign(h, extra || {});
  }

  function handle(res) {
    if (res.status === 401) {
      clearToken();
      throw new Error('No autenticado. Inicia sesion en el portal.');
    }
    return res.json().catch(function () { return {}; }).then(function (data) {
      if (!res.ok) throw new Error(data.error || ('Error ' + res.status));
      return data;
    });
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var url = BASE + path;
    var init = { method: method, headers: headers(opts.headers) };
    if (body !== undefined && body !== null) {
      init.body = JSON.stringify(body);
    }
    return fetch(url, init).then(handle);
  }

  var api = {
    base: BASE,
    token: token,
    setToken: setToken,
    clearToken: clearToken,

    get: function (path, params) {
      var q = '';
      if (params) {
        var qs = Object.keys(params)
          .filter(function (k) { return params[k] !== undefined && params[k] !== null; })
          .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
          .join('&');
        if (qs) q = '?' + qs;
      }
      return request('GET', path + q);
    },
    post: function (path, body) { return request('POST', path, body); },
    put: function (path, body) { return request('PUT', path, body); },
    patch: function (path, body) { return request('PATCH', path, body); },
    del: function (path) { return request('DELETE', path); },

    // --- Atajos de dominio ---
    login: function (email, password) {
      return request('POST', '/auth/login', { email: email, password: password })
        .then(function (r) { setToken(r.token); return r; });
    },
    crearCliente: function (datos) { return api.post('/clientes', datos); },
    listarClientes: function (params) { return api.get('/clientes', params); },
    crearCredito: function (datos) { return api.post('/creditos', datos); },
    listarCreditos: function (params) { return api.get('/creditos', params); },
    crearFideicomiso: function (datos) { return api.post('/fideicomisos', datos); },
    listarFideicomisos: function (params) { return api.get('/fideicomisos', params); },
    health: function () { return api.get('/health'); }
  };

  global.DAGSF = global.DAGSF || {};
  global.DAGSF.api = api;
})(typeof window !== 'undefined' ? window : this);
