'use strict';
/* ==========================================================================
   PAGE-SPECIFIC JS — ByteNana homepage
   Only the bits the design-kit's animations.js doesn't already cover:
     - Section 04 chooser cards act as tabs that switch the engagement panels
       (Staff Augmentation / Product Teams)
   ========================================================================== */
(function () {
  const tabs   = Array.prototype.slice.call(document.querySelectorAll('.chooser-card[role="tab"]'));
  const panels = Array.prototype.slice.call(document.querySelectorAll('.engage-panel'));
  if (!tabs.length || !panels.length) return;

  function selectTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');   // roving tabindex
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(t.dataset.tab); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const n = tabs[(i + 1) % tabs.length]; selectTab(n.dataset.tab); n.focus(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const p = tabs[(i - 1 + tabs.length) % tabs.length]; selectTab(p.dataset.tab); p.focus(); }
    });
  });

  // Deep link support: #how-we-engage?tab=product
  const params = new URLSearchParams((location.hash.split('?')[1]) || '');
  if (params.get('tab')) selectTab(params.get('tab'));
})();
