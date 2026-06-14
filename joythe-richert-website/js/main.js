/* ============================================================
   Joythe & Richert — main.js
   Header behaviour, mobile nav, scroll reveal, forms.
   ============================================================ */
(function () {
  'use strict';

  /* --- Sticky header shadow on scroll --- */
  var header = document.querySelector('.site-header');
  function onScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* --- Mobile nav toggle --- */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
      var open = document.body.classList.contains('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.querySelectorAll('.mobile-drawer a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
        document.body.style.overflow = '';
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --- Scroll reveal --- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* --- Mark active nav link by pathname --- */
  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[href], .mobile-drawer a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });

  /* --- Form handling --- */
  function showSuccess(form) {
    var ok = form.querySelector('.form-success');
    var fields = form.querySelector('.form-fields');
    if (ok) {
      if (fields) fields.style.display = 'none';
      ok.classList.add('show');
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Netlify forms are identified by their hidden "form-name" input — this
  // survives Netlify's deploy-time HTML processing (which strips the
  // data-netlify attribute, so we must NOT rely on that as a selector).
  var handled = [];
  document.querySelectorAll('input[name="form-name"]').forEach(function (inp) {
    var form = inp.form;
    if (!form || handled.indexOf(form) !== -1) return;
    handled.push(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      // POST to "/" — the path Netlify reliably processes for form
      // submissions — so the inline success message can stay (no reload).
      var data = new URLSearchParams(new FormData(form)).toString();
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      }).then(function () { showSuccess(form); })
        .catch(function () { showSuccess(form); });
    });
  });

  // Pure demo forms with no Netlify backend (none currently) — just show success.
  document.querySelectorAll('form[data-demo]').forEach(function (form) {
    if (handled.indexOf(form) !== -1) return;
    form.addEventListener('submit', function (e) { e.preventDefault(); showSuccess(form); });
  });

  /* --- Animated counters --- */
  var nums = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && nums.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = 1400, start = performance.now();
        function tick(now) {
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { cio.observe(n); });
  }

  /* --- Footer year --- */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
