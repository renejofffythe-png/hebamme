/**
 * animations.js
 * Kristina Schuldeis – Hebamme & EEH-Fachberaterin
 *
 * Minimale JS-Logik für Animations-Interaktionen.
 * Kein Framework, keine externen Abhängigkeiten — Vanilla JS.
 *
 * Inhaltsverzeichnis:
 *   A.  FAQ Accordion
 *   B.  Scroll-Reveal — IntersectionObserver (reveal-element + botanical-deco)
 *   C.  Trust-Bar — Zahlen Fade-in via IntersectionObserver
 *   D.  Mobile Overlay Nav
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   A. FAQ ACCORDION
   ══════════════════════════════════════════════════════════════
   Toggled die Klasse .faq-item--open auf dem übergeordneten
   .faq-item beim Click auf .faq-question.
   Accessibility: aria-expanded wird synchron gesetzt.
   ══════════════════════════════════════════════════════════════ */

(function initFaqAccordion() {
  const questions = document.querySelectorAll('.faq-question');

  if (!questions.length) return;

  questions.forEach(function (btn) {
    // Initialen aria-Zustand setzen
    btn.setAttribute('aria-expanded', 'false');

    const answer = btn.nextElementSibling;
    if (answer && answer.classList.contains('faq-answer')) {
      answer.setAttribute('role', 'region');
    }

    btn.addEventListener('click', function () {
      const item        = btn.closest('.faq-item');
      const isOpen      = item.classList.contains('faq-item--open');
      const allItems    = document.querySelectorAll('.faq-item');

      /*
       * Option A — Nur ein FAQ gleichzeitig offen (Accordion-Verhalten):
       * Auskommentieren wenn mehrere gleichzeitig erlaubt sein sollen.
       */
      allItems.forEach(function (otherItem) {
        if (otherItem !== item) {
          otherItem.classList.remove('faq-item--open');
          const otherBtn = otherItem.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Ziel-Item toggeln
      item.classList.toggle('faq-item--open', !isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
  });
})();


/* ══════════════════════════════════════════════════════════════
   B. SCROLL-REVEAL — IntersectionObserver
   ══════════════════════════════════════════════════════════════
   Beobachtet .reveal-element und .botanical-deco.
   Setzt .visible-Klasse beim Einrollen in den Viewport.
   prefers-reduced-motion wird geprüft — Observer bei Reduzierung
   direkt alle Elemente als sichtbar markieren.
   ══════════════════════════════════════════════════════════════ */

(function initScrollReveal() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Alle zu beobachtenden Selektoren */
  const revealSelectors = '.reveal-element, .botanical-deco, .testimonial--left, .testimonial--right, .trust-value';
  const elements        = document.querySelectorAll(revealSelectors);

  if (!elements.length) return;

  /* Bei reduzierter Bewegung: sofort alle sichtbar machen, Observer nicht starten */
  if (reducedMotion) {
    elements.forEach(function (el) {
      el.classList.add('visible');
    });
    return;
  }

  /*
   * IntersectionObserver-Konfiguration:
   * threshold: 0.12 — Element ist sichtbar sobald 12% im Viewport sind.
   * rootMargin: leicht nach oben versetzt, damit Elemente
   *             kurz vor dem sichtbaren Bereich schon "ready" sind.
   */
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          /*
           * Nach dem ersten Einblenden nicht weiter beobachten —
           * verhindert rückwärtige Ausblend-Effekte beim Hoch-Scrollen.
           */
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold:  0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach(function (el) {
    observer.observe(el);
  });
})();


/* ══════════════════════════════════════════════════════════════
   C. TRUST-BAR — Zahlen Fade-in
   ══════════════════════════════════════════════════════════════
   Verwendet denselben Observer-Mechanismus wie Scroll-Reveal.
   .trust-value-Elemente werden bereits in initScrollReveal
   erfasst (falls Selector dort ergänzt). Dieser Block stellt
   sicher, dass sie auch standalone funktionieren.
   ══════════════════════════════════════════════════════════════ */

/*
 * Hinweis: .trust-value ist bereits im revealSelectors-String
 * in initScrollReveal() enthalten. Kein separater Observer nötig.
 * Sicherheitsnetz falls animations.js ohne Scroll-Reveal genutzt wird:
 */
(function initTrustBar() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const values        = document.querySelectorAll('.trust-value');

  if (!values.length) return;
  if (reducedMotion) {
    values.forEach(function (el) { el.classList.add('visible'); });
    return;
  }

  /* Standalone-Observer als Fallback */
  const obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  values.forEach(function (el) {
    /* Nur beobachten wenn nicht bereits durch initScrollReveal gesetzt */
    if (!el.classList.contains('visible')) {
      obs.observe(el);
    }
  });
})();


/* ══════════════════════════════════════════════════════════════
   D. MOBILE OVERLAY NAV
   ══════════════════════════════════════════════════════════════
   Öffnet/schließt .nav-overlay via .nav-overlay--open.
   Body erhält overflow: hidden wenn Overlay offen ist.
   Escape-Taste schließt das Overlay.
   Focus-Trap für Accessibility.
   ══════════════════════════════════════════════════════════════ */

(function initMobileNav() {
  const overlay   = document.querySelector('.nav-overlay');
  const hamburger = document.querySelector('.nav-hamburger');
  const closeBtn  = document.querySelector('.nav-overlay-close');

  if (!overlay || !hamburger) return;

  function openOverlay() {
    overlay.classList.add('nav-overlay--open');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');

    /* Focus in das Overlay setzen — auf Close-Button oder ersten Link */
    const firstFocusable = overlay.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      /* Kurzer Delay damit visibility-Transition abgeschlossen ist */
      setTimeout(function () { firstFocusable.focus(); }, 50);
    }
  }

  function closeOverlay() {
    overlay.classList.remove('nav-overlay--open');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('aria-hidden', 'true');

    /* Focus zurück zum Hamburger */
    hamburger.focus();
  }

  /* Hamburger öffnet */
  hamburger.addEventListener('click', openOverlay);

  /* Close-Button schließt */
  if (closeBtn) {
    closeBtn.addEventListener('click', closeOverlay);
  }

  /* Klick auf Overlay-Hintergrund schließt (nicht auf den Inhalt) */
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeOverlay();
  });

  /* Escape schließt */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('nav-overlay--open')) {
      closeOverlay();
    }
  });

  /* Overlay-Links schließen das Menü beim Click */
  const overlayLinks = overlay.querySelectorAll('.nav-overlay-link');
  overlayLinks.forEach(function (link) {
    link.addEventListener('click', closeOverlay);
  });

  /* Initialer aria-Zustand */
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-controls', overlay.id || 'nav-overlay');
  overlay.setAttribute('aria-hidden', 'true');
})();
