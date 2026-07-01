/* Rotating outline globe of the Americas for the hero — vanilla JS canvas, no deps.
   Country outlines from assets/geo/world.geojson, wrapped onto an orthographic globe,
   right-justified. Brazil is highlighted; "data arrows" fan out of Brazil to US cities.
   Globe slowly auto-spins and reacts to hover. Tunable constants up top. */
(function () {
  const canvas = document.querySelector(".hero-map");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ---- Tunables ---- */
  const BRAND      = "#F2B705";
  const GEO_URL    = "assets/geo/world.geojson";
  const DOT_LAT    = 2.2;      // deg between dot rows (smaller = denser sphere)
  const DOT_R      = 0.8;      // tiny dot radius
  const DOT_A      = 0.20;     // tiny dot base opacity
  const RIM_A      = 0.85;     // glowing globe rim opacity
  const RIM_GLOW   = 18;       // rim glow blur radius (px)
  const LINE_A     = 0.45;     // country outline opacity
  const LINE_W     = 1;        // country outline width
  const BR_A       = 0.95;     // Brazil outline opacity
  const BR_W       = 1.8;      // Brazil outline width
  const SPIN_DPS   = 7;        // auto-spin speed, degrees / second
  const HOVER_SPIN = 0.12;     // spin slowdown factor while hovering (1 = no change)
  const HOVER_LON  = 32;       // max extra longitude the cursor can swing (deg)
  const HOVER_LAT  = 24;       // max latitude tilt the cursor can apply (deg)
  const PULSE_S    = 0.11;     // arrow travel speed (fraction of route / second)
  const ROUTE_A    = 0.20;
  const MAX_PXR    = 2;

  /* ---- View / globe centering on the Americas ---- */
  const VIEW_LON = -75, VIEW_LAT = -8;
  const LON_MIN = -128, LON_MAX = -33, LAT_MIN = -56, LAT_MAX = 54;
  const RAD = Math.PI / 180;

  /* ---- Cities (lat, lon) ---- */
  const CITIES = {
    sf:  { lat: 37.77, lon: -122.42, us: true,  r: 3.0 },
    chi: { lat: 41.88, lon: -87.63,  us: true,  r: 3.0 },
    ny:  { lat: 40.71, lon: -74.00,  us: true,  r: 3.6 },
    aus: { lat: 30.27, lon: -97.74,  us: true,  r: 3.2 },
    mia: { lat: 25.76, lon: -80.19,  us: true,  r: 3.2 },
    sao: { lat: -12.5, lon: -53.0,   us: false, r: 4.2 } // Brazil hub (central Brazil)
  };
  // Arrows originate ONLY from Brazil (São Paulo) -> US cities.
  const ROUTES = [
    ["sao", "ny"], ["sao", "aus"], ["sao", "mia"], ["sao", "chi"], ["sao", "sf"]
  ];

  // Mirror the whole Americas setup onto the opposite side of the globe (+180°
  // longitude) so the same cities/arrows reappear as it spins.
  Object.keys(CITIES).forEach(function (k) {
    const c = CITIES[k];
    CITIES[k + "_m"] = { lat: c.lat, lon: c.lon + 180, us: c.us, r: c.r };
  });
  ROUTES.slice().forEach(function (r) {
    ROUTES.push([r[0] + "_m", r[1] + "_m"]);
  });

  let w = 0, h = 0, pxr = 1, t0 = 0, last = 0, raf = null;
  let cx = 0, cy = 0, R = 0;
  let polys = null;                            // [{name, rings}]
  let lon0 = VIEW_LON, lat0 = VIEW_LAT;
  let spin = 0;                                // accumulated auto-spin (deg)
  let dragLat = 0;                             // vertical tilt from dragging (deg)
  let dragging = false, grabX = 0, grabY = 0, spinAtGrab = 0, latAtGrab = 0;
  const DRAG_LON = 0.35;                        // deg of spin per px dragged (x)
  const DRAG_LAT = 0.25;                        // deg of tilt per px dragged (y)
  const MAX_LAT  = 38;                          // clamp vertical tilt
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // Orthographic projection.
  function ortho(lat, lon) {
    const la = lat * RAD, lo = (lon - lon0) * RAD, la0 = lat0 * RAD;
    const cosc = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo);
    const x = Math.cos(la) * Math.sin(lo);
    const y = Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo);
    return { x: cx + R * x, y: cy - R * y, cosc: cosc, vis: cosc >= 0 };
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    pxr = Math.min(window.devicePixelRatio || 1, MAX_PXR);
    canvas.width = Math.round(w * pxr);
    canvas.height = Math.round(h * pxr);
    ctx.setTransform(pxr, 0, 0, pxr, 0, 0);
    R = Math.min(h * 0.45, w * 0.45); // fit the globe within its own column
    // Globe is centered inside its dedicated container on every breakpoint.
    cx = w / 2;
    cy = h * 0.5;
  }

  /* ---- drawing ---- */
  function drawRim() {
    // glowing outline of the globe
    ctx.save();
    ctx.shadowColor = hexA(BRAND, 0.9);
    ctx.shadowBlur = RIM_GLOW;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = hexA(BRAND, RIM_A);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.stroke(); // second pass intensifies the glow
    ctx.restore();
  }

  function drawDots() {
    // hexagonal dot field forming the sphere; alternate rows offset by half a step,
    // lon density scaled by cos(lat) for even spread
    let row = 0;
    for (let lat = -88; lat <= 88; lat += DOT_LAT) {
      const circ = Math.cos(lat * RAD);
      const lonStep = DOT_LAT / Math.max(0.18, circ);
      const offset = (row & 1) * (lonStep / 2); // half-step shift => hexagonal packing
      for (let lon = -180 + offset; lon < 180; lon += lonStep) {
        const p = ortho(lat, lon);
        if (!p.vis) continue;
        ctx.fillStyle = hexA(BRAND, DOT_A * (0.3 + 0.7 * p.cosc));
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }
      row++;
    }
  }

  function strokeRings(rings) {
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      let started = false; ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const p = ortho(ring[i][1], ring[i][0]);
        if (!p.vis) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }
  function drawOutlines() {
    ctx.lineJoin = "round";
    // other countries first
    ctx.lineWidth = LINE_W;
    ctx.strokeStyle = hexA(BRAND, LINE_A);
    for (let i = 0; i < polys.length; i++) {
      if (polys[i].name === "Brazil") continue;
      strokeRings(polys[i].rings);
    }
    // Brazil on top, brighter + thicker
    ctx.lineWidth = BR_W;
    ctx.strokeStyle = hexA(BRAND, BR_A);
    for (let i = 0; i < polys.length; i++) {
      if (polys[i].name === "Brazil") strokeRings(polys[i].rings);
    }
  }

  function drawRoutes() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexA(BRAND, ROUTE_A);
    for (const [from, to] of ROUTES) {
      const A = CITIES[from], B = CITIES[to];
      let started = false; ctx.beginPath();
      for (let s = 0; s <= 1.0001; s += 0.04) {
        const p = ortho(A.lat + (B.lat - A.lat) * s, A.lon + (B.lon - A.lon) * s);
        if (!p.vis) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }
  function drawPulses(time) {
    // arrows travel FROM Brazil (s=0) toward the US city (s=1)
    for (let i = 0; i < ROUTES.length; i++) {
      const A = CITIES[ROUTES[i][0]], B = CITIES[ROUTES[i][1]];
      const phase = (time * PULSE_S + i * 0.37) % 1;
      const tail = 0.14;
      for (let s = 0; s <= 1; s += 0.25) {
        const p = phase - s * tail;
        if (p < 0 || p > 1) continue;
        const pt = ortho(A.lat + (B.lat - A.lat) * p, A.lon + (B.lon - A.lon) * p);
        if (!pt.vis) continue;
        const fade = (1 - s) * (1 - Math.abs(p - 0.5) * 0.4);
        ctx.fillStyle = hexA(BRAND, Math.max(0, fade));
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.6 - s * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function drawNodes(time) {
    for (const k in CITIES) {
      const c = CITIES[k], p = ortho(c.lat, c.lon);
      if (!p.vis) continue;
      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(time * 1.6 + c.lon * 0.05);
      ctx.fillStyle = hexA(BRAND, 0.14 + 0.12 * pulse);
      ctx.beginPath();
      ctx.arc(p.x, p.y, c.r + 5 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(BRAND, c.us ? 0.95 : 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(time) {
    ctx.clearRect(0, 0, w, h);
    drawRim();
    if (polys) drawOutlines();
    drawRoutes();
    drawPulses(time);
    drawNodes(time);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    if (!dragging) spin += SPIN_DPS * dt;   // auto-spin pauses while dragging
    lon0 = VIEW_LON + spin;
    lat0 = VIEW_LAT + dragLat;
    render(time);
    raf = requestAnimationFrame(frame);
  }

  /* ---- drag to spin (listen on window; canvas stays pointer-events:none) ---- */
  function overGlobe(e) {
    const rect = canvas.getBoundingClientRect();
    return Math.hypot((e.clientX - rect.left) - cx, (e.clientY - rect.top) - cy) <= R;
  }
  function onDown(e) {
    if (!overGlobe(e)) return;
    dragging = true;
    grabX = e.clientX; grabY = e.clientY;
    spinAtGrab = spin; latAtGrab = dragLat;
    document.body.classList.add("globe-grabbing");
    e.preventDefault();
  }
  function onMove(e) {
    if (dragging) {
      spin = spinAtGrab + (e.clientX - grabX) * DRAG_LON;
      dragLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, latAtGrab - (e.clientY - grabY) * DRAG_LAT));
      e.preventDefault();
      return;
    }
    // cursor affordance when hovering over the globe
    document.body.classList.toggle("globe-grab", overGlobe(e));
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("globe-grabbing");
  }

  function start() {
    if (reduce) { lon0 = VIEW_LON; lat0 = VIEW_LAT; render(0); return; }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    t0 = performance.now(); last = t0;
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
  }

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { layout(); if (reduce) render(0); }, 120);
  });

  // Keep the canvas bitmap in sync with its actual displayed size. Without this,
  // a container resize that doesn't fire window.resize leaves a stale bitmap that
  // the browser stretches — squashing the globe into an oval in some browsers.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(function () { layout(); if (reduce) render(0); });
    ro.observe(canvas);
  }

  layout();
  fetch(GEO_URL)
    .then(function (r) { return r.json(); })
    .then(function (geo) {
      polys = [];
      geo.features.forEach(function (f) {
        const g = f.geometry; if (!g) return;
        const name = f.properties && f.properties.name;
        const groups = g.type === "Polygon" ? [g.coordinates]
                     : g.type === "MultiPolygon" ? g.coordinates : [];
        groups.forEach(function (rings) {
          let mnLon = 999, mxLon = -999, mnLat = 999, mxLat = -999;
          rings[0].forEach(function (pt) {
            if (pt[0] < mnLon) mnLon = pt[0]; if (pt[0] > mxLon) mxLon = pt[0];
            if (pt[1] < mnLat) mnLat = pt[1]; if (pt[1] > mxLat) mxLat = pt[1];
          });
          if (mxLon < LON_MIN || mnLon > LON_MAX || mxLat < LAT_MIN || mnLat > LAT_MAX) return;
          polys.push({ name: name, rings: rings });
        });
      });
      // Mirror every Americas outline (incl. Brazil) onto the opposite side
      const mirrored = polys.map(function (p) {
        return {
          name: p.name,
          rings: p.rings.map(function (ring) {
            return ring.map(function (pt) { return [pt[0] + 180, pt[1]]; });
          })
        };
      });
      polys = polys.concat(mirrored);
      start();
    })
    .catch(function () { start(); });
})();
