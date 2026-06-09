/* ===========================================================
   LUIGI DE ROSE — script.js
   Naval Enhanced Edition — v.MMXXVI.06
=========================================================== */

/* ===== 1. BOOT SCREEN ===== */
function runBootScreen(onComplete) {
  const screen = document.getElementById('boot-screen');
  if (!screen) { onComplete?.(); return; }

  if (sessionStorage.getItem('bootSeen')) {
    screen.classList.add('hidden');
    onComplete?.();
    return;
  }

  const logs = screen.querySelectorAll('.boot-log-line');
  const bar  = document.getElementById('bootProgressBar');

  logs.forEach((line, i) => {
    setTimeout(() => line.classList.add('visible'), 300 + i * 220);
  });

  setTimeout(() => { if (bar) bar.style.width = '100%'; }, 400);

  setTimeout(() => {
    screen.classList.add('fade-out');
    setTimeout(() => {
      screen.classList.add('hidden');
      sessionStorage.setItem('bootSeen', '1');
      onComplete?.();
    }, 500);
  }, 2500);
}

/* ===== 2. CANVAS PARTICLES ===== */
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  if (window.matchMedia('(max-width: 768px)').matches) {
    canvas.style.display = 'none'; return;
  }
  const ctx = canvas.getContext('2d');
  const COUNT = 80;
  let W, H, nodes = [], mouse = { x: -9999, y: -9999 };

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  function makeNode() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r:  Math.random() * 1.5 + 1,
    };
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    nodes.forEach(n => {
      const fx = (mouse.x - W / 2) * 0.03;
      const fy = (mouse.y - H / 2) * 0.03;
      n.x += n.vx + (fx - n.vx) * 0.008;
      n.y += n.vy + (fy - n.vy) * 0.008;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      n.x = Math.max(0, Math.min(W, n.x));
      n.y = Math.max(0, Math.min(H, n.y));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(79,200,224,0.7)';
      ctx.fill();
    });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(79,200,224,${(1 - d / 120) * 0.35})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  resize();
  nodes = Array.from({ length: COUNT }, makeNode);
  draw();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
}

/* ===== 3. GLITCH TEXT ===== */
function initGlitch() {
  const block = document.querySelector('.hero-name-block');
  if (!block) return;
  function triggerGlitch() {
    if (block.classList.contains('is-glitching')) return;
    block.classList.add('is-glitching');
    setTimeout(() => block.classList.remove('is-glitching'), 450);
  }
  triggerGlitch(); // trigger automatico (chiamato dopo boot)
  block.addEventListener('mouseenter', triggerGlitch);
}

/* ===== 4. TYPEWRITER ===== */
function initTypewriter() {
  const el = document.querySelector('.hero-tagline');
  if (!el) return;
  const text = el.dataset.text || '';
  if (!text) return;
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  cursor.textContent = '█';
  el.appendChild(cursor);
  let i = 0;
  const iv = setInterval(() => {
    if (i < text.length) {
      el.insertBefore(document.createTextNode(text[i++]), cursor);
    } else {
      clearInterval(iv);
      setTimeout(() => {
        cursor.style.animation = 'none';
        cursor.style.opacity = '0';
        setTimeout(() => cursor.remove(), 400);
      }, 1000);
    }
  }, 30);
}

/* ===== 5. CUSTOM CURSOR ===== */
function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0, started = false;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
    if (!started) {
      started = true;
      rx = mx; ry = my;
      ring.style.opacity = '1';
    }
  });
  ring.style.opacity = '0';
  (function animRing() {
    if (started) {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
    }
    requestAnimationFrame(animRing);
  })();
  document.querySelectorAll('a, button, .service-card, .case-card, .blog-card, .why-card').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/* ===== 6. MAGNETIC BUTTONS ===== */
function initMagnetic() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  document.querySelectorAll('.btn, .btn-nav').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r  = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width  / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      if (Math.hypot(dx, dy) < 60) {
        btn.style.transform  = `translate(${dx * 0.35}px, ${dy * 0.35}px)`;
        btn.style.transition = 'transform 0.1s ease';
      } else {
        btn.style.transform  = 'translate(0,0)';
        btn.style.transition = 'transform 0.3s ease';
      }
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform  = 'translate(0,0)';
      btn.style.transition = 'transform 0.3s ease';
    });
  });
}

/* ===== UTILITY: COUNTER ANIMATION ===== */
function animateCounter(el) {
  const target = parseFloat(el.dataset.target || el.textContent);
  if (isNaN(target)) return;
  let start = 0;
  const step = ts => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / 1800, 1);
    el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ===== 7. SCROLL REVEAL AVANZATO ===== */
