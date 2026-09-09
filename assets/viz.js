/* Graphiques des pages d'exemples de Mia Insights.
   Bibliothèque SVG écrite à la main, sans dépendance : les pages s'ouvrent en
   file://, rien ne doit être téléchargé. Toutes les données affichées sont
   fictives et produites par un générateur à graine fixe, pour que la page
   montre la même chose à chaque ouverture.

   Règles de dessin appliquées partout :
   1. Une seule échelle de valeurs par graphique, jamais deux axes.
   2. Barres de 24 px au plus, bout arrondi côté valeur, carré à la ligne de base.
   3. Deux pixels de surface séparent deux marques qui se touchent.
   4. Traits et grilles en épaisseur constante (vector-effect), grille pleine.
   5. Le texte ne porte jamais la couleur d'une série. La couleur est sur la marque.
   6. Étiquettes directes seulement sur les extrêmes, jamais sur chaque point.
   7. Toute valeur lisible au survol est aussi lisible dans le tableau replié.  */

(function () {
  'use strict';

  var W0 = 780;         // largeur par défaut du dessin, en unités de la viewBox
                        // (spec.width la remplace : une carte étroite dessine plus étroit,
                        //  sinon son graphique se retrouve derrière une barre de défilement)
  var GAP = 1.6;        // séparation entre deux marques qui se touchent
  var RAD = 3;          // arrondi du bout de barre, côté valeur
  var MAXBAR = 18;      // épaisseur maximale d'une barre
  var NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------- outils

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Générateur pseudo-aléatoire à graine, pour que les données ne bougent pas.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function fmt(v, dec, unit) {
    if (v === null || v === undefined || isNaN(v)) return '';
    var d = dec === undefined ? 0 : dec;
    var s = Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
    return unit ? s + ' ' + unit : s;
  }

  // Bornes et graduations rondes.
  function niceStep(raw) {
    var e = Math.floor(Math.log(raw) / Math.LN10), p = Math.pow(10, e), f = raw / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }
  function scale(min, max, count) {
    if (min === max) { max = min + 1; }
    var step = niceStep((max - min) / (count || 5));
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var t = [], v = lo, guard = 0;
    while (v <= hi + step * 1e-9 && guard++ < 40) { t.push(Math.round(v / step) * step); v += step; }
    return { lo: lo, hi: hi, ticks: t };
  }

  // Chemin d'une colonne verticale, arrondie du côté de la valeur.
  function colPath(x, w, yBase, yVal) {
    var up = yVal <= yBase, h = Math.abs(yBase - yVal), r = Math.min(RAD, w / 2, h);
    if (h < 0.4) return '';
    return up
      ? 'M' + x + ' ' + yBase + 'V' + (yVal + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r)
        + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + yBase + 'Z'
      : 'M' + x + ' ' + yBase + 'V' + (yVal - r) + 'a' + r + ' ' + r + ' 0 0 0 ' + r + ' ' + r
        + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 0 ' + r + ' ' + (-r) + 'V' + yBase + 'Z';
  }

  // Chemin d'une barre horizontale, arrondie du côté de la valeur.
  function barPath(y, h, xBase, xVal) {
    var right = xVal >= xBase, w = Math.abs(xVal - xBase), r = Math.min(RAD, h / 2, w);
    if (w < 0.4) return '';
    return right
      ? 'M' + xBase + ' ' + y + 'H' + (xVal - r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r
        + 'v' + (h - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + (-r) + ' ' + r + 'H' + xBase + 'Z'
      : 'M' + xBase + ' ' + y + 'H' + (xVal + r) + 'a' + r + ' ' + r + ' 0 0 0 ' + (-r) + ' ' + r
        + 'v' + (h - 2 * r) + 'a' + r + ' ' + r + ' 0 0 0 ' + r + ' ' + r + 'H' + xBase + 'Z';
  }

  // ------------------------------------------------------- squelette d'un cadre

  function frame(node, spec) {
    node.classList.add('vz');
    var h = '';
    if (spec.title) h += '<p class="vz-title">' + esc(spec.title) + '</p>';
    if (spec.sub) h += '<p class="vz-sub">' + esc(spec.sub) + '</p>';
    h += '<div class="vz-ctl-slot"></div>';
    h += '<div class="vz-kpi-slot"></div>';
    h += '<div class="vz-legend"></div>';
    h += '<div class="vz-plot"></div>';
    if (spec.scale) {
      h += '<div class="vz-scale"><span>' + esc(spec.scale[0]) + '</span><span class="bar"></span><span>'
        + esc(spec.scale[1]) + '</span></div>';
    }
    if (spec.caption) h += '<p class="caption">' + esc(spec.caption) + '</p>';
    h += '<details class="vz-data"><summary>Voir les données</summary><div class="wrap"></div></details>';
    node.innerHTML = h;
    return {
      legend: node.querySelector('.vz-legend'),
      plot: node.querySelector('.vz-plot'),
      data: node.querySelector('.vz-data .wrap'),
      ctl: node.querySelector('.vz-ctl-slot'),
      kpi: node.querySelector('.vz-kpi-slot')
    };
  }

  function legend(host, items) {
    if (!items || items.length < 2) { host.innerHTML = ''; return; }
    host.innerHTML = items.map(function (it) {
      var cls = it.type === 'line' ? 'line' : it.type === 'dot' ? 'dot' : '';
      return '<span><i class="' + cls + '" style="background:' + esc(it.color) + '"></i>' + esc(it.name) + '</span>';
    }).join('');
  }

  function table(host, head, rows) {
    var h = '<table><thead><tr>' + head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('')
      + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
    });
    host.innerHTML = h + '</tbody></table>';
  }

  // ------------------------------------------------------------- infobulle

  function tipFor(node) {
    var t = node.querySelector('.vz-tip');
    if (!t) { t = document.createElement('div'); t.className = 'vz-tip'; node.appendChild(t); }
    return t;
  }
  function tipShow(node, tip, evt, title, rows) {
    tip.innerHTML = '';
    var hd = document.createElement('div'); hd.className = 'h'; hd.textContent = title; tip.appendChild(hd);
    rows.forEach(function (r) {
      var d = document.createElement('div'); d.className = 'r';
      if (r.color) { var i = document.createElement('i'); i.style.background = r.color; d.appendChild(i); }
      var s = document.createElement('span'); s.textContent = r.name; d.appendChild(s);
      var b = document.createElement('b'); b.textContent = r.value; d.appendChild(b);
      tip.appendChild(d);
    });
    tip.style.display = 'block';
    var box = node.getBoundingClientRect(), tb = tip.getBoundingClientRect();
    var x = evt.clientX - box.left + 14, y = evt.clientY - box.top - tb.height - 12;
    if (x + tb.width > box.width - 4) x = evt.clientX - box.left - tb.width - 14;
    if (x < 4) x = 4;
    if (y < 4) y = evt.clientY - box.top + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function tipHide(tip) { tip.style.display = 'none'; }

  // Attache l'infobulle à toutes les marques porteuses de data-tip du graphique.
  function wire(node, plot) {
    var tip = tipFor(node);
    plot.querySelectorAll('[data-tip]').forEach(function (m) {
      var payload = JSON.parse(m.getAttribute('data-tip'));
      function show(e) {
        m.classList.add('on');
        tipShow(node, tip, e.touches ? e.touches[0] : e, payload.t, payload.r);
      }
      m.addEventListener('pointerenter', show);
      m.addEventListener('pointermove', show);
      m.addEventListener('pointerleave', function () { m.classList.remove('on'); tipHide(tip); });
    });
  }

  function svgOpen(w, h) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-hidden="false">';
  }

  // ---------------------------------------------------------------- colonnes
  // Colonnes verticales, groupées ou empilées. Une seule échelle de valeurs.

  function columns(node, spec) {
    var p = frame(node, spec), S = spec.series, cats = spec.cats;
    var W = spec.width || W0;
    var padL = spec.padL || 54, padR = 16, padT = 14, padB = spec.padB || 34;
    var H = spec.height || 250, plotH = H - padT - padB, plotW = W - padL - padR;

    var vals = [];
    if (spec.stacked) {
      cats.forEach(function (c, i) {
        var pos = 0, neg = 0;
        S.forEach(function (s) { var v = s.values[i]; if (v >= 0) pos += v; else neg += v; });
        vals.push(pos, neg);
      });
    } else { S.forEach(function (s) { s.values.forEach(function (v) { vals.push(v); }); }); }
    vals.push(0);
    if (spec.ref) vals.push(spec.ref.value);
    var sc = scale(Math.min.apply(null, vals), Math.max.apply(null, vals), 5);
    var y = function (v) { return padT + plotH - (v - sc.lo) / (sc.hi - sc.lo) * plotH; };
    var band = plotW / cats.length;
    var groupW = Math.min(band * 0.72, (spec.stacked ? 1 : S.length) * MAXBAR + (S.length - 1) * GAP);
    var barW = spec.stacked ? groupW : (groupW - (S.length - 1) * GAP) / S.length;

    var g = svgOpen(W, H) + '<g class="grid">';
    sc.ticks.forEach(function (t) {
      g += '<line x1="' + padL + '" y1="' + y(t) + '" x2="' + (W - padR) + '" y2="' + y(t)
        + '" vector-effect="non-scaling-stroke"/>';
    });
    g += '</g><g class="axis">';
    sc.ticks.forEach(function (t) {
      g += '<text x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" font-size="9.6">'
        + esc(fmt(t, spec.dec, '')) + '</text>';
    });
    g += '<line class="base" x1="' + padL + '" y1="' + y(sc.lo < 0 ? 0 : sc.lo) + '" x2="' + (W - padR)
      + '" y2="' + y(sc.lo < 0 ? 0 : sc.lo) + '" vector-effect="non-scaling-stroke"/>';
    cats.forEach(function (c, i) {
      g += '<text x="' + (padL + band * i + band / 2) + '" y="' + (H - padB + 16)
        + '" text-anchor="middle" font-size="9.6">' + esc(c) + '</text>';
    });
    g += '</g>';

    if (spec.yLabel) {
      g += '<text x="' + padL + '" y="' + (padT - 3) + '" font-size="9.4" class="lbl muted">'
        + esc(spec.yLabel) + '</text>';
    }

    var rows = [];
    cats.forEach(function (c, i) {
      var x0 = padL + band * i + (band - groupW) / 2;
      var accP = 0, accN = 0;
      var tipRows = S.map(function (s) {
        return { color: s.color, name: s.name, value: fmt(s.values[i], spec.dec, spec.unit) };
      });
      S.forEach(function (s, k) {
        var v = s.values[i], x, yTop, yBot;
        if (spec.stacked) {
          x = x0;
          if (v >= 0) { yBot = y(accP); accP += v; yTop = y(accP) + (k ? GAP : 0); }
          else { yBot = y(accN); accN += v; yTop = y(accN) - (k ? GAP : 0); }
        } else { x = x0 + k * (barW + GAP); yBot = y(0); yTop = y(v); }
        var d = colPath(x, barW, yBot, yTop);
        if (d) {
          g += '<path class="mark" d="' + d + '" fill="' + esc(s.color) + '" data-tip=\''
            + esc(JSON.stringify({ t: c, r: tipRows })) + '\'/>';
        }
      });
      rows.push([c].concat(S.map(function (s) { return fmt(s.values[i], spec.dec, spec.unit); })));
    });

    if (spec.ref) {
      g += '<g class="ref"><line x1="' + padL + '" y1="' + y(spec.ref.value) + '" x2="' + (W - padR)
        + '" y2="' + y(spec.ref.value) + '" stroke-dasharray="0" vector-effect="non-scaling-stroke"/>'
        + '<text x="' + (W - padR) + '" y="' + (y(spec.ref.value) - 6) + '" text-anchor="end" font-size="9.4">'
        + esc(spec.ref.label) + '</text></g>';
    }
    // Étiquette directe sur l'extrême seulement.
    if (spec.labelMax && !spec.stacked && S.length === 1) {
      var mx = 0; S[0].values.forEach(function (v, i) { if (v > S[0].values[mx]) mx = i; });
      var xm = padL + band * mx + (band - groupW) / 2 + barW / 2;
      g += '<text class="lbl" x="' + xm + '" y="' + (y(S[0].values[mx]) - 7) + '" text-anchor="middle">'
        + esc(fmt(S[0].values[mx], spec.dec, spec.unit)) + '</text>';
    }

    p.plot.innerHTML = g + '</svg>';
    legend(p.legend, S.map(function (s) { return { name: s.name, color: s.color }; }));
    table(p.data, [spec.catLabel || 'Catégorie'].concat(S.map(function (s) { return s.name; })), rows);
    wire(node, p.plot);
    return p;
  }

  // ------------------------------------------------------------------ barres
  // Barres horizontales, une série. Valeurs négatives acceptées (écart au zéro).

  function bars(node, spec) {
    var p = frame(node, spec), cats = spec.cats, vals = spec.values;
    var W = spec.width || W0;
    var padL = spec.padL || 150, padR = 54, padT = spec.rule ? 20 : 8, padB = 26;
    var rowH = spec.rowH || 26, H = padT + padB + rowH * cats.length, plotW = W - padL - padR;
    var all = vals.concat([0]);
    if (spec.rule) all.push(spec.rule.value);
    var sc = scale(Math.min.apply(null, all), Math.max.apply(null, all), 4);
    var x = function (v) { return padL + (v - sc.lo) / (sc.hi - sc.lo) * plotW; };
    var barH = Math.min(MAXBAR, rowH - 8);

    var g = svgOpen(W, H) + '<g class="grid">';
    sc.ticks.forEach(function (t) {
      g += '<line x1="' + x(t) + '" y1="' + padT + '" x2="' + x(t) + '" y2="' + (H - padB)
        + '" vector-effect="non-scaling-stroke"/>';
    });
    g += '</g><g class="axis">';
    sc.ticks.forEach(function (t) {
      g += '<text x="' + x(t) + '" y="' + (H - padB + 15) + '" text-anchor="middle" font-size="9.6">'
        + esc(fmt(t, spec.dec, '')) + '</text>';
    });
    var zero = sc.lo < 0 ? x(0) : padL;
    g += '<line class="base" x1="' + zero + '" y1="' + padT + '" x2="' + zero + '" y2="' + (H - padB)
      + '" vector-effect="non-scaling-stroke"/></g>';

    var rows = [];
    cats.forEach(function (c, i) {
      var yTop = padT + rowH * i + (rowH - barH) / 2;
      var col = typeof spec.color === 'function' ? spec.color(vals[i], i) : (spec.color || 'var(--vz-s1)');
      var d = barPath(yTop, barH, zero, x(vals[i]));
      g += '<text class="cat" x="' + (padL - 10) + '" y="' + (yTop + barH / 2 + 4)
        + '" text-anchor="end" font-size="10">' + esc(c) + '</text>';
      if (d) {
        g += '<path class="mark" d="' + d + '" fill="' + esc(col) + '" data-tip=\''
          + esc(JSON.stringify({ t: c, r: [{ color: col, name: spec.valueLabel || 'Valeur', value: fmt(vals[i], spec.dec, spec.unit) }] })) + '\'/>';
      }
      var end = x(vals[i]);
      g += '<text class="lbl" x="' + (vals[i] >= 0 ? end + 7 : end - 7) + '" y="' + (yTop + barH / 2 + 4)
        + '" text-anchor="' + (vals[i] >= 0 ? 'start' : 'end') + '">'
        + esc(fmt(vals[i], spec.dec, spec.unit)) + '</text>';
      rows.push([c, fmt(vals[i], spec.dec, spec.unit)]);
    });

    if (spec.rule) {
      g += '<g class="ref"><line x1="' + x(spec.rule.value) + '" y1="' + padT + '" x2="'
        + x(spec.rule.value) + '" y2="' + (H - padB) + '" vector-effect="non-scaling-stroke"/>'
        + '<text x="' + (x(spec.rule.value)) + '" y="' + (padT - 2) + '" text-anchor="middle" '
        + 'font-size="9.4">' + esc(spec.rule.label) + '</text></g>';
    }

    p.plot.innerHTML = g + '</svg>';
    if (spec.legendItems) legend(p.legend, spec.legendItems); else p.legend.innerHTML = '';
    table(p.data, [spec.catLabel || 'Catégorie', spec.valueLabel || 'Valeur'], rows);
    wire(node, p.plot);
    return p;
  }

  // ------------------------------------------------------------------ courbes
  // Courbes, avec bande d'incertitude et segment projeté en pointillé.

  function lines(node, spec) {
    var p = frame(node, spec), S = spec.series, xs = spec.x;
    var W = spec.width || W0;
    var padL = spec.padL || 54, padR = spec.padR || 58, padT = 16, padB = 34;
    var H = spec.height || 260, plotH = H - padT - padB, plotW = W - padL - padR;

    var vals = [];
    S.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) vals.push(v); }); });
    if (spec.band) spec.band.lo.concat(spec.band.hi).forEach(function (v) { if (v !== null) vals.push(v); });
    if (spec.limits) vals.push(spec.limits.lo, spec.limits.hi);
    if (spec.rule) vals.push(spec.rule.value);
    if (spec.zero) vals.push(0);
    var sc = scale(Math.min.apply(null, vals), Math.max.apply(null, vals), 5);
    var X = function (i) { return padL + (xs.length === 1 ? plotW / 2 : plotW * i / (xs.length - 1)); };
    var Y = function (v) { return padT + plotH - (v - sc.lo) / (sc.hi - sc.lo) * plotH; };

    var g = svgOpen(W, H) + '<g class="grid">';
    sc.ticks.forEach(function (t) {
      g += '<line x1="' + padL + '" y1="' + Y(t) + '" x2="' + (W - padR) + '" y2="' + Y(t)
        + '" vector-effect="non-scaling-stroke"/>';
    });
    g += '</g>';

    // Zone projetée, signalée par un fond et un libellé plutôt que par un axe.
    if (spec.futureFrom !== undefined) {
      g += '<rect x="' + X(spec.futureFrom) + '" y="' + padT + '" width="' + (W - padR - X(spec.futureFrom))
        + '" height="' + plotH + '" fill="#f4f7fa"/>'
        + '<text x="' + (X(spec.futureFrom) + 6) + '" y="' + (padT + 12) + '" font-size="9.4" class="lbl muted">'
        + esc(spec.futureLabel || 'projection') + '</text>';
    }
    // Bande d'incertitude, lavis de la teinte de la série.
    if (spec.band) {
      var up = [], dn = [];
      spec.band.lo.forEach(function (v, i) { if (v !== null) { up.push(X(i) + ' ' + Y(spec.band.hi[i])); dn.unshift(X(i) + ' ' + Y(v)); } });
      g += '<path d="M' + up.concat(dn).join('L') + 'Z" fill="' + esc(spec.band.color || S[0].color)
        + '" opacity="0.12"/>';
    }
    // Repère simple : un trait nommé sur la même échelle.
    if (spec.rule) {
      g += '<g class="ref"><line x1="' + padL + '" y1="' + Y(spec.rule.value) + '" x2="' + (W - padR)
        + '" y2="' + Y(spec.rule.value) + '" vector-effect="non-scaling-stroke"/><text x="' + (W - padR)
        + '" y="' + (Y(spec.rule.value) - 5) + '" text-anchor="end" font-size="9.4">'
        + esc(spec.rule.label) + '</text></g>';
    }
    // Limites de contrôle : deux traits nommés, pas une seconde échelle.
    if (spec.limits) {
      g += '<g class="ref">';
      [['lo', spec.limits.loLabel], ['hi', spec.limits.hiLabel]].forEach(function (pair) {
        var v = spec.limits[pair[0]];
        var dy = pair[0] === 'hi' ? -5 : 12;
        g += '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v)
          + '" vector-effect="non-scaling-stroke"/><text x="' + (W - padR) + '" y="' + (Y(v) + dy)
          + '" text-anchor="end" font-size="9.4">' + esc(pair[1]) + '</text>';
      });
      g += '</g>';
    }

    S.forEach(function (s) {
      var solid = [], dash = [], cut = s.dashFrom === undefined ? xs.length : s.dashFrom;
      s.values.forEach(function (v, i) {
        if (v === null) return;
        var pt = X(i) + ' ' + Y(v);
        if (i <= cut) solid.push(pt);
        if (i >= cut) dash.push(pt);
      });
      if (solid.length > 1) {
        g += '<path d="M' + solid.join('L') + '" fill="none" stroke="' + esc(s.color)
          + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
      }
      if (dash.length > 1) {
        g += '<path d="M' + dash.join('L') + '" fill="none" stroke="' + esc(s.color)
          + '" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
      }
    });

    // Points hors limites : marqués par une forme, pas seulement par la couleur.
    if (spec.limits && spec.flagSeries !== undefined) {
      var fs = S[spec.flagSeries];
      fs.values.forEach(function (v, i) {
        if (v === null || (v >= spec.limits.lo && v <= spec.limits.hi)) return;
        g += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="5" fill="var(--vz-critical)" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>'
          + '<text class="lbl" x="' + X(i) + '" y="' + (Y(v) - 11) + '" text-anchor="middle">hors limite</text>';
      });
    }

    // Marqueur et étiquette en bout de courbe seulement.
    S.forEach(function (s) {
      var last = -1;
      s.values.forEach(function (v, i) { if (v !== null) last = i; });
      if (last < 0) return;
      g += '<circle cx="' + X(last) + '" cy="' + Y(s.values[last]) + '" r="3.4" fill="' + esc(s.color)
        + '" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>';
      if (S.length <= 4 && spec.endLabels !== false) {
        g += '<text class="lbl" x="' + (X(last) + 7) + '" y="' + (Y(s.values[last]) + 4) + '">'
          + esc(fmt(s.values[last], spec.dec, spec.unit)) + '</text>';
      }
    });

    g += '<g class="axis">';
    sc.ticks.forEach(function (t) {
      g += '<text x="' + (padL - 8) + '" y="' + (Y(t) + 4) + '" text-anchor="end" font-size="9.6">'
        + esc(fmt(t, spec.dec, '')) + '</text>';
    });
    g += '<line class="base" x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="'
      + (padT + plotH) + '" vector-effect="non-scaling-stroke"/>';
    var every = spec.tickEvery || Math.ceil(xs.length / 10);
    xs.forEach(function (c, i) {
      if (i % every && i !== xs.length - 1) return;
      g += '<text x="' + X(i) + '" y="' + (H - padB + 16) + '" text-anchor="middle" font-size="9.6">'
        + esc(c) + '</text>';
    });
    g += '</g>';
    if (spec.yLabel) {
      g += '<text x="' + padL + '" y="' + (padT - 4) + '" font-size="9.4" class="lbl muted">'
        + esc(spec.yLabel) + '</text>';
    }

    // Couche de survol : une bande par abscisse, la lecture donne toutes les séries.
    g += '<g class="hits">';
    xs.forEach(function (c, i) {
      var w = plotW / Math.max(1, xs.length - 1), x0 = X(i) - w / 2;
      var rowsT = S.filter(function (s) { return s.values[i] !== null; }).map(function (s) {
        return { color: s.color, name: s.name, value: fmt(s.values[i], spec.dec, spec.unit) };
      });
      if (spec.band && spec.band.lo[i] !== null) {
        rowsT.push({ color: '', name: 'fourchette', value: fmt(spec.band.lo[i], spec.dec, '') + ' à ' + fmt(spec.band.hi[i], spec.dec, spec.unit) });
      }
      g += '<rect class="hit" x="' + Math.max(padL, x0) + '" y="' + padT + '" width="' + w + '" height="'
        + plotH + '" data-tip=\'' + esc(JSON.stringify({ t: c, r: rowsT })) + '\'/>';
    });
    g += '</g>';

    p.plot.innerHTML = g + '</svg>';
    legend(p.legend, S.map(function (s) { return { name: s.name, color: s.color, type: 'line' }; }));
    table(p.data, [spec.xLabel || 'Période'].concat(S.map(function (s) { return s.name; })),
      xs.map(function (c, i) {
        return [c].concat(S.map(function (s) { return s.values[i] === null ? '' : fmt(s.values[i], spec.dec, spec.unit); }));
      }));
    wire(node, p.plot);
    return p;
  }

  // ------------------------------------------------------------- carte de chaleur

  function heat(node, spec) {
    var p = frame(node, spec), rows = spec.rows, cols = spec.cols, V = spec.values;
    var W = spec.width || W0;
    var padL = spec.padL || 132, padR = 14, padT = 30, padB = 8;
    var cw = (W - padL - padR) / cols.length, ch = spec.cellH || 30;
    var H = padT + padB + ch * rows.length;
    var flat = [];
    V.forEach(function (r) { r.forEach(function (v) { if (v !== null) flat.push(v); }); });
    var mn = Math.min.apply(null, flat), mx = Math.max.apply(null, flat);
    var steps = ['--vz-seq-0', '--vz-seq-1', '--vz-seq-2', '--vz-seq-3', '--vz-seq-4', '--vz-seq-5', '--vz-seq-6'];
    var stepOf = function (v) {
      var k = Math.round((v - mn) / (mx - mn || 1) * (steps.length - 1));
      return steps[Math.max(0, Math.min(steps.length - 1, k))];
    };

    var g = svgOpen(W, H) + '<g class="axis">';
    cols.forEach(function (c, j) {
      g += '<text x="' + (padL + cw * j + cw / 2) + '" y="' + (padT - 10) + '" text-anchor="middle" font-size="9.6">'
        + esc(c) + '</text>';
    });
    g += '</g>';
    var tRows = [];
    rows.forEach(function (r, i) {
      g += '<text class="cat" x="' + (padL - 10) + '" y="' + (padT + ch * i + ch / 2 + 4)
        + '" text-anchor="end" font-size="10">' + esc(r) + '</text>';
      var line = [r];
      cols.forEach(function (c, j) {
        var v = V[i][j];
        line.push(v === null ? '' : fmt(v, spec.dec, spec.unit));
        if (v === null) return;
        var step = stepOf(v), dark = steps.indexOf(step) >= 4;
        g += '<rect class="mark" x="' + (padL + cw * j + GAP / 2) + '" y="' + (padT + ch * i + GAP / 2)
          + '" width="' + (cw - GAP) + '" height="' + (ch - GAP) + '" rx="4" fill="var(' + step + ')" data-tip=\''
          + esc(JSON.stringify({ t: r + ' · ' + c, r: [{ name: spec.valueLabel || 'Valeur', value: fmt(v, spec.dec, spec.unit) }] })) + '\'/>'
          + '<text x="' + (padL + cw * j + cw / 2) + '" y="' + (padT + ch * i + ch / 2 + 4)
          + '" text-anchor="middle" font-size="9.6" fill="' + (dark ? '#ffffff' : '#16212e')
          + '" pointer-events="none">' + esc(fmt(v, spec.dec, '')) + '</text>';
      });
      tRows.push(line);
    });

    p.plot.innerHTML = g + '</svg>';
    p.legend.innerHTML = '';
    table(p.data, [spec.rowLabel || ''].concat(cols), tRows);
    wire(node, p.plot);
    return p;
  }

  // ------------------------------------- barres empilées divergentes (échelle d'accord)

  function likert(node, spec) {
    var p = frame(node, spec), cats = spec.cats, S = spec.series, neg = spec.negCount;
    var W = spec.width || W0;
    var padL = spec.padL || 168, padR = 24, padT = 8, padB = 30;
    var rowH = spec.rowH || 34, H = padT + padB + rowH * cats.length, plotW = W - padL - padR;
    var barH = Math.min(MAXBAR, rowH - 12);

    var maxL = 0, maxR = 0;
    cats.forEach(function (c, i) {
      var l = 0, r = 0;
      S.forEach(function (s, k) { if (k < neg) l += s.values[i]; else r += s.values[i]; });
      maxL = Math.max(maxL, l); maxR = Math.max(maxR, r);
    });
    var span = Math.max(maxL, maxR), sc = scale(-span, span, 4);
    var X = function (v) { return padL + (v - sc.lo) / (sc.hi - sc.lo) * plotW; };

    var g = svgOpen(W, H) + '<g class="grid">';
    sc.ticks.forEach(function (t) {
      g += '<line x1="' + X(t) + '" y1="' + padT + '" x2="' + X(t) + '" y2="' + (H - padB)
        + '" vector-effect="non-scaling-stroke"/>';
    });
    g += '</g><g class="axis">';
    sc.ticks.forEach(function (t) {
      g += '<text x="' + X(t) + '" y="' + (H - padB + 15) + '" text-anchor="middle" font-size="9.6">'
        + esc(Math.abs(t)) + ' %</text>';
    });
    g += '<line class="base" x1="' + X(0) + '" y1="' + padT + '" x2="' + X(0) + '" y2="' + (H - padB)
      + '" vector-effect="non-scaling-stroke"/></g>';

    var tRows = [];
    cats.forEach(function (c, i) {
      var yTop = padT + rowH * i + (rowH - barH) / 2;
      var tipRows = S.map(function (s) { return { color: s.color, name: s.name, value: fmt(s.values[i], 0, '%') }; });
      var tip = esc(JSON.stringify({ t: c, r: tipRows }));
      g += '<text class="cat" x="' + (padL - 10) + '" y="' + (yTop + barH / 2 + 4)
        + '" text-anchor="end" font-size="10">' + esc(c) + '</text>';
      var acc = 0;
      for (var k = neg - 1; k >= 0; k--) { acc -= S[k].values[i]; }
      var cur = acc;
      S.forEach(function (s, k) {
        var v = s.values[i], x0 = X(cur), x1 = X(cur + v);
        cur += v;
        if (Math.abs(x1 - x0) < 0.5) return;
        var gap = k === 0 || k === S.length - 1 ? 0 : 0;
        g += '<rect class="mark" x="' + (x0 + GAP / 2) + '" y="' + yTop + '" width="' + Math.max(0, x1 - x0 - GAP)
          + '" height="' + barH + '" rx="' + (k === 0 || k === S.length - 1 ? 3 : 0) + '" fill="' + esc(s.color)
          + '" data-tip=\'' + tip + '\'/>';
      });
      // Étiquette directe : le total favorable, en encre, à droite de la barre.
      var fav = 0; S.forEach(function (s, k) { if (k >= neg) fav += s.values[i]; });
      g += '<text class="lbl" x="' + (X(fav) + 8) + '" y="' + (yTop + barH / 2 + 4) + '">' + fav + ' %</text>';
      tRows.push([c].concat(S.map(function (s) { return fmt(s.values[i], 0, '%'); })));
    });

    p.plot.innerHTML = g + '</svg>';
    legend(p.legend, S.map(function (s) { return { name: s.name, color: s.color }; }));
    table(p.data, [spec.catLabel || 'Direction'].concat(S.map(function (s) { return s.name; })), tRows);
    wire(node, p.plot);
    return p;
  }

  // ------------------------------------------------------------------- tuiles

  function kpis(host, list) {
    host.innerHTML = '<div class="vz-kpis">' + list.map(function (k) {
      var d = k.delta ? '<div class="d ' + (k.dir || '') + '">' + esc(k.delta) + '</div>' : '';
      return '<div class="vz-kpi"><div class="l">' + esc(k.label) + '</div><div class="v">' + esc(k.value)
        + '</div>' + d + '</div>';
    }).join('') + '</div>';
  }

  window.VZ = {
    rng: rng, fmt: fmt, esc: esc, scale: scale,
    columns: columns, bars: bars, lines: lines, heat: heat, likert: likert, kpis: kpis,
    table: table
  };
})();
