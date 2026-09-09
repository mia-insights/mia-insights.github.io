/* Mia Insights, application de démonstration.

   Ce que l'application montre : un tableau de bord ne se développe pas, il se
   demande. On écrit une phrase à Mia, elle écrit le code, l'exécute, et un
   miabord entier apparaît dans la navigation. Ensuite on le modifie de la même
   façon, en le lui disant, pendant qu'on le regarde : Mia occupe une colonne
   fixe à droite, à côté du miabord, et pas un panneau qui recouvre l'écran.

   TOUTES LES DONNÉES SONT INVENTÉES. Voir la vue « À propos ».

   Organisation du fichier :
   1. état de l'application, filtres, modifications par miabord
   2. petites fabriques d'éléments
   3. les recettes, une par miabord : le prompt, le code montré, les onglets
   4. la barre latérale, les onglets et le routage
   5. Mia : produire un miabord, en ouvrir un, le modifier  */

(function () {
  'use strict';

  var D = window.DEMO;

  /* ================================================== 1. état de l'application */

  var etat = {
    vue: 'apercu',
    filtres: { periode: 12, branche: '*', reseau: '*' },
    produits: ['portefeuille'],   // miabords déjà générés au démarrage
    mods: {},                     // modifications demandées, par miabord
    onglets: {}                   // onglet courant, par miabord
  };

  var CARTES_PORTEFEUILLE = [
    { id: 'primes', nom: 'primes et charge de sinistres' },
    { id: 'sp', nom: 'ratio sinistres sur primes par branche' },
    { id: 'mouvements', nom: 'affaires nouvelles et résiliations' },
    { id: 'motifs', nom: 'motifs de résiliation' },
    { id: 'delai', nom: 'délai de prise en charge' }
  ];

  function mods(id) {
    if (!etat.mods[id]) {
      etat.mods[id] = { repere: 75, tri: 'origine', tuiles: true,
        cartes: ['primes', 'sp', 'mouvements'] };
    }
    return etat.mods[id];
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmt(v, d, u) { return VZ.fmt(v, d, u); }
  function esc(s) { return VZ.esc(s); }

  /* La marque de Mia, en SVG, animée par la feuille de style. */
  function marque(taille) {
    return '<span class="mia-mark' + (taille ? ' ' + taille : '') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">'
      + '<path class="etoile" d="M12 2.6c.55 4.2 2.6 6.25 6.8 6.8-4.2.55-6.25 2.6-6.8 6.8'
      + '-.55-4.2-2.6-6.25-6.8-6.8 4.2-.55 6.25-2.6 6.8-6.8Z" fill="#fff" fill-opacity=".95"/>'
      + '<circle class="pt" cx="17.6" cy="17.4" r="2.2" fill="#fff" fill-opacity=".85"/>'
      + '</svg></span>';
  }

  /* ============================================== 2. fabriques d'éléments */

  function carte(host, id, large) {
    var d = el('div', 'vz' + (large ? ' wide' : ''));
    d.id = id;
    host.appendChild(d);
    return d;
  }
  function grille(host) {
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
  function commande(host, html) {
    var c = el('div', 'vz-ctl', html);
    host.appendChild(c);
    return c;
  }
  function note(host, titre, html) {
    var n = el('div', 'about', '<h3 style="margin-top:0">' + esc(titre) + '</h3>' + html);
    host.appendChild(n);
    return n;
  }

  /* ================================================ 3. les miabords, par recette */

  var RECETTES = [
    /* --------------------------------------------------------- portefeuille */
    {
      id: 'portefeuille',
      titre: 'Portefeuille et rentabilité',
      direction: 'Finance et actuariat',
      resume: 'Primes, charge de sinistres, ratio par branche et dérive trimestre par trimestre.',
      prompt: 'Construis-moi un miabord de rentabilité technique : primes acquises et charge de '
        + 'sinistres par trimestre, ratio sinistres sur primes par branche avec le repère de 75 %, '
        + 'et une lecture branche par branche et trimestre par trimestre pour voir où ça dérive.',
      filtres: true,
      modifiable: true,
      onglets: ['Synthèse', 'Par branche', 'Mouvements'],
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
      rendre: function (host, f, m, onglet) {
        var d = D.portefeuille(f);
        var noms = d.cles.map(function (k) { return D.BRANCHES[k].nom; });
        var sp = d.spBranche.slice();
        if (m.tri === 'valeur') {
          var idx = noms.map(function (_, i) { return i; })
            .sort(function (a, b) { return sp[b] - sp[a]; });
          noms = idx.map(function (i) { return noms[i]; });
          sp = idx.map(function (i) { return sp[i]; });
        }

        if (onglet === 0) {
          grosChiffre(host, {
            l: 'Résultat technique cumulé sur la période',
            v: fmt(Math.round(d.resultat / 1000), 1) + ' M€',
            d: 'ratio combiné ' + fmt(d.combine, 1, '%'),
            n: 'Primes acquises moins charge de sinistres moins frais de gestion, ces derniers '
              + 'posés à 22,1 % des primes. Un seul chiffre en tête, le reste est en dessous.'
          });
          if (m.tuiles) {
            tuiles(host, [
              { l: 'Primes acquises', v: fmt(Math.round(d.totP / 1000), 1) + ' M€' },
              { l: 'Charge de sinistres', v: fmt(Math.round(d.totC / 1000), 1) + ' M€' },
              { l: 'Ratio sinistres sur primes', v: fmt(d.sp, 1, '%'),
                d: d.sp > m.repere ? 'au-dessus du repère de ' + m.repere + ' %'
                  : 'sous le repère de ' + m.repere + ' %',
                dir: d.sp > m.repere ? 'down' : 'up' },
              { l: 'Délai moyen de prise en charge', v: fmt(d.delai, 1, 'j') },
              { l: 'Trimestres sous revue', v: String(f.periode) }
            ]);
          }
          var g = grille(host);
          m.cartes.forEach(function (id) { dessinerCarte(id, g, d, f, m, noms, sp); });
          if (!m.cartes.length) {
            note(host, 'Ce miabord n’a plus aucune carte',
              '<p>Demandez à Mia d’en ajouter une, par exemple « ajoute les motifs de résiliation ».</p>');
          }
        } else if (onglet === 1) {
          var g2 = grille(host);
          dessinerCarte('sp', g2, d, f, m, noms, sp);
          dessinerCarte('heat', g2, d, f, m, noms, sp);
          tableau(host, 'Ratio par branche', 'Moyenne sur la période filtrée, et écart au repère.',
            ['Branche', 'Ratio S sur P', 'Écart au repère de ' + m.repere + ' %'],
            noms.map(function (n, i) {
              var e = sp[i] - m.repere;
              return [esc(n), fmt(sp[i], 1, '%'),
                '<span class="dot ' + (e > 0 ? 'stop' : 'ok') + '">'
                + (e > 0 ? '+' : '') + fmt(e, 1) + ' pt</span>'];
            }));
        } else {
          var g3 = grille(host);
          dessinerCarte('mouvements', g3, d, f, m, noms, sp);
          dessinerCarte('motifs', g3, d, f, m, noms, sp);
        }
      }
    },

    /* -------------------------------------------------------- tarification */
    {
      id: 'tarification',
      titre: 'Tarification automobile',
      direction: 'Finance et actuariat',
      resume: 'Prime pure par âge et par zone, prime technique contre prime pratiquée, effet d’un ajustement.',
      prompt: 'Construis un miabord de tarification automobile : la prime pure par tranche d’âge '
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
      rendre: function (host, f, m) {
        var h = m.hausse === undefined ? 0 : m.hausse;
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
          + '<input type="range" min="0" max="20" step="1" value="' + h + '">'
          + '<output>+' + h + ' %</output></label>'
          + '<span class="hint">Le curseur ne touche que les trois segments concernés.</span>');
        c.querySelector('input').addEventListener('input', function (e) {
          m.hausse = Number(e.target.value);
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
        note(host, 'Ce que le miabord ne dit pas',
          '<p>Un modèle qui touche au prix ou à l’accès à un produit d’assurance est un système à '
          + 'haut risque au sens du règlement européen sur l’IA. Ce qui est produit ici est une aide '
          + 'à l’analyse, pas un tarif appliqué. Et un écart de tarification peut venir d’un choix '
          + 'commercial assumé : l’outil montre l’écart, il ne dit pas quoi en faire.</p>');
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
          r.forEach(function (v, k) {
            var proj = t.obs[i][k] === null;
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
        note(host, 'La relance qui suit',
          '<p>Le triangle est le geste le plus banal du métier et le plus pénible à refaire à la '
          + 'main. L’intérêt n’est pas de le produire, c’est de pouvoir demander tout de suite '
          + '« refais-le en excluant les trois sinistres les plus lourds », puis « refais-le par '
          + 'produit », et de comparer.</p>');
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
      rendre: function (host, f, m) {
        var s = m.scenario || 'central';
        var d = D.forecast(s);
        var c = commande(host,
          '<span class="seg">'
          + '<button type="button" data-s="bas"' + (s === 'bas' ? ' class="on"' : '') + '>Sinistralité dégradée</button>'
          + '<button type="button" data-s="central"' + (s === 'central' ? ' class="on"' : '') + '>Tendance actuelle</button>'
          + '<button type="button" data-s="haut"' + (s === 'haut' ? ' class="on"' : '') + '>Sinistralité améliorée</button>'
          + '</span><span class="hint">Le scénario ne change que la partie projetée, à droite du trait.</span>');
        c.addEventListener('click', function (e) {
          var b = e.target.closest('button');
          if (!b) return;
          m.scenario = b.getAttribute('data-s');
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
      prompt: 'Construis un miabord du flux sinistres : le délai moyen de prise en charge par canal '
        + 'sur douze semaines, une carte de contrôle de la fréquence par garantie avec des limites à '
        + 'trois écarts types, et une projection du flux entrant à huit semaines comparée à ce que '
        + 'l’équipe peut traiter.',
      filtres: true,
      onglets: ['Délais', 'Dérive', 'Charge'],
      code: 'py',
      source: '# 1. délai par canal   2. carte de contrôle   3. projection de charge\n'
        + 'delai = (dossiers.query("rouvert == False")\n'
        + '         .assign(j=lambda d: (d.premiere_action - d.reception).dt.days)\n'
        + '         .groupby(["canal", "semaine"]).j.mean())\n\n'
        + 'attendu = STL(freq, period=52).fit().trend + saison\n'
        + 'lo, hi  = attendu.mean() - 3*resid.std(), attendu.mean() + 3*resid.std()\n\n'
        + 'stock = np.maximum.accumulate(np.cumsum(flux_projete - capacite)).clip(0)',
      rendre: function (host, f, m, onglet) {
        if (onglet === 0) {
          var dl = D.delais(f);
          tuiles(host, [
            { l: 'Délai moyen, tous canaux', v: fmt(D.portefeuille(f).delai, 1, 'j') },
            { l: 'Canal le plus lent', v: 'Guichet', d: 'écart le plus fort à l’engagement' },
            { l: 'Engagement', v: '2 jours ouvrés' },
            { l: 'Semaines sous revue', v: '12' }
          ]);
          var g = grille(host);
          VZ.lines(carte(g, 's-delai', true), {
            title: 'Délai moyen de prise en charge, par canal d’entrée',
            sub: 'Douze semaines, réouvertures exclues. Le trait est l’engagement de deux jours.',
            x: dl.sem,
            series: dl.canaux.map(function (n, i) {
              return { name: n, color: 'var(--vz-s' + (i + 1) + ')', values: dl.series[i] };
            }),
            dec: 1, unit: 'j', height: 265, tickEvery: 1, xLabel: 'Semaine', yLabel: 'jours ouvrés',
            rule: { value: 2, label: 'engagement 2 j' },
            caption: 'Données inventées. Un décrochage appelle une deuxième question, pas une conclusion.'
          });
        } else if (onglet === 1) {
          var gar = m.garantie === undefined ? 0 : m.garantie;
          var ct = D.controle(gar);
          tuiles(host, [
            { l: 'Garantie', v: ct.nom },
            { l: 'Semaines hors limites', v: String(ct.hors),
              d: ct.hors ? 'à instruire' : 'rien à signaler', dir: ct.hors ? 'down' : 'up' },
            { l: 'Fréquence moyenne observée', v: fmt(ct.moyenne, 2) },
            { l: 'Limite haute', v: fmt(ct.hi, 2) }
          ]);
          var c = commande(host,
            '<span class="seg">'
            + D.GARANTIES.map(function (x, i) {
              return '<button type="button" data-g="' + i + '"' + (i === gar ? ' class="on"' : '') + '>'
                + esc(x.nom) + '</button>';
            }).join('')
            + '</span><span class="hint">Chaque garantie a son propre attendu saisonnier.</span>');
          c.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            m.garantie = Number(b.getAttribute('data-g'));
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
            dec: 2, height: 265, tickEvery: 4, endLabels: false,
            xLabel: 'Semaine', yLabel: 'pour mille contrats',
            limits: { lo: ct.lo, hi: ct.hi, loLabel: 'limite basse', hiLabel: 'limite haute' },
            flagSeries: 1,
            caption: 'Données inventées. Un point rouge n’est pas un problème, c’est une semaine à regarder.'
          });
        } else {
          var eff = m.effectif === undefined ? 13 : m.effectif;
          var fx = D.flux(eff);
          tuiles(host, [
            { l: 'Capacité hebdomadaire', v: fmt(fx.cap, 0) + ' dossiers' },
            { l: 'Stock à huit semaines', v: fmt(fx.stock, 0) + ' dossiers',
              d: fx.stock ? 'le retard s’installe' : 'aucun retard', dir: fx.stock ? 'down' : 'up' },
            { l: 'Première semaine en retard', v: fx.premiere || 'aucune' },
            { l: 'Effectif qui absorbe le pic', v: fx.absorbe + ' personnes' }
          ]);
          var c2 = commande(host,
            '<label>Gestionnaires présents<input type="range" min="8" max="20" step="1" value="'
            + eff + '"><output>' + eff + '</output></label>'
            + '<span class="hint">Capacité posée à ' + D.PAR_GESTIONNAIRE
            + ' dossiers par gestionnaire et par semaine : une hypothèse assumée, pas une mesure.</span>');
          c2.querySelector('input').addEventListener('input', function (e) {
            m.effectif = Number(e.target.value);
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
            height: 265, tickEvery: 2, futureFrom: fx.coupe, futureLabel: 'projection',
            xLabel: 'Semaine', yLabel: 'dossiers par semaine',
            caption: 'Données inventées.'
          });
        }
      }
    },

    /* ------------------------------------------------------------ attrition */
    {
      id: 'attrition',
      titre: 'Attrition et relance',
      direction: 'Marketing et commercial',
      resume: 'Transformation par campagne, rétention par cohorte, poids des variables, simulation de relance.',
      prompt: 'Construis un miabord de l’attrition : le taux de transformation des quatre dernières '
        + 'campagnes par segment avec le repère de deux et demi pour cent, la rétention par cohorte '
        + 'sur trente-six mois, les variables qui pèsent dans le départ en excluant celles connues '
        + 'après la résiliation, et combien de clients relancer.',
      onglets: ['Campagnes et rétention', 'Combien relancer'],
      code: 'py',
      source: '# survie par cohorte, puis modèle de durée, puis optimisation de l’effort\n'
        + 'from lifelines import KaplanMeierFitter, CoxPHFitter\n\n'
        + 'km = KaplanMeierFitter().fit(duree, evenement)          # censure à droite prise en compte\n'
        + 'cox = CoxPHFitter().fit(X.drop(columns=POSTERIEURES),   # fuite de données écartée\n'
        + '                        "duree", "resilie")\n\n'
        + 'score  = cox.predict_partial_hazard(X).rank(pct=True)\n'
        + 'valeur = sauves(part) * PRIME - part * N * COUT_CONTACT\n'
        + 'optimum = valeur.idxmax()',
      rendre: function (host, f, m, onglet) {
        var ret = D.retention();
        if (onglet === 0) {
          var g = grille(host);
          VZ.columns(carte(g, 'a-camp'), {
            title: 'Taux de transformation par campagne et par segment',
            sub: 'Souscriptions dans les quatre-vingt-dix jours qui suivent le contact.',
            width: 520, cats: D.CAMPAGNES,
            series: D.SEGMENTS_CLIENT.map(function (s, k) {
              return { name: s.nom, color: 'var(--vz-s' + (k + 1) + ')', values: s.v };
            }),
            dec: 1, unit: '%', catLabel: 'Campagne', height: 245, yLabel: 'taux de transformation',
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
            dec: 1, unit: '%', height: 265, tickEvery: 3,
            xLabel: 'Mois depuis la souscription', yLabel: 'contrats restants, base 100',
            caption: 'Données inventées. Les décrochements au douzième et au vingt-quatrième mois sont les échéances annuelles.'
          });
        } else {
          var part = m.relance === undefined ? 20 : m.relance;
          var r = D.relance(), i = part / 2;
          tuiles(host, [
            { l: 'Contrats relancés', v: fmt(r.portefeuille * part / 100, 0) },
            { l: 'Contrats sauvés estimés', v: fmt(r.sauves[i], 0) },
            { l: 'Coût de la relance', v: fmt(r.couts[i], 0) + ' €' },
            { l: 'Valeur nette préservée', v: fmt(r.valeur[i], 0) + ' k€',
              d: i === r.best ? 'c’est l’optimum' : 'optimum à ' + r.parts[r.best],
              dir: i === r.best ? 'up' : '' }
          ]);
          var c = commande(host,
            '<label>Part du portefeuille relancée, du score le plus élevé au plus bas'
            + '<input type="range" min="0" max="60" step="2" value="' + part + '">'
            + '<output>' + part + ' %</output></label>'
            + '<span class="hint">Coût posé à ' + r.cout + ' € par contact, prime annuelle moyenne à '
            + r.prime + ' €.</span>');
          c.querySelector('input').addEventListener('input', function (e) {
            m.relance = Number(e.target.value);
            rendreVue();
          });
          var g2 = grille(host);
          VZ.lines(carte(g2, 'a-sim', true), {
            title: 'Valeur nette préservée selon la part du portefeuille relancée, en milliers d’euros',
            sub: 'Primes des contrats sauvés moins le coût des contacts. Tout est en euros.',
            x: r.parts,
            series: [{ name: 'Valeur nette préservée', color: 'var(--vz-s1)', values: r.valeur }],
            height: 255, tickEvery: 3, endLabels: false,
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
      }
    },

    /* --------------------------------------------------------------- fraude */
    {
      id: 'fraude',
      titre: 'Anomalies et seuil',
      direction: 'Risque et fraude',
      resume: 'Taux d’anomalies par prestataire, arbitrage du seuil, queue de distribution des montants.',
      prompt: 'Construis un miabord des anomalies : le taux de dossiers portant au moins un signal '
        + 'par garantie et par prestataire en ne gardant que ceux à plus de deux cents dossiers, la '
        + 'précision et le rappel du score selon le seuil, et la distribution des montants réglés.',
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
      rendre: function (host, f, m) {
        var s = m.seuil === undefined ? 70 : m.seuil;
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
          '<label>Seuil de déclenchement<input type="range" min="30" max="95" step="1" value="'
          + s + '"><output>' + s + '</output></label>'
          + '<span class="hint">Capacité d’instruction posée à ' + F.capacite
          + ' dossiers par an. Le seuil est un arbitrage de direction, pas un réglage technique.</span>');
        c.querySelector('input').addEventListener('input', function (e) {
          m.seuil = Number(e.target.value);
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
          dec: 1, unit: '%', height: 255, tickEvery: 5, endLabels: false,
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
          caption: 'Données inventées. Une cellule qui sort est une liste de dossiers à ouvrir.'
        });
        var montants = F.nb.map(function (n, i) { return Math.round(n * F.milieu[i] / 1000); });
        var total = montants.reduce(function (x, y) { return x + y; }, 0);
        VZ.columns(carte(g, 'r-queue'), {
          title: 'Montant total réglé par tranche de montant, en milliers d’euros',
          sub: 'Neuf tranches croissantes.',
          width: 520, cats: F.tranches,
          series: [{ name: 'Montant réglé', color: 'var(--vz-s1)', values: montants }],
          catLabel: 'Tranche', height: 240, padB: 46, yLabel: 'milliers d’euros', labelMax: true,
          caption: 'Données inventées. Les vingt-huit dossiers des deux dernières tranches portent '
            + Math.round((montants[7] + montants[8]) / total * 100) + ' % du montant total.'
        });
        note(host, 'La règle qui encadre ce miabord',
          '<p>Nous ne détectons pas de la fraude, nous détectons des anomalies que d’autres '
          + 'qualifient. Ces graphiques produisent des signaux et montrent pourquoi. L’enquête, la '
          + 'confrontation et le jugement restent humains.</p>'
          + '<p>Le calcul de la précision et du rappel suppose un historique de dossiers '
          + '<strong>qualifiés</strong>, dont on sait après enquête s’ils étaient fondés. Sans ce '
          + 'retour, l’outil ne peut que compter des signaux.</p>');
      }
    },

    /* ------------------------------------------------------------------ RH */
    {
      id: 'rh',
      titre: 'Baromètre et démographie',
      direction: 'Ressources humaines',
      resume: 'Baromètre par direction avec seuil d’effectif, départs à cinq ans, écart de compétences.',
      prompt: 'Construis un miabord du baromètre interne : la répartition des réponses par direction '
        + 'en excluant les directions de moins de dix répondants, en barres centrées sur la réponse '
        + 'neutre. Ajoute la pyramide des âges avec la part qui atteint l’âge de départ dans les '
        + 'cinq ans, et l’écart entre compétences détenues et demandées. Aucune donnée individuelle.',
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
        var departs = R.partent.reduce(function (a, b) { return a + b; }, 0);
        var effectif = R.reste.reduce(function (a, b) { return a + b; }, 0) + departs;
        tuiles(host, [
          { l: 'Effectif couvert', v: fmt(effectif, 0) },
          { l: 'Départs prévisibles à cinq ans', v: fmt(departs, 0),
            d: fmt(departs / effectif * 100, 0, '% de l’effectif') },
          { l: 'Directions retenues au baromètre', v: String(R.directions.length),
            d: 'deux écartées, moins de dix répondants' },
          { l: 'Écart de compétences le plus fort', v: 'Automatisation', d: 'indemnisation et systèmes' }
        ]);
        var g = grille(host);
        VZ.likert(carte(g, 'h-baro', true), {
          title: '« Je dispose des moyens de faire mon travail correctement »',
          sub: 'Répartition des réponses par direction, centrée sur la réponse neutre. Le nombre à droite est le total favorable.',
          cats: R.directions, negCount: 2,
          series: R.modalites.map(function (mo, k) {
            return { name: mo.nom, color: mo.c, values: R.reponses.map(function (r) { return r[k]; }) };
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
          catLabel: 'Tranche d’âge', height: 245, yLabel: 'nombre de personnes',
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
        note(host, 'Le cadre, avant les chiffres',
          '<ol><li>Aucun résultat sur un effectif trop petit. Un taux calculé sur six personnes '
          + 'n’est plus un agrégat, c’est une désignation. Le seuil est posé dans la source.</li>'
          + '<li>Aucune donnée de rémunération, au même titre que les données client et de santé.</li>'
          + '<li>Une analyse portant sur les salariés suppose l’information et la consultation des '
          + 'représentants du personnel. Ce miabord s’en tient à des projections démographiques.</li></ol>');
      }
    },

    /* ---------------------------------------------------- segmentation ML */
    {
      id: 'segmentation',
      titre: 'Segmentation du portefeuille',
      direction: 'Finance et actuariat',
      resume: 'Segments appris sur les données plutôt que fixés a priori, avec le choix du nombre de segments.',
      prompt: 'Apprends une segmentation du portefeuille sur les variables de prime, ancienneté, '
        + 'nombre de contrats, fréquence de sinistres et usage du digital. Choisis le nombre de '
        + 'segments par la courbe d’inertie, donne-moi le profil de chaque segment et son ratio '
        + 'sinistres sur primes.',
      onglets: ['Les segments', 'Choix du nombre de segments'],
      code: 'py',
      source: '# segmentation non supervisée : k moyennes sur variables normalisées\n'
        + 'from sklearn.preprocessing import StandardScaler\n'
        + 'from sklearn.cluster import KMeans\n'
        + 'from sklearn.metrics import silhouette_score\n\n'
        + 'X = StandardScaler().fit_transform(portefeuille[VARIABLES])\n\n'
        + 'inertie = {k: KMeans(k, n_init=20, random_state=0).fit(X).inertia_\n'
        + '           for k in range(2, 11)}          # le coude désigne k = 5\n\n'
        + 'km = KMeans(5, n_init=20, random_state=0).fit(X)\n'
        + 'profil = (portefeuille.assign(segment=km.labels_)\n'
        + '          .groupby("segment")[VARIABLES + ["sp"]].mean())',
      rendre: function (host, f, m, onglet) {
        var S = D.segmentation();
        if (onglet === 1) {
          tuiles(host, [
            { l: 'Nombre de segments retenu', v: '5', d: 'coude de la courbe d’inertie' },
            { l: 'Variables utilisées', v: String(S.vars.length) },
            { l: 'Contrats classés', v: fmt(S.total, 0) },
            { l: 'Silhouette moyenne', v: '0,41', d: 'structure nette mais pas séparée' }
          ]);
          var g0 = grille(host);
          VZ.lines(carte(g0, 'sg-inertie', true), {
            title: 'Inertie intra-classe selon le nombre de segments',
            sub: 'Le coude marque le point où ajouter un segment n’explique presque plus rien.',
            x: S.k,
            series: [{ name: 'Inertie intra-classe', color: 'var(--vz-s1)', values: S.inertie }],
            dec: 1, height: 250, tickEvery: 1, endLabels: false,
            xLabel: 'Nombre de segments', yLabel: 'inertie, base 100',
            caption: 'Données inventées. Le choix du nombre de segments est un arbitrage, pas un résultat : '
              + 'la courbe propose, le métier décide.'
          });
          note(host, 'Pourquoi ce graphique compte plus que le suivant',
            '<p>Une segmentation apprise donne toujours un résultat, quel que soit le nombre de '
            + 'segments demandé. Cette courbe est ce qui permet de dire que cinq segments sont '
            + 'justifiés et pas neuf. Sans elle, on présente une partition arbitraire avec l’autorité '
            + 'd’un modèle.</p>');
          return;
        }
        tuiles(host, S.segs.slice(0, 4).map(function (s) {
          return { l: s.nom, v: fmt(s.taille, 0),
            d: 'ratio S sur P ' + fmt(s.sp, 1, '%'), dir: s.sp > 75 ? 'down' : 'up' };
        }));
        var g = grille(host);
        VZ.bars(carte(g, 'sg-taille'), {
          title: 'Taille des segments, en contrats',
          sub: 'Segments appris sur les données, pas fixés a priori.',
          width: 520, cats: S.segs.map(function (s) { return s.nom; }),
          values: S.segs.map(function (s) { return s.taille; }),
          rowH: 30, padL: 182, catLabel: 'Segment', valueLabel: 'Contrats', color: 'var(--vz-s1)',
          caption: 'Données inventées.'
        });
        VZ.bars(carte(g, 'sg-sp'), {
          title: 'Ratio sinistres sur primes par segment',
          sub: 'La segmentation ne sert que si les segments se comportent différemment.',
          width: 520, rule: { value: 75, label: 'repère 75 %' },
          cats: S.segs.map(function (s) { return s.nom; }),
          values: S.segs.map(function (s) { return s.sp; }),
          dec: 1, unit: '%', rowH: 30, padL: 182, catLabel: 'Segment', valueLabel: 'Ratio',
          color: function (v) { return v > 75 ? 'var(--vz-s2)' : 'var(--vz-s1)'; },
          legendItems: [
            { name: 'Sous le repère', color: 'var(--vz-s1)' },
            { name: 'Au-dessus du repère', color: 'var(--vz-s2)' }
          ],
          caption: 'Données inventées. L’écart entre le premier et le deuxième segment est le vrai résultat.'
        });
        VZ.heat(carte(g, 'sg-profil', true), {
          title: 'Profil des segments, chaque variable ramenée à une échelle de 0 à 100',
          sub: 'Une ligne se lit horizontalement : c’est la signature du segment.',
          rows: S.segs.map(function (s) { return s.nom; }), cols: S.vars,
          values: S.segs.map(function (s) { return s.profil; }),
          rowLabel: 'Segment', valueLabel: 'Niveau', cellH: 30, padL: 186,
          scale: ['niveau bas', 'niveau élevé'],
          caption: 'Données inventées. Les valeurs sont normalisées, elles ne s’interprètent qu’en comparaison.'
        });
      }
    },

    /* ------------------------------------------------- modèle de coût, ML */
    {
      id: 'cout',
      titre: 'Modèle de coût des sinistres',
      direction: 'Finance et actuariat',
      resume: 'Modèle par arbres de gradient, importance des variables, calibration et pouvoir de discrimination.',
      prompt: 'Entraîne un modèle de coût des sinistres par arbres de gradient, avec validation '
        + 'croisée. Donne-moi l’importance des variables, la calibration par décile de prédiction, '
        + 'et compare son pouvoir de discrimination à celui du tarif actuel.',
      onglets: ['Ce que le modèle retient', 'Est-il fiable', 'Apporte-t-il quelque chose'],
      code: 'py',
      source: '# arbres de gradient, validation croisée par groupes de contrats\n'
        + 'from sklearn.model_selection import GroupKFold, cross_val_predict\n'
        + 'from sklearn.ensemble import HistGradientBoostingRegressor\n'
        + 'from sklearn.inspection import permutation_importance\n\n'
        + 'modele = HistGradientBoostingRegressor(loss="gamma", max_depth=4,\n'
        + '                                       learning_rate=.05, max_iter=600)\n\n'
        + '# la validation croisée groupe par assuré : deux contrats du même ménage\n'
        + '# ne peuvent pas se retrouver de part et d\'autre de la coupure\n'
        + 'pred = cross_val_predict(modele, X, y, cv=GroupKFold(5), groups=assure_id)\n\n'
        + 'imp = permutation_importance(modele.fit(X, y), X, y, n_repeats=20)\n'
        + 'gini = 2 * roc_auc_lorenz(y, pred) - 1',
      rendre: function (host, f, m, onglet) {
        var C = D.coutModele();
        if (onglet === 0) {
          tuiles(host, [
            { l: 'Variables retenues', v: String(C.vars.length), d: 'sur 34 candidates' },
            { l: 'Variable la plus lourde', v: 'Véhicule', d: 'puissance et valeur' },
            { l: 'Profondeur des arbres', v: '4', d: 'volontairement faible, pour rester lisible' },
            { l: 'Itérations', v: '600' }
          ]);
          var g = grille(host);
          VZ.bars(carte(g, 'co-imp', true), {
            title: 'Importance des variables, mesurée par permutation',
            sub: 'Base cent sur la variable la plus lourde. Mesurée hors échantillon d’apprentissage.',
            cats: C.vars, values: C.poids, rowH: 28, padL: 216,
            catLabel: 'Variable', valueLabel: 'Poids relatif', color: 'var(--vz-s1)',
            caption: 'Données inventées. Une importance n’est pas une causalité : elle dit ce que le '
              + 'modèle utilise, pas ce qui produit le sinistre.'
          });
          note(host, 'Pourquoi l’importance par permutation et pas celle de l’arbre',
            '<p>L’importance rendue par défaut par un modèle à base d’arbres favorise les variables '
            + 'à beaucoup de modalités, même quand elles n’apportent rien. La permutation mesure ce '
            + 'que l’on perd réellement en cassant une variable, hors échantillon d’apprentissage. '
            + 'C’est plus long à calculer et beaucoup plus honnête.</p>');
          return;
        }
        if (onglet === 1) {
          tuiles(host, [
            { l: 'Écart moyen prédit contre observé', v: fmt(C.ecartMoyen, 1, '%'),
              d: 'sur les dix déciles', dir: 'up' },
            { l: 'Validation croisée', v: '5 blocs', d: 'groupés par assuré' },
            { l: 'Décile le plus mal calibré', v: 'D9', d: 'sous-estimation de 4 %' },
            { l: 'Loi retenue', v: 'Gamma', d: 'coûts positifs et asymétriques' }
          ]);
          var g2 = grille(host);
          VZ.lines(carte(g2, 'co-cal', true), {
            title: 'Calibration : coût prédit et coût observé, par décile de prédiction',
            sub: 'Les deux séries sont en euros, sur une seule échelle. Elles doivent se superposer.',
            x: C.deciles,
            series: [
              { name: 'Coût prédit', color: 'var(--vz-s1)', values: C.predit },
              { name: 'Coût observé', color: 'var(--vz-s2)', values: C.observe }
            ],
            unit: '€', height: 260, tickEvery: 1,
            xLabel: 'Décile de prédiction', yLabel: 'euros',
            caption: 'Données inventées. Un modèle qui discrimine bien mais calibre mal donne un '
              + 'classement juste et des montants faux.'
          });
          note(host, 'La question à poser avant de regarder la performance',
            '<p>Deux qualités différentes sont en jeu. <strong>Discriminer</strong>, c’est mettre les '
            + 'contrats dans le bon ordre. <strong>Calibrer</strong>, c’est annoncer le bon montant. '
            + 'Un tarif a besoin des deux, et beaucoup de modèles présentés comme performants ne '
            + 'font que le premier.</p>');
          return;
        }
        tuiles(host, [
          { l: 'Pouvoir de discrimination du modèle', v: fmt(C.gini, 3),
            d: 'indice de concentration', dir: 'up' },
          { l: 'Pouvoir du tarif actuel', v: fmt(C.giniTarif, 3) },
          { l: 'Gain relatif', v: '+' + fmt((C.gini / C.giniTarif - 1) * 100, 0, '%') },
          { l: 'Lecture', v: 'à confirmer', d: 'sur une année complète, hors échantillon' }
        ]);
        var g3 = grille(host);
        VZ.lines(carte(g3, 'co-lorenz', true), {
          title: 'Part du coût total portée par les contrats les plus risqués',
          sub: 'Contrats classés du plus risqué au moins risqué. Plus la courbe monte vite, mieux le modèle sépare.',
          x: C.parts,
          series: [
            { name: 'Modèle', color: 'var(--vz-s1)', values: C.modele },
            { name: 'Tarif actuel', color: 'var(--vz-s2)', values: C.tarif },
            { name: 'Aucun pouvoir de tri', color: 'var(--vz-gray)', values: C.hasard }
          ],
          dec: 1, unit: '%', height: 270, tickEvery: 1,
          xLabel: 'Part du portefeuille, du plus risqué au moins risqué',
          yLabel: 'part du coût total',
          caption: 'Données inventées. La diagonale grise est le repère : une courbe qui la suit ne trie rien.'
        });
        note(host, 'Ce que ce gain ne dit pas',
          '<p>Un meilleur tri ne devient un résultat que si l’on décide quoi en faire, et cette '
          + 'décision n’est pas technique. Un modèle qui touche au prix ou à l’accès à un produit '
          + 'd’assurance est un système à haut risque au sens du règlement européen sur l’IA : la '
          + 'documentation, la surveillance et l’explication du refus font partie du travail, pas de '
          + 'l’option.</p>');
      }
    },

    /* ----------------------------------------------------------- adoption */
    {
      id: 'adoption',
      titre: 'Adoption des outils',
      direction: 'Transformation',
      resume: 'Usage réel par direction, entonnoir des besoins, trajectoire à douze mois.',
      prompt: 'Construis un miabord de l’adoption : les utilisateurs actifs par semaine et par '
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
          height: 255, tickEvery: 3, xLabel: 'Semaine', yLabel: 'utilisateurs actifs',
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
          dec: 1, unit: '%', height: 255, tickEvery: 4, futureFrom: 11, futureLabel: 'prolongement',
          xLabel: 'Mois', yLabel: 'part de l’effectif',
          rule: { value: 50, label: 'moitié de l’effectif' },
          caption: 'Données inventées. Une courbe ajustée sur douze points et prolongée de douze mois est une hypothèse.'
        });
      }
    }
  ];

  function recette(id) {
    for (var i = 0; i < RECETTES.length; i++) if (RECETTES[i].id === id) return RECETTES[i];
    return null;
  }

  /* Les cartes du miabord portefeuille, dessinées à la demande. */
  function dessinerCarte(id, g, d, f, m, noms, sp) {
    if (id === 'primes') {
      VZ.columns(carte(g, 'c-primes', true), {
        title: 'Primes acquises et charge de sinistres, par trimestre',
        sub: 'En milliers d’euros. Les deux séries sont dans la même unité, donc sur une seule échelle.',
        cats: d.lbl,
        series: [
          { name: 'Primes acquises', color: 'var(--vz-s1)', values: d.primes },
          { name: 'Charge de sinistres', color: 'var(--vz-s2)', values: d.charge }
        ],
        catLabel: 'Trimestre', height: 245, padB: 40, yLabel: 'milliers d’euros',
        caption: 'Données inventées. L’écart entre les deux barres est ce qui reste avant frais de gestion.'
      });
    } else if (id === 'sp') {
      VZ.bars(carte(g, 'c-sp'), {
        title: 'Ratio sinistres sur primes, par branche',
        sub: 'Moyenne sur la période filtrée' + (m.tri === 'valeur' ? ', trié du plus élevé au plus bas.' : '.'),
        width: 500, rule: { value: m.repere, label: 'repère ' + m.repere + ' %' },
        cats: noms, values: sp, dec: 1, unit: '%', rowH: 30, padL: 132,
        catLabel: 'Branche', valueLabel: 'Ratio S sur P',
        color: function (v) { return v > m.repere ? 'var(--vz-s2)' : 'var(--vz-s1)'; },
        legendItems: [
          { name: 'Sous le repère', color: 'var(--vz-s1)' },
          { name: 'Au-dessus du repère', color: 'var(--vz-s2)' }
        ],
        caption: 'Données inventées. Le repère est une convention interne, pas une norme.'
      });
    } else if (id === 'mouvements') {
      var mv = D.mouvements(f);
      VZ.columns(carte(g, 'c-mouv'), {
        title: 'Affaires nouvelles et résiliations, par trimestre',
        sub: 'En nombre de contrats, comptées de part et d’autre du zéro.',
        width: 500, cats: mv.lbl, stacked: true,
        series: [
          { name: 'Affaires nouvelles', color: 'var(--vz-s1)', values: mv.nouvelles },
          { name: 'Résiliations', color: 'var(--vz-s2)', values: mv.resiliations }
        ],
        catLabel: 'Trimestre', height: 235, padB: 40, yLabel: 'contrats',
        caption: 'Données inventées.'
      });
    } else if (id === 'motifs') {
      VZ.bars(carte(g, 'c-motifs'), {
        title: 'Motifs de résiliation déclarés',
        sub: 'Motif renseigné à la clôture du contrat.',
        width: 500, cats: D.MOTIFS.libelles, values: D.MOTIFS.parts, unit: '%', rowH: 26, padL: 186,
        catLabel: 'Motif', valueLabel: 'Part', color: 'var(--vz-s1)',
        caption: 'Données inventées. Un motif déclaré n’est pas une cause.'
      });
    } else if (id === 'delai') {
      var dl = D.delais(f);
      VZ.lines(carte(g, 'c-delai'), {
        title: 'Délai moyen de prise en charge, par canal',
        sub: 'Douze semaines. Le trait est l’engagement de deux jours.',
        width: 500, x: dl.sem,
        series: dl.canaux.map(function (n, i) {
          return { name: n, color: 'var(--vz-s' + (i + 1) + ')', values: dl.series[i] };
        }),
        dec: 1, unit: 'j', height: 235, tickEvery: 2, xLabel: 'Semaine', yLabel: 'jours ouvrés',
        rule: { value: 2, label: 'engagement' },
        caption: 'Données inventées.'
      });
    } else if (id === 'heat') {
      VZ.heat(carte(g, 'c-heat', true), {
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
  }

  /* ================================= 4. barre latérale, onglets et routage */

  var ICONES = {
    apercu: '<path d="M3 13h7V3H3zM14 21h7V11h-7zM14 8h7V3h-7zM3 21h7v-5H3z"/>',
    miabord: '<path d="M5 20V13M12 20V5M19 20v-4"/>',
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
    h += '<div class="grp">Mes miabords<span class="cpt">' + etat.produits.length + '</span></div>';
    if (!etat.produits.length) {
      h += '<div class="vide">Aucun pour l’instant. Demandez-en un à Mia.</div>';
    }
    etat.produits.forEach(function (id) {
      var r = recette(id);
      h += '<a href="#' + id + '" data-v="' + id + '"' + (etat.vue === id ? ' class="on"' : '') + '>'
        + ico('miabord') + esc(r.titre) + '</a>';
    });
    h += '<a href="#nouveau" data-v="nouveau" style="color:#9FC4E8">' + ico('plus') + 'Nouveau miabord</a>';
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
        if (v === 'nouveau') { ouvrirMia(); return; }
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

  function dessinerOnglets(r) {
    var host = document.getElementById('tabs');
    if (!r || !r.onglets) { host.className = 'tabs hidden'; host.innerHTML = ''; return; }
    var cur = etat.onglets[r.id] || 0;
    host.className = 'tabs';
    host.innerHTML = r.onglets.map(function (t, i) {
      return '<button type="button" data-o="' + i + '"' + (i === cur ? ' class="on"' : '') + '>'
        + esc(t) + '</button>';
    }).join('');
    host.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        etat.onglets[r.id] = Number(b.getAttribute('data-o'));
        rendreVue();
      });
    });
  }

  /* ------------------------------------------------------------- les vues */

  function vueApercu(host, f) {
    avertissement(host, '<b>Toutes les données de cette application sont inventées.</b> Elles ne '
      + 'décrivent aucun assureur réel : ni portefeuille, ni clients, ni salariés, ni résultats. '
      + 'Voir <a href="#apropos" data-go="apropos">À propos</a>.');
    var r = recette('portefeuille');
    r.rendre(host, f, mods('portefeuille'), etat.onglets.portefeuille || 0);
    note(host, 'Ce miabord a été produit par une phrase',
      '<p>Aucun développement, aucun écran à maintenir. Quelqu’un a écrit ce qu’il voulait voir, '
      + 'Mia a écrit la requête, l’a exécutée et a mis en forme le résultat. Les miabords de la '
      + 'barre latérale ont tous été produits de la même façon, et le prompt qui a produit chacun '
      + 'est affiché en haut de sa page.</p>'
      + '<p><strong>Et il se modifie de la même façon.</strong> Dites à Mia, dans la colonne de '
      + 'droite, « mets le repère à 80 % », « trie les branches par ratio », « ajoute les motifs de '
      + 'résiliation » ou « sur 16 trimestres, chez les courtiers ». Le miabord se recalcule pendant '
      + 'que vous le regardez.</p>');
  }

  function vueMiabord(host, r, f) {
    var m = mods(r.id);
    var onglet = etat.onglets[r.id] || 0;
    var head = el('div', 'about');
    head.innerHTML = '<h2 style="margin-top:0">' + esc(r.titre) + '</h2>'
      + '<p style="color:var(--mi-muted)"><strong>' + esc(r.direction) + '</strong> · ' + esc(r.resume) + '</p>'
      + '<h3>Le prompt qui a produit ce miabord</h3>'
      + '<p style="background:var(--mi-accent-soft);border-radius:12px;padding:.7rem .9rem">'
      + esc(r.prompt) + '</p>'
      + '<details class="code"><summary>Voir le code écrit par Mia</summary><pre>'
      + coloriser(r.source, r.code) + '</pre></details>';
    host.appendChild(head);
    avertissement(host, '<b>Données inventées.</b> Ce miabord montre une forme de réponse et une '
      + 'méthode, pas un résultat.');
    r.rendre(host, f, m, onglet);
  }

  function vueSources(host) {
    var head = el('div', 'about');
    head.innerHTML = '<h2 style="margin-top:0">Sources de données</h2><p>Ce que l’application lit, '
      + 'et ce qu’elle ne lit pas encore. Deux sources seulement sont réellement branchées. Les '
      + 'miabords de cette démonstration supposent les autres, et le disent.</p>';
    host.appendChild(head);
    tableau(host, 'État des sources', 'Une ligne par source, avec le droit d’accès et la dernière mise à jour.',
      ['Source', 'État', 'Volume', 'Mise à jour', 'Droit d’accès', 'Remarque'],
      D.SOURCES.map(function (s) {
        var lib = { ok: 'Branchée', wait: 'À brancher', stop: 'Bloquée' }[s.etat];
        return [esc(s.nom), '<span class="dot ' + s.etat + '">' + lib + '</span>',
          esc(s.lignes), esc(s.maj), esc(s.droits), esc(s.note)];
      }));
    note(host, 'Le point qui commande tout le reste',
      '<p>Le filtrage des droits n’est pas branché sur l’authentification d’entreprise. Tant que ce '
      + 'point n’est pas repris, aucune source portant des données à accès restreint ne peut être '
      + 'branchée, et cette application reste une démonstration.</p>'
      + '<h3>Les quatre conditions pour brancher une source</h3><ol>'
      + '<li>Le sens de chaque colonne est écrit quelque part.</li>'
      + '<li>Une clé qui relie la source aux autres.</li>'
      + '<li>Une date qui fait foi, choisie et la même partout.</li>'
      + '<li>Le droit de lire, appliqué à la personne connectée.</li></ol>');
  }

  function vueApropos(host) {
    var a = el('div', 'about');
    a.innerHTML = '<h2 style="margin-top:0">À propos de cette démonstration</h2>'
      + '<p>Cette application montre ce que devient l’analyse de données quand un tableau de bord se '
      + 'demande au lieu de se développer. Chaque miabord de la barre latérale a été produit par une '
      + 'phrase, et le prompt qui l’a produit est affiché en haut de sa page, avec le code écrit par '
      + 'Mia. Il se modifie de la même façon, en le lui disant.</p>'
      + '<h3>Ce que ces chiffres ne sont pas</h3>'
      + '<p><strong>Toutes les données sont inventées</strong>, produites par un générateur '
      + 'pseudo-aléatoire à graine fixe pour que l’application montre la même chose à chaque '
      + 'ouverture. Elles ne décrivent ni le portefeuille, ni les clients, ni les salariés, ni les '
      + 'résultats d’un assureur réel, et aucun chiffre ne doit être cité hors de cette application. '
      + 'Aucun nom de personne n’y figure, les prestataires sont des étiquettes anonymes.</p>'
      + '<p>Le sujet de cette démonstration est la façon de travailler, pas les chiffres : une '
      + 'analyse se demande, elle ne se développe pas.</p>'
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
      + '<h3>Retour</h3><p><a href="../index.html">Retour au site</a>, qui explique le principe, ce '
      + 'que l’on peut demander métier par métier, et comment poser une question exploitable.</p>';
    host.appendChild(a);
  }

  var TITRES = { apercu: 'Vue d’ensemble', sources: 'Sources de données', apropos: 'À propos' };

  function rendreVue() {
    var host = document.getElementById('vue');
    var f = etat.filtres;
    host.classList.add('load');
    host.innerHTML = '';
    var r = recette(etat.vue);
    var estApercu = etat.vue === 'apercu';
    document.getElementById('titre').textContent =
      r ? r.titre : (TITRES[etat.vue] || 'Vue d’ensemble');
    dessinerOnglets(estApercu ? recette('portefeuille') : r);
    var avecFiltres = estApercu || (r && r.filtres);
    document.getElementById('filtres').style.display = avecFiltres ? '' : 'none';
    document.getElementById('sep2').style.display = avecFiltres ? '' : 'none';
    ['periode', 'branche', 'reseau'].forEach(function (k) {
      var s = document.getElementById('f-' + k);
      if (s && String(s.value) !== String(f[k])) s.value = String(f[k]);
    });
    document.getElementById('stamp').textContent = avecFiltres
      ? f.periode + ' trimestres · '
        + (f.branche === '*' ? 'toutes branches' : D.BRANCHES[f.branche].nom.toLowerCase())
        + ' · ' + D.RESEAUX[f.reseau].nom
      : 'données fictives';

    if (estApercu) vueApercu(host, f);
    else if (etat.vue === 'sources') vueSources(host);
    else if (etat.vue === 'apropos') vueApropos(host);
    else if (r) vueMiabord(host, r, f);

    host.querySelectorAll('[data-go]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); allerA(a.getAttribute('data-go')); });
    });
    window.setTimeout(function () { host.classList.remove('load'); }, 20);
  }

  function clignote() {
    var z = document.getElementById('vue');
    z.classList.remove('majour');
    void z.offsetWidth;
    z.classList.add('majour');
  }

  /* Coloration très simple du code montré, sans dépendance. */
  function coloriser(src, langue) {
    var t = esc(src);
    t = t.replace(/(^|\n)(\s*)(--|#)([^\n]*)/g, '$1$2<span class="c">$3$4</span>');
    var mots = langue === 'sql'
      ? ['SELECT', 'FROM', 'JOIN', 'USING', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'WITH', 'AS', 'AND', 'OR', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ON', 'SUM', 'COUNT', 'DISTINCT', 'BETWEEN']
      : ['import', 'from', 'for', 'in', 'if', 'return', 'assert', 'lambda', 'def', 'not'];
    mots.forEach(function (mo) {
      t = t.replace(new RegExp('(^|[^\\w])(' + mo + ')([^\\w]|$)', 'g'), '$1<span class="k">$2</span>$3');
    });
    return t;
  }

  /* ============================================================= 5. Mia */

  var corps = null, appli = null;

  function ouvrirMia() {
    appli.classList.remove('sansmia');
    var i = document.getElementById('q');
    window.setTimeout(function () { i.focus(); }, 240);
  }
  function fermerMia() { appli.classList.add('sansmia'); }

  function travaille(actif) {
    document.querySelectorAll('.mia-mark').forEach(function (m) {
      m.classList.toggle('travaille', !!actif);
    });
  }

  function bulleUtilisateur(texte) {
    var m = el('div', 'msg me', '<div class="b"></div>');
    m.querySelector('.b').textContent = texte;
    corps.appendChild(m);
    corps.scrollTop = corps.scrollHeight;
  }
  function bulleMia() {
    var m = el('div', 'msg ia',
      '<div class="who">' + marque('s') + 'Mia</div><div class="txt"></div>');
    corps.appendChild(m);
    corps.scrollTop = corps.scrollHeight;
    return m.querySelector('.txt');
  }

  var ETAPES = [
    'Je cherche les tables qui portent ces informations',
    'J’écris la requête et le calcul',
    'J’exécute sur la période demandée',
    'Je mets en forme et je construis le miabord'
  ];

  function produire(r) {
    var txt = bulleMia();
    var ul = el('ul', 'steps');
    txt.appendChild(ul);
    travaille(true);
    ETAPES.forEach(function (s, i) {
      window.setTimeout(function () {
        ul.appendChild(el('li', null, '<span class="t">' + (i + 1) + '.</span><span>' + esc(s) + '</span>'));
        corps.scrollTop = corps.scrollHeight;
      }, 260 * i);
    });
    window.setTimeout(function () {
      travaille(false);
      var d = el('div');
      d.innerHTML = '<details class="code"><summary>Voir le code que j’ai écrit</summary><pre>'
        + coloriser(r.source, r.code) + '</pre></details>'
        + '<p><strong>' + esc(r.titre) + '</strong> est prêt. ' + esc(r.resume)
        + ' Le miabord est ajouté à la barre latérale.</p>'
        + '<p><button class="send" data-open="' + r.id + '">Ouvrir le miabord</button></p>';
      txt.appendChild(d);
      if (etat.produits.indexOf(r.id) < 0) etat.produits.push(r.id);
      dessinerMenu();
      chips();
      d.querySelector('[data-open]').addEventListener('click', function () { allerA(r.id); });
      corps.scrollTop = corps.scrollHeight;
    }, 260 * ETAPES.length + 200);
  }

  function repondre(html) {
    var txt = bulleMia();
    txt.innerHTML = html;
    corps.scrollTop = corps.scrollHeight;
    return txt;
  }

  function applique(resume) {
    rendreVue();
    dessinerMenu();
    clignote();
    repondre('<div class="fait"><span class="ic">✓</span><span>' + resume + '</span></div>'
      + '<p style="color:var(--mi-muted);font-size:.83rem;margin:.35rem 0 0">Le miabord a été '
      + 'recalculé. Vous pouvez enchaîner : « et sur 16 trimestres », « trie par ratio », '
      + '« enlève les mouvements ».</p>');
  }

  /* ------------------------------------------------- reconnaissance simple */

  var MOTS = {
    portefeuille: ['portefeuille', 'rentabilit', 'primes', 'ratio', 's/p', 'combin'],
    tarification: ['tarif', 'prime technique', 'prime pure', 'segment', 'glm', 'pricing'],
    provisionnement: ['provision', 'triangle', 'chain ladder', 'ultime', 'ibnr', 'reserv'],
    forecast: ['projet', 'prévision', 'prevision', 'forecast', 'scénario', 'scenario', 'résultat technique'],
    sinistres: ['sinistre', 'délai', 'delai', 'canal', 'flux', 'charge', 'gestionnaire', 'garantie', 'dérive', 'derive'],
    attrition: ['attrition', 'churn', 'résiliation', 'resiliation', 'rétention', 'retention', 'relance', 'campagne', 'cohorte'],
    fraude: ['fraude', 'anomalie', 'seuil', 'prestataire', 'faux positif', 'précision', 'precision', 'rappel'],
    rh: ['baromètre', 'barometre', 'rh', 'salari', 'effectif', 'âge', 'age', 'compétence', 'competence', 'départ', 'depart'],
    adoption: ['adoption', 'usage', 'licence', 'acculturation', 'ambassadeur', 'besoin', 'entonnoir'],
    segmentation: ['segmentation', 'segment', 'clustering', 'k moyennes', 'kmeans', 'typologie', 'inertie'],
    cout: ['modèle de coût', 'modele de cout', 'gradient', 'boosting', 'machine learning',
      'apprentissage', 'importance des variables', 'calibration', 'gini', 'discrimination']
  };
  function trouverRecette(s) {
    var meilleur = null, score = 0;
    RECETTES.forEach(function (r) {
      var n = 0;
      (MOTS[r.id] || []).forEach(function (mo) { if (s.indexOf(mo) >= 0) n++; });
      if (n > score) { score = n; meilleur = r; }
    });
    return score > 0 ? meilleur : null;
  }

  var BRANCHES_MOTS = { auto: ['automobile', 'auto'], hab: ['habitation'], sante: ['santé', 'sante'],
    prev: ['prévoyance', 'prevoyance'], rc: ['responsabilité civile', 'responsabilite civile', ' rc '] };
  var RESEAUX_MOTS = { agents: ['agent'], courtiers: ['courtier'], direct: ['direct', 'espace client'] };

  /* Modifications du miabord courant. Retourne la liste de ce qui a changé. */
  function modifier(s) {
    var faits = [], f = etat.filtres;
    var idCourant = etat.vue === 'apercu' ? 'portefeuille' : etat.vue;
    var r = recette(idCourant);
    var m = mods(idCourant);

    var p = s.match(/(\d{1,2})\s*trimestres?/);
    if (p) {
      var n = Number(p[1]);
      n = n <= 9 ? 8 : (n <= 13 ? 12 : 16);
      if (f.periode !== n) { f.periode = n; faits.push('période portée à <strong>' + n + ' trimestres</strong>'); }
    }
    if (/toutes? les branches|toutes branches/.test(s)) {
      if (f.branche !== '*') { f.branche = '*'; faits.push('filtre de branche retiré'); }
    } else {
      Object.keys(BRANCHES_MOTS).forEach(function (k) {
        BRANCHES_MOTS[k].forEach(function (mo) {
          if (s.indexOf(mo) >= 0 && f.branche !== k) {
            f.branche = k;
            faits.push('branche <strong>' + D.BRANCHES[k].nom.toLowerCase() + '</strong> seule');
          }
        });
      });
    }
    if (/tous les r[ée]seaux/.test(s)) {
      if (f.reseau !== '*') { f.reseau = '*'; faits.push('filtre de réseau retiré'); }
    } else {
      Object.keys(RESEAUX_MOTS).forEach(function (k) {
        RESEAUX_MOTS[k].forEach(function (mo) {
          if (s.indexOf(mo) >= 0 && f.reseau !== k) {
            f.reseau = k;
            faits.push('réseau : <strong>' + D.RESEAUX[k].nom + '</strong>');
          }
        });
      });
    }

    var rep = s.match(/(?:rep[eè]re|seuil)[^0-9]{0,18}(\d{2,3})\s*%/);
    if (rep && idCourant === 'portefeuille') {
      m.repere = Number(rep[1]);
      faits.push('repère du ratio placé à <strong>' + m.repere + ' %</strong>');
    }
    if (/tri(e|er)?\b|classe|ordonne/.test(s) && idCourant === 'portefeuille') {
      if (/origine|alphab|nom/.test(s)) { m.tri = 'origine'; faits.push('branches remises dans l’ordre d’origine'); }
      else { m.tri = 'valeur'; faits.push('branches triées <strong>du ratio le plus élevé au plus bas</strong>'); }
    }
    if (idCourant === 'portefeuille') {
      var ajout = /ajoute|rajoute|montre aussi|affiche aussi/.test(s);
      var retrait = /enl[èe]ve|retire|supprime|masque|cache/.test(s);
      CARTES_PORTEFEUILLE.concat([{ id: 'heat', nom: 'lecture branche par trimestre' }]).forEach(function (c) {
        var vise = c.nom.split(' ').filter(function (w) { return w.length > 4; })
          .some(function (w) { return s.indexOf(w) >= 0; }) || s.indexOf(c.id) >= 0;
        if (!vise) return;
        var i = m.cartes.indexOf(c.id);
        if (ajout && i < 0) { m.cartes.push(c.id); faits.push('carte <strong>' + c.nom + '</strong> ajoutée'); }
        if (retrait && i >= 0) { m.cartes.splice(i, 1); faits.push('carte <strong>' + c.nom + '</strong> retirée'); }
      });
      if (/(tuiles|chiffres cl[ée]s|indicateurs)/.test(s)) {
        if (/enl[èe]ve|retire|masque|cache|supprime/.test(s) && m.tuiles) {
          m.tuiles = false; faits.push('tuiles de chiffres clés masquées');
        }
        if (/affiche|remets|montre|ajoute/.test(s) && !m.tuiles) {
          m.tuiles = true; faits.push('tuiles de chiffres clés réaffichées');
        }
      }
    }

    if (r && r.onglets) {
      r.onglets.forEach(function (t, i) {
        var mo = t.toLowerCase();
        if (s.indexOf(mo) >= 0 && (etat.onglets[idCourant] || 0) !== i) {
          etat.onglets[idCourant] = i;
          faits.push('onglet <strong>' + esc(t) + '</strong> ouvert');
        }
      });
    }
    return faits;
  }

  function demander(q) {
    if (!q.trim()) return;
    bulleUtilisateur(q);
    var s = q.toLowerCase();

    window.setTimeout(function () {
      // 1. ouvrir un miabord existant
      if (/^\s*(ouvre|affiche|montre|va sur|passe (sur|à|a))\b/.test(s)) {
        var cible = trouverRecette(s);
        if (cible && etat.produits.indexOf(cible.id) >= 0) {
          allerA(cible.id);
          repondre('<p>J’ouvre <strong>' + esc(cible.titre) + '</strong>.</p>');
          return;
        }
        if (cible) { produire(cible); return; }
      }
      // 2. modifier le miabord courant
      var faits = modifier(s);
      if (faits.length) {
        applique(faits.map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1); }).join('. ') + '.');
        return;
      }
      // 3. produire un miabord
      var r = trouverRecette(s);
      if (r) {
        if (etat.produits.indexOf(r.id) >= 0) {
          allerA(r.id);
          repondre('<p><strong>' + esc(r.titre) + '</strong> existe déjà, je l’ouvre. Dites-moi ce '
            + 'que vous voulez y changer.</p>');
          return;
        }
        produire(r);
        return;
      }
      // 4. refus honnête
      var restants = RECETTES.filter(function (x) { return etat.produits.indexOf(x.id) < 0; });
      repondre('<p>Je ne sais pas faire celle-ci dans cette démonstration. Le vrai produit écrit la '
        + 'requête à partir des tables réellement branchées ; ici, les miabords sont préparés à '
        + 'l’avance pour que la page fonctionne sans serveur et sans données.</p>'
        + (restants.length
          ? '<p>Ce que je peux produire : ' + restants.map(function (x) {
            return '<strong>' + esc(x.titre.toLowerCase()) + '</strong>';
          }).join(', ') + '.</p>'
          : '<p>Tous les miabords prévus ont déjà été produits.</p>')
        + '<p>Et sur le miabord ouvert, je sais changer la période, la branche, le réseau, le repère '
        + 'du ratio, l’ordre des branches, les cartes affichées et l’onglet.</p>');
    }, 300);
  }

  /* Pour une démonstration rapide : tous les miabords d'un coup, sans attendre
     l'animation, et la barre latérale se remplit d'un seul geste. */
  function toutProduire() {
    var avant = etat.produits.length;
    RECETTES.forEach(function (r) {
      if (etat.produits.indexOf(r.id) < 0) etat.produits.push(r.id);
    });
    var ajoutes = etat.produits.length - avant;
    dessinerMenu();
    chips();
    if (!ajoutes) { repondre('<p>Ils sont déjà tous là.</p>'); return; }
    repondre('<div class="fait"><span class="ic">✓</span><span><strong>' + ajoutes
      + ' miabords</strong> produits d’un coup, ils sont dans la barre latérale.</span></div>'
      + '<p style="color:var(--mi-muted);font-size:.83rem;margin:.35rem 0 0">Raccourci de '
      + 'démonstration. Dans le vrai produit, chacun serait écrit, exécuté et vérifié un par un.</p>');
  }

  function chips() {
    var host = document.getElementById('chips');
    var restants = RECETTES.filter(function (r) { return etat.produits.indexOf(r.id) < 0; });
    var h = '';
    if (restants.length) {
      h += '<span class="titre">Produire un miabord</span>';
      h += '<button type="button" data-tout="1" style="border-color:#C9DBF0;'
        + 'background:var(--mi-accent-soft);font-weight:800">Tout produire (' + restants.length + ')</button>';
      h += restants.map(function (r) {
        return '<button type="button" data-p="' + r.id + '">' + esc(r.titre) + '</button>';
      }).join('');
    }
    h += '<span class="titre">Modifier celui-ci</span>'
      + '<button type="button" data-m="mets le repère à 80 %">repère à 80 %</button>'
      + '<button type="button" data-m="trie les branches par ratio">trier par ratio</button>'
      + '<button type="button" data-m="ajoute les motifs de résiliation">ajouter les motifs</button>'
      + '<button type="button" data-m="sur 16 trimestres chez les courtiers">16 trimestres, courtiers</button>';
    host.innerHTML = h;
    var tout = host.querySelector('[data-tout]');
    if (tout) tout.addEventListener('click', toutProduire);
    host.querySelectorAll('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () { demander(recette(b.getAttribute('data-p')).prompt); });
    });
    host.querySelectorAll('[data-m]').forEach(function (b) {
      b.addEventListener('click', function () { demander(b.getAttribute('data-m')); });
    });
  }

  /* ==================================================== démarrage de la page */

  document.addEventListener('DOMContentLoaded', function () {
    appli = document.querySelector('.app');
    corps = document.getElementById('miabody');

    document.querySelectorAll('[data-mark]').forEach(function (e) {
      e.innerHTML = marque(e.getAttribute('data-mark') || '');
    });

    document.getElementById('ask').addEventListener('click', function () {
      appli.classList.contains('sansmia') ? ouvrirMia() : fermerMia();
    });
    document.getElementById('closemia').addEventListener('click', fermerMia);
    document.getElementById('scrim').addEventListener('click', fermerMia);
    document.getElementById('burger').addEventListener('click', function () {
      document.querySelector('.side').classList.toggle('open');
    });

    document.getElementById('form').addEventListener('submit', function (e) {
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

    var accueil = bulleMia();
    accueil.innerHTML = '<p>Bonjour. Écrivez le miabord que vous voulez voir : j’écris la requête, '
      + 'je l’exécute, et il apparaît dans la barre latérale.</p>'
      + '<p>Une fois ouvert, <strong>dites-moi ce que vous voulez y changer</strong> et il se '
      + 'recalcule pendant que vous le regardez.</p>'
      + '<p style="color:var(--mi-muted);font-size:.83rem">Dans cette démonstration les miabords '
      + 'sont préparés à l’avance et les données sont inventées.</p>';

    chips();
    dessinerMenu();
    rendreVue();
  });
})();