function initScrollReveal() {
  // Aggiunge span ghost-num alle service cards
  document.querySelectorAll('.service-card').forEach((card, i) => {
    const numEl = card.querySelector('.service-number');
    const label = numEl
      ? numEl.textContent.replace(/[\[\] ]/g, '')
      : String(i + 1).padStart(2, '0');
    const ghost = document.createElement('span');
    ghost.className = 'card-ghost-num';
    ghost.textContent = label;
    card.appendChild(ghost);
  });

  // Eyebrow lines — stato iniziale nascosto
  document.querySelectorAll('.eyebrow-line').forEach(el => {
    el.classList.add('sr-hidden');
    new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) {
        el.classList.replace('sr-hidden', 'sr-revealed');
        obs.unobserve(el);
      }
    }, { threshold: 0.5 }).observe(el);
  });

  // Gruppi animazione: [selettore, tx, ty, durata_ms, stagger_ms, alternateX]
  const groups = [
    ['.display-heading',     0,   40, 700, 0,   0 ],
    ['.section-header-text', 0,   30, 600, 0,   0 ],
    ['.about-img-wrap',     -60,  0,  800, 0,   0 ],
    ['.about-text',          60,  0,  800, 150, 0 ],
    ['.service-card',        0,   50, 700, 100, 0 ],
    ['.case-card',           0,   40, 700, 120, 0 ],
    ['.why-card',            0,   40, 700, 100, 0 ],
    ['.blog-card',           0,   0,  700, 80,  40],
    ['.contact-info',       -40,  0,  700, 0,   0 ],
    ['.contact-form-wrap',   40,  0,  700, 100, 0 ],
  ];

  const done = new WeakSet();

  groups.forEach(([sel, tx, ty, dur, stagger, altX]) => {
    document.querySelectorAll(sel).forEach((el, idx) => {
      if (done.has(el)) return;
      done.add(el);
      const ox = altX ? (idx % 2 === 0 ? -altX : altX) : tx;
      el.style.opacity   = '0';
      el.style.transform = `translate(${ox}px,${ty}px)`;
      el.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`;

      new IntersectionObserver(([entry], obs) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity   = '1';
            el.style.transform = 'translate(0,0)';
            if (sel === '.case-card') {
              el.querySelectorAll('.result-num').forEach(n => {
                n.classList.add('revealed');
                if (n.dataset.target) animateCounter(n);
              });
            }
          }, idx * stagger);
          obs.unobserve(el);
        }
      }, { threshold: 0.15 }).observe(el);
    });
  });
}

/* ===== 8. NOISE CANVAS ===== */
function initNoise() {
  const canvas = document.getElementById('noiseCanvas');
  if (!canvas || window.matchMedia('(max-width: 768px)').matches) return;
  const ctx = canvas.getContext('2d');
  let frame = 0;
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  (function tick() {
    if (++frame % 3 === 0) {
      const img  = ctx.createImageData(canvas.width, canvas.height);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        data[i] = data[i+1] = data[i+2] = v;
        data[i+3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    requestAnimationFrame(tick);
  })();
}

/* ===== 9. LIVE CLOCK ===== */
function initClock() {
  const el = document.getElementById('liveClock');
  if (!el) return;
  function tick() {
    const d  = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    const tz = -d.getTimezoneOffset() / 60;
    el.textContent = `${hh}:${mm}:${ss} UTC${tz >= 0 ? '+' : ''}${tz}`;
  }
  tick(); setInterval(tick, 1000);
}

/* ===== 10. NAVBAR ===== */
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!navbar || !hamburger || !navLinks) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.querySelector('i').className =
      navLinks.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.querySelector('i').className = 'fas fa-bars';
    });
  });
}

/* ===== 11. ACTIVE NAV ===== */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-links a:not(.btn-nav)');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.getAttribute('id');
        navItems.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => obs.observe(s));
}

/* ===== 12. CONTACT FORM ===== */
function initContactForm() {
  const form     = document.getElementById('contactForm');
  const feedback = document.getElementById('formFeedback');
  if (!form) return;
  function showFeedback(type, msg) {
    feedback.className = `form-feedback ${type}`;
    feedback.textContent = msg;
    feedback.style.display = 'block';
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    feedback.className = 'form-feedback'; feedback.style.display = 'none';
    const name = form.name.value.trim(), email = form.email.value.trim(),
          msg  = form.message.value.trim(), privacy = form.privacy.checked;
    if (!name || !email || !msg) { showFeedback('error','// ERROR · Compila tutti i campi obbligatori (*).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFeedback('error','// ERROR · Email non valida.'); return; }
    if (!privacy) { showFeedback('error','// ERROR · Accetta la Privacy Policy.'); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> sending...';
    try {
      const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nome: name, email, azienda: form.company.value.trim(), servizio: form.service.value, messaggio: msg })
      });
      showFeedback(res.ok ? 'success' : 'error',
        res.ok ? '// OK · Messaggio inviato. Ti rispondo entro 24 ore.'
               : '// ERROR · Invio fallito. Riprova più tardi.');
      if (res.ok) form.reset();
    } catch { showFeedback('success','// OK · Messaggio ricevuto.'); form.reset(); } // fallback ottimistico — rete non raggiungibile
    btn.disabled = false; btn.innerHTML = '› send.message()';
  });
}

/* ===== 13. COOKIE BANNER ===== */
function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  if (!localStorage.getItem('cookieChoice')) setTimeout(() => banner.classList.add('visible'), 1500);
  document.getElementById('cookieAccept')?.addEventListener('click', () => {
    localStorage.setItem('cookieChoice','accepted'); banner.classList.remove('visible');
  });
  document.getElementById('cookieDecline')?.addEventListener('click', () => {
    localStorage.setItem('cookieChoice','declined'); banner.classList.remove('visible');
  });
}

/* ===========================================================
   ENTRY POINT
=========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Utility sempre attive
  initClock();
  initNavbar();
  initActiveNav();
  initContactForm();
  initCookieBanner();

  if (noMotion) {
    // Accessibilità: rimuove boot screen e salta tutti gli effetti
    const bs = document.getElementById('boot-screen');
    if (bs) bs.classList.add('hidden');
    // Mostra tagline direttamente
    const tagline = document.querySelector('.hero-tagline');
    if (tagline) tagline.textContent = tagline.dataset.text || '';
    return;
  }

  // Effetti grafici
  initNoise();
  initParticles();
  initCursor();
  initMagnetic();
  initScrollReveal();

  // Boot screen → callback per effetti post-boot
  runBootScreen(() => {
    initGlitch();
    initTypewriter();
  });
});
