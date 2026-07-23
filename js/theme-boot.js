/* Evita flash de tema incorrecto antes de cargar CSS */
(function () {
  try {
    var t = localStorage.getItem('cmr-theme') || 'light';
    if (t !== 'dark' && t !== 'light') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
