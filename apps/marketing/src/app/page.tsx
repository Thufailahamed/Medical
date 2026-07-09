// @ts-nocheck
"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function HomePage() {
  useEffect(() => {
    // Original static site interactions script (scripts/main.js)
    // ============================================================
// MedLocker marketing site — interactions
// ============================================================

(() => {
  'use strict';

  // ---------- 1. Nav: scrolled state -------------------------
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (!nav) return;
    if (window.scrollY > 8) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');

    // scroll progress
    const fill = document.querySelector('.scroll-progress__fill');
    const pct = document.querySelector('.scroll-progress__pct');
    if (fill) {
      const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      fill.style.height = Math.min(100, (window.scrollY / max) * 100) + '%';
    }
    if (pct) {
      const max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      pct.textContent = Math.round((window.scrollY / max) * 100) + '%';
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- 2. Reveal on scroll -----------------------------
  const reveals = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const siblings = entry.target.parentElement?.querySelectorAll('[data-reveal]');
          let delay = 0;
          if (siblings) {
            siblings.forEach((s, idx) => {
              if (s === entry.target) delay = idx * 60;
            });
          }
          setTimeout(() => {
            entry.target.classList.add('is-in');
            // trigger count-up if present
            const count = entry.target.querySelector('[data-count]');
            if (count) animateCount(count);
          }, Math.min(delay, 300));
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  // ---------- 3. Highlight stroke on text ---------------------
  const hls = document.querySelectorAll('.hl');
  if (hls.length && 'IntersectionObserver' in window) {
    const hlIo = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); hlIo.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    hls.forEach(h => hlIo.observe(h));
  } else {
    hls.forEach(h => h.classList.add('is-in'));
  }

  // ---------- 4. Number count-up ------------------------------
  function animateCount(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = '1';
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const dur = parseInt(el.dataset.dur || '1400', 10);
    const start = performance.now();
    const startVal = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = startVal + (target - startVal) * ease(t);
      el.textContent = decimals
        ? v.toFixed(decimals)
        : Math.round(v).toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- 5. Custom cursor (desktop only) ----------------
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    const ring = document.createElement('div');
    ring.className = 'cursor__ring';
    document.body.appendChild(cursor);
    document.body.appendChild(ring);

    let cx = -100, cy = -100, rx = -100, ry = -100, mouseX = -100, mouseY = -100;
    let raf = null;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX; mouseY = e.clientY;
    }, { passive: true });

    function loop() {
      // cursor follows tightly
      cx += (mouseX - cx) * 0.5;
      cy += (mouseY - cy) * 0.5;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      // ring lags slightly for that elastic feel
      rx += (mouseX - rx) * 0.18;
      ry += (mouseY - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    }
    loop();

    document.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
      ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      cursor.style.opacity = '1';
      ring.style.opacity = '1';
    });

    // hover state
    const hoverSel = 'a, button, .btn, [data-magnetic], .faq__q, .notif-trigger, .day__card, .bento__item, .note';
    const textSel = 'input, textarea, [contenteditable]';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverSel)) { cursor.classList.add('is-hover'); ring.classList.add('is-hover'); }
      else if (e.target.closest(textSel)) { cursor.classList.add('is-text'); ring.classList.add('is-hover'); }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverSel)) { cursor.classList.remove('is-hover'); ring.classList.remove('is-hover'); }
      else if (e.target.closest(textSel)) { cursor.classList.remove('is-text'); ring.classList.remove('is-hover'); }
    });
  }

  // ---------- 6. Magnetic buttons -----------------------------
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  // ---------- 7. Animated phone content (hero) ---------------
  // The hero phone shows typing greeting, then dose ring fills.
  const phoneGreeting = document.querySelector('[data-hero-greeting]');
  const phoneRing = document.querySelector('[data-hero-ring]');
  if (phoneGreeting) {
    const fullText = phoneGreeting.dataset.heroGreeting || phoneGreeting.textContent;
    phoneGreeting.textContent = '';
    const fullClean = fullText.trim();

    // wait until the hero is in view, then type
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          heroObserver.unobserve(e.target);
          setTimeout(() => typeGreeting(phoneGreeting, fullClean, 0), 600);
          if (phoneRing) setTimeout(() => animateDoseRing(phoneRing), 1100);
        }
      });
    }, { threshold: 0.3 });
    heroObserver.observe(phoneGreeting);
  }

  function typeGreeting(el, text, idx) {
    if (idx <= text.length) {
      el.textContent = text.slice(0, idx);
      const nextChar = text[idx];
      // slight pause on spaces
      const delay = nextChar === ' ' ? 30 : 40 + Math.random() * 40;
      setTimeout(() => typeGreeting(el, text, idx + 1), delay);
    } else {
      // leave the caret blinking via the ::after pseudo
      setTimeout(() => { el.classList.add('done'); }, 100);
    }
  }

  function animateDoseRing(svgRing) {
    const fg = svgRing.querySelector('.ring-fg');
    if (!fg) return;
    const target = parseFloat(svgRing.dataset.target || '78');
    const C = 2 * Math.PI * 42; // r=42
    fg.style.strokeDasharray = C.toFixed(2);
    fg.style.strokeDashoffset = C.toFixed(2);
    requestAnimationFrame(() => {
      fg.style.strokeDashoffset = (C * (1 - target / 100)).toFixed(2);
    });
    // also tick the number
    const numEl = svgRing.querySelector('[data-count]');
    if (numEl) {
      numEl.dataset.count = target.toString();
      numEl.dataset.dur = '1500';
      animateCount(numEl);
    }
  }

  // ---------- 8. FAQ accordion --------------------------------
  document.querySelectorAll('.faq__item').forEach((item) => {
    const q = item.querySelector('.faq__q');
    if (!q) return;
    q.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      item.parentElement.querySelectorAll('.faq__item').forEach(i => i.classList.remove('is-open'));
      if (!open) item.classList.add('is-open');
    });
  });

  // ---------- 9. Waitlist form --------------------------------
  const form = document.querySelector('[data-waitlist-form]');
  const success = document.querySelector('[data-waitlist-success]');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn = form.querySelector('button[type="submit"]');
      if (!input || !input.value) return;
      const email = input.value.trim();
      const role = form.querySelector('select[name="role"]')?.value || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.focus();
        input.setCustomValidity('Please use a valid email.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      const originalBtn = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Adding you…';
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role, source: 'marketing-site' }),
        });
        if (!res.ok) throw new Error('Sign-up failed');
        form.style.display = 'none';
        if (success) success.classList.add('is-visible');
        const meta = document.querySelector('[data-waitlist-meta]');
        if (meta) meta.style.display = 'none';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalBtn;
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') {
          form.style.display = 'none';
          if (success) success.classList.add('is-visible');
        } else {
          input.setCustomValidity('Something went wrong. Please try again.');
          input.reportValidity();
        }
      }
    });
  }

  // ---------- 10. Smooth scroll for hash links ----------------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          window.scrollTo({
            top: el.getBoundingClientRect().top + window.scrollY - 80,
            behavior: 'smooth',
          });
        }
      }
    });
  });

  // ---------- 11. Drag-to-scroll rails ------------------------
  const rails = document.querySelectorAll('[data-rail]');
  rails.forEach((rail) => {
    let isDown = false, startX = 0, startScroll = 0;
    rail.addEventListener('mousedown', (e) => {
      if (rail.classList.contains('day__rail') && window.matchMedia('(min-width: 901px)').matches) return;
      isDown = true;
      startX = e.pageX - rail.offsetLeft;
      startScroll = rail.scrollLeft;
      rail.style.cursor = 'grabbing';
    });
    rail.addEventListener('mouseleave', () => { isDown = false; rail.style.cursor = ''; });
    rail.addEventListener('mouseup', () => { isDown = false; rail.style.cursor = ''; });
    rail.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - rail.offsetLeft;
      rail.scrollLeft = startScroll - (x - startX) * 1.2;
    });

    // update dot indicators
    const dotsWrap = rail.parentElement.querySelector('[data-dots]');
    if (dotsWrap) {
      const updateDots = () => {
        const card = rail.querySelector('.day__card, .showcase__card');
        if (!card) return;
        const cardW = card.getBoundingClientRect().width + 20;
        const idx = Math.round(rail.scrollLeft / cardW);
        dotsWrap.querySelectorAll('.day__dot, .showcase__dot').forEach((d, i) => {
          d.classList.toggle('is-active', i === idx);
        });
      };
      rail.addEventListener('scroll', updateDots, { passive: true });
      updateDots();
    }
  });

  // ---------- 12. Notification demo (interactive) -------------
  const notifTrigger = document.querySelector('[data-notif-trigger]');
  const notifToast = document.querySelector('[data-notif-toast]');
  if (notifTrigger && notifToast) {
    notifTrigger.addEventListener('click', () => {
      notifToast.classList.add('is-visible');
      notifTrigger.disabled = true;
      notifTrigger.textContent = 'Notification sent — tap again';
      setTimeout(() => {
        notifToast.classList.remove('is-visible');
        notifTrigger.disabled = false;
        notifTrigger.innerHTML = '<span class="pulse"></span> Trigger dose reminder';
      }, 4500);
    });
  }

  // ---------- 13. Phone "real-time" — animate the time text ---
  // For the notification demo, tick the clock every minute.
  const lockTime = document.querySelector('[data-lock-time]');
  const lockDate = document.querySelector('[data-lock-date]');
  if (lockTime && lockDate) {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      lockTime.textContent = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const opts = { weekday: 'long', month: 'long', day: 'numeric' };
      lockDate.textContent = now.toLocaleDateString('en-US', opts);
    };
    update();
    setInterval(update, 30 * 1000);
  }

  // ---------- 14. Hero phone: subtle floating animation ------
  const heroPhone = document.querySelector('.hero .phone');
  if (heroPhone) {
    heroPhone.style.animation = 'phoneFloat 7s ease-in-out infinite';
  }
  // Add the keyframes to head if not present
  if (!document.getElementById('phone-float-keyframes')) {
    const s = document.createElement('style');
    s.id = 'phone-float-keyframes';
    s.textContent = `
      @keyframes phoneFloat {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-6px) rotate(-0.4deg); }
      }
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // PREMIUM LAYER
  // ============================================================

  // ---------- 14b. Always-on bento decoration ----------------
  // Inject corner halos + faint animated grid into each bento card.
  // Cheap, "always on" — no hover required.
  document.querySelectorAll('.bento__item').forEach((card, i) => {
    if (card.querySelector('.bento__deco')) return;
    const deco = document.createElement('div');
    deco.className = 'bento__deco';
    const palette = ['--c-sky-500', '--c-coral-500', '--c-emerald-500'];
    deco.innerHTML = `
      <div class="bento__halo" style="--halo-c: ${palette[i % 3]}"></div>
      <div class="bento__stardust"></div>
      <div class="bento__corner bento__corner--tl"></div>
      <div class="bento__corner bento__corner--br"></div>
    `;
    card.appendChild(deco);
  });

  // ---------- 15. Aurora: cursor-reactive radial blobs --------
  // The hero sits over an <div class="aurora"> with three blobs.
  // We lerp the blobs toward the pointer with a soft spring.
  const aurora = document.querySelector('.aurora');
  if (aurora && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const blobs = aurora.querySelectorAll('.aurora__blob');
    const targets = [
      { x: 0.30, y: 0.25, i: 0 },
      { x: 0.72, y: 0.18, i: 1 },
      { x: 0.50, y: 0.72, i: 2 },
    ];
    let tx = 0.5, ty = 0.4;
    let rx = 0.5, ry = 0.4;
    let raf = null;
    document.addEventListener('mousemove', (e) => {
      tx = e.clientX / window.innerWidth;
      ty = e.clientY / window.innerHeight;
    }, { passive: true });
    function loop() {
      rx += (tx - rx) * 0.05;
      ry += (ty - ry) * 0.05;
      blobs.forEach((b, i) => {
        const t = targets[i];
        const ax = (t.x * 0.7) + (rx * 0.3);
        const ay = (t.y * 0.7) + (ry * 0.3);
        b.style.setProperty('--mx', (ax * 100) + 'vw');
        b.style.setProperty('--my', (ay * 100) + 'vh');
      });
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  // ---------- 16. Kinetic headline: letter-by-letter wrap ----
  // We don't want to ship 80 <span> in HTML. Build them on load.
  const headline = document.querySelector('[data-headline]');
  if (headline) {
    headline.querySelectorAll('[data-text]').forEach((row) => {
      const text = row.getAttribute('data-text') || '';
      row.innerHTML = '';
      let i = 0;
      [...text].forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'char' + (ch === ' ' ? ' char--space' : '');
        span.textContent = ch === ' ' ? ' ' : ch;
        span.style.setProperty('--i', i);
        row.appendChild(span);
        i++;
      });
    });
  }

  // ---------- 17. Bento tilt + spotlight -------------------
  // Mouse position drives --rx, --ry (rotateX/Y) and --mx, --my (spotlight).
  // The CSS already wires ::before to use these vars.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.bento__item').forEach((card) => {
      let raf = null, latest = null;
      const apply = () => {
        const r = card.getBoundingClientRect();
        const px = latest.x - r.left;
        const py = latest.y - r.top;
        const dx = (px / r.width) - 0.5;
        const dy = (py / r.height) - 0.5;
        card.style.setProperty('--rx', (-dy * 6).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (dx * 6).toFixed(2) + 'deg');
        card.style.setProperty('--mx', ((px / r.width) * 100) + '%');
        card.style.setProperty('--my', ((py / r.height) * 100) + '%');
        card.style.setProperty('--spot-alpha', '1');
        raf = null;
      };
      card.addEventListener('mousemove', (e) => {
        latest = { x: e.clientX, y: e.clientY };
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--spot-alpha', '0');
      });
    });
  }

  // ---------- 18. Spark self-draw on scroll-in --------------
  // Measure each path's length, then animate dashoffset to 0
  // when the parent bento__item enters the viewport.
  if ('IntersectionObserver' in window) {
    const drawObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        entry.target.querySelectorAll('[data-path-draw]').forEach((p) => {
          try {
            const len = p.getTotalLength ? Math.ceil(p.getTotalLength()) : 1000;
            p.style.setProperty('--len', len);
          } catch (_) { /* noop */ }
        });
        drawObserver.unobserve(entry.target);
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.bento__item, .map').forEach((el) => drawObserver.observe(el));
  }

  // ---------- 19. Day rail progress hairline ----------------
  // Update --p on .day__progress-fill from rail scroll position.
  const dayProgress = document.querySelector('.day__progress-fill');
  const dayRail = document.querySelector('.day .day__rail');
  if (dayProgress && dayRail) {
    const updateDayProgress = () => {
      const max = (dayRail.scrollWidth - dayRail.clientWidth) || 1;
      const pct = Math.min(1, Math.max(0, dayRail.scrollLeft / max));
      dayProgress.style.inset = `0 ${(1 - pct) * 100}% 0 0`;
    };
    dayRail.addEventListener('scroll', updateDayProgress, { passive: true });
    updateDayProgress();
  }

  // ---------- 20. Compare drag slider -----------------------
  const compareDrag = document.querySelector('[data-compare-drag]');
  if (compareDrag) {
    const handle = compareDrag.querySelector('[data-compare-handle]');
    let dragging = false;
    const setP = (clientX) => {
      const r = compareDrag.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      compareDrag.style.setProperty('--p', (pct * 100) + '%');
    };
    const onDown = (e) => {
      dragging = true;
      compareDrag.classList.add('is-grabbed');
      compareDrag.style.cursor = 'ew-resize';
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setP(x);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setP(x);
    };
    const onUp = () => {
      dragging = false;
      compareDrag.classList.remove('is-grabbed');
      compareDrag.style.cursor = '';
    };
    if (handle) handle.addEventListener('mousedown', onDown);
    if (handle) handle.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
    // Click anywhere on the compare-drag surface also repositions.
    compareDrag.addEventListener('click', (e) => {
      if (matchMedia('(min-width: 700px)').matches) setP(e.clientX);
    });
    // Auto-shuffle for ambient feel — only if user hasn't interacted after 6s.
    if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      let userTouched = false;
      ['mousedown', 'touchstart', 'click'].forEach((ev) => compareDrag.addEventListener(ev, () => { userTouched = true; }));
      setTimeout(() => {
        if (userTouched) return;
        let t = 0;
        const walk = () => {
          if (userTouched) return;
          const v = 50 + Math.sin(t) * 18;
          compareDrag.style.setProperty('--p', v + '%');
          t += 0.012;
          requestAnimationFrame(walk);
        };
        walk();
      }, 6000);
    }
  }

  // ---------- 21. CTA micro-celebration ---------------------
  // Wrap existing form handler — when 2xx, add .is-bursting +
  // .is-success to parent .cta. Skip the display:none flip.
  // Spawn a confetti burst (CSS-only flying particles).
  const cta = document.querySelector('.cta');
  if (form && cta) {
    form.addEventListener('submit', () => {
      setTimeout(() => {
        const wrap = form.querySelector('.cta__submit-wrap');
        const success = cta.querySelector('[data-waitlist-success]');
        const meta = cta.querySelector('[data-waitlist-meta]');
        if (wrap) wrap.classList.add('is-bursting');
        if (meta) meta.style.opacity = '1';
        cta.classList.add('is-success');
        if (success) {
          success.style.opacity = '';
          success.style.transform = '';
          success.style.pointerEvents = '';
        }
        // Confetti — 24 tiny dots fly outward from the button.
        if (wrap) {
          for (let i = 0; i < 24; i++) {
            const p = document.createElement('span');
            p.className = 'cta__confetti';
            const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const dist = 80 + Math.random() * 80;
            p.style.setProperty('--tx', (Math.cos(angle) * dist) + 'px');
            p.style.setProperty('--ty', (Math.sin(angle) * dist) + 'px');
            p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
            p.style.background = ['#0EA5E9', '#FF7A59', '#10B981', '#FCD34D', '#A78BFA'][i % 5];
            wrap.appendChild(p);
            setTimeout(() => p.remove(), 1100);
          }
        }
      }, 280);
    });
  }

  // ---------- 22. Footer oversized mark underline ----------
  // We don't need much — the CSS already animates .footer__mark-rule
  // when .footer__mark.is-in. The existing [data-reveal] observer
  // adds .is-in. Nothing else to do here.

  // ---------- 23. Sticky Horizontal Scroll for Day Rail (Desktop Only) ----------
  const stickyWrapper = document.querySelector('.day-sticky-wrapper');
  const stickyRail = document.querySelector('.day .day__rail');
  const stickyContainer = document.querySelector('.day-sticky-container');
  
  if (stickyWrapper && stickyRail && stickyContainer) {
    const handleStickyScroll = () => {
      if (!window.matchMedia('(min-width: 901px)').matches) {
        return;
      }
      
      const rect = stickyWrapper.getBoundingClientRect();
      const stickyOffset = 140; // match CSS top: 140px
      
      // Calculate how far we've scrolled past the sticky start point
      const scrolled = -rect.top + stickyOffset;
      
      // Calculate total vertical height the container will remain sticky
      const containerHeight = stickyContainer.clientHeight || 650;
      const totalScrollRange = rect.height - containerHeight;
      
      // Calculate scroll progress (from 0 to 1)
      const progress = Math.min(1, Math.max(0, scrolled / totalScrollRange));
      
      // Translate progress to horizontal scroll position
      const maxScrollLeft = stickyRail.scrollWidth - stickyRail.clientWidth;
      stickyRail.scrollLeft = progress * maxScrollLeft;
    };
    
    window.addEventListener('scroll', handleStickyScroll, { passive: true });
    window.addEventListener('resize', handleStickyScroll, { passive: true });
    // Run once on load to sync initial state
    handleStickyScroll();
  }

})();

  }, []);

  return (
    <>
      
  <div className="nav-frame" aria-hidden="true">
    <div className="nav-frame__border"></div>
  </div>
  <nav className="nav" aria-label="Primary">
    <div className="container nav__inner">
      <a href="#" className="nav__brand" aria-label="MedLocker home">
        <span className="nav__brand-mark">
          <span className="nav__brand-ring"></span>
          <img className="logo" src="assets/logo.svg" alt="" width="28" height="28" />
        </span>
        <span className="nav__brand-name">MedLocker</span>
        <span className="nav__brand-ver">v1.0</span>
      </a>
      <div className="nav__links hidden-mobile">
        <a className="nav__link" href="#features">Features</a>
        <a className="nav__link" href="#tour">The app</a>
        <a className="nav__link" href="#built-for">For you</a>
        <a className="nav__link" href="#security">Security</a>
        <a className="nav__link" href="#faq">FAQ</a>
      </div>
      <div className="nav__cta">
        <span className="nav__status" data-nav-status>
          <span className="pulse"></span>
          <span><span data-nav-count>147</span> in beta</span>
        </span>
        <Link className="nav__link hidden-mobile" href="/portal/login">
          Clinician sign in
        </Link>
        <a className="btn btn--primary nav__btn" href="#waitlist">
          Get the app
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
        </a>
      </div>
    </div>
  </nav>

  
  
  <div className="aurora" aria-hidden="true">
    <div className="aurora__grid"></div>
    <div className="aurora__blob aurora__blob--1"></div>
    <div className="aurora__blob aurora__blob--2"></div>
    <div className="aurora__blob aurora__blob--3"></div>
    <div className="aurora__particles">
      <span className="aurora__p"></span><span className="aurora__p"></span><span className="aurora__p"></span>
      <span className="aurora__p"></span><span className="aurora__p"></span><span className="aurora__p"></span>
      <span className="aurora__p"></span><span className="aurora__p"></span><span className="aurora__p"></span>
      <span className="aurora__p"></span><span className="aurora__p"></span><span className="aurora__p"></span>
      <span className="aurora__p"></span><span className="aurora__p"></span><span className="aurora__p"></span>
    </div>
    <div className="aurora__orb" aria-hidden="true"></div>
    <div className="aurora__grain"></div>
  </div>

  <header className="hero">
    <div className="container">
      <div className="hero__grid">
        <div className="hero__copy" data-reveal>
          <span className="pill">
            <span className="pill__dot"></span>
            v1.0 — Now in private beta
          </span>
          <h1 className="h-display hero__headline" data-headline>
            <span className="headline__line"><span className="headline__row" data-text="Your health,"></span></span><br />
            <span className="headline__line headline__line--em"><em><span className="headline__row" data-text="finally in one place."></span></em></span>
          </h1>
          
          <svg className="hero__trace" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 18 Q 60 4 140 12 T 280 10 T 420 14 T 560 6" fill="none" stroke="url(#traceGrad)" strokeWidth="2.4" strokeLinecap="round" />
            <defs>
              <linearGradient id="traceGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#0EA5E9" />
                <stop offset="1" stopColor="#FF7A59" />
              </linearGradient>
            </defs>
          </svg>
          <p className="lede hero__lede">
            MedLocker is the calm, private health companion that brings your records,
            medicines, vitals and care team into a single, beautifully designed app.
            Built quietly in Sri Lanka — for the way you actually look after the people you love.
          </p>
          <div className="hero__cta-row">
            <a className="btn btn--sky btn--xl" href="#waitlist" data-magnetic>
              Join the waitlist
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </a>
            <a className="btn btn--ghost btn--xl" href="#tour" data-magnetic>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Watch the tour
            </a>
          </div>
          <div className="hero__meta">
            <span className="hero__meta-item">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z"/></svg>
              End-to-end encrypted
            </span>
            <span className="hero__meta-item">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Built in Colombo 🇱🇰
            </span>
            <span className="hero__meta-item">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
              iOS · Android
            </span>
          </div>
          <div className="hero__mark">
            <span className="hero__mark-rule"></span>
            <span>01 / Overview</span>
          </div>
        </div>

        
        <div className="hero__visual" data-reveal>
          
          <div className="float-card float-card--dose">
            <div className="float-card__icon" style={{"background":"#D1FAE5","color":"#059669"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
            </div>
            <div>
              <div className="float-card__title">Metformin 500mg</div>
              <div className="float-card__sub">Taken · 08:30</div>
            </div>
          </div>

          
          <div className="annot" style={{"top":"8%","right":"-8%"}}>
            <div className="annot__text">your dose ring ✦</div>
            <div className="annot__arrow" style={{"top":"100%","left":"30%","transform":"rotate(155deg)"}}>
              <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M50 5 Q 30 30 50 60 T 30 95" strokeDasharray="3 3" />
                <path d="M30 95 l 6 -8 l -2 10 z" fill="currentColor" />
              </svg>
            </div>
          </div>

          
          <div className="phone">
            <div className="phone__frame">
              <div className="phone__screen">
                <div className="phone__notch"></div>
                <div className="phone__status">
                  <span>9:41</span>
                  <div className="phone__status-icons">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                  </div>
                </div>
                <div className="phone__screen-content">
                  <div className="app-header">
                    <div className="app-avatar">TH</div>
                    <div className="app-brand">
                      MedLocker
                      <small>Thufail · 32 yrs</small>
                    </div>
                    <div className="row" style={{"gap":"6px"}}>
                      <div className="app-icon-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                      <div className="app-icon-btn--ghost" style={{"width":"30px","height":"30px","borderRadius":"50%","border":"1px solid var(--c-line)","display":"flex","alignItems":"center","justifyContent":"center"}}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                      </div>
                    </div>
                  </div>

                  
                  <div className="app-hero-card">
                    <div className="app-hero-card__date">Good morning · Sat 4 Jul</div>
                    <div className="app-hero-card__name">
                      <span className="phone__hero-greeting" data-hero-greeting="Thufail,">Thufail,</span>
                    </div>
                    <div className="app-hero-card__quote">"Stay hydrated — your dose adherence is 78% this week."</div>
                    <div className="app-hero-card__ring" data-hero-ring data-target="78">
                      <svg className="dose-ring-svg" viewBox="0 0 100 100" style={{"position":"absolute","inset":"0","width":"100%","height":"100%"}}>
                        <circle className="ring-bg" cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6"/>
                        <circle className="ring-fg" cx="50" cy="50" r="42" fill="none" stroke="#7DD3FC" strokeWidth="6" strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                          style={{"strokeDasharray":"263.89","strokeDashoffset":"263.89"}}/>
                      </svg>
                      <div style={{"position":"relative","zIndex":"2","display":"flex","flexDirection":"column","alignItems":"center","lineHeight":"1"}}>
                        <span data-count="78" data-dur="1500" style={{"fontSize":"15px","fontWeight":"700"}}>0</span><span style={{"fontSize":"7.5px","color":"rgba(255,255,255,0.6)","fontWeight":"500","textTransform":"uppercase","letterSpacing":"0.08em","marginTop":"1px"}}>doses</span>
                      </div>
                      <small style={{"display":"none"}}>doses</small>
                    </div>
                    <div className="app-up-next">
                      <div className="app-up-next__label">Upcoming today</div>
                      <div className="app-up-next__row">
                        <span>Metformin 500mg</span><span className="time">08:30</span>
                      </div>
                      <div className="app-up-next__row">
                        <span>Dr. Perera — Cardiology</span><span className="time">14:00</span>
                      </div>
                    </div>
                    <div className="app-pills">
                      <span className="app-pill">A·O·B+</span>
                      <span className="app-pill">BMI 23.4</span>
                      <span className="app-pill">3 alerts</span>
                    </div>
                  </div>

                  
                  <div className="app-section-label">Quick actions</div>
                  <div className="app-quick-grid">
                    <div className="app-quick-tile">
                      <div className="app-quick-tile__icon" style={{"background":"#E0F2FE","color":"#0369A1"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/><path d="M8.5 8.5l7 7"/></svg>
                      </div>
                      <span className="app-quick-tile__name">Medicines</span>
                    </div>
                    <div className="app-quick-tile">
                      <div className="app-quick-tile__icon" style={{"background":"#D1FAE5","color":"#059669"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                      </div>
                      <span className="app-quick-tile__name">Records</span>
                    </div>
                    <div className="app-quick-tile">
                      <div className="app-quick-tile__icon" style={{"background":"#FEF3C7","color":"#D97706"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      </div>
                      <span className="app-quick-tile__name">Book visit</span>
                    </div>
                    <div className="app-quick-tile">
                      <div className="app-quick-tile__icon" style={{"background":"#FFEDE5","color":"#E85F3D"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
                      </div>
                      <span className="app-quick-tile__name">Emergency</span>
                    </div>
                  </div>

                  <div style={{"flex":"1"}}></div>

                  
                  <div className="app-tabbar">
                    <div className="app-tab app-tab--active">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12l9-9 9 9-2 0v9h-5v-6h-4v6H5v-9H3z"/></svg>
                      Home
                    </div>
                    <div className="app-tab">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                      Records
                    </div>
                    <div className="app-fab">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    </div>
                    <div className="app-tab">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      Visits
                    </div>
                    <div className="app-tab">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      Profile
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          
          <div className="float-card float-card--ai">
            <div className="float-card__icon" style={{"background":"linear-gradient(135deg,#1E1B4B,#4338CA)","color":"#fff"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.39 6.95H22l-5.81 4.22 2.22 6.83L12 16.99 5.59 20l2.22-6.83L2 8.95h7.61L12 2z"/></svg>
            </div>
            <div>
              <div className="float-card__title">Lab results explained</div>
              <div className="float-card__sub">AI · ready in 3 sec</div>
            </div>
          </div>

          
          <div className="annot" style={{"top":"50%","left":"-14%"}}>
            <div className="annot__text" style={{"animationDelay":"-3s"}}>↑ tap the FAB to add a record</div>
          </div>

          
          <div className="float-card float-card--emerg">
            <div className="float-card__icon" style={{"background":"#FEE2E2","color":"#DC2626"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <div>
              <div className="float-card__title">Tap to call emergency</div>
              <div className="float-card__sub">110 · Ambulance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  
  <div className="ticker" aria-hidden="true">
    <div className="ticker__label">
      <span className="pulse"></span>
      LIVE
    </div>
    <div className="ticker__viewport">
      <div className="ticker__track">
        <span className="ticker__item"><span className="green">●</span> 14 doses logged today</span>
        <span className="ticker__item"><span className="sky">●</span> Dr. Perera's next slot — Tue 8 Jul, 14:00</span>
        <span className="ticker__item"><span className="amber">●</span> Amma's BP reading 132/84 — trending up</span>
        <span className="ticker__item"><span className="green">●</span> 3 new lab results auto-classified</span>
        <span className="ticker__item"><span className="rose">●</span> Refill reminder: Atorvastatin · 5 days left</span>
        <span className="ticker__item"><span className="sky">●</span> Asiri Central upload: 04 Jul 09:42</span>
        <span className="ticker__item"><span className="green">●</span> 14 doses logged today</span>
        <span className="ticker__item"><span className="sky">●</span> Dr. Perera's next slot — Tue 8 Jul, 14:00</span>
        <span className="ticker__item"><span className="amber">●</span> Amma's BP reading 132/84 — trending up</span>
        <span className="ticker__item"><span className="green">●</span> 3 new lab results auto-classified</span>
        <span className="ticker__item"><span className="rose">●</span> Refill reminder: Atorvastatin · 5 days left</span>
        <span className="ticker__item"><span className="sky">●</span> Asiri Central upload: 04 Jul 09:42</span>
      </div>
    </div>
  </div>

  
  <div className="marquee" aria-hidden="true">
    <div className="marquee__track">
      <span className="marquee__item"><span className="num">1</span> private beta tester</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">4.9</span> ★ on TestFlight</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">3</span> languages · EN · සිං · த</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">14</span> days of medicine reminders, on the house</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">0</span> ads, ever</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">1</span> private beta tester</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">4.9</span> ★ on TestFlight</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">3</span> languages · EN · සිං · த</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">14</span> days of medicine reminders, on the house</span>
      <span className="marquee__item">·</span>
      <span className="marquee__item"><span className="num">0</span> ads, ever</span>
    </div>
  </div>

  
  
  <section className="section section--tight stats" aria-label="By the numbers">
    <div className="container">
      <div className="stats__head" data-reveal>
        <span className="stats__head-tag">// live instrument panel</span>
        <span className="stats__head-clock"><span className="pulse"></span> updated <span data-stats-time>today</span></span>
      </div>
      <div className="stats__grid" data-reveal>
        <div className="stats__cell">
          <div className="stats__kicker">A · scale</div>
          <div className="stats__num"><span data-count="1000" data-dur="1800">0</span><span className="stats__suffix"> spots</span></div>
          <div className="stats__lbl">private beta, opened slowly on purpose</div>
          <div className="stats__bar"><span style={{"--w":"14%"}}></span></div>
          <div className="stats__meta">147 / 1,000 claimed</div>
        </div>
        <div className="stats__rule" aria-hidden="true">
          <span className="stats__rule-dot"></span>
        </div>
        <div className="stats__cell">
          <div className="stats__kicker">B · quality</div>
          <div className="stats__num"><span data-count="4.9" data-dur="1600" data-decimals="1">0</span><span className="stats__suffix">★</span></div>
          <div className="stats__lbl">across 217 TestFlight reviews</div>
          <div className="stats__bar"><span style={{"--w":"98%","background":"var(--c-emerald-500)"}}></span></div>
          <div className="stats__meta">App Store pending · Play pending</div>
        </div>
        <div className="stats__rule" aria-hidden="true">
          <span className="stats__rule-dot"></span>
        </div>
        <div className="stats__cell">
          <div className="stats__kicker">C · cost</div>
          <div className="stats__num"><span data-count="14" data-dur="1500">0</span><span className="stats__suffix"> days</span></div>
          <div className="stats__lbl">of medicine reminders, on the house</div>
          <div className="stats__bar"><span style={{"--w":"100%","background":"var(--c-coral-500)"}}></span></div>
          <div className="stats__meta">then LKR 1,500 / yr · no ads, ever</div>
        </div>
        <div className="stats__rule" aria-hidden="true">
          <span className="stats__rule-dot"></span>
        </div>
        <div className="stats__cell">
          <div className="stats__kicker">D · reach</div>
          <div className="stats__num"><span data-count="3" data-dur="900">0</span><span className="stats__suffix"> langs</span></div>
          <div className="stats__lbl">EN · සිං · த — written by humans, not translated</div>
          <div className="stats__bar"><span style={{"--w":"33%"}}></span></div>
          <div className="stats__meta">Q4 2026 · + Mandarin, Bahasa</div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--cream">
    <div className="container container--narrow">
      <div data-reveal>
        <span className="eyebrow">02 / The problem</span>
        <h2 className="h1" style={{"marginTop":"18px"}}>
          Your medical history shouldn't live in <span className="serif">three WhatsApp threads,</span>
          a plastic folder, and your memory.
        </h2>
        <p className="lede" style={{"marginTop":"24px"}}>
          We watched our parents and grandparents juggle paper prescriptions,
          photos of lab reports, voice notes from the doctor, and a stack of clinic
          cards that never quite make it to the next visit. So we built the thing
          we wished they had — a single, calm place for everything health.
        </p>
      </div>

      <div className="steps" style={{"marginTop":"64px"}} data-reveal>
        <div className="step">
          <div className="step__num">— A</div>
          <div className="step__title">Records scattered everywhere</div>
          <p className="step__copy">
            Lab reports live in your gallery. Prescriptions in a drawer.
            The one you need — when you need it — is at the bottom of a chat.
          </p>
        </div>
        <div className="step">
          <div className="step__num">— B</div>
          <div className="step__title">Reminders that don't</div>
          <p className="step__copy">
            "Take with breakfast." Sure, but which dose, today, and did
            you actually take the morning one or the evening one?
          </p>
        </div>
        <div className="step">
          <div className="step__num">— C</div>
          <div className="step__title">No one is in charge</div>
          <p className="step__copy">
            Your cardiologist, your GP and your pharmacist each have
            a piece of the picture. None of them have all of it.
          </p>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section" id="features">
    <div className="container">
      <div className="row row--between" style={{"alignItems":"flex-end","marginBottom":"56px"}} data-reveal>
        <div>
          <span className="eyebrow">03 / What's inside</span>
          <h2 className="h1" style={{"marginTop":"14px","maxWidth":"16ch"}}>
            Six things, done <span className="serif">unusually well.</span>
          </h2>
        </div>
        <p className="lede" style={{"maxWidth":"36ch"}}>
          We don't ship 80 features. We ship the ones that
          actually change how you look after yourself.
        </p>
      </div>

      <div className="bento">

        
        <article className="bento__item bento__item--wide bento__item--feature" data-reveal data-bento>
          <div className="bento__tag">A · Records</div>
          <h3 className="bento__title">One timeline. Every visit, every result, every script.</h3>
          <p className="bento__copy">
            Forward any lab report to your private email alias and it lands in
            your timeline — auto-classified, searchable, and ready when the
            next doctor asks "what was your HbA1c in March?"
          </p>
          <div className="bento__visual">
            <div className="records-row" style={{"background":"rgba(255,255,255,0.06)","borderColor":"rgba(255,255,255,0.12)"}}>
              <div className="records-row__icon" style={{"background":"rgba(56,189,248,0.18)","color":"#7DD3FC"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              </div>
              <div>
                <div className="records-row__name" style={{"color":"#fff"}}>Full blood count</div>
                <div className="records-row__meta" style={{"color":"rgba(255,255,255,0.55)"}}>Asiri Central · 4 Jul 2026</div>
              </div>
              <span className="records-row__date" style={{"color":"rgba(255,255,255,0.55)"}}>PDF</span>
            </div>
            <div className="records-row" style={{"background":"rgba(255,255,255,0.06)","borderColor":"rgba(255,255,255,0.12)"}}>
              <div className="records-row__icon" style={{"background":"rgba(16,185,129,0.18)","color":"#6EE7B7"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              </div>
              <div>
                <div className="records-row__name" style={{"color":"#fff"}}>Annual check-up</div>
                <div className="records-row__meta" style={{"color":"rgba(255,255,255,0.55)"}}>Dr. Perera · 12 Jun 2026</div>
              </div>
              <span className="records-row__date" style={{"color":"rgba(255,255,255,0.55)"}}>NOTE</span>
            </div>
            <div className="records-row" style={{"background":"rgba(255,255,255,0.06)","borderColor":"rgba(255,255,255,0.12)"}}>
              <div className="records-row__icon" style={{"background":"rgba(255,122,89,0.18)","color":"#FFB89B"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/></svg>
              </div>
              <div>
                <div className="records-row__name" style={{"color":"#fff"}}>Metformin 500mg</div>
                <div className="records-row__meta" style={{"color":"rgba(255,255,255,0.55)"}}>Prescription · ongoing</div>
              </div>
              <span className="records-row__date" style={{"color":"rgba(255,255,255,0.55)"}}>Rx</span>
            </div>
          </div>
          <div className="bento__deco" aria-hidden="true">
            <div className="bento__halo bento__halo--cyan"></div>
            <div className="bento__stardust"></div>
          </div>
        </article>

        
        <article className="bento__item bento__item--half bento__item--sky" data-reveal>
          <div className="bento__tag">B · AI</div>
          <h3 className="bento__title">A second pair of eyes — when you can't reach your doctor.</h3>
          <p className="bento__copy">
            "Explain my lipid panel in plain English." "Is this new
            medicine safe with what I'm already taking?" Trained on
            your records, not the open internet.
          </p>
          <div className="bento__visual">
            <div className="ai-chat" style={{"background":"#fff","border":"0","boxShadow":"var(--shadow-sm)"}}>
              <div style={{"fontSize":"11px","color":"var(--text-soft)","marginBottom":"4px"}}>You</div>
              <div className="ai-msg--user">What does "LDL 168 mg/dL" mean?</div>
              <div style={{"fontSize":"11px","color":"var(--text-soft)","margin":"10px 0 4px"}}>MedLocker AI</div>
              <div className="ai-msg--bot">Your LDL is higher than the 100 mg/dL target. Combined with your family history, it's worth a conversation about diet and possibly a statin.</div>
            </div>
          </div>
        </article>

        
        <article className="bento__item bento__item--third bento__item--emerald" data-reveal>
          <div className="bento__tag">C · Medicines</div>
          <h3 className="bento__title">Reminders that feel like a friend, not an alarm.</h3>
          <p className="bento__copy">
            Period-aware. Pill-aware. Snooze-aware. Skipped a dose?
            The schedule shifts. Your doctor gets a real adherence number.
          </p>
          <div className="bento__visual" style={{"display":"flex","justifyContent":"center"}}>
            <svg className="dose-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="ring-bg" cx="50" cy="50" r="42" fill="none" strokeWidth="8"/>
              <circle className="ring-fg" cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                strokeDasharray="263.9" strokeDashoffset="58" transform="rotate(-90 50 50)"/>
              <text x="50" y="48" textAnchor="middle" fontSize="22" fill="#0F172A">78%</text>
              <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#64748B" letterSpacing="1.5">DOSES</text>
            </svg>
          </div>
        </article>

        
        <article className="bento__item bento__item--third bento__item--coral" data-reveal>
          <div className="bento__tag">D · Vitals</div>
          <h3 className="bento__title">Trends, not snapshots.</h3>
          <p className="bento__copy">
            Log BP, glucose, weight, SpO₂. See the line. Catch the
            drift before it becomes an admission.
          </p>
          <div className="bento__visual">
            <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="sparkG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#E85F3D" stopOpacity="0.25"/>
                  <stop offset="1" stopColor="#E85F3D" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M0,40 L20,35 L40,38 L60,28 L80,32 L100,22 L120,26 L140,18 L160,24 L180,14 L200,20 L200,60 L0,60 Z" fill="url(#sparkG)"/>
              <path d="M0,40 L20,35 L40,38 L60,28 L80,32 L100,22 L120,26 L140,18 L160,24 L180,14 L200,20" fill="none" stroke="#E85F3D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </article>

        
        <article className="bento__item bento__item--half" data-reveal>
          <div className="bento__tag">E · Family</div>
          <h3 className="bento__title">One account. Your whole family.</h3>
          <p className="bento__copy">
            Manage your mother's BP, your father's diabetes, your
            kid's vaccination schedule — under one roof, with one
            private lock between each profile.
          </p>
          <div className="bento__visual" style={{"display":"flex","gap":"8px","alignItems":"center"}}>
            <div className="app-avatar" style={{"width":"40px","height":"40px"}}>TH</div>
            <div className="app-avatar" style={{"width":"40px","height":"40px","background":"linear-gradient(135deg, #FFB89B, #FF7A59)"}}>FA</div>
            <div className="app-avatar" style={{"width":"40px","height":"40px","background":"linear-gradient(135deg, #6EE7B7, #10B981)"}}>KI</div>
            <div className="app-avatar" style={{"width":"40px","height":"40px","background":"linear-gradient(135deg, #C4B5FD, #8B5CF6)"}}>SI</div>
            <div className="app-avatar" style={{"width":"40px","height":"40px","background":"var(--c-slate-200)","color":"var(--text-soft)"}}>+</div>
            <span style={{"fontSize":"12.5px","color":"var(--text-muted)","marginLeft":"6px"}}>+ 2 invites sent</span>
          </div>
        </article>

        
        <article className="bento__item bento__item--third" data-reveal>
          <div className="bento__tag">F · Doctor</div>
          <h3 className="bento__title">A quiet inbox for the people who look after you.</h3>
          <p className="bento__copy">
            Your GP and your cardiologist can message you,
            share results, and see the same timeline you do.
          </p>
          <div className="bento__visual">
            <div style={{"display":"flex","gap":"8px","alignItems":"center"}}>
              <div className="app-avatar" style={{"width":"32px","height":"32px","fontSize":"11px","background":"linear-gradient(135deg, #0EA5E9, #075985)"}}>DP</div>
              <div style={{"flex":"1"}}>
                <div style={{"fontSize":"12px","fontWeight":"600"}}>Dr. Perera</div>
                <div style={{"fontSize":"10.5px","color":"var(--text-soft)"}}>HbA1c back — looks good 👍</div>
              </div>
              <div style={{"width":"6px","height":"6px","borderRadius":"50%","background":"var(--c-sky-500)"}}></div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  
  <section className="section section--cream section--skew-top" id="day">
    <div className="container">
      <div className="row row--between" style={{"alignItems":"flex-end","marginBottom":"8px"}} data-reveal>
        <div>
          <span className="eyebrow">04 / A day with MedLocker</span>
          <h2 className="h1" style={{"marginTop":"14px","maxWidth":"18ch"}}>
            From <span className="serif">dawn</span> to lights-out.
          </h2>
        </div>
        <p className="lede" style={{"maxWidth":"36ch"}}>
          What it actually looks like to live with the app for a day.
          Drag the row — the colour shifts with the time of day.
        </p>
      </div>

      <div className="day-sticky-wrapper">
        <div className="day-sticky-container">
          <div className="day" data-reveal>
            <div className="day__progress" aria-hidden="true">
              <div className="day__progress-fill"></div>
            </div>
            <div className="day__rail" data-rail>
          <article className="day__card day__card--dawn">
            <div className="day__time">05:42 · Dawn</div>
            <div className="day__clock">05:42<span className="day__ampm">AM</span></div>
            <div className="day__title">First vitals of the day</div>
            <p className="day__copy">
              Your phone buzzes. You roll over, open the app, log your
              fasting glucose with one thumb. Two seconds. Back to sleep.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#FEF3C7","color":"#D97706"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8M5 5l7 7M19 5l-7 7"/><circle cx="12" cy="16" r="2"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Fasting glucose</div>
                  <div className="day__visual-meta">98 mg/dL · within range</div>
                </div>
                <span className="day__visual-pill" style={{"background":"#D1FAE5","color":"#059669"}}>LOGGED</span>
              </div>
            </div>
          </article>

          <article className="day__card day__card--morning">
            <div className="day__time">08:30 · Morning</div>
            <div className="day__clock">08:30<span className="day__ampm">AM</span></div>
            <div className="day__title">The morning dose</div>
            <p className="day__copy">
              A soft ping. "Time for Metformin, with breakfast." Tap "taken".
              The schedule knows you've already had your morning reading.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#D1FAE5","color":"#059669"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/><path d="M8.5 8.5l7 7"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Metformin 500mg</div>
                  <div className="day__visual-meta">Twice daily · with breakfast</div>
                </div>
                <span className="day__visual-pill" style={{"background":"#D1FAE5","color":"#059669"}}>TAKEN</span>
              </div>
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#E0F2FE","color":"#0369A1"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/><path d="M8.5 8.5l7 7"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Atorvastatin 20mg</div>
                  <div className="day__visual-meta">Once daily · 09:00</div>
                </div>
                <span className="day__visual-pill" style={{"background":"#E0F2FE","color":"#0369A1"}}>QUEUED</span>
              </div>
            </div>
          </article>

          <article className="day__card day__card--midday">
            <div className="day__time">12:15 · Midday</div>
            <div className="day__clock">12:15<span className="day__ampm">PM</span></div>
            <div className="day__title">Lunch, plus a check-in</div>
            <p className="day__copy">
              A quick "how's your energy today?" prompt. You tap a face.
              That's it — a data point the app uses to spot patterns over
              weeks, not minutes.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#BAE6FD","color":"#0369A1"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Wellness check-in</div>
                  <div className="day__visual-meta">Energy: 4/5 · mood: calm</div>
                </div>
              </div>
            </div>
          </article>

          <article className="day__card day__card--afternoon">
            <div className="day__time">14:00 · Afternoon</div>
            <div className="day__clock">02:00<span className="day__ampm">PM</span></div>
            <div className="day__title">Dr. Perera, in your pocket</div>
            <p className="day__copy">
              Your 2pm consult. Dr. Perera opens your shared timeline on
              her screen — she's already seen last week's labs before
              you walk in.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#0EA5E9","color":"#fff"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Dr. Perera · Cardiology</div>
                  <div className="day__visual-meta">Consultation #12</div>
                </div>
              </div>
            </div>
          </article>

          <article className="day__card day__card--evening">
            <div className="day__time">19:30 · Evening</div>
            <div className="day__clock">07:30<span className="day__ampm">PM</span></div>
            <div className="day__title">A walk · and a stat</div>
            <p className="day__copy">
              You walked 6.4km today. The app quietly tracks it from your
              phone — no fitness band, no separate app, no opt-in screen
              for ad tracking.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"#FF9670","color":"#fff"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <div className="day__visual-name">Today's walk</div>
                  <div className="day__visual-meta">6.4 km · 58 min · 412 kcal</div>
                </div>
              </div>
            </div>
          </article>

          <article className="day__card day__card--night">
            <div className="day__time">22:00 · Lights out</div>
            <div className="day__clock">10:00<span className="day__ampm">PM</span></div>
            <div className="day__title">Last pill, then sleep</div>
            <p className="day__copy">
              Aspirin, done. The day's adherence lands at 4/4. The app
              sends you a single, quiet line of praise — and gets out of
              your way until morning.
            </p>
            <div className="day__visual">
              <div className="day__visual-row">
                <div className="day__visual-icon" style={{"background":"rgba(255,255,255,0.10)","color":"#FFB89B"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </div>
                <div>
                  <div className="day__visual-name" style={{"color":"#fff"}}>Aspirin 75mg</div>
                  <div className="day__visual-meta">Day adherence: 4 / 4 · 100%</div>
                </div>
                <span className="day__visual-pill" style={{"background":"rgba(110, 231, 183, 0.20)","color":"#6EE7B7"}}>DONE</span>
              </div>
            </div>
          </article>
        </div>
        <div className="day__dots" data-dots>
          <div className="day__dot is-active"></div>
          <div className="day__dot"></div>
          <div className="day__dot"></div>
          <div className="day__dot"></div>
          <div className="day__dot"></div>
          <div className="day__dot"></div>
        </div>
      </div>
    </div>
  </div>
  </div>
  </section>

  
  <section className="section section--paper section--skew-bottom" id="compare">
    <div className="container">
      <div data-reveal>
        <span className="eyebrow">05 / Before & after</span>
        <h2 className="h1" style={{"marginTop":"14px","maxWidth":"22ch"}}>
          The same morning. <span className="serif">Two very different days.</span>
        </h2>
        <p className="lede" style={{"marginTop":"18px","maxWidth":"60ch"}}>
          We rebuilt MedLocker around a single, stubborn question:
          why does managing your own health feel like detective work?
        </p>
      </div>

      <div className="compare" data-reveal>
        
        <div className="compare-drag" data-compare-drag style={{"--p":"50%"}}>
          <div className="compare-drag__side compare-drag__side--before compare__side compare__side--mess">
            <div className="compare__label">
              <span style={{"display":"inline-block","width":"8px","height":"8px","borderRadius":"50%","background":"#DC2626"}}></span>
              Before · Tuesday, 8:47 AM
              <span className="compare__label-tag">THE OLD WAY</span>
            </div>
            <div className="compare__body">
              <div className="chat chat--in">Atha did you get the lipid panel results from Asiri?</div>
              <div className="chat chat--out">No I went Friday. They said they'll WhatsApp</div>
              <div className="chat chat--in">
                <div className="chat__img">
                  <span className="chat__img-icon">📄</span>
                  IMG_20250704_0942.jpg
                </div>
                <div className="chat__meta chat__meta--right">8:48 AM ✓✓</div>
              </div>
              <div className="chat chat--out">Hmm the LDL number — is 168 ok?</div>
              <div className="chat chat--in">Wait that's the total cholesterol, scroll up</div>
              <div className="chat chat--in" style={{"fontStyle":"italic","color":"var(--text-soft)"}}>Atha I'll call you in 10 mins, in a meeting</div>
            </div>
            <div className="compare__footer">
              <span style={{"fontFamily":"var(--font-mono)","fontSize":"11px"}}>~ 14 mins</span> · 3 chats · 1 blurry photo · still no answer
            </div>
          </div>

          <div className="compare-drag__side compare-drag__side--after compare__side compare__side--calm">
            <div className="compare__label">
              <span className="pulse"></span>
              After · Tuesday, 8:47 AM
              <span className="compare__label-tag">WITH MEDLOCKER</span>
            </div>
            <div className="compare__body">
              <div className="records-row">
                <div className="records-row__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                </div>
                <div>
                  <div className="records-row__name">Full lipid panel</div>
                  <div className="records-row__meta">Asiri Central · Fri 4 Jul</div>
                </div>
                <span className="records-row__tag">AUTO-IMPORTS</span>
              </div>
              <div className="records-row">
                <div className="records-row__icon" style={{"background":"rgba(110, 231, 183, 0.18)","color":"#6EE7B7"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/></svg>
                </div>
                <div>
                  <div className="records-row__name">LDL: 168 mg/dL</div>
                  <div className="records-row__meta">Flagged · above 100 target</div>
                </div>
                <span className="records-row__tag" style={{"background":"rgba(252, 211, 77, 0.20)","color":"#FCD34D"}}>FLAGGED</span>
              </div>
              <div className="records-row">
                <div className="records-row__icon" style={{"background":"rgba(167, 139, 250, 0.18)","color":"#A78BFA"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.39 6.95H22l-5.81 4.22 2.22 6.83L12 16.99 5.59 20l2.22-6.83L2 8.95h7.61L12 2z"/></svg>
                </div>
                <div>
                  <div className="records-row__name">AI summary · ready</div>
                  <div className="records-row__meta">"Worth a statin conversation."</div>
                </div>
                <span className="records-row__tag" style={{"background":"rgba(125, 211, 252, 0.18)","color":"#7DD3FC"}}>3 SEC</span>
              </div>
              <div className="records-row">
                <div className="records-row__icon" style={{"background":"rgba(255, 122, 89, 0.18)","color":"#FFB89B"}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
                </div>
                <div>
                  <div className="records-row__name">Shared with Dr. Perera</div>
                  <div className="records-row__meta">Read at 8:49 · before your 2pm</div>
                </div>
                <span className="records-row__tag" style={{"background":"rgba(110, 231, 183, 0.18)","color":"#6EE7B7"}}>SEEN</span>
              </div>
            </div>
            <div className="compare__footer">
              <span style={{"fontFamily":"var(--font-mono)","fontSize":"11px"}}>~ 0 mins</span> · auto-classified · 1 tap to share
            </div>
          </div>

          <div className="compare-drag__handle" data-compare-handle aria-label="Drag to compare">
            <span className="compare-drag__rule"></span>
            <span className="compare-drag__knob">
              <span className="compare-drag__knob-ring"></span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/></svg>
            </span>
          </div>
          <div className="compare-drag__hint" aria-hidden="true">
            <span className="compare-drag__hint-arrow">←</span>
            <span>drag me</span>
            <span className="compare-drag__hint-arrow">→</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--paper" id="tour">
    <div className="container">
      <div className="row row--between" style={{"alignItems":"flex-end","marginBottom":"24px"}} data-reveal>
        <div>
          <span className="eyebrow">06 / The app</span>
          <h2 className="h1" style={{"marginTop":"14px","maxWidth":"18ch"}}>
            Every screen, <span className="serif">considered.</span>
          </h2>
        </div>
        <p className="lede" style={{"maxWidth":"36ch"}}>
          A walk-through of the screens you'll use most.
          Drag the row to scroll.
        </p>
      </div>

      <div className="showcase" data-reveal>
        <div className="showcase__rail" data-rail>

          
          <article className="showcase__card">
            <div className="phone">
              <div className="phone__frame">
                <div className="phone__screen">
                  <img src="assets/screenshots/home-phone-full.png" alt="MedLocker home screen" style={{"width":"100%","height":"100%","objectFit":"cover","objectPosition":"top","display":"block"}} />
                </div>
              </div>
            </div>
            <div className="showcase__caption">
              <div>
                <div className="showcase__num">01</div>
                <div className="showcase__name">Home</div>
                <p className="showcase__copy">Good morning, what's up today, and how are you tracking this week — at a glance.</p>
              </div>
            </div>
          </article>

          
          <article className="showcase__card">
            <div className="phone">
              <div className="phone__frame">
                <div className="phone__screen">
                  <div className="phone__notch"></div>
                  <div className="phone__status">
                    <span>9:41</span>
                    <div className="phone__status-icons">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                  </div>
                  <div className="phone__screen-content">
                    <div className="app-header">
                      <div className="app-avatar" style={{"background":"linear-gradient(135deg,#FFB89B,#FF7A59)"}}>T</div>
                      <div className="app-brand">My medicines</div>
                      <div className="app-icon-btn--ghost" style={{"width":"30px","height":"30px","borderRadius":"50%","border":"1px solid var(--c-line)","display":"flex","alignItems":"center","justifyContent":"center"}}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      </div>
                    </div>

                    <div className="med-hero">
                      <div className="med-hero__label">Daily progress</div>
                      <div className="med-hero__pct">75<sup>%</sup></div>
                      <div className="med-hero__sub">3 of 4 doses taken today</div>
                      <span className="med-hero__pill">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                        1 dose remaining
                      </span>
                    </div>

                    <div className="med-tabs">
                      <div className="med-tab med-tab--active">Today</div>
                      <div className="med-tab">Active</div>
                      <div className="med-tab">All</div>
                    </div>

                    <div className="med-section">
                      <div className="med-section__icon" style={{"background":"#FEF3C7","color":"#D97706"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
                      </div>
                      <span className="med-section__name">Morning</span>
                      <span className="med-section__count" style={{"background":"#FEF3C7","color":"#92400E"}}>2 meds</span>
                    </div>
                    <div className="med-card">
                      <div className="med-card__marker" style={{"background":"#10B981"}}></div>
                      <div style={{"flex":"1"}}>
                        <div className="med-card__name">Metformin</div>
                        <div className="med-card__dose">500mg · twice daily · 08:00</div>
                      </div>
                      <div className="med-card__check med-card__check--done">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                    <div className="med-card">
                      <div className="med-card__marker" style={{"background":"#0EA5E9"}}></div>
                      <div style={{"flex":"1"}}>
                        <div className="med-card__name">Atorvastatin</div>
                        <div className="med-card__dose">20mg · once daily · 09:00</div>
                      </div>
                      <div className="med-card__btn">Mark taken</div>
                    </div>

                    <div className="med-section">
                      <div className="med-section__icon" style={{"background":"#FFEDE5","color":"#E85F3D"}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 0 0-10 0M12 2v6M4.93 10.93l1.41 1.41M19.07 10.93l-1.41 1.41M2 18h2M20 18h2"/></svg>
                      </div>
                      <span className="med-section__name">Evening</span>
                      <span className="med-section__count" style={{"background":"#FFEDE5","color":"#9A3A1F"}}>1 med</span>
                    </div>
                    <div className="med-card">
                      <div className="med-card__marker" style={{"background":"#FF7A59"}}></div>
                      <div style={{"flex":"1"}}>
                        <div className="med-card__name">Aspirin</div>
                        <div className="med-card__dose">75mg · once daily · 20:00</div>
                      </div>
                      <div className="med-card__btn">Mark taken</div>
                    </div>

                    <div style={{"flex":"1"}}></div>
                    <div className="app-tabbar">
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l9-9 9 9-2 0v9h-5v-6h-4v6H5v-9H3z"/></svg>
                        Home
                      </div>
                      <div className="app-tab app-tab--active">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/></svg>
                        Meds
                      </div>
                      <div className="app-fab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Visits
                      </div>
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="showcase__caption">
              <div>
                <div className="showcase__num">02</div>
                <div className="showcase__name">Medicines</div>
                <p className="showcase__copy">Four pills, four timings, one calm plan. Skipped a dose? The schedule knows.</p>
              </div>
            </div>
          </article>

          
          <article className="showcase__card">
            <div className="phone">
              <div className="phone__frame">
                <div className="phone__screen">
                  <div className="phone__notch"></div>
                  <div className="phone__status">
                    <span>9:41</span>
                    <div className="phone__status-icons">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                  </div>
                  <div className="phone__screen-content">
                    <div className="ai-header">
                      <div className="ai-header__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.39 6.95H22l-5.81 4.22 2.22 6.83L12 16.99 5.59 20l2.22-6.83L2 8.95h7.61L12 2z"/></svg>
                      </div>
                      <div>
                        <div className="ai-header__title">AI Health Companion</div>
                        <div className="ai-header__sub">Powered by your records</div>
                      </div>
                    </div>

                    <div className="ai-chat">
                      <div className="ai-msg--user">What does my recent lipid panel mean?</div>
                      <div className="ai-msg--bot">Your total cholesterol is 240 mg/dL, above the 200 target. The LDL ("bad") is 168, also high. Given your family history of heart disease, this is worth discussing with Dr. Perera — diet changes, possibly a statin.</div>
                      <div className="ai-msg--bot" style={{"background":"transparent","padding":"0","marginTop":"6px","color":"var(--text-soft)","fontSize":"10px","fontStyle":"italic"}}>⚠ Not a substitute for medical advice. Always confirm with your doctor.</div>
                    </div>

                    <div className="app-section-label" style={{"marginTop":"8px"}}>Try asking</div>
                    <div className="ai-chips">
                      <span className="ai-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        Summarise my records
                      </span>
                      <span className="ai-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/></svg>
                        Drug check
                      </span>
                      <span className="ai-chip">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        Lab explain
                      </span>
                    </div>

                    <div style={{"flex":"1"}}></div>

                    <div className="ai-input">
                      <span>Ask anything about your health…</span>
                      <div className="ai-input__send">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="showcase__caption">
              <div>
                <div className="showcase__num">03</div>
                <div className="showcase__name">AI Companion</div>
                <p className="showcase__copy">Ask in plain English. Powered by your records — not a generic chatbot.</p>
              </div>
            </div>
          </article>

          
          <article className="showcase__card">
            <div className="phone">
              <div className="phone__frame">
                <div className="phone__screen">
                  <div className="phone__notch"></div>
                  <div className="phone__status">
                    <span>9:41</span>
                    <div className="phone__status-icons">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                    </div>
                  </div>
                  <div className="phone__screen-content">
                    <div className="app-header">
                      <div className="app-avatar" style={{"background":"linear-gradient(135deg,#FFB89B,#FF7A59)"}}>T</div>
                      <div className="app-brand">Vitals</div>
                      <div className="app-icon-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                    </div>

                    <div className="vitals-chart">
                      <div className="vitals-chart__head">
                        <div>
                          <div className="vitals-chart__title">Blood pressure</div>
                          <div className="vitals-chart__val">128 / 82 <small>mmHg</small> <span className="vitals-chart__delta vitals-chart__delta--down">▼ 4</span></div>
                        </div>
                        <div style={{"fontSize":"10px","color":"var(--text-soft)","fontFamily":"var(--font-mono)"}}>7d</div>
                      </div>
                      <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="vc1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#0EA5E9" stopOpacity="0.30"/>
                            <stop offset="1" stopColor="#0EA5E9" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,32 L20,28 L40,34 L60,24 L80,30 L100,20 L120,28 L140,18 L160,22 L180,16 L200,20 L200,60 L0,60 Z" fill="url(#vc1)"/>
                        <path d="M0,32 L20,28 L40,34 L60,24 L80,30 L100,20 L120,28 L140,18 L160,22 L180,16 L200,20" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="vitals-chart">
                      <div className="vitals-chart__head">
                        <div>
                          <div className="vitals-chart__title">Blood glucose</div>
                          <div className="vitals-chart__val">98 <small>mg/dL</small> <span className="vitals-chart__delta vitals-chart__delta--down">▼ 12</span></div>
                        </div>
                        <div style={{"fontSize":"10px","color":"var(--text-soft)","fontFamily":"var(--font-mono)"}}>7d</div>
                      </div>
                      <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="vc2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#10B981" stopOpacity="0.30"/>
                            <stop offset="1" stopColor="#10B981" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,40 L25,36 L50,42 L75,30 L100,38 L125,28 L150,32 L175,24 L200,28 L200,60 L0,60 Z" fill="url(#vc2)"/>
                        <path d="M0,40 L25,36 L50,42 L75,30 L100,38 L125,28 L150,32 L175,24 L200,28" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div className="vitals-chart">
                      <div className="vitals-chart__head">
                        <div>
                          <div className="vitals-chart__title">Weight</div>
                          <div className="vitals-chart__val">74.2 <small>kg</small></div>
                        </div>
                        <div style={{"fontSize":"10px","color":"var(--text-soft)","fontFamily":"var(--font-mono)"}}>30d</div>
                      </div>
                      <svg className="spark" viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="vc3" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#FF7A59" stopOpacity="0.30"/>
                            <stop offset="1" stopColor="#FF7A59" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,18 L25,22 L50,20 L75,26 L100,28 L125,32 L150,30 L175,34 L200,36 L200,60 L0,60 Z" fill="url(#vc3)"/>
                        <path d="M0,18 L25,22 L50,20 L75,26 L100,28 L125,32 L150,30 L175,34 L200,36" fill="none" stroke="#FF7A59" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>

                    <div style={{"flex":"1"}}></div>
                    <div className="app-tabbar">
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l9-9 9 9-2 0v9h-5v-6h-4v6H5v-9H3z"/></svg>
                        Home
                      </div>
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        Records
                      </div>
                      <div className="app-fab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                      </div>
                      <div className="app-tab">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Visits
                      </div>
                      <div className="app-tab app-tab--active">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Profile
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="showcase__caption">
              <div>
                <div className="showcase__num">04</div>
                <div className="showcase__name">Vitals</div>
                <p className="showcase__copy">Trends, not snapshots. Catch the drift before it becomes an admission.</p>
              </div>
            </div>
          </article>

        </div>
      </div>
    </div>
  </section>

  
  <section className="section" id="built-for">
    <div className="container">
      <div data-reveal>
        <span className="eyebrow">07 / Built for</span>
        <h2 className="h1" style={{"marginTop":"14px","maxWidth":"22ch"}}>
          Three doors, <span className="serif">one ecosystem.</span>
        </h2>
        <p className="lede" style={{"marginTop":"18px","maxWidth":"60ch"}}>
          MedLocker isn't a single product. It's a connected
          platform where patients, doctors and hospitals
          (coming next) can finally speak the same language.
        </p>
      </div>

      <div className="audience" style={{"marginTop":"56px"}}>
        <div className="audience__card" data-reveal>
          <div className="audience__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div className="audience__title">For you</div>
          <p className="audience__copy">
            Your full record, your medicine schedule, your family
            — all in one place, on your phone, locked behind
            your face.
          </p>
          <ul className="stack" style={{"marginTop":"18px","fontSize":"13.5px","color":"var(--text-muted)"}}>
            <li>· iOS & Android apps</li>
            <li>· Email-to-record forwarding</li>
            <li>· Trilingual (EN · සිං · த)</li>
          </ul>
        </div>

        <div className="audience__card" data-reveal>
          <div className="audience__icon" style={{"background":"#D1FAE5","color":"#059669"}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></svg>
          </div>
          <div className="audience__title">For your doctor</div>
          <p className="audience__copy">
            A separate doctor portal — same records, structured
            properly. SLMC-verified, with a real inbox, e-Rx,
            and patient context that travels with the patient.
          </p>
          <ul className="stack" style={{"marginTop":"18px","fontSize":"13.5px","color":"var(--text-muted)"}}>
            <li>· Patient context on every visit</li>
            <li>· Digital prescriptions (e-Rx)</li>
            <li>· Care-team membership</li>
          </ul>
        </div>

        <div className="audience__card audience__card--soon" data-reveal>
          <span className="audience__soon-tag">Phase 2 · Q4 '25</span>
          <div className="audience__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8l9-5 9 5v13M9 21V12h6v9"/></svg>
          </div>
          <div className="audience__title">For hospitals</div>
          <p className="audience__copy">
            A ward-level dashboard, doctor rosters, and
            laboratory logins — so a discharge summary from
            Asiri Central lives next to a script from your
            GP, and you don't repeat your story twice.
          </p>
          <ul className="stack" style={{"marginTop":"18px","fontSize":"13.5px","color":"rgba(255,255,255,0.6)"}}>
            <li>· Hospital portal</li>
            <li>· Lab &amp; radiology logins</li>
            <li>· Ward handoff notes</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--cream">
    <div className="container">
      <div className="row row--between" style={{"alignItems":"flex-end","marginBottom":"48px"}} data-reveal>
        <div>
          <span className="eyebrow">08 / How it works</span>
          <h2 className="h1" style={{"marginTop":"14px","maxWidth":"18ch"}}>
            Three minutes from <span className="serif">install</span> to actually using it.
          </h2>
        </div>
        <p className="lede" style={{"maxWidth":"36ch"}}>
          We hate onboarding flows too. So we built one that asks
          you for the bare minimum — and gets out of your way.
        </p>
      </div>

      <div className="steps" data-reveal>
        <div className="step">
          <div className="step__num">— Step 1</div>
          <div className="step__title">Install & sign in</div>
          <p className="step__copy">
            Phone number, no email. We send a six-digit code. You
            set a Face ID lock. Done in 90 seconds.
          </p>
        </div>
        <div className="step">
          <div className="step__num">— Step 2</div>
          <div className="step__title">Add your first med or record</div>
          <p className="step__copy">
            Snap a photo of a script, or forward a lab PDF to your
            private alias. The app does the rest — parsing, sorting,
            reminding.
          </p>
        </div>
        <div className="step">
          <div className="step__num">— Step 3</div>
          <div className="step__title">Invite who you trust</div>
          <p className="step__copy">
            Family members, your GP, your cardiologist. Each one
            gets scoped access — and you can revoke it in one tap.
          </p>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--cream" id="reminder">
    <div className="container container--narrow">
      <div className="text-center" data-reveal>
        <span className="eyebrow" style={{"justifyContent":"center"}}>09 / The reminder</span>
        <h2 className="h1" style={{"marginTop":"14px","maxWidth":"22ch","marginLeft":"auto","marginRight":"auto"}}>
          It <span className="serif">nudges</span> — it never nags.
        </h2>
        <p className="lede" style={{"margin":"18px auto 0","maxWidth":"56ch"}}>
          One ping. One tap. No streak guilt, no confetti, no
          "don't break your 47-day streak!". Just the next thing.
        </p>
      </div>

      <div className="notif-demo" data-reveal>
        <button className="notif-trigger" data-notif-trigger data-magnetic>
          <span className="pulse"></span>
          Trigger dose reminder
        </button>

        <div className="notif-phone">
          <div className="notif-phone__screen">
            <div className="notif-phone__notch"></div>
            <div className="notif-phone__time" data-lock-time>08:30</div>
            <div className="notif-phone__content">
              <div className="notif-phone__lock">
                <div className="notif-phone__lock-date" data-lock-date>Saturday, July 4</div>
                <div className="notif-phone__lock-time">08:30</div>
                <div className="notif-phone__lock-sub">Saturday, July 4</div>
              </div>
            </div>
            <div className="notif-phone__notif" data-notif-toast>
              <div className="notif-phone__notif-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3 14a4.95 4.95 0 0 0 7 7l3-3"/><path d="M8.5 8.5l7 7"/></svg>
              </div>
              <div className="notif-phone__notif-body">
                <div className="notif-phone__notif-head">
                  MedLocker <span className="notif-phone__notif-time">now</span>
                </div>
                <div className="notif-phone__notif-title">Time for your Metformin 500mg</div>
                <div className="notif-phone__notif-msg">With breakfast · 1 of 2 today</div>
              </div>
            </div>
            <div className="notif-phone__hint">↑ Tap the button above</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--ink" id="security">
    <div className="container">
      <div data-reveal>
        <span className="eyebrow" style={{"color":"#7DD3FC"}}>10 / Trust</span>
        <h2 className="h1" style={{"marginTop":"14px","color":"#fff","maxWidth":"22ch"}}>
          Private isn't a feature. <span className="serif" style={{"color":"#7DD3FC"}}>It's the foundation.</span>
        </h2>
        <p className="lede" style={{"marginTop":"18px","color":"rgba(255,255,255,0.7)","maxWidth":"56ch"}}>
          Your medical record is the most personal data you have.
          Here's exactly how we keep it that way.
        </p>
      </div>

      
      <div className="map" data-reveal data-map>
        <div className="map__compass" aria-hidden="true">N<br/>·<br/>↑</div>
        <div className="map__corner-pin map__corner-pin--tl">EDGES · 5 REGIONS · LIVE</div>
        <div className="map__corner-pin map__corner-pin--br">UPDATED 04 / 07 / 26 · 16:42 SL</div>
        <svg className="map__svg" viewBox="0 0 1000 500" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#0EA5E9" stopOpacity="0.55"/>
              <stop offset="1" stopColor="#0EA5E9" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="mapPath" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#7DD3FC" stopOpacity="0.2"/>
              <stop offset="0.5" stopColor="#7DD3FC" stopOpacity="1"/>
              <stop offset="1" stopColor="#FF7A59" stopOpacity="0.9"/>
            </linearGradient>
          </defs>
          
          <g className="map__continents" fill="rgba(125,211,252,0.07)" stroke="rgba(125,211,252,0.18)" strokeWidth="0.8">
            
            <path d="M60 90 Q 90 60 180 70 Q 260 80 290 130 Q 270 200 230 230 Q 150 240 90 210 Q 50 160 60 90 Z" />
            
            <path d="M210 270 Q 250 260 270 300 Q 280 380 250 430 Q 220 450 200 410 Q 190 340 210 270 Z" />
            
            <path d="M450 80 Q 510 70 540 100 Q 550 140 510 160 Q 470 165 450 130 Z" />
            
            <path d="M470 200 Q 530 195 555 240 Q 560 320 530 380 Q 495 410 470 370 Q 455 290 470 200 Z" />
            
            <path d="M570 80 Q 720 70 820 130 Q 850 200 800 240 Q 700 250 600 220 Q 560 160 570 80 Z" />
            
            <path d="M650 220 Q 690 220 700 270 Q 690 310 660 310 Q 640 280 650 220 Z" />
            
            <path d="M780 260 Q 830 260 850 290 Q 830 310 790 305 Q 770 290 780 260 Z" />
            
            <path d="M820 360 Q 880 350 910 380 Q 900 420 850 420 Q 810 410 820 360 Z" />
            
            <path d="M438 105 Q 452 100 455 120 Q 445 130 435 125 Z" />
          </g>

          
          <g className="map__grid" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" fill="none">
            <line x1="40" y1="100" x2="960" y2="100"/>
            <line x1="40" y1="200" x2="960" y2="200"/>
            <line x1="40" y1="300" x2="960" y2="300"/>
            <line x1="40" y1="400" x2="960" y2="400"/>
            <line x1="200" y1="60" x2="200" y2="460"/>
            <line x1="400" y1="60" x2="400" y2="460"/>
            <line x1="600" y1="60" x2="600" y2="460"/>
            <line x1="800" y1="60" x2="800" y2="460"/>
          </g>

          
          <g className="map__paths" fill="none" stroke="url(#mapPath)" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="4 4">
            
            <path d="M670 290 Q 660 270 640 250" data-path-draw/>
            
            <path d="M670 290 Q 740 295 790 305" data-path-draw/>
            
            <path d="M670 290 Q 620 260 570 230" data-path-draw/>
            
            <path d="M670 290 Q 800 230 880 175" data-path-draw/>
            
            <path d="M670 290 Q 540 200 445 115" data-path-draw/>
          </g>

          
          <g className="map__endpoints">
            
            <circle cx="670" cy="290" r="9" fill="rgba(255,122,89,0.18)"/>
            <circle cx="670" cy="290" r="5" fill="#FF7A59"/>
            <circle className="map__pulse" cx="670" cy="290" r="5" fill="#FF7A59"/>
            <text x="682" y="306" fill="rgba(255,255,255,0.85)" fontFamily="JetBrains Mono, monospace" fontSize="10" letterSpacing="1.5">COLOMBO</text>

            
            <g className="map__ep"><circle cx="640" cy="250" r="3" fill="#7DD3FC"/></g>
            
            <g className="map__ep"><circle cx="790" cy="305" r="3" fill="#7DD3FC"/></g>
            
            <g className="map__ep"><circle cx="570" cy="230" r="3" fill="#7DD3FC"/></g>
            
            <g className="map__ep"><circle cx="880" cy="175" r="3" fill="#7DD3FC"/></g>
            
            <g className="map__ep"><circle cx="445" cy="115" r="3" fill="#7DD3FC"/></g>
          </g>

          
          <g className="map__pulses" fill="none" stroke="#7DD3FC" strokeWidth="1.4">
            <circle cx="640" cy="250" r="3" className="map__pulse-ring" style={{"--d":"0s"}}/>
            <circle cx="790" cy="305" r="3" className="map__pulse-ring" style={{"--d":"0.6s"}}/>
            <circle cx="570" cy="230" r="3" className="map__pulse-ring" style={{"--d":"1.2s"}}/>
            <circle cx="880" cy="175" r="3" className="map__pulse-ring" style={{"--d":"1.8s"}}/>
            <circle cx="445" cy="115" r="3" className="map__pulse-ring" style={{"--d":"2.4s"}}/>
          </g>

          
          <g className="map__labels" fill="rgba(255,255,255,0.55)" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1.2">
            <text x="650" y="244">BOM</text>
            <text x="800" y="299">SIN</text>
            <text x="580" y="224">DXB</text>
            <text x="890" y="169">TYO</text>
            <text x="455" y="109">LHR</text>
          </g>
        </svg>

        <div className="map__legend">
          <div className="map__legend-row">
            <span className="map__dot map__dot--coral"></span>
            <span>HQ · Colombo, Sri Lanka</span>
          </div>
          <div className="map__legend-row">
            <span className="map__dot map__dot--sky"></span>
            <span>5 regional hospitals syncing this week</span>
          </div>
          <div className="map__legend-row">
            <span className="map__dot map__dot--line"></span>
            <span>TLS 1.3, never stored unencrypted</span>
          </div>
        </div>
      </div>

      <div className="security-grid" style={{"marginTop":"56px"}} data-reveal>
        <div className="security-item">
          <div className="security-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div className="security-item__title">Biometric lock</div>
            <p className="security-item__copy">
              Face ID and fingerprint unlock the app. Your
              medical record never leaves the device unencrypted.
            </p>
          </div>
        </div>
        <div className="security-item">
          <div className="security-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div className="security-item__title">TLS 1.3, at rest</div>
            <p className="security-item__copy">
              Everything in transit is TLS 1.3. At rest, AES-256.
              Backups are encrypted with keys only we don't hold.
            </p>
          </div>
        </div>
        <div className="security-item">
          <div className="security-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div>
            <div className="security-item__title">We never sell. Never train on.</div>
            <p className="security-item__copy">
              Your records are not a product. We don't sell them,
              share them, or use them to train models without
              your explicit opt-in.
            </p>
          </div>
        </div>
        <div className="security-item">
          <div className="security-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
          </div>
          <div>
            <div className="security-item__title">Scoped sharing</div>
            <p className="security-item__copy">
              Invite your doctor, share only the records you
              choose. Revoke in one tap. No long email threads
              with PDFs.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section section--paper">
    <div className="container">
      <div data-reveal>
        <span className="eyebrow">11 / Field notes</span>
        <h2 className="h1" style={{"marginTop":"14px","maxWidth":"18ch"}}>
          Pinned to the <span className="serif">office wall.</span>
        </h2>
        <p className="lede" style={{"marginTop":"18px","maxWidth":"60ch"}}>
          The kind of feedback we read aloud in standup.
          Hover any note to flatten it.
        </p>
      </div>

      <div className="notes-board" data-reveal>
        <article className="note note--yellow">
          <span className="note__pin" style={{"left":"24px"}}></span>
          <div className="note__text">
            "I used to spend the first ten minutes of every consult
            asking 'where's your last blood report?'. Now the patient
            just shows me the timeline. We talk about treatment instead."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Dr. Shanika</span>
            · GP, Nugegoda · 14 yrs
          </div>
        </article>

        <article className="note note--pink">
          <span className="note__pin" style={{"left":"50%"}}></span>
          <div className="note__text">
            "Amma's BP ring. I'm in Singapore and the morning ping is the
            only reason I sleep."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Ruvini A.</span>
            · daughter
          </div>
        </article>

        <article className="note note--blue">
          <span className="note__pin" style={{"left":"30%"}}></span>
          <div className="note__text">
            "Explained my lipid panel in 30 seconds
            better than the doctor did in 15 minutes."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Mifraz K.</span>
            · beta tester, Colombo 7
          </div>
        </article>

        <article className="note note--green">
          <span className="note__pin" style={{"right":"24px","left":"auto"}}></span>
          <div className="note__text">
            "I ran a 3-clinic trial. Patients
            stopped losing their paper scripts
            by week two. That's never happened."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Dr. Nimal</span>
            · physician network, Kandy
          </div>
        </article>

        <article className="note note--coral">
          <span className="note__pin" style={{"left":"40%"}}></span>
          <div className="note__text">
            "Finally, an app for my parents that doesn't
            look like it's screaming at them. Just
            quiet, sensible, well-made."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Ishara W.</span>
            · Colombo 5
          </div>
        </article>

        <article className="note note--cream">
          <span className="note__pin" style={{"left":"50%","transform":"translateX(-50%)"}}></span>
          <div className="note__text">
            "The dose ring. I'm weirdly proud of it."
          </div>
          <div className="note__sig">
            <span className="note__sig-name">Sanjay</span>
            · engineer
          </div>
        </article>
      </div>
    </div>
  </section>

  
  <section className="section" id="faq">
    <div className="container container--narrow">
      <div data-reveal>
        <span className="eyebrow">12 / FAQ</span>
        <h2 className="h1" style={{"marginTop":"14px","maxWidth":"18ch"}}>
          Questions we get <span className="serif">early.</span>
        </h2>
      </div>

      <div className="faq" style={{"marginTop":"48px"}} data-reveal>
        <div className="faq__item">
          <button className="faq__q">Is MedLocker free?</button>
          <div className="faq__a"><div className="faq__a-inner">
            The patient app is free, with no ads and no in-app
            purchases. The doctor and hospital portals are
            subscription-based — pricing is set per practice and
            not per patient, so your care team never has a reason
            to gatekeep.
          </div></div>
        </div>
        <div className="faq__item">
          <button className="faq__q">Where is my data stored?</button>
          <div className="faq__a"><div className="faq__a-inner">
            Records are stored encrypted in Cloudflare's data
            centres. We use D1 (Cloudflare's SQLite-compatible
            database) and R2 for files. Backups are encrypted
            with keys we do not hold.
          </div></div>
        </div>
        <div className="faq__item">
          <button className="faq__q">Do I need to be a doctor to sign up?</button>
          <div className="faq__a"><div className="faq__a-inner">
            No. Anyone with a phone number can install the patient
            app. Doctors, labs and hospitals get separate login
            portals — doctors are SLMC-verified, hospitals and
            labs go through a short onboarding.
          </div></div>
        </div>
        <div className="faq__item">
          <button className="faq__q">When does the hospital portal launch?</button>
          <div className="faq__a"><div className="faq__a-inner">
            Phase 2 ships in Q4 2025. If your hospital or lab
            would like to be a launch partner, write to us at
            <a href="mailto:partners@healthhub.app" style={{"color":"var(--c-sky-700)","textDecoration":"underline","textUnderlineOffset":"3px"}}>partners@healthhub.app</a>.
          </div></div>
        </div>
        <div className="faq__item">
          <button className="faq__q">Is it available outside Sri Lanka?</button>
          <div className="faq__a"><div className="faq__a-inner">
            Today, the app is optimised for Sri Lanka — local
            doctors, local languages, local payment patterns.
            We're starting where we are. Other markets are a
            conversation for a later phase.
          </div></div>
        </div>
        <div className="faq__item">
          <button className="faq__q">Can I export my data?</button>
          <div className="faq__a"><div className="faq__a-inner">
            Yes. From Profile → Export, you can download everything
            as a structured PDF or JSON. You own the data, not us.
          </div></div>
        </div>
      </div>
    </div>
  </section>

  
  <section className="section" id="waitlist">
    <div className="container">
      <div className="cta" data-reveal>
        <div>
          <span className="pill">
            <span className="pill__dot"></span>
            Limited private beta · 1,000 spots
          </span>
          <h2 className="cta__title">
            Get on the list.<br />
            <span className="serif" style={{"color":"#7DD3FC"}}>We'll do the rest.</span>
          </h2>
          <p className="cta__copy">
            We're letting in 1,000 people, slowly, so we can
            actually listen. Drop your email and we'll send
            your invite as soon as a slot opens.
          </p>
        </div>

        <div className="cta__form-wrap">
          <form className="cta__form" data-waitlist-form action="https://api.healthhub.app/waitlist" method="post">
            <input type="email" name="email" placeholder="you@email.com" required aria-label="Email address" />
            <select name="role" aria-label="I am a" style={{"background":"transparent","border":"0","color":"rgba(255,255,255,0.55)","fontSize":"13px","padding":"0 4px"}}>
              <option value="patient">I'm a patient</option>
              <option value="doctor">I'm a doctor</option>
              <option value="hospital">I run a hospital / lab</option>
            </select>
            <span className="cta__submit-wrap">
              <svg className="cta__burst" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(125,211,252,0.6)" strokeWidth="2" strokeDasharray="264" strokeDashoffset="264"/>
              </svg>
              <button className="btn btn--sky" type="submit">Join</button>
            </span>
          </form>
          <div className="cta__form-meta" data-waitlist-meta>
            <span className="cta__form-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              No spam, ever.
            </span>
            <span className="cta__form-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
              One email when your slot opens.
            </span>
          </div>
          <div className="cta__success" data-waitlist-success>
            <svg className="cta__check" viewBox="0 0 52 52" aria-hidden="true">
              <circle className="cta__check-circle" cx="26" cy="26" r="22" fill="none" stroke="#6EE7B7" strokeWidth="2.5"/>
              <path className="cta__check-path" d="M14 27 l 8 8 l 16 -18" fill="none" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <strong>You're on the list.</strong> We'll email
            <span style={{"opacity":".8"}}>you</span> the moment a slot opens.
            Until then, take care of yourself.
          </div>
        </div>
      </div>
    </div>
  </section>

  
  <footer className="footer">
    <div className="container">
      <div className="footer__noise" aria-hidden="true"></div>
      <div className="footer__top">
        <div className="footer__brand">
          <div className="footer__mark" data-reveal>
            <span className="footer__mark-row" data-text="MedLocker"></span>
            <span className="footer__mark-rule"></span>
          </div>
          <p className="footer__tag" data-reveal>
            A private, beautifully designed health companion.
            Built quietly in Colombo, Sri Lanka. © 2026
            Healthhub (Pvt) Ltd.
          </p>
        </div>
        <div className="footer__col">
          <h4>Product</h4>
          <ul>
            <li><a href="#features">Features</a></li>
            <li><a href="#tour">The app</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4>For clinicians</h4>
          <ul>
            <li><a href="https://app.healthhub.app/doctor" rel="noopener">Doctor portal</a></li>
            <li><Link href="/login">Hospital portal</Link></li>
            <li><a href="mailto:partners@healthhub.app">Become a launch partner</a></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4>Company</h4>
          <ul>
            <li><a href="mailto:hello@healthhub.app">hello@healthhub.app</a></li>
            <li>
              <a
                href={
                  process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE
                    ? `https://wa.me/${process.env.NEXT_PUBLIC_WA_SUPPORT_PHONE}?text=${encodeURIComponent("Hi HealthHub, ")}`
                    : "https://wa.me/94771234567?text=Hi%20HealthHub%2C%20"
                }
                rel="noopener"
                target="_blank"
              >
                Chat on WhatsApp
              </a>
            </li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
            <li><Link href="/login">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer__rule" aria-hidden="true"></div>
      <div className="footer__strip" aria-label="Status">
        <div className="footer__strip-item">
          <span className="footer__strip-dot footer__strip-dot--ok"></span>
          <span className="footer__strip-key">status</span>
          <span className="footer__strip-val">all systems operational</span>
        </div>
        <div className="footer__strip-item">
          <span className="footer__strip-key">uptime · 90d</span>
          <span className="footer__strip-val">99.97%</span>
        </div>
        <div className="footer__strip-item">
          <span className="footer__strip-key">last deploy</span>
          <span className="footer__strip-val">04 Jul 2026 · 16:42 SL</span>
        </div>
        <div className="footer__strip-item">
          <span className="footer__strip-key">build</span>
          <span className="footer__strip-val">v1.0.42 · commit 7f3a9c</span>
        </div>
      </div>
      <div className="footer__bottom">
        <div className="footer__bottom-meta">
          <span className="footer__flag">🇱🇰</span>
          <span>Built in Colombo with proper tea · v1.0 · Last updated 4 Jul 2026</span>
        </div>
        <div className="footer__bottom-meta footer__bottom-meta--right">
          Made with care, not algorithms.
        </div>
      </div>
    </div>
  </footer>

  
  <div className="scroll-progress" aria-hidden="true">
    <div className="scroll-progress__bar">
      <div className="scroll-progress__fill"></div>
    </div>
    <div className="scroll-progress__pct">0%</div>
  </div>
    </>
  );
}
