/* Mia Insights, application de démonstration.

   Ce que l'application montre : une analyse complète n'est pas développée, elle
   est demandée. On écrit une phrase, l'agent écrit le code, l'exécute, et une
   page entière apparaît dans la navigation, avec ses graphiques et ses chiffres.
   Les pages déjà présentes au démarrage ont été produites de la même façon.

   TOUTES LES DONNÉES SONT INVENTÉES. Voir demo/README.md et la vue « À propos ».

   Organisation du fichier :
   1. état de l'application et filtres
   2. petites fabriques d'éléments (cartes, tuiles, tableaux)
   3. les recettes, une par analyse : le prompt, le code montré, les graphiques
   4. la barre latérale et le routage des vues
   5. le panneau « demander une analyse »  */

(function () {
  'use strict';

  var D = window.DEMO;

  /* ============================================================ 1. état */

  var etat = {
    vue: 'apercu',
    filtres: { periode: 12, branche: '*', reseau: '*' },
    produites: ['portefeuille'],          // analyses déjà générées au démarrage
    curseurs: {}                          // valeur des curseurs, par analyse
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmt(v, d, u) { return VZ.fmt(v, d, u); }
  function esc(s) { return VZ.esc(s); }

  /* =============================================== 2. fabriques d'éléments */

  function carte(host, id, large) {
    var d = el('div', 'vz' + (large ? ' wide' : ''));
    d.id = id;
    host.appendChild(d);
    return d;
  }
  function grille(host, large) {
    var g = el('div', 'grid');
    host.appendChild(g);
    return g;
  }
  function tuiles(host, liste) {
    var k = el('div', 'kpis');
    liste.forEach(function (t) {
      k.appendChild(el('div', 'kpi',
        '<div class="l">' + esc(t.l) + '</div><div class="v">' + esc(t.v) + '</div>'
        + (t.d ? '<div class="d ' + (t.dir || '') + '">' + esc(t.d) + '</div>' : '')));
    });
    host.appendChild(k);
    return k;
  }
  function grosChiffre(host, o) {
    host.appendChild(el('div', 'hero',
      '<span class="l">' + esc(o.l) + '</span><span class="v">' + esc(o.v) + '</span>'
      + '<span class="d">' + esc(o.d) + '</span><span class="n">' + esc(o.n) + '</span>'));
  }
  function avertissement(host, texte) {
    host.appendChild(el('div', 'viewnote',
      '<span class="tag">Données fictives</span><span>' + texte + '</span>'));
  }
  function commande(host, html) {
    var c = el('div', 'vz-ctl', html);
    host.appendChild(c);
    return c;
  }
  function tableau(host, titre, sous, entetes, lignes) {
    var t = el('div', 'tbl');
    var h = '<h3>' + esc(titre) + '</h3><p class="s">' + esc(sous) + '</p><div class="wrap"><table><thead><tr>';
    entetes.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    lignes.forEach(function (r) {
      h += '<tr>';
      r.forEach(function (c) { h += '<td>' + c + '</td>'; });
      h += '</tr>';
    });
    t.innerHTML = h + '</tbody></table></div>';
    host.appendChild(t);
    return t;
  }

  /* ================================================ 3. les analyses, par recette

     Chaque recette porte le prompt qui l'a produite, le code que l'agent a
     écrit, et la fonction qui dessine la page. La fonction est rappelée à
     chaque changement de filtre ou de curseur. */

  var RECETTES = [
    /* ------------------------------------------------------- portefeuille */
    {
      id: 'portefeuille',
      titre: 'Portefeuille et rentabilité',
      direction: 'Finance et actuariat',
      resume: 'Primes, charge de sinistres, ratio par branche et dérive trimestre par trimestre.',
      prompt: 'Analyse la rentabilité technique du portefeuille : primes acquises et charge de '
        + 'sinistres par trimestre, ratio sinistres sur primes par branche avec le repère de 75 %, '
        + 'et une lecture branche par branche et trimestre par trimestre pour voir où ça dérive.',
      filtres: true,
      code: 'sql',
      source: 'SELECT b.branche, t.trimestre,\n'
        + '       SUM(p.prime_acquise)            AS primes,\n'
        + '       SUM(s.charge_brute)             AS charge,\n'
        + '       SUM(s.charge_brute) / SUM(p.prime_acquise) AS ratio\n'
        + '  FROM primes p\n'
        + '  JOIN sinistres s USING (numero_police)\n'
        + '  JOIN branches  b USING (code_branche)\n'
        + '  JOIN calendrier t ON t.date_id = p.date_effet\n'
        + ' WHERE t.trimestre >= :debut\n'
        + '   AND (:branche = \'*\' OR b.code_branche = :branche)\n'
        + ' GROUP BY b.branche, t.trimestre\n'
        + ' ORDER BY t.trimestre;',
      rendre: function (host, f) {
        var d = D.portefeuille(f);
        grosChiffre(host, {
          l: 'Résultat technique cumulé sur la période',
          v: fmt(Math.round(d.resultat / 1000), 1) + ' M€',
          d: 'ratio combiné ' + fmt(d.combine, 1, '%'),
          n: 'Primes acquises moins charge de sinistres moins frais de gestion, ces derniers posés '
            + 'à 22,1 % des primes. Un seul chiffre en tête, le reste est en dessous.'
        });
        tuiles(host, [
          { l: 'Primes acquises', v: fmt(Math.round(d.totP / 1000), 1) + ' M€' },
          { l: 'Charge de sinistres', v: fmt(Math.round(d.totC / 1000), 1) + ' M€' },
          { l: 'Ratio sinistres sur primes', v: fmt(d.sp, 1, '%'),
            d: d.sp > 75 ? 'au-dessus du repère de 75 %' : 'sous le repère de 75 %',
            dir: d.sp > 75 ? 'down' : 'up' },
          { l: 'Délai moyen de prise en charge', v: fmt(d.delai, 1, 'j') },
          { l: 'Trimestres sous revue', v: String(f.periode) }
        ]);
        var g = grille(host);
        VZ.columns(carte(g, 'p-primes', true), {
          title: 'Primes acquises et charge de sinistres, par trimestre',
          sub: 'En milliers d’euros. Les deux séries sont dans la même unité, donc sur une seule échelle.',
          cats: d.lbl,
          series: [
            { name: 'Primes acquises', color: 'var(--vz-s1)', values: d.primes },
            { name: 'Charge de sinistres', color: 'var(--vz-s2)', values: d.charge }
          ],
          catLabel: 'Trimestre', height: 240, padB: 40, yLabel: 'milliers d’euros',
          caption: 'Données inventées. L’écart entre les deux barres est ce qui reste avant frais de gestion.'
        });
        VZ.bars(carte(g, 'p-sp'), {
          title: 'Ratio sinistres sur primes, par branche',
          sub: 'Moyenne sur la période filtrée.',
          width: 500, rule: { value: 75, label: 'repère 75 %' },
          cats: d.cles.map(function (k) { return D.BRANCHES[k].nom; }),
          values: d.spBranche, dec: 1, unit: '%', rowH: 30, padL: 132,
          catLabel: 'Branche', valueLabel: 'Ratio S sur P',
          color: function (v) { return v > 75 ? 'var(--vz-s2)' : 'var(--vz-s1)'; },
          legendItems: [
            { name: 'Sous le repère', color: 'var(--vz-s1)' },
            { name: 'Au-dessus du repère', color: 'var(--vz-s2)' }
          ],
          caption: 'Données inventées. Le repère de 75 % est une convention interne, pas une norme.'
        });
        var m = D.mouvements(f);
        VZ.columns(carte(g, 'p-mouv'), {
          title: 'Affaires nouvelles et résiliations, par trimestre',
          sub: 'En nombre de contrats, comptées de part et d’autre du zéro.',
          width: 500, cats: m.lbl, stacked: true,
          series: [
            { name: 'Affaires nouvelles', color: 'var(--vz-s1)', values: m.nouvelles },
            { name: 'Résiliations', color: 'var(--vz-s2)', values: m.resiliations }
          ],
          catLabel: 'Trimestre', height: 230, padB: 40, yLabel: 'contrats',
          caption: 'Données inventées.'
        });
        VZ.heat(carte(g, 'p-heat', true), {
          title: 'Ratio sinistres sur primes, branche par branche et trimestre par trimestre',
          sub: 'La lecture utile est horizontale : une ligne qui fonce vers la droite est une branche qui dérive.',
          rows: d.cles.map(function (k) { return D.BRANCHES[k].nom; }),
          cols: d.lbl,
          values: d.cles.map(function (k) {
            return d.parBranche[k].map(function (x) { return Math.round(x.sp * 1000) / 10; });
          }),
          dec: 1, unit: '%', rowLabel: 'Branche', valueLabel: 'Ratio', cellH: 30, padL: 140,
          scale: ['ratio bas', 'ratio élevé'], caption: 'Données inventées.'
        });
      }
    },

    /* -------------------------------------------------------- tarification */
    {
      id: 'tarification',
      titre: 'Tarification automobile',
      direction: 'Finance et actuariat',
      resume: 'Prime pure par âge et par zone, prime technique contre prime pratiquée, effet d’un ajustement.',
      prompt: 'Construis une analyse de tarification automobile : la prime pure par tranche d’âge '
        + 'et par zone sur trois exercices, puis ajuste un modèle fréquence multipliée par coût, '
        + 'sors la prime technique par segment et compare-la à la prime pratiquée. Ajoute un '
        + 'curseur pour tester une hausse sur les profils avec sinistre récent.',
      code: 'py',
      source: '# fréquence en Poisson, coût moyen en gamma, prime technique = produit des deux\n'
        + 'import pandas as pd, statsmodels.api as sm\n\n'
        + 'freq = sm.GLM(y_nb, X, family=sm.families.Poisson(),\n'
        + '              offset=np.log(expo)).fit()\n'
        + 'cout = sm.GLM(y_cout[y_nb > 0], X[y_nb > 0],\n'
        + '              family=sm.families.Gamma(sm.families.links.log())).fit()\n\n'
        + 'prime_technique = freq.predict(X) * cout.predict(X) * (1 + chargement)\n'
        + 'ecart = (prime_technique - prime_pratiquee) / prime_pratiquee * 100',
      rendre: function (host, f) {
        var h = etat.curseurs.tarification === undefined ? 0 : etat.curseurs.tarification;
        var t = D.tarification(h);
        tuiles(host, [
          { l: 'Marge technique du portefeuille', v: fmt(t.marge, 1, '%'),
            d: h ? 'après ajustement de +' + h + ' %' : 'situation actuelle', dir: h ? 'up' : '' },
          { l: 'Contrats touchés par l’ajustement', v: fmt(t.touches, 0) },
          { l: 'Contrats sur-tarifés de plus de 8 %', v: fmt(t.surTarifes, 0),
            d: 'risque de résiliation à surveiller' },
          { l: 'Prime moyenne du portefeuille', v: fmt(t.primeMoyenne, 0, '€') }
        ]);
        var c = commande(host,
          '<label>Ajustement appliqué aux profils avec sinistre responsable récent'
          + '<input type="range" id="c-tarif" min="0" max="20" step="1" value="' + h + '">'
          + '<output>+' + h + ' %</output></label>'
          + '<span class="hint">Le curseur ne touche que les trois segments concernés. '
          + 'Les tuiles et les barres se recalculent.</span>');
        c.querySelector('input').addEventListener('input', function (e) {
          etat.curseurs.tarification = Number(e.target.value);
          rendreVue();
        });
        var g = grille(host);
        VZ.heat(carte(g, 't-heat'), {
          title: 'Prime pure annuelle par tranche d’âge et par zone, en euros',
          sub: 'Fréquence multipliée par coût moyen, trois exercices clos.',
          width: 520,
          rows: D.PRIME_PURE.lignes, cols: D.PRIME_PURE.colonnes, values: D.PRIME_PURE.valeurs,
          rowLabel: 'Tranche d’âge', valueLabel: 'Prime pure', unit: '€', cellH: 30, padL: 110,
          scale: ['prime basse', 'prime haute'],
          caption: 'Données inventées. La lecture qui compte est l’écart entre deux colonnes à âge égal.'
        });
        VZ.bars(carte(g, 't-ecart'), {
          title: 'Écart entre prime technique et prime pratiquée, par segment',
          sub: 'Une barre vers la droite veut dire que le segment est tarifé sous son coût technique.',
          width: 520, cats: t.cats, values: t.ecarts, dec: 1, unit: '%', rowH: 29, padL: 168,
          catLabel: 'Segment', valueLabel: 'Écart',
          color: function (v) { return v >= 0 ? 'var(--vz-pos)' : 'var(--vz-neg)'; },
          legendItems: [
            { name: 'Sous-tarifé', color: 'var(--vz-pos)' },
            { name: 'Sur-tarifé', color: 'var(--vz-neg)' }
          ],
          caption: 'Données inventées. Un écart n’est pas une erreur : il peut être un choix commercial assumé.'
        });
        var note = el('div', 'about');
        note.innerHTML = '<h3>Ce que l’analyse ne dit pas</h3><p>Un modèle qui touche au prix ou à '
          + 'l’accès à un produit d’assurance est un système à haut risque au sens du règlement '
          + 'européen sur l’IA. Ce qui est produit ici est une aide à l’analyse, pas un tarif '
          + 'appliqué. Et un écart de tarification peut venir d’un choix commercial assumé, d’une '
          + 'contrainte réglementaire, ou d’un segment que l’on accepte de perdre : l’outil montre '
          + 'l’écart, il ne dit pas quoi en faire.</p>';
        host.appendChild(note);
      }
    },

    /* ------------------------------------------------------ provisionnement */
    {
      id: 'provisionnement',
      titre: 'Provisionnement',
      direction: 'Finance et actuariat',
      resume: 'Triangle des règlements cumulés, facteurs de passage, charge ultime et provision.',
      prompt: 'Construis le triangle des règlements cumulés par exercice de survenance et par '
        + 'année de développement sur la responsabilité civile, déroule-le en chain ladder, et '
        + 'donne-moi la charge ultime et la provision à constituer.',
      code: 'py',
      source: '# chain ladder, facteurs pondérés par les volumes\n'
        + 'cumul = reglements.pivot_table(index="survenance", columns="dev",\n'
        + '                               values="montant", aggfunc="sum").cumsum(axis=1)\n\n'
        + 'f = [cumul.iloc[:n-j-1, j+1].sum() / cumul.iloc[:n-j-1, j].sum()\n'
        + '     for j in range(n - 1)]\n\n'
        + 'plein = cumul.copy()\n'
        + 'for i in range(n):\n'
        + '    for j in range(1, n):\n'
        + '        if pd.isna(plein.iat[i, j]):\n'
        + '            plein.iat[i, j] = plein.iat[i, j-1] * f[j-1]\n\n'
        + 'provision = plein.iloc[:, -1].sum() - cumul.ffill(axis=1).iloc[:, -1].sum()',
      rendre: function (host) {
        var t = D.triangle();
        tuiles(host, [
          { l: 'Charge ultime estimée', v: fmt(t.ultime, 0) + ' k€' },
          { l: 'Déjà réglé', v: fmt(t.regle, 0) + ' k€' },
          { l: 'Provision à constituer', v: fmt(t.provision, 0) + ' k€' },
          { l: 'Cadence à un an', v: '46 %', d: 'part réglée la première année' }
        ]);
        var box = el('div', 'vz');
        var h = '<p class="vz-title">Triangle des règlements cumulés, en milliers d’euros</p>'
          + '<p class="vz-sub">Les cellules pleines sont observées, celles en pointillé sont '
          + 'déroulées par les facteurs de passage.</p><div class="vz-tri"><table><thead><tr><th>Survenance</th>';
        for (var j = 0; j < t.ans.length; j++) h += '<th>' + j + '</th>';
        h += '<th>Ultime</th><th>Provision</th></tr></thead><tbody>';
        t.plein.forEach(function (r, i) {
          h += '<tr><td>' + t.ans[i] + '</td>';
          r.forEach(function (v, j) {
            var proj = t.obs[i][j] === null;
            h += '<td class="' + (proj ? 'proj' : '') + '" title="'
              + (proj ? 'valeur déroulée' : 'valeur observée') + '">' + fmt(v, 0) + '</td>';
          });
          var ult = r[t.ans.length - 1];
          var reg = t.obs[i].filter(function (v) { return v !== null; }).pop();
          h += '<td class="fac">' + fmt(ult, 0) + '</td><td class="ibnr">' + fmt(ult - reg, 0) + '</td></tr>';
        });
        h += '<tr><td>Facteurs de passage</td>';
        t.fac.forEach(function (v) { h += '<td class="fac">' + fmt(v, 3) + '</td>'; });
        h += '<td class="fac">1,000</td><td class="fac">' + fmt(t.ultime, 0) + '</td>'
          + '<td class="ibnr">' + fmt(t.provision, 0) + '</td></tr></tbody></table></div>'
          + '<p class="caption">Données inventées. Survoler une cellule indique si elle est observée ou déroulée.</p>';
        box.innerHTML = h;
        host.appendChild(box);
        var note = el('div', 'about');
        note.innerHTML = '<h3>La relance qui suit</h3><p>Le triangle est le geste le plus banal du '
          + 'métier et le plus pénible à refaire à la main. L’intérêt n’est pas de le produire, '
          + 'c’est de pouvoir demander tout de suite « refais-le en excluant les trois sinistres '
          + 'les plus lourds », puis « refais-le par produit », et de comparer. Chaque variante est '
          + 'une nouvelle question, pas un nouveau développement.</p>';
        host.appendChild(note);
      }
    },

    /* ------------------------------------------------------------ forecast */
    {
      id: 'forecast',
      titre: 'Projection du résultat',
      direction: 'Finance et actuariat',
      resume: 'Résultat technique projeté à quatre trimestres, saisonnalité, fourchette et scénarios.',
      prompt: 'Prends le résultat technique trimestriel des trois dernières années, tiens compte '
        + 'de la saisonnalité, et projette les quatre prochains trimestres avec une fourchette. '
        + 'Montre-moi ce que ça donne si la sinistralité se dégrade de cinq points.',
      code: 'py',
      source: '# tendance et saisonnalité séparées, fourchette sur la dispersion des résidus\n'
        + 'from statsmodels.tsa.seasonal import STL\n\n'
        + 'stl   = STL(serie, period=4, robust=True).fit()\n'
        + 'tend  = np.polyfit(range(len(stl.trend)), stl.trend, 1)\n'
        + 'saison = stl.seasonal[-4:].values\n\n'
        + 'proj  = [np.polyval(tend, len(serie)+k) * (1 + choc) + saison[k % 4]\n'
        + '         for k in range(4)]\n'
        + 'marge = stl.resid.std() * np.sqrt(np.arange(1, 5))',
      rendre: function (host) {
        var s = etat.curseurs.forecast || 'central';
        var d = D.forecast(s);
        var c = commande(host,
          '<span class="seg" id="c-scen">'
          + '<button type="button" data-s="bas"' + (s === 'bas' ? ' class="on"' : '') + '>Sinistralité dégradée</button>'
          + '<button type="button" data-s="central"' + (s === 'central' ? ' class="on"' : '') + '>Tendance actuelle</button>'
          + '<button type="button" data-s="haut"' + (s === 'haut' ? ' class="on"' : '') + '>Sinistralité améliorée</button>'
          + '</span><span class="hint">Le scénario ne change que la partie projetée, à droite du trait.</span>');
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b) return;
          etat.curseurs.forecast = b.getAttribute('data-s');
          rendreVue();
        });
        tuiles(host, [
          { l: 'Quatre prochains trimestres, cumul', v: fmt(d.cumul, 0) + ' k€' },
          { l: 'Écart au scénario central',
            v: d.ecart === 0 ? '0 %' : (d.ecart > 0 ? '+' : '') + fmt(d.ecart * 100, 0, '%') },
          { l: 'Fourchette au dernier trimestre', v: fmt(d.lo[15], 0) + ' à ' + fmt(d.hi[15], 0) },
          { l: 'Trimestre le plus faible', v: 'T3', d: 'saisonnalité récurrente' }
        ]);
        var g = grille(host);
        VZ.lines(carte(g, 'f-serie', true), {
          title: 'Résultat technique trimestriel, en milliers d’euros',
          sub: 'Douze trimestres observés, quatre projetés. Une seule échelle, la fourchette est celle du scénario retenu.',
          x: d.x,
          series: [{ name: 'Résultat technique', color: 'var(--vz-s1)', values: d.serie, dashFrom: 11 }],
          band: { lo: d.lo, hi: d.hi, color: 'var(--vz-s1)' },
          futureFrom: 11, futureLabel: 'projection', tickEvery: 2, height: 270,
          xLabel: 'Trimestre', yLabel: 'milliers d’euros',
          caption: 'Données inventées. La fourchette s’élargit avec l’horizon, comme il se doit.'
        });
      }
    },

    /* ------------------------------------------------------------ sinistres */
    {
      id: 'sinistres',
      titre: 'Flux sinistres et charge',
      direction: 'Opérations et sinistres',
      resume: 'Délai par canal, dérive de fréquence par garantie, flux entrant contre capacité.',
      prompt: 'Analyse le flux sinistres : le délai moyen de prise en charge par canal d’entrée sur '
        + 'douze semaines, une carte de contrôle de la fréquence par garantie avec des limites à '
        + 'trois écarts types, et une projection du flux entrant à huit semaines comparée à ce que '
        + 'l’équipe peut traiter.',
      filtres: true,
      code: 'py',
      source: '# 1. délai par canal   2. carte de contrôle   3. projection de charge\n'
        + 'delai = (dossiers.query("rouvert == False")\n'
        + '         .assign(j=lambda d: (d.premiere_action - d.reception).dt.days)\n'
        + '         .groupby(["canal", "semaine"]).j.mean())\n\n'
        + 'attendu = STL(freq, period=52).fit().trend + saison\n'
        + 'lo, hi  = attendu.mean() - 3*resid.std(), attendu.mean() + 3*resid.std()\n\n'
        + 'stock = np.maximum.accumulate(np.cumsum(flux_projete - capacite)).clip(0)',
      rendre: function (host, f) {
        var dl = D.delais(f);
        var gar = etat.curseurs.garantie === undefined ? 0 : etat.curseurs.garantie;
        var ct = D.controle(gar);
        var eff = etat.curseurs.effectif === undefined ? 13 : etat.curseurs.effectif;
        var fx = D.flux(eff);
        tuiles(host, [
          { l: 'Délai moyen, tous canaux', v: fmt(D.portefeuille(f).delai, 1, 'j') },
          { l: 'Semaines hors limites, ' + ct.nom.toLowerCase(), v: String(ct.hors),
            d: ct.hors ? 'à instruire' : 'rien à signaler', dir: ct.hors ? 'down' : 'up' },
          { l: 'Capacité hebdomadaire', v: fmt(fx.cap, 0) + ' dossiers' },
          { l: 'Stock à huit semaines', v: fmt(fx.stock, 0) + ' dossiers',
            d: fx.stock ? 'le retard s’installe' : 'aucun retard', dir: fx.stock ? 'down' : 'up' },
          { l: 'Première semaine en retard', v: fx.premiere || 'aucune' }
        ]);
        var g = grille(host);
        VZ.lines(carte(g, 's-delai', true), {
          title: 'Délai moyen de prise en charge, par canal d’entrée',
          sub: 'Douze semaines, réouvertures exclues. Le trait est l’engagement de deux jours.',
          x: dl.sem,
          series: dl.canaux.map(function (n, i) {
            return { name: n, color: 'var(--vz-s' + (i + 1) + ')', values: dl.series[i] };
          }),
          dec: 1, unit: 'j', height: 250, tickEvery: 1, xLabel: 'Semaine', yLabel: 'jours ouvrés',
          rule: { value: 2, label: 'engagement 2 j' },
          caption: 'Données inventées. Un décrochage appelle une deuxième question, pas une conclusion.'
        });
        var c = commande(host,
          '<span class="seg" id="c-gar">'
          + D.GARANTIES.map(function (x, i) {
            return '<button type="button" data-g="' + i + '"' + (i === gar ? ' class="on"' : '') + '>'
              + esc(x.nom) + '</button>';
          }).join('')
          + '</span><span class="hint">Chaque garantie a son propre attendu saisonnier.</span>');
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b) return;
          etat.curseurs.garantie = Number(b.getAttribute('data-g'));
          rendreVue();
        });
        var g2 = grille(host);
        VZ.lines(carte(g2, 's-ctrl', true), {
          title: 'Fréquence hebdomadaire pour mille contrats exposés · ' + ct.nom,
          sub: 'Observé contre attendu saisonnier, limites à trois écarts types.',
          x: ct.sem,
          series: [
            { name: 'Attendu saisonnier', color: 'var(--vz-gray)', values: ct.attendu },
            { name: 'Observé', color: 'var(--vz-s1)', values: ct.observe }
          ],
          dec: 2, height: 250, tickEvery: 4, endLabels: false,
          xLabel: 'Semaine', yLabel: 'pour mille contrats',
          limits: { lo: ct.lo, hi: ct.hi, loLabel: 'limite basse', hiLabel: 'limite haute' },
          flagSeries: 1,
          caption: 'Données inventées. Un point rouge n’est pas un problème, c’est une semaine à regarder.'
        });
        var c2 = commande(host,
          '<label>Gestionnaires présents<input type="range" id="c-eff" min="8" max="20" step="1" value="'
          + eff + '"><output>' + eff + '</output></label>'
          + '<span class="hint">Capacité posée à ' + D.PAR_GESTIONNAIRE
          + ' dossiers par gestionnaire et par semaine, c’est une hypothèse assumée, pas une mesure.</span>');
        c2.querySelector('input').addEventListener('input', function (e) {
          etat.curseurs.effectif = Number(e.target.value);
          rendreVue();
        });
        var g3 = grille(host);
        VZ.lines(carte(g3, 's-flux', true), {
          title: 'Dossiers entrants par semaine, et capacité de traitement',
          sub: 'Dix semaines observées, huit projetées. Les deux séries sont dans la même unité.',
          x: fx.lbl,
          series: [
            { name: 'Dossiers entrants', color: 'var(--vz-s1)', values: fx.serie, dashFrom: fx.coupe },
            { name: 'Capacité de l’équipe', color: 'var(--vz-s2)',
              values: fx.serie.map(function () { return fx.cap; }) }
          ],
          height: 250, tickEvery: 2, futureFrom: fx.coupe, futureLabel: 'projection',
          xLabel: 'Semaine', yLabel: 'dossiers par semaine',
          caption: 'Données inventées. Il faudrait ' + fx.absorbe + ' personnes pour absorber le pic.'
        });
      }
    },

    /* ------------------------------------------------------------ attrition */
    {
      id: 'attrition',
      titre: 'Attrition et relance',
      direction: 'Marketing et commercial',
      resume: 'Transformation par campagne, rétention par cohorte, poids des variables, simulation de relance.',
      prompt: 'Analyse l’attrition : le taux de transformation des quatre dernières campagnes par '
        + 'segment avec le repère de deux et demi pour cent, la courbe de rétention par cohorte de '
        + 'souscription sur trente-six mois, les variables qui pèsent dans le départ en excluant '
        + 'celles connues après la résiliation, et combien de clients relancer.',
      code: 'py',
      source: '# survie par cohorte, puis modèle de durée, puis optimisation de l’effort\n'
        + 'from lifelines import KaplanMeierFitter, CoxPHFitter\n\n'
        + 'km = KaplanMeierFitter().fit(duree, evenement)          # censure à droite prise en compte\n'
        + 'cox = CoxPHFitter().fit(X.drop(columns=POSTERIEURES),   # fuite de données écartée\n'
        + '                        "duree", "resilie")\n\n'
        + 'score  = cox.predict_partial_hazard(X).rank(pct=True)\n'
        + 'valeur = sauves(part) * PRIME - part * N * COUT_CONTACT\n'
        + 'optimum = valeur.idxmax()',
      rendre: function (host) {
        var part = etat.curseurs.relance === undefined ? 20 : etat.curseurs.relance;
        var r = D.relance(), i = part / 2, ret = D.retention();
        tuiles(host, [
          { l: 'Contrats relancés', v: fmt(r.portefeuille * part / 100, 0) },
          { l: 'Contrats sauvés estimés', v: fmt(r.sauves[i], 0) },
          { l: 'Coût de la relance', v: fmt(r.couts[i], 0) + ' €' },
          { l: 'Valeur nette préservée', v: fmt(r.valeur[i], 0) + ' k€',
            d: i === r.best ? 'c’est l’optimum' : 'optimum à ' + r.parts[r.best],
            dir: i === r.best ? 'up' : '' }
        ]);
        var g = grille(host);
        VZ.columns(carte(g, 'a-camp'), {
          title: 'Taux de transformation par campagne et par segment',
          sub: 'Souscriptions dans les quatre-vingt-dix jours qui suivent le contact.',
          width: 520, cats: D.CAMPAGNES,
          series: D.SEGMENTS_CLIENT.map(function (s, k) {
            return { name: s.nom, color: 'var(--vz-s' + (k + 1) + ')', values: s.v };
          }),
          dec: 1, unit: '%', catLabel: 'Campagne', height: 240, yLabel: 'taux de transformation',
          ref: { value: 2.5, label: 'repère métier, 2,5 %' },
          caption: 'Données inventées. Sans le repère, on compare les barres entre elles.'
        });
        VZ.bars(carte(g, 'a-poids'), {
          title: 'Poids des variables dans le départ',
          sub: 'Variables postérieures au départ écartées à la demande.',
          width: 520, cats: ret.variables, values: ret.poids, rowH: 26, padL: 186,
          catLabel: 'Variable', valueLabel: 'Poids relatif', color: 'var(--vz-s1)',
          caption: 'Données inventées. Un poids n’est pas une cause.'
        });
        VZ.lines(carte(g, 'a-reten', true), {
          title: 'Contrats encore en portefeuille, par cohorte de souscription',
          sub: 'Base cent au mois de souscription. Les contrats en cours à la date d’arrêt sont traités comme tels.',
          x: ret.mois,
          series: ret.cohortes.map(function (c, k) {
            return { name: c.nom, color: 'var(--vz-s' + (k + 1) + ')', values: c.v };
          }),
          dec: 1, unit: '%', height: 260, tickEvery: 3,
          xLabel: 'Mois depuis la souscription', yLabel: 'contrats restants, base 100',
          caption: 'Données inventées. Les décrochements au douzième et au vingt-quatrième mois sont les échéances annuelles.'
        });
        var c = commande(host,
          '<label>Part du portefeuille relancée, du score le plus élevé au plus bas'
          + '<input type="range" id="c-rel" min="0" max="60" step="2" value="' + part + '">'
          + '<output>' + part + ' %</output></label>'
          + '<span class="hint">Coût posé à ' + r.cout + ' € par contact, prime annuelle moyenne à '
          + r.prime + ' €.</span>');
        c.querySelector('input').addEventListener('input', function (e) {
          etat.curseurs.relance = Number(e.target.value);
          rendreVue();
        });
        var g2 = grille(host);
        VZ.lines(carte(g2, 'a-sim', true), {
          title: 'Valeur nette préservée selon la part du portefeuille relancée, en milliers d’euros',
          sub: 'Primes des contrats sauvés moins le coût des contacts. Tout est en euros, une seule échelle.',
          x: r.parts,
          series: [{ name: 'Valeur nette préservée', color: 'var(--vz-s1)', values: r.valeur }],
          height: 250, tickEvery: 3, endLabels: false,
          xLabel: 'Part relancée', yLabel: 'milliers d’euros',
          rule: { value: r.valeur[r.best], label: 'optimum, ' + r.parts[r.best] },
          caption: 'Données inventées. Le sommet se déplace dès qu’on change le coût du contact ou l’efficacité supposée.'
        });
        VZ.bars(carte(g2, 'a-motifs', true), {
          title: 'Motifs de résiliation déclarés',
          sub: 'Motif renseigné à la clôture du contrat.',
          cats: D.MOTIFS.libelles, values: D.MOTIFS.parts, unit: '%', rowH: 26, padL: 200,
          catLabel: 'Motif', valueLabel: 'Part', color: 'var(--vz-s1)',
          caption: 'Données inventées. Un motif déclaré n’est pas une cause.'
        });
      }
    },

    /* --------------------------------------------------------------- fraude */
    {
      id: 'fraude',
      titre: 'Anomalies et seuil',
      direction: 'Risque et fraude',
      resume: 'Taux d’anomalies par prestataire, arbitrage du seuil, queue de distribution des montants.',
      prompt: 'Analyse les anomalies : le taux de dossiers portant au moins un signal par garantie '
        + 'et par prestataire en ne gardant que ceux à plus de deux cents dossiers, la précision et '
        + 'le rappel du score selon le seuil, et la distribution des montants réglés par tranche.',
      code: 'sql',
      source: '-- le filtre de volume s’applique AVANT le calcul du taux\n'
        + 'WITH vol AS (\n'
        + '  SELECT prestataire, COUNT(*) AS n\n'
        + '    FROM dossiers WHERE periode BETWEEN :debut AND :fin\n'
        + '   GROUP BY prestataire HAVING COUNT(*) > 200)\n'
        + 'SELECT d.prestataire, d.famille,\n'
        + '       100.0 * SUM(CASE WHEN d.signaux > 0 THEN 1 ELSE 0 END) / COUNT(*) AS taux\n'
        + '  FROM dossiers d JOIN vol USING (prestataire)\n'
        + ' GROUP BY d.prestataire, d.famille;',
      rendre: function (host) {
        var s = etat.curseurs.seuil === undefined ? 70 : etat.curseurs.seuil;
        var a = D.auSeuil(s), pr = D.courbePR(), F = D.FRAUDE;
        tuiles(host, [
          { l: 'Dossiers à instruire par an', v: fmt(a.retenus, 0),
            d: a.retenus > F.capacite ? 'au-delà de la capacité de ' + F.capacite : 'dans la capacité',
            dir: a.retenus > F.capacite ? 'down' : 'up' },
          { l: 'Dossiers qui ne donneront rien', v: fmt(a.faux, 0) },
          { l: 'Cas fondés couverts', v: fmt(a.vrais, 0) + ' sur ' + fmt(F.fondes, 0) },
          { l: 'Montant couvert, ordre de grandeur',
            v: fmt(Math.round(a.vrais * F.montantMoyen / 1000), 0) + ' k€' }
        ]);
        var c = commande(host,
          '<label>Seuil de déclenchement<input type="range" id="c-seuil" min="30" max="95" step="1" value="'
          + s + '"><output>' + s + '</output></label>'
          + '<span class="hint">La capacité d’instruction de la cellule est posée à ' + F.capacite
          + ' dossiers par an. Le seuil est un arbitrage de direction, pas un réglage technique.</span>');
        c.querySelector('input').addEventListener('input', function (e) {
          etat.curseurs.seuil = Number(e.target.value);
          rendreVue();
        });
        var g = grille(host);
        VZ.lines(carte(g, 'r-pr', true), {
          title: 'Précision et rappel du score d’anomalies, selon le seuil',
          sub: 'Les deux séries sont des pourcentages, donc sur une seule échelle.',
          x: pr.seuils,
          series: [
            { name: 'Précision, part des dossiers retenus qui sont fondés', color: 'var(--vz-s1)', values: pr.precision },
            { name: 'Rappel, part des cas fondés qui sont retenus', color: 'var(--vz-s2)', values: pr.rappel }
          ],
          dec: 1, unit: '%', height: 250, tickEvery: 5, endLabels: false,
          xLabel: 'Seuil', yLabel: 'pourcentage',
          rule: { value: pr.precision[s - 30], label: 'précision au seuil ' + s },
          caption: 'Données inventées. Monter le seuil augmente la précision et fait baisser le rappel.'
        });
        VZ.heat(carte(g, 'r-heat'), {
          title: 'Part des dossiers portant au moins une anomalie, en pourcentage',
          sub: 'Prestataires à plus de deux cents dossiers. Les noms sont des étiquettes anonymes.',
          width: 520, rows: F.prestataires, cols: F.familles, values: F.taux,
          dec: 1, unit: '%', rowLabel: 'Prestataire', valueLabel: 'Taux', cellH: 28, padL: 116,
          scale: ['taux faible', 'taux élevé'],
          caption: 'Données inventées. Une cellule qui sort est une liste de dossiers à ouvrir, pas une conclusion.'
        });
        var montants = F.nb.map(function (n, i) { return Math.round(n * F.milieu[i] / 1000); });
        var total = montants.reduce(function (x, y) { return x + y; }, 0);
        VZ.columns(carte(g, 'r-queue'), {
          title: 'Montant total réglé par tranche de montant, en milliers d’euros',
          sub: 'Neuf tranches croissantes. Le nombre de dossiers est dans le tableau replié.',
          width: 520, cats: F.tranches,
          series: [{ name: 'Montant réglé', color: 'var(--vz-s1)', values: montants }],
          catLabel: 'Tranche', height: 240, padB: 46, yLabel: 'milliers d’euros', labelMax: true,
          caption: 'Données inventées. Les vingt-huit dossiers des deux dernières tranches portent '
            + Math.round((montants[7] + montants[8]) / total * 100) + ' % du montant total.'
        });
        var note = el('div', 'about');
        note.innerHTML = '<h3>La règle qui encadre cette analyse</h3><p>Nous ne détectons pas de la '
          + 'fraude, nous détectons des anomalies que d’autres qualifient. Ces graphiques produisent '
          + 'des signaux et montrent pourquoi. L’enquête, la confrontation et le jugement restent '
          + 'humains.</p><p>Le calcul de la précision et du rappel suppose un historique de dossiers '
          + '<strong>qualifiés</strong> par la cellule, c’est-à-dire dont on sait après enquête s’ils '
          + 'étaient fondés. Sans ce retour, l’outil ne peut que compter des signaux.</p>';
        host.appendChild(note);
      }
    },

    /* ------------------------------------------------------------------ RH */
    {
      id: 'rh',
      titre: 'Baromètre et démographie',
      direction: 'Ressources humaines',
      resume: 'Baromètre par direction avec seuil d’effectif, départs à cinq ans, écart de compétences.',
      prompt: 'Analyse le baromètre interne : la répartition des réponses par direction en excluant '
        + 'les directions de moins de dix répondants, en barres centrées sur la réponse neutre. '
        + 'Ajoute la pyramide des âges avec la part qui atteint l’âge de départ dans les cinq ans, '
        + 'et l’écart entre compétences détenues et demandées. Aucune donnée individuelle.',
      code: 'py',
      source: '# le seuil d’effectif est appliqué dans la source, pas laissé à la question\n'
        + 'SEUIL = 10\n\n'
        + 'rep = (reponses.groupby(["direction", "modalite"]).size()\n'
        + '       .unstack(fill_value=0))\n'
        + 'rep = rep[rep.sum(axis=1) >= SEUIL]        # anonymat des répondants\n'
        + 'rep = rep.div(rep.sum(axis=1), axis=0) * 100\n\n'
        + 'assert "matricule" not in rep.columns      # aucune donnée individuelle en sortie',
      rendre: function (host) {
        var R = D.RH;
        var totalDeparts = R.partent.reduce(function (a, b) { return a + b; }, 0);
        var effectif = R.reste.reduce(function (a, b) { return a + b; }, 0) + totalDeparts;
        tuiles(host, [
          { l: 'Effectif couvert', v: fmt(effectif, 0) },
          { l: 'Départs prévisibles à cinq ans', v: fmt(totalDeparts, 0),
            d: fmt(totalDeparts / effectif * 100, 0, '% de l’effectif') },
          { l: 'Directions retenues au baromètre', v: String(R.directions.length),
            d: 'deux écartées, moins de dix répondants' },
          { l: 'Écart de compétences le plus fort', v: 'Automatisation', d: 'indemnisation et systèmes' }
        ]);
        var g = grille(host);
        VZ.likert(carte(g, 'h-baro', true), {
          title: '« Je dispose des moyens de faire mon travail correctement »',
          sub: 'Répartition des réponses par direction, centrée sur la réponse neutre. Le nombre à droite est le total favorable.',
          cats: R.directions, negCount: 2,
          series: R.modalites.map(function (m, k) {
            return { name: m.nom, color: m.c, values: R.reponses.map(function (r) { return r[k]; }) };
          }),
          catLabel: 'Direction', padL: 172, rowH: 34,
          caption: 'Données inventées. Deux directions de moins de dix répondants ont été retirées, et c’est écrit plutôt que caché.'
        });
        VZ.columns(carte(g, 'h-pyr'), {
          title: 'Effectif par tranche d’âge, et départs dans les cinq ans',
          sub: 'Volumes agrégés. Aucun identifiant individuel n’entre dans ce calcul.',
          width: 520, cats: R.ages, stacked: true,
          series: [
            { name: 'Reste en poste au-delà de cinq ans', color: 'var(--vz-s1)', values: R.reste },
            { name: 'Atteint l’âge de départ dans les cinq ans', color: 'var(--vz-s4)', values: R.partent }
          ],
          catLabel: 'Tranche d’âge', height: 240, yLabel: 'nombre de personnes',
          caption: 'Données inventées. Projection démographique, pas prédiction de comportement.'
        });
        VZ.heat(carte(g, 'h-comp'), {
          title: 'Écart entre compétences demandées et détenues, en personnes',
          sub: 'Un nombre positif veut dire qu’il manque des personnes sur cette compétence.',
          width: 520, rows: R.equipes, cols: R.competences, values: R.ecarts,
          rowLabel: 'Équipe', valueLabel: 'Écart', cellH: 28, padL: 128,
          scale: ['écart faible', 'écart fort'],
          caption: 'Données inventées. Point de départ d’un plan de formation, pas d’une évaluation.'
        });
        var note = el('div', 'about');
        note.innerHTML = '<h3>Le cadre, avant les chiffres</h3><ol>'
          + '<li>Aucun résultat sur un effectif trop petit. Un taux calculé sur six personnes n’est '
          + 'plus un agrégat, c’est une désignation. Le seuil est posé dans la source, pas dans la question.</li>'
          + '<li>Aucune donnée de rémunération, au même titre que les données client et de santé.</li>'
          + '<li>Une analyse portant sur les salariés suppose l’information et la consultation des '
          + 'représentants du personnel. Cette page s’en tient à des projections démographiques, '
          + 'jamais à un score individuel.</li></ol>';
        host.appendChild(note);
      }
    },

    /* ----------------------------------------------------------- adoption */
    {
      id: 'adoption',
      titre: 'Adoption des outils',
      direction: 'Transformation',
      resume: 'Usage réel par direction, entonnoir des besoins, trajectoire à douze mois.',
      prompt: 'Analyse l’adoption des outils IA : les utilisateurs actifs par semaine et par '
        + 'direction en comptant comme actif au moins trois usages dans la semaine, comparés aux '
        + 'comptes ouverts. Ajoute l’entonnoir des besoins du recensé au lancé, et où l’on en sera '
        + 'dans un an si le rythme se maintient.',
      code: 'sql',
      source: '-- un compte ouvert n’est pas un utilisateur : le seuil d’activité est explicite\n'
        + 'SELECT direction, semaine, COUNT(DISTINCT utilisateur) AS actifs\n'
        + '  FROM (SELECT direction, utilisateur, semaine, COUNT(*) AS usages\n'
        + '          FROM journaux_usage\n'
        + '         GROUP BY 1, 2, 3\n'
        + '        HAVING COUNT(*) >= 3) AS actifs_semaine\n'
        + ' GROUP BY direction, semaine\n'
        + ' ORDER BY semaine;',
      rendre: function (host) {
        var A = D.adoption();
        var actifs = A.usage.reduce(function (a, s) { return a + s.v[25]; }, 0);
        tuiles(host, [
          { l: 'Utilisateurs actifs cette semaine', v: fmt(actifs, 0) },
          { l: 'Comptes ouverts', v: fmt(A.comptes, 0),
            d: fmt(A.comptes - actifs, 0) + ' comptes sans usage', dir: 'down' },
          { l: 'Besoins recensés depuis janvier', v: fmt(A.entonnoir[0], 0) },
          { l: 'Cas d’usage lancés', v: fmt(A.entonnoir[3], 0),
            d: fmt(A.entonnoir[3] / A.entonnoir[0] * 100, 0, '% du recensé') }
        ]);
        var g = grille(host);
        VZ.lines(carte(g, 'd-usage', true), {
          title: 'Utilisateurs actifs par semaine, par direction',
          sub: 'Est actif quelqu’un qui a fait au moins trois usages dans la semaine.',
          x: A.sem,
          series: A.usage.map(function (s, k) {
            return { name: s.nom, color: 'var(--vz-s' + (k + 1) + ')', values: s.v };
          }),
          height: 250, tickEvery: 3, xLabel: 'Semaine', yLabel: 'utilisateurs actifs',
          rule: { value: A.comptes, label: 'comptes ouverts, ' + A.comptes },
          caption: 'Données inventées. L’écart entre les courbes et le trait est l’information, pas le total.'
        });
        VZ.bars(carte(g, 'd-funnel'), {
          title: 'Du besoin remonté au cas d’usage lancé',
          sub: 'Même ensemble de départ à chaque étape.',
          width: 520, cats: A.etapes, values: A.entonnoir, rowH: 32, padL: 150,
          catLabel: 'Étape', valueLabel: 'Nombre', color: 'var(--vz-s1)',
          caption: 'Données inventées. La plus forte perte est entre le recensement et la qualification.'
        });
        VZ.lines(carte(g, 'd-proj'), {
          title: 'Part de l’effectif utilisant régulièrement les outils',
          sub: 'Douze mois observés, douze prolongés par une courbe de diffusion qui sature.',
          width: 520, x: A.mois,
          series: A.projection.map(function (s, k) {
            return { name: s.nom, color: 'var(--vz-s' + (k + 1) + ')', values: s.v, dashFrom: 11 };
          }),
          dec: 1, unit: '%', height: 250, tickEvery: 4, futureFrom: 11, futureLabel: 'prolongement',
          xLabel: 'Mois', yLabel: 'part de l’effectif',
          rule: { value: 50, label: 'moitié de l’effectif' },
          caption: 'Données inventées. Une courbe ajustée sur douze points et prolongée de douze mois est une hypothèse, pas une prévision.'
        });
      }
    }
  ];

  function recette(id) {
    for (var i = 0; i < RECETTES.length; i++) if (RECETTES[i].id === id) return RECETTES[i];
    return null;
  }

  /* ============================================ 4. barre latérale et routage */

  var ICONES = {
    apercu: '<path d="M3 13h7V3H3zM14 21h7V11h-7zM14 8h7V3h-7zM3 21h7v-5H3z"/>',
    analyse: '<path d="M5 20V13M12 20V5M19 20v-4"/>',
    source: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    apropos: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/>'
  };
  function ico(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
      + 'stroke-linecap="round" stroke-linejoin="round">' + ICONES[k] + '</svg>';
  }

  function dessinerMenu() {
    var nav = document.getElementById('menu');
    var h = '<a href="#apercu" data-v="apercu"' + (etat.vue === 'apercu' ? ' class="on"' : '') + '>'
      + ico('apercu') + 'Vue d’ensemble</a>';
    h += '<div class="grp">Analyses produites</div>';
    if (!etat.produites.length) {
      h += '<div style="padding:.4rem .55rem;font-size:.82rem;color:#7fa5ad">Aucune pour l’instant.</div>';
    }
    etat.produites.forEach(function (id) {
      var r = recette(id);
      h += '<a href="#' + id + '" data-v="' + id + '"' + (etat.vue === id ? ' class="on"' : '') + '>'
        + ico('analyse') + esc(r.titre) + '</a>';
    });
    h += '<a href="#nouvelle" data-v="nouvelle" style="color:#8fc6ce">' + ico('plus') + 'Demander une analyse</a>';
    h += '<div class="grp">L’application</div>'
      + '<a href="#sources" data-v="sources"' + (etat.vue === 'sources' ? ' class="on"' : '') + '>'
      + ico('source') + 'Sources de données</a>'
      + '<a href="#apropos" data-v="apropos"' + (etat.vue === 'apropos' ? ' class="on"' : '') + '>'
      + ico('apropos') + 'À propos</a>';
    nav.innerHTML = h;
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var v = a.getAttribute('data-v');
        if (v === 'nouvelle') { ouvrirChat(); return; }
        allerA(v);
        document.querySelector('.side').classList.remove('open');
      });
    });
  }

  function allerA(v) {
    etat.vue = v;
    dessinerMenu();
    rendreVue();
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------- les vues */

  function vueApercu(host, f) {
    avertissement(host, '<b>Toutes les données de cette application sont inventées.</b> Elles ne '
      + 'décrivent aucun assureur réel : ni portefeuille, ni clients, ni salariés, ni résultats. '
      + 'Voir <a href="#apropos" data-go="apropos">À propos</a>.');
    recette('portefeuille').rendre(host, f);
    var note = el('div', 'about');
    note.innerHTML = '<h2>Cette page a été produite par une phrase</h2>'
      + '<p>Aucun développement, aucun tableau de bord à maintenir. Quelqu’un a écrit ce qu’il '
      + 'voulait voir, l’agent a écrit la requête, l’a exécutée et a mis en forme le résultat. '
      + 'Les analyses de la barre latérale ont toutes été produites de la même façon, et le prompt '
      + 'qui a produit chacune est affiché en haut de sa page.</p>'
      + '<p><strong>Pour en produire une nouvelle</strong>, le bouton « Poser une question » en haut '
      + 'à droite. Une page complète apparaît dans la navigation, avec ses graphiques, ses chiffres '
      + 'et le code qui les a produits.</p>';
    host.appendChild(note);
  }

  function vueAnalyse(host, r, f) {
    var head = el('div', 'about');
    head.innerHTML = '<h2>' + esc(r.titre) + '</h2>'
      + '<p style="color:var(--mi-muted)"><strong>' + esc(r.direction) + '</strong> · ' + esc(r.resume) + '</p>'
      + '<h3>Le prompt qui a produit cette page</h3>'
      + '<p style="background:var(--mi-accent-soft);border-radius:12px;padding:.7rem .9rem">'
      + esc(r.prompt) + '</p>'
      + '<details class="code"><summary>Voir le code écrit par l’agent</summary><pre>'
      + coloriser(r.source, r.code) + '</pre></details>';
    host.appendChild(head);
    avertissement(host, '<b>Données inventées.</b> Cette page montre une forme de réponse et une '
      + 'méthode, pas un résultat.');
    r.rendre(host, f);
  }

  function vueSources(host) {
    var head = el('div', 'about');
    head.innerHTML = '<h2>Sources de données</h2><p>Ce que l’application lit, et ce qu’elle ne lit '
      + 'pas encore. Deux sources seulement sont réellement branchées à ce jour. Les analyses de '
      + 'cette démonstration supposent les autres, et le disent.</p>';
    host.appendChild(head);
    tableau(host, 'État des sources', 'Une ligne par source, avec le droit d’accès et la dernière mise à jour.',
      ['Source', 'État', 'Volume', 'Mise à jour', 'Droit d’accès', 'Remarque'],
      D.SOURCES.map(function (s) {
        var lib = { ok: 'Branchée', wait: 'À brancher', stop: 'Bloquée' }[s.etat];
        return [esc(s.nom), '<span class="dot ' + s.etat + '">' + lib + '</span>',
          esc(s.lignes), esc(s.maj), esc(s.droits), esc(s.note)];
      }));
    var note = el('div', 'about');
    note.innerHTML = '<h3>Le point qui commande tout le reste</h3><p>Le filtrage des droits n’est '
      + 'pas branché sur l’authentification d’entreprise. Tant que ce point n’est pas repris, '
      + 'aucune source portant des données à accès restreint ne peut être branchée, et cette '
      + 'application reste une démonstration. C’est le premier des travaux, et il ne se règle pas '
      + 'dans l’outil : il se règle avec l’équipe qui tient l’annuaire d’entreprise.</p>'
      + '<h3>Les quatre conditions pour brancher une source</h3><ol>'
      + '<li>Le sens de chaque colonne est écrit quelque part. Sans cela, l’agent traduit une '
      + 'question française vers une colonne dont personne ne garantit le sens.</li>'
      + '<li>Une clé qui relie la source aux autres.</li>'
      + '<li>Une date qui fait foi, choisie et la même partout.</li>'
      + '<li>Le droit de lire, appliqué à la personne connectée.</li></ol>';
    host.appendChild(note);
  }

  function vueApropos(host) {
    var a = el('div', 'about');
    a.innerHTML = '<h2>À propos de cette démonstration</h2>'
      + '<p>Cette application montre ce que devient l’analyse de données quand une page entière se '
      + 'demande au lieu de se développer. Chaque analyse de la barre latérale a été produite par '
      + 'une phrase, et le prompt qui l’a produite est affiché en haut de sa page, avec le code '
      + 'écrit par l’agent.</p>'
      + '<h3>Ce que ces chiffres ne sont pas</h3>'
      + '<p><strong>Toutes les données sont inventées</strong>, produites par un générateur '
      + 'pseudo-aléatoire à graine fixe pour que l’application montre la même chose à chaque '
      + 'ouverture. Elles ne décrivent ni le portefeuille, ni les clients, ni les salariés, ni les '
      + 'résultats d’un assureur réel, et aucun chiffre ne doit être cité hors de cette application. Aucun nom '
      + 'de personne n’y figure, les prestataires sont des étiquettes anonymes.</p>'
      + '<p>Le sujet de cette démonstration est la façon de travailler, pas les chiffres : une analyse '
      + 'se demande, elle ne se développe pas.</p>'
      + '<h3>Ce qu’il faudrait pour que cette application existe</h3><ol>'
      + '<li><strong>Brancher le filtrage des droits sur l’authentification d’entreprise.</strong> '
      + 'Rien ne se déploie avant.</li>'
      + '<li><strong>Brancher les sources</strong>, avec pour chacune une définition écrite des '
      + 'variables. C’est le chantier de gouvernance de la donnée, et cette démonstration le rend '
      + 'concret plutôt que de le remplacer.</li>'
      + '<li><strong>Construire la boucle de mesure.</strong> Rien ne dit encore si une réponse est '
      + 'juste. Un modèle mal spécifié produit un graphique convaincant.</li>'
      + '<li><strong>Reprendre le code du prototype</strong>, qui n’est pas écrit pour durer.</li></ol>'
      + '<h3>Comment les graphiques sont faits</h3>'
      + '<p>Une bibliothèque SVG écrite à la main, sans dépendance, parce que l’application doit '
      + 's’ouvrir sans serveur. Les règles de dessin sont constantes : une seule échelle de valeurs '
      + 'par graphique et jamais deux axes, barres de vingt-quatre pixels au plus à bout arrondi du '
      + 'côté de la valeur, deux pixels de surface entre deux marques qui se touchent, étiquettes '
      + 'directes sur les seuls extrêmes, et jamais la couleur d’une série portée par du texte. '
      + 'Toute valeur lisible au survol est aussi lisible dans le tableau replié sous chaque '
      + 'graphique.</p>'
      + '<h3>Retour</h3><p><a href="../index.html">Retour au site</a>, qui explique le principe, '
      + 'ce que l’on peut demander métier par métier, et comment poser une question exploitable.</p>';
    host.appendChild(a);
  }

  var TITRES = { apercu: 'Vue d’ensemble', sources: 'Sources de données', apropos: 'À propos' };

  function rendreVue() {
    var host = document.getElementById('vue');
    var f = etat.filtres;
    host.classList.add('load');
    host.innerHTML = '';
    var r = recette(etat.vue);
    document.getElementById('titre').textContent = r ? r.titre : (TITRES[etat.vue] || 'Vue d’ensemble');
    var avecFiltres = etat.vue === 'apercu' || (r && r.filtres);
    document.getElementById('filtres').style.display = avecFiltres ? '' : 'none';
    document.getElementById('stamp').textContent = avecFiltres
      ? f.periode + ' trimestres · '
        + (f.branche === '*' ? 'toutes branches' : D.BRANCHES[f.branche].nom.toLowerCase())
        + ' · ' + D.RESEAUX[f.reseau].nom
      : 'données fictives';

    if (etat.vue === 'apercu') vueApercu(host, f);
    else if (etat.vue === 'sources') vueSources(host);
    else if (etat.vue === 'apropos') vueApropos(host);
    else if (r) vueAnalyse(host, r, f);

    host.querySelectorAll('[data-go]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); allerA(a.getAttribute('data-go')); });
    });
    window.setTimeout(function () { host.classList.remove('load'); }, 20);
  }

  /* Coloration très simple du code montré, sans dépendance. */
  function coloriser(src, langue) {
    var t = esc(src);
    t = t.replace(/(^|\n)(\s*)(--|#)([^\n]*)/g, '$1$2<span class="c">$3$4</span>');
    var mots = langue === 'sql'
      ? ['SELECT', 'FROM', 'JOIN', 'USING', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'WITH', 'AS', 'AND', 'OR', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ON', 'SUM', 'COUNT', 'DISTINCT', 'BETWEEN']
      : ['import', 'from', 'for', 'in', 'if', 'return', 'assert', 'lambda', 'def', 'not'];
    mots.forEach(function (m) {
      t = t.replace(new RegExp('(^|[^\\w])(' + m + ')([^\\w]|$)', 'g'), '$1<span class="k">$2</span>$3');
    });
    return t;
  }

  /* ================================= 5. le panneau « demander une analyse » */

  var chat = null, corps = null;

  function ouvrirChat() {
    chat.classList.add('open');
    document.getElementById('scrim').classList.add('on');
    var i = document.getElementById('q');
    window.setTimeout(function () { i.focus(); }, 240);
  }
  function fermerChat() {
    chat.classList.remove('open');
    document.getElementById('scrim').classList.remove('on');
  }

  function bulleUtilisateur(texte) {
    var m = el('div', 'msg me', '<div class="b"></div>');
    m.querySelector('.b').textContent = texte;
    corps.appendChild(m);
    corps.scrollTop = corps.scrollHeight;
  }

  function bulleAgent() {
    var m = el('div', 'msg ia',
      '<div class="who"><span class="m"></span>Mia Insights</div><div class="txt"></div>');
    corps.appendChild(m);
    corps.scrollTop = corps.scrollHeight;
    return m.querySelector('.txt');
  }

  var ETAPES = [
    'Je cherche les tables qui portent ces informations',
    'J’écris la requête et le calcul',
    'J’exécute sur la période demandée',
    'Je mets en forme et je construis la page'
  ];

  function repondre(r) {
    var txt = bulleAgent();
    var ul = el('ul', 'steps');
    txt.appendChild(ul);
    ETAPES.forEach(function (s, i) {
      window.setTimeout(function () {
        var li = el('li', null, '<span class="t">' + (i + 1) + '.</span><span>' + esc(s) + '</span>');
        ul.appendChild(li);
        corps.scrollTop = corps.scrollHeight;
      }, 260 * i);
    });
    window.setTimeout(function () {
      var d = el('div');
      d.innerHTML = '<details class="code"><summary>Voir le code que j’ai écrit</summary><pre>'
        + coloriser(r.source, r.code) + '</pre></details>'
        + '<p><strong>' + esc(r.titre) + '</strong> est prête. ' + esc(r.resume)
        + ' La page est ajoutée à la barre latérale, sous « Analyses produites ».</p>'
        + '<p><button class="send" data-open="' + r.id + '">Ouvrir l’analyse</button></p>';
      txt.appendChild(d);
      if (etat.produites.indexOf(r.id) < 0) etat.produites.push(r.id);
      dessinerMenu();
      chips();
      d.querySelector('[data-open]').addEventListener('click', function () {
        fermerChat();
        allerA(r.id);
      });
      corps.scrollTop = corps.scrollHeight;
    }, 260 * ETAPES.length + 200);
  }

  function refuser(texte) {
    var txt = bulleAgent();
    var restantes = RECETTES.filter(function (r) { return etat.produites.indexOf(r.id) < 0; });
    txt.innerHTML = '<p>Je ne sais pas produire celle-ci dans cette démonstration. Le vrai produit '
      + 'écrit la requête à partir des tables réellement branchées ; ici, les analyses sont '
      + 'préparées à l’avance pour que la page fonctionne sans serveur et sans données.</p>'
      + (restantes.length
        ? '<p>Ce que je peux produire maintenant : ' + restantes.map(function (r) {
          return '<strong>' + esc(r.titre.toLowerCase()) + '</strong>';
        }).join(', ') + '.</p>'
        : '<p>Toutes les analyses prévues dans la démonstration ont déjà été produites.</p>');
    corps.scrollTop = corps.scrollHeight;
  }

  /* Reconnaissance très simple : des mots-clés par recette, et rien d'inventé
     quand aucune ne correspond. */
  var MOTS = {
    portefeuille: ['portefeuille', 'rentabilit', 'primes', 'ratio', 's/p', 'combin', 'branche'],
    tarification: ['tarif', 'prime technique', 'prime pure', 'segment', 'glm', 'pricing'],
    provisionnement: ['provision', 'triangle', 'chain ladder', 'ultime', 'ibnr', 'reserv'],
    forecast: ['projet', 'prévision', 'prevision', 'forecast', 'trimestre prochain', 'scénario', 'scenario', 'résultat'],
    sinistres: ['sinistre', 'délai', 'delai', 'canal', 'flux', 'charge', 'gestionnaire', 'garantie', 'dérive', 'derive'],
    attrition: ['attrition', 'churn', 'résiliation', 'resiliation', 'rétention', 'retention', 'relance', 'campagne', 'cohorte'],
    fraude: ['fraude', 'anomalie', 'seuil', 'prestataire', 'faux positif', 'précision', 'precision', 'rappel'],
    rh: ['baromètre', 'barometre', 'rh', 'salari', 'effectif', 'âge', 'age', 'compétence', 'competence', 'départ', 'depart'],
    adoption: ['adoption', 'usage', 'licence', 'acculturation', 'ambassadeur', 'besoin', 'entonnoir']
  };

  function trouver(q) {
    var s = q.toLowerCase(), meilleur = null, score = 0;
    RECETTES.forEach(function (r) {
      var n = 0;
      (MOTS[r.id] || []).forEach(function (m) { if (s.indexOf(m) >= 0) n++; });
      if (n > score) { score = n; meilleur = r; }
    });
    return score > 0 ? meilleur : null;
  }

  function demander(q) {
    if (!q.trim()) return;
    bulleUtilisateur(q);
    var r = trouver(q);
    window.setTimeout(function () { r ? repondre(r) : refuser(q); }, 320);
  }

  function chips() {
    var host = document.getElementById('chips');
    var restantes = RECETTES.filter(function (r) { return etat.produites.indexOf(r.id) < 0; });
    host.innerHTML = restantes.map(function (r) {
      return '<button type="button" data-p="' + r.id + '">' + esc(r.titre) + '</button>';
    }).join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = recette(b.getAttribute('data-p'));
        demander(r.prompt);
      });
    });
  }

  /* ==================================================== démarrage de la page */

  document.addEventListener('DOMContentLoaded', function () {
    chat = document.getElementById('chat');
    corps = document.getElementById('chatbody');

    document.getElementById('ask').addEventListener('click', ouvrirChat);
    document.getElementById('closechat').addEventListener('click', fermerChat);
    document.getElementById('scrim').addEventListener('click', fermerChat);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermerChat(); });
    document.getElementById('burger').addEventListener('click', function () {
      document.querySelector('.side').classList.toggle('open');
    });

    var form = document.getElementById('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var i = document.getElementById('q');
      demander(i.value);
      i.value = '';
    });

    ['periode', 'branche', 'reseau'].forEach(function (k) {
      document.getElementById('f-' + k).addEventListener('change', function (e) {
        etat.filtres[k] = k === 'periode' ? Number(e.target.value) : e.target.value;
        rendreVue();
      });
    });

    var accueil = bulleAgent();
    accueil.innerHTML = '<p>Écrivez l’analyse que vous voulez voir. J’écris la requête, je '
      + 'l’exécute, et une page complète apparaît dans la barre latérale.</p>'
      + '<p style="color:var(--mi-muted);font-size:.85rem">Dans cette démonstration les analyses '
      + 'sont préparées à l’avance et les données sont inventées. Les propositions ci-dessous sont '
      + 'celles qui fonctionnent.</p>';

    chips();
    dessinerMenu();
    rendreVue();
  });
})();
