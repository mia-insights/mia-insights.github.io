/* Barre de navigation du site public Mia Insights.
   Injectée dans <div id="site-nav"></div>. Une seule liste à modifier pour
   ajouter une page. Les chemins sont relatifs à la racine du site ; le script
   ajoute « ../ » quand la page courante est dans un sous-dossier. */
(function () {
  var pages = [
    { f: 'index.html', l: 'Accueil' },
    { f: 'le-principe.html', n: '01', l: 'Le principe' },
    { f: 'les-analyses.html', n: '02', l: 'Les analyses' },
    { f: 'la-methode.html', n: '03', l: 'La méthode' },
    { f: 'apropos.html', l: 'À propos' },
    { f: 'demo/index.html', l: 'Démonstration', cta: true }
  ];

  var path = location.pathname.replace(/\\/g, '/').toLowerCase();
  if (path.charAt(path.length - 1) === '/') path += 'index.html';
  var dansDemo = path.indexOf('/demo/') >= 0;
  var prefixe = dansDemo ? '../' : '';

  function ici(f) {
    var p = (prefixe ? f : f).toLowerCase();
    return path.lastIndexOf(p) === path.length - p.length;
  }

  var html = '<a class="brand" href="' + prefixe + 'index.html">'
    + '<span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" '
    + 'stroke-linecap="round"><path d="M5 19V12M12 19V5M19 19v-4"/></svg></span>Mia Insights</a>'
    + '<button class="hamb" id="hamb" aria-label="Menu"><span></span><span></span><span></span></button>'
    + '<nav class="navlinks">';
  pages.forEach(function (p) {
    var actif = ici(p.f) ? ' active' : '';
    html += '<a class="' + (p.cta ? 'cta' : '') + actif + '" href="' + prefixe + p.f + '">'
      + (p.n ? '<span class="n">' + p.n + '</span>' : '') + p.l + '</a>';
  });
  html += '</nav>';

  var host = document.getElementById('site-nav');
  if (!host) return;
  host.className = 'nav';
  host.innerHTML = html;
  var b = document.getElementById('hamb');
  if (b) b.addEventListener('click', function () { host.classList.toggle('open'); });
})();
