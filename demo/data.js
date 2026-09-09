/* Mia Insights, application de démonstration : le jeu de données.

   TOUT EST INVENTÉ. Rien ici ne décrit le portefeuille, les clients, les
   salariés ni les résultats d'un assureur réel. Les valeurs sont produites par un
   générateur pseudo-aléatoire à graine fixe, pour que l'application montre
   exactement la même chose à chaque ouverture et que deux personnes qui la
   regardent voient les mêmes chiffres.

   Les libellés de branches, de garanties et d'indicateurs reprennent le vocabulaire
   courant de l'assurance, pour que la démonstration parle au métier. */

window.DEMO = (function () {
  'use strict';

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function bruit(seed, amp) {
    var g = rng(seed);
    return function () { return 1 + (g() - 0.5) * amp; };
  }

  /* ------------------------------------------------------------ référentiels */

  var BRANCHES = {
    auto:  { nom: 'Automobile',            primes: 41200, sp: 0.786, delai: 1.9, part: 0.34 },
    hab:   { nom: 'Habitation',            primes: 24800, sp: 0.641, delai: 2.4, part: 0.21 },
    sante: { nom: 'Santé',                 primes: 29600, sp: 0.842, delai: 1.2, part: 0.25 },
    prev:  { nom: 'Prévoyance',            primes: 14300, sp: 0.512, delai: 3.1, part: 0.12 },
    rc:    { nom: 'Responsabilité civile', primes: 9400,  sp: 0.694, delai: 3.6, part: 0.08 }
  };
  var CLES = ['auto', 'hab', 'sante', 'prev', 'rc'];

  var RESEAUX = {
    '*':       { nom: 'tous les réseaux', poids: 1,    sp: 0,      delai: 0 },
    agents:    { nom: 'les agents',       poids: 0.47, sp: -0.021, delai: -0.2 },
    courtiers: { nom: 'les courtiers',    poids: 0.34, sp: 0.028,  delai: 0.4 },
    direct:    { nom: 'le direct',        poids: 0.19, sp: 0.009,  delai: -0.5 }
  };

  var SAISON = [1.04, 0.97, 0.92, 1.07];        // T1 à T4

  function trimestres(n) {
    var out = [], an = 2026, q = 3;              // le trimestre courant est T3 2026
    for (var i = 0; i < n; i++) { q--; if (q < 1) { q = 4; an--; } out.unshift('T' + q + ' ' + an); }
    return out;
  }
  function noQ(lbl) { return Number(lbl.charAt(1)) - 1; }

  /* --------------------------------------------- portefeuille et actuariat */

  function portefeuille(f) {
    var cles = f.branche === '*' ? CLES : [f.branche];
    var r = RESEAUX[f.reseau], lbl = trimestres(f.periode);
    var g = rng(31337), primes = [], charge = [], parBranche = {};
    cles.forEach(function (k) { parBranche[k] = []; });
    lbl.forEach(function (t, i) {
      var s = SAISON[noQ(t)], tot = 0, ch = 0;
      cles.forEach(function (k) {
        var b = BRANCHES[k];
        var p = b.primes / 4 * r.poids * s * (1 + (i - f.periode / 2) * 0.006) * (0.985 + g() * 0.03);
        var sp = b.sp + r.sp + Math.sin((i + k.length) / 3.1) * 0.035 + (g() - 0.5) * 0.02;
        parBranche[k].push({ p: p, sp: sp });
        tot += p; ch += p * sp;
      });
      primes.push(Math.round(tot));
      charge.push(Math.round(ch));
    });
    var totP = primes.reduce(function (a, b) { return a + b; }, 0);
    var totC = charge.reduce(function (a, b) { return a + b; }, 0);
    var frais = Math.round(totP * 0.221);
    return {
      lbl: lbl, cles: cles, primes: primes, charge: charge, parBranche: parBranche,
      reseau: r, totP: totP, totC: totC, frais: frais,
      resultat: totP - totC - frais,
      sp: totC / totP * 100,
      combine: (totC + frais) / totP * 100,
      spBranche: cles.map(function (k) {
        var p = 0, c = 0;
        parBranche[k].forEach(function (x) { p += x.p; c += x.p * x.sp; });
        return Math.round(c / p * 1000) / 10;
      }),
      delai: cles.reduce(function (a, k) { return a + BRANCHES[k].delai * BRANCHES[k].part; }, 0)
        / cles.reduce(function (a, k) { return a + BRANCHES[k].part; }, 0) + r.delai
    };
  }

  /* Prime pure par tranche d'âge et par zone. */
  var PRIME_PURE = {
    lignes: ['18 à 25 ans', '26 à 35 ans', '36 à 50 ans', '51 à 65 ans', '66 ans et plus'],
    colonnes: ['Centre', 'Sud', 'Nord', 'Est', 'Frontaliers'],
    valeurs: [
      [452, 388, 301, 324, 411],
      [318, 276, 214, 233, 297],
      [241, 208, 168, 179, 226],
      [203, 181, 149, 158, 194],
      [229, 206, 176, 184, 218]
    ]
  };

  /* Segments de tarification, pour la comparaison prime technique et pratiquée. */
  var SEGMENTS = [
    { n: 'Jeune conducteur, centre',      tech: 968,  prat: 812,  nb: 1240,  recent: true },
    { n: 'Jeune conducteur, hors centre', tech: 742,  prat: 655,  nb: 2090,  recent: true },
    { n: 'Sinistre récent, 26 à 50 ans',  tech: 604,  prat: 548,  nb: 3410,  recent: true },
    { n: 'Flotte professionnelle',        tech: 1490, prat: 1435, nb: 610,   recent: false },
    { n: 'Second véhicule',               tech: 288,  prat: 296,  nb: 4820,  recent: false },
    { n: 'Conducteur 36 à 50 ans',        tech: 412,  prat: 431,  nb: 11800, recent: false },
    { n: 'Conducteur 51 à 65 ans',        tech: 356,  prat: 388,  nb: 9350,  recent: false },
    { n: 'Senior, bonus maximal',         tech: 331,  prat: 379,  nb: 5270,  recent: false }
  ];

  function tarification(hausse) {
    var cats = [], ecarts = [], primes = 0, techs = 0, surTarifes = 0, touches = 0;
    SEGMENTS.forEach(function (s) {
      var prat = s.recent ? s.prat * (1 + hausse / 100) : s.prat;
      var e = (s.tech - prat) / prat * 100;
      cats.push(s.n);
      ecarts.push(Math.round(e * 10) / 10);
      primes += prat * s.nb; techs += s.tech * s.nb;
      if (e < -8) surTarifes += s.nb;
      if (s.recent && hausse) touches += s.nb;
    });
    var nb = SEGMENTS.reduce(function (a, s) { return a + s.nb; }, 0);
    return {
      cats: cats, ecarts: ecarts, touches: touches, surTarifes: surTarifes,
      marge: (primes - techs) / primes * 100, primeMoyenne: primes / nb
    };
  }

  /* Triangle de règlements cumulés et déroulement en chain ladder. */
  function triangle() {
    var ans = [2020, 2021, 2022, 2023, 2024, 2025];
    var ultime = [8420, 8910, 9240, 9880, 10310, 10920];
    var cadence = [0.46, 0.71, 0.855, 0.935, 0.978, 1];
    var g = rng(20260909);
    var obs = ans.map(function (a, i) {
      return cadence.map(function (m, j) {
        return i + j > ans.length - 1 ? null : Math.round(ultime[i] * m * (0.97 + g() * 0.06));
      });
    });
    var fac = [];
    for (var j = 0; j < ans.length - 1; j++) {
      var num = 0, den = 0;
      for (var i = 0; i + j + 1 <= ans.length - 1; i++) { num += obs[i][j + 1]; den += obs[i][j]; }
      fac.push(num / den);
    }
    var plein = obs.map(function (r) { return r.slice(); });
    for (var a = 0; a < ans.length; a++) {
      for (var b = 1; b < ans.length; b++) {
        if (plein[a][b] === null) plein[a][b] = Math.round(plein[a][b - 1] * fac[b - 1]);
      }
    }
    var ult = 0, regle = 0;
    plein.forEach(function (r, i) {
      ult += r[ans.length - 1];
      regle += obs[i].filter(function (v) { return v !== null; }).pop();
    });
    return { ans: ans, obs: obs, plein: plein, fac: fac, ultime: ult, regle: regle, provision: ult - regle };
  }

  /* Résultat technique projeté sur quatre trimestres. */
  function forecast(scenario) {
    var f = { bas: -0.09, central: 0, haut: 0.07 }[scenario];
    var lbl = trimestres(12), q = 3, an = 2026, g = rng(4242), serie = [];
    for (var i = 0; i < 12; i++) {
      serie.push(Math.round((2450 + i * 46) * SAISON[noQ(lbl[i])] * (0.96 + g() * 0.08)));
    }
    var xs = lbl.slice();
    for (var k = 0; k < 4; k++) {
      q++; if (q > 4) { q = 1; an++; }
      xs.push('T' + q + ' ' + an);
      serie.push(Math.round((2450 + (12 + k) * 46) * SAISON[q - 1] * (1 + f)));
    }
    var lo = [], hi = [];
    xs.forEach(function (_, i) {
      if (i < 11) { lo.push(null); hi.push(null); return; }
      var m = 0.035 + (i - 11) * 0.022;
      lo.push(Math.round(serie[i] * (1 - m)));
      hi.push(Math.round(serie[i] * (1 + m)));
    });
    return { x: xs, serie: serie, lo: lo, hi: hi,
      cumul: serie.slice(12).reduce(function (a, b) { return a + b; }, 0), ecart: f };
  }

  /* ------------------------------------------------------ sinistres et flux */

  var CANAUX = ['Espace client', 'Boîte commune', 'Courtier', 'Guichet'];

  function delais(f) {
    var base = portefeuille(f).delai, sem = [], out = [];
    for (var i = 12; i >= 1; i--) sem.push('S-' + i);
    [[0.62, 3], [0.94, 5], [1.08, 7], [1.34, 11]].forEach(function (p, k) {
      var g = rng(p[1] * 7 + 1), v = [];
      for (var i = 0; i < 12; i++) {
        v.push(Math.round((base * p[0] + Math.sin(i / 2.1) * 0.24 + (g() - 0.5) * 0.3) * 10) / 10);
      }
      if (k === 3) { v[7] = Math.round((v[7] + 1.6) * 10) / 10; v[8] = Math.round((v[8] + 1.2) * 10) / 10; }
      out.push(v);
    });
    return { sem: sem, canaux: CANAUX, series: out };
  }

  var GARANTIES = [
    { nom: 'Dégât des eaux',   base: 3.1, amp: 1.5,  phase: 0.4, seed: 21, pics: { 33: 6.9, 34: 7.4 } },
    { nom: 'Bris de glace',    base: 5.4, amp: 0.8,  phase: 2.1, seed: 22, pics: {} },
    { nom: 'Vol et vandalisme',base: 1.9, amp: 0.55, phase: 4.0, seed: 23, pics: { 45: 3.8 } },
    { nom: 'Incendie',         base: 0.9, amp: 0.22, phase: 1.2, seed: 24, pics: {} }
  ];

  function controle(k) {
    var g = GARANTIES[k], r = rng(g.seed), sem = [], att = [], obs = [];
    for (var i = 0; i < 52; i++) {
      sem.push('S' + (i + 1));
      var a = g.base + Math.sin((i / 52) * Math.PI * 2 + g.phase) * g.amp;
      att.push(Math.round(a * 100) / 100);
      obs.push(Math.round((g.pics[i] !== undefined ? g.pics[i] : a * (0.9 + r() * 0.2)) * 100) / 100);
    }
    var moy = att.reduce(function (a, b) { return a + b; }, 0) / 52;
    var ec = Math.sqrt(obs.reduce(function (a, v, i) { return a + Math.pow(v - att[i], 2); }, 0) / 52);
    var lo = Math.max(0, Math.round((moy - 3 * ec) * 100) / 100);
    var hi = Math.round((moy + 3 * ec) * 100) / 100;
    return {
      nom: g.nom, sem: sem, attendu: att, observe: obs, lo: lo, hi: hi, ecart: ec,
      hors: obs.filter(function (v) { return v < lo || v > hi; }).length,
      moyenne: obs.reduce(function (a, b) { return a + b; }, 0) / 52
    };
  }

  var PAR_GESTIONNAIRE = 42;

  function flux(effectif) {
    var lbl = [], g = rng(9091), histo = [], futur = [];
    for (var i = 0; i < 10; i++) {
      lbl.push('S-' + (10 - i));
      histo.push(Math.round((498 + Math.sin(i / 3) * 42) * (0.96 + g() * 0.08)));
    }
    for (var k = 0; k < 8; k++) {
      lbl.push('S+' + (k + 1));
      futur.push(Math.round(512 + Math.sin((10 + k) / 3) * 46 + k * 7));
    }
    var cap = effectif * PAR_GESTIONNAIRE, stock = 0, pire = 0, premiere = null;
    futur.forEach(function (v, i) {
      stock = Math.max(0, stock + v - cap);
      if (stock > pire) pire = stock;
      if (stock > 0 && premiere === null) premiere = 'S+' + (i + 1);
    });
    return {
      lbl: lbl, serie: histo.concat(futur), cap: cap, coupe: 9,
      stock: pire, premiere: premiere,
      absorbe: Math.ceil(Math.max.apply(null, futur) / PAR_GESTIONNAIRE)
    };
  }

  /* ------------------------------------------------------------- commercial */

  var CAMPAGNES = ['Prévoyance', 'Habitation', 'Second véhicule', 'Épargne'];
  var SEGMENTS_CLIENT = [
    { nom: 'Clients de longue date', v: [9.4, 6.1, 4.8, 7.2] },
    { nom: 'Clients récents',        v: [5.2, 4.4, 3.1, 2.9] },
    { nom: 'Mono-contrat',           v: [3.6, 2.2, 1.4, 1.8] }
  ];

  function retention() {
    function surv(h0, pente, choc, coupe) {
      var out = [], s = 100;
      for (var m = 0; m <= 36; m++) {
        if (m === 0) { out.push(100); continue; }
        if (coupe && m > coupe) { out.push(null); continue; }
        s = s * (1 - (h0 + pente * m / 36 + (m === 12 || m === 24 ? choc : 0)) / 100);
        out.push(Math.round(s * 10) / 10);
      }
      return out;
    }
    var mois = [];
    for (var m = 0; m <= 36; m++) mois.push(String(m));
    return {
      mois: mois,
      cohortes: [
        { nom: 'Cohorte 2021', v: surv(0.42, 0.5, 1.9) },
        { nom: 'Cohorte 2022', v: surv(0.5, 0.55, 2.2) },
        { nom: 'Cohorte 2023', v: surv(0.61, 0.6, 2.6) },
        { nom: 'Cohorte 2024', v: surv(0.72, 0.62, 2.9, 24) }
      ],
      variables: ['Hausse de prime à l’échéance', 'Aucun sinistre depuis 3 ans', 'Un seul contrat détenu',
        'Aucun contact avec l’agent', 'Changement d’adresse', 'Paiement mensuel', 'Ancienneté de l’agent'],
      poids: [100, 71, 63, 48, 34, 22, 14]
    };
  }

  var COUT_CONTACT = 18, PRIME_MOY = 640, PORTEFEUILLE = 50000;

  function relance() {
    var parts = [], valeur = [], sauves = [], couts = [];
    for (var p = 0; p <= 60; p += 2) {
      var n = PORTEFEUILLE * p / 100;
      var taux = p === 0 ? 0 : (0.28 - 0.0026 * p);
      var s = n * taux * 0.34;
      parts.push(p + ' %');
      sauves.push(Math.round(s));
      couts.push(Math.round(n * COUT_CONTACT));
      valeur.push(Math.round((s * PRIME_MOY - n * COUT_CONTACT) / 1000));
    }
    var best = 0;
    valeur.forEach(function (v, i) { if (v > valeur[best]) best = i; });
    return { parts: parts, valeur: valeur, sauves: sauves, couts: couts, best: best,
      portefeuille: PORTEFEUILLE, cout: COUT_CONTACT, prime: PRIME_MOY };
  }

  var MOTIFS = {
    libelles: ['Hausse de prime à l’échéance', 'Offre concurrente', 'Vente du bien ou du véhicule',
      'Déménagement hors du pays', 'Insatisfaction sur un sinistre',
      'Regroupement chez un autre assureur', 'Décès ou fin de contrat'],
    parts: [31, 22, 14, 11, 9, 8, 5]
  };

  function mouvements(f) {
    var d = portefeuille(f), g = rng(808), an = [], re = [];
    d.lbl.forEach(function (t, i) {
      var base = 1180 * d.reseau.poids * (f.branche === '*' ? 1 : BRANCHES[f.branche].part / 0.2);
      an.push(Math.round(base * SAISON[noQ(t)] * (0.94 + g() * 0.12)));
      re.push(-Math.round(base * 0.78 * SAISON[noQ(t)] * (0.9 + g() * 0.2) * (1 + i * 0.006)));
    });
    return { lbl: d.lbl, nouvelles: an, resiliations: re };
  }

  /* ------------------------------------------------------------ fraude */

  var FRAUDE = {
    prestataires: ['Prestataire A', 'Prestataire B', 'Prestataire C', 'Prestataire D',
      'Prestataire E', 'Prestataire F', 'Prestataire G'],
    familles: ['Optique', 'Dentaire', 'Carrosserie', 'Bâtiment', 'Médical'],
    taux: [
      [14.2, 6.1, 3.4, 4.0, 5.2],
      [4.8, 5.3, 3.1, 3.6, 4.4],
      [3.9, 4.1, 11.8, 3.2, 3.8],
      [5.1, 4.6, 4.2, 3.9, 4.1],
      [3.2, 3.6, 3.8, 9.4, 3.5],
      [4.4, 3.9, 4.6, 4.1, 4.2],
      [3.6, 3.4, 3.2, 3.5, 3.3]
    ],
    tranches: ['0 à 500 €', '500 à 1 k€', '1 à 2 k€', '2 à 5 k€', '5 à 10 k€',
      '10 à 25 k€', '25 à 50 k€', '50 à 150 k€', 'plus de 150 k€'],
    nb: [8420, 5310, 3180, 1720, 640, 245, 78, 22, 6],
    milieu: [250, 750, 1500, 3500, 7500, 17500, 37500, 95000, 310000],
    capacite: 900, total: 42000, fondes: 1050, montantMoyen: 4300
  };

  function auSeuil(s) {
    var retenus = Math.round(FRAUDE.total * Math.pow((100 - s) / 70, 2.35) * 0.62);
    var vrais = Math.round(FRAUDE.fondes * Math.pow((100 - s) / 70, 1.05) * 0.86);
    if (vrais > retenus) vrais = retenus;
    return { retenus: retenus, vrais: vrais, faux: retenus - vrais,
      precision: retenus ? vrais / retenus * 100 : 100, rappel: vrais / FRAUDE.fondes * 100 };
  }
  function courbePR() {
    var seuils = [], prec = [], rapp = [];
    for (var s = 30; s <= 95; s++) {
      var a = auSeuil(s);
      seuils.push(String(s));
      prec.push(Math.round(a.precision * 10) / 10);
      rapp.push(Math.round(a.rappel * 10) / 10);
    }
    return { seuils: seuils, precision: prec, rappel: rapp };
  }

  /* -------------------------------------------------- ressources humaines */

  var RH = {
    directions: ['Opérations et sinistres', 'Commercial et distribution', 'Risque et conformité',
      'Finance et actuariat', 'Ressources humaines', 'Systèmes d’information'],
    modalites: [
      { nom: 'Pas du tout d’accord', c: '#a32a2a' },
      { nom: 'Plutôt pas d’accord', c: '#e8968f' },
      { nom: 'Neutre', c: '#d9dde2' },
      { nom: 'Plutôt d’accord', c: '#8fb8e6' },
      { nom: 'Tout à fait d’accord', c: '#2a78d6' }
    ],
    reponses: [
      [6, 14, 12, 41, 27],
      [4, 11, 13, 45, 27],
      [9, 21, 15, 38, 17],
      [12, 26, 14, 34, 14],
      [3, 9, 11, 48, 29],
      [7, 16, 12, 43, 22]
    ],
    ages: ['moins de 30', '30 à 39', '40 à 49', '50 à 54', '55 à 59', '60 et plus'],
    reste: [148, 262, 241, 118, 74, 21],
    partent: [0, 0, 0, 12, 63, 47],
    equipes: ['Souscription', 'Indemnisation', 'Actuariat', 'Marketing', 'Systèmes d’information', 'Conformité'],
    competences: ['Analyse de données', 'Rédaction réglementaire', 'Relation client', 'Automatisation', 'Langues'],
    ecarts: [
      [4, 2, 1, 3, 2],
      [6, 1, 2, 7, 3],
      [3, 5, 0, 2, 1],
      [5, 0, 1, 4, 2],
      [2, 1, 0, 8, 1],
      [1, 6, 0, 1, 2]
    ]
  };

  /* ------------------------------------------------------------- adoption */

  function adoption() {
    var sem = [];
    for (var i = 0; i < 26; i++) sem.push('S' + (i + 1));
    function courbe(plafond, vitesse, seed) {
      var g = rng(seed), out = [];
      for (var i = 0; i < 26; i++) {
        out.push(Math.round(plafond / (1 + Math.exp(-(i - 11) * vitesse)) * (0.93 + g() * 0.14)));
      }
      return out;
    }
    var mois = [], noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
      'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    for (var m = 0; m < 24; m++) mois.push(noms[m % 12] + (m < 12 ? ' 26' : ' 27'));
    function diffusion(plafond, vitesse, milieu) {
      var out = [];
      for (var i = 0; i < 24; i++) out.push(Math.round(plafond / (1 + Math.exp(-(i - milieu) * vitesse)) * 10) / 10);
      return out;
    }
    return {
      sem: sem, comptes: 430,
      usage: [
        { nom: 'Opérations', v: courbe(148, 0.28, 31) },
        { nom: 'Commercial', v: courbe(96, 0.24, 32) },
        { nom: 'Systèmes d’information', v: courbe(74, 0.42, 33) },
        { nom: 'Finance', v: courbe(21, 0.16, 34) }
      ],
      etapes: ['Besoins recensés', 'Besoins qualifiés', 'Cas d’usage cadrés', 'Cas d’usage lancés'],
      entonnoir: [214, 96, 41, 17],
      mois: mois,
      projection: [
        { nom: 'Systèmes d’information', v: diffusion(82, 0.31, 7) },
        { nom: 'Opérations', v: diffusion(64, 0.24, 11) },
        { nom: 'Commercial', v: diffusion(48, 0.21, 13) },
        { nom: 'Finance', v: diffusion(26, 0.17, 17) }
      ]
    };
  }

  /* -------------------------------------------------------------- sources */

  var SOURCES = [
    { nom: 'Tickets du service client', etat: 'ok', lignes: '1,2 M', maj: 'il y a 2 h',
      droits: 'Équipe IA', note: 'Source de la démonstration du 27 août.' },
    { nom: 'Tickets du service d’assistance', etat: 'ok', lignes: '840 k', maj: 'il y a 2 h',
      droits: 'Équipe IA', note: 'Branchée fin août.' },
    { nom: 'Contrats et primes encaissées', etat: 'stop', lignes: 'non branchée', maj: '—',
      droits: 'à définir', note: 'Suppose le filtrage par identité.' },
    { nom: 'Sinistres réglés', etat: 'stop', lignes: 'non branchée', maj: '—',
      droits: 'à définir', note: 'Clé de jointure avec les contrats à confirmer.' },
    { nom: 'Flux documentaire des sinistres', etat: 'wait', lignes: 'non branchée', maj: '—',
      droits: 'Indemnisation', note: 'Un tableau de bord existe déjà, risque de doublon.' },
    { nom: 'Suivi des actions commerciales', etat: 'wait', lignes: 'non branchée', maj: '—',
      droits: 'Direction commerciale', note: 'Définition de la transformation à écrire.' },
    { nom: 'Baromètre interne', etat: 'wait', lignes: 'non branchée', maj: '—',
      droits: 'Ressources humaines', note: 'Seuil de dix répondants à poser dans la source.' },
    { nom: 'Données de gestion', etat: 'stop', lignes: 'non branchée', maj: '—',
      droits: 'très restreint', note: 'Ne s’ouvre pas avant le filtrage par identité.' }
  ];

  return {
    rng: rng, bruit: bruit,
    BRANCHES: BRANCHES, CLES: CLES, RESEAUX: RESEAUX, CANAUX: CANAUX,
    GARANTIES: GARANTIES, CAMPAGNES: CAMPAGNES, SEGMENTS_CLIENT: SEGMENTS_CLIENT,
    MOTIFS: MOTIFS, FRAUDE: FRAUDE, RH: RH, SOURCES: SOURCES,
    PRIME_PURE: PRIME_PURE, PAR_GESTIONNAIRE: PAR_GESTIONNAIRE,
    trimestres: trimestres,
    portefeuille: portefeuille, tarification: tarification, triangle: triangle, forecast: forecast,
    delais: delais, controle: controle, flux: flux,
    retention: retention, relance: relance, mouvements: mouvements,
    auSeuil: auSeuil, courbePR: courbePR, adoption: adoption
  };
})();
