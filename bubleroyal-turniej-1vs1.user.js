// ==UserScript==
// @name         BubleRoyal - Auto Turniej 1vs1 (pętla, mobile)
// @namespace    arditu
// @version      1.5
// @description  Klawisz T / ikona: petla Turniej -> Play -> 1 vs 1 -> Start (auto) + auto odswiezanie. Dziala tez na Firefox Android (poprawka podwojnego dotyku) + ikonka czasu (odliczanie do odswiezenia) + Wake Lock.
// @match        *://bubleroyal.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(function(){
  'use strict';

  // ===== USTAWIENIA =====
  const REFRESH_TIME = 8000; // 8000ms = 8 sekund
  const MAX_FAILS = 6;       // po tylu nieudanych próbach pętla sama się zatrzyma

  // ===== KLUCZE PAMIĘCI (przetrwają przeładowanie strony) =====
  const LOOP_KEY = 'turLoopActive';
  const FAIL_KEY = 'turLoopFails';
  const NEXT_KEY = 'turLoopNextReload'; // znacznik czasu kolejnego odświeżenia (mobile)

  // ---- stan pętli ----
  const isLooping = () => localStorage.getItem(LOOP_KEY) === '1';

  const setLooping = on => {
    if(on) localStorage.setItem(LOOP_KEY, '1');
    else   localStorage.removeItem(LOOP_KEY);
  };

  let reloadTimer = null;

  // ---- pomocnicze ----
  const vis = el => !!(el && (el.offsetParent || el.offsetWidth || el.offsetHeight));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function waitFor(sel, timeout = 3000){
    const t0 = Date.now();

    while(Date.now() - t0 < timeout){
      const el = (typeof sel === 'function') ? sel() : document.querySelector(sel);

      if(vis(el)) return el;

      await wait(80);
    }

    return null;
  }

  function toast(msg, col){
    let d = document.getElementById('turToast');

    if(!d){
      d = document.createElement('div');
      d.id = 'turToast';
      d.style.cssText =
        'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;' +
        'background:#111;color:#fff;font:bold 14px monospace;padding:8px 16px;border-radius:8px;' +
        'border:1px solid #444;box-shadow:0 2px 10px rgba(0,0,0,.5);max-width:90vw;text-align:center';

      document.body.appendChild(d);
    }

    d.style.color = col || '#fff';
    d.textContent = msg;

    clearTimeout(d._t);

    d._t = setTimeout(() => {
      d.style.opacity = '0';
      d.style.transition = 'opacity .6s';
    }, 2500);

    d.style.opacity = '1';
  }

  // ===== WAKE LOCK (utrzymanie wlaczonego ekranu na telefonie) =====
  let wakeLock = null;

  async function requestWakeLock(){
    try{
      if(!('wakeLock' in navigator)) return;       // brak wsparcia (np. http / stara przeglądarka)
      if(!isLooping()) return;
      if(document.visibilityState !== 'visible') return;
      if(wakeLock) return;

      wakeLock = await navigator.wakeLock.request('screen');

      if(wakeLock && wakeLock.addEventListener){
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    }catch(e){
      // odmowa lub brak wsparcia – pętla i tak działa, gdy ekran jest aktywny
    }
  }

  function releaseWakeLock(){
    try{ if(wakeLock) wakeLock.release(); }catch(e){}
    wakeLock = null;
  }

  // ===== ODSWIEZANIE (z nadrabianiem po powrocie do karty) =====
  function scheduleReload(){
    clearTimeout(reloadTimer);
    localStorage.setItem(NEXT_KEY, String(Date.now() + REFRESH_TIME));
    reloadTimer = setTimeout(doReload, REFRESH_TIME);
  }

  function doReload(){
    clearTimeout(reloadTimer);
    localStorage.removeItem(NEXT_KEY);
    location.reload();
  }

  // ---- licznik nieudanych prób (zabezpieczenie przed wiecznym odświeżaniem) ----
  function loopFail(){
    if(!isLooping()) return;

    const n = (parseInt(localStorage.getItem(FAIL_KEY) || '0', 10) || 0) + 1;
    localStorage.setItem(FAIL_KEY, String(n));

    if(n >= MAX_FAILS){
      stopLoop();
      toast(`Pętla zatrzymana po ${MAX_FAILS} nieudanych próbach`, '#f55');
    }
  }

  // ---- główny flow ----
  let busy = false;

  async function enterTurniej(){
    if(busy) return;

    busy = true;

    let started = false;

    try{

      // 1) wybór trybu Turniej
      const gm = await waitFor('#gamemode', 5000);

      if(!gm){
        toast('Brak #gamemode (zaloguj się / odśwież)', '#f55');
        loopFail();
        return;
      }

      const opt = [...gm.options].find(o =>
        /turniej/i.test(o.textContent)
      );

      if(!opt){
        toast('Brak opcji Turniej (musisz być zalogowany)', '#f55');
        loopFail();
        return;
      }

      gm.value = opt.value;
      gm.dispatchEvent(new Event('change', { bubbles:true }));

      toast('Tryb: Turniej...', '#5cf');

      await wait(250);

      // 2) Play
      const play = await waitFor('#mode2', 2500);

      if(!play){
        toast('Nie znalazłem przycisku Play (#mode2)', '#f55');
        loopFail();
        return;
      }

      play.click();

      await wait(150);

      // 3) 1 vs 1
      const oneVone = await waitFor(() => {
        return [...document.querySelectorAll('.back-end.box, .box')]
          .find(e =>
            vis(e) &&
            /1\s*vs?\s*1/i.test(e.textContent || '')
          );
      }, 2500);

      if(!oneVone){
        toast('Nie znalazłem przycisku 1 vs 1', '#f55');
        loopFail();
        return;
      }

      oneVone.click();

      await wait(150);

      // 4) Start
      const start =
        await waitFor('#start button.btn-primary.mono', 2500)
        || await waitFor(() =>
          [...document.querySelectorAll('button')]
            .find(b =>
              vis(b) &&
              /^start$/i.test((b.textContent || '').trim())
            ),
          1500
        );

      if(!start){
        toast('Okno otwarte, ale brak przycisku Start', '#fa3');
        loopFail();
        return;
      }

      start.click();
      started = true;

      // sukces -> zerujemy licznik błędów
      localStorage.removeItem(FAIL_KEY);

      toast(
        isLooping()
          ? `START! Pętla – odświeżenie za ${REFRESH_TIME / 1000}s`
          : `START! Odświeżenie za ${REFRESH_TIME / 1000}s`,
        '#5f5'
      );

    } finally {

      // ===== AUTO ODŚWIEŻANIE W PĘTLI =====
      // Dopóki pętla jest aktywna, po każdym przejściu (lub nieudanej próbie)
      // planujemy odświeżenie. Po przeładowaniu skrypt sam rusza od nowa.
      if(isLooping()){
        scheduleReload();
      } else if(started){
        // pojedyncze uruchomienie (gdyby pętla była wyłączona) – jak w oryginale
        setTimeout(() => location.reload(), REFRESH_TIME);
      }

      setTimeout(() => {
        busy = false;
      }, 1200);

    }
  }

  // ---- sterowanie pętlą ----
  function startLoop(){
    setLooping(true);
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(NEXT_KEY);
    requestWakeLock();
    updateIcon();
    toast('Pętla turnieju: START', '#5f5');
    enterTurniej();
  }

  function stopLoop(){
    setLooping(false);
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(NEXT_KEY);
    clearTimeout(reloadTimer);
    releaseWakeLock();
    updateIcon();
    toast('Pętla turnieju: STOP', '#fa3');
  }

  function toggleLoop(){
    if(isLooping()) stopLoop();
    else            startLoop();
  }

  // ---- ikonka ----
  function updateIcon(){
    const b = document.getElementById('turIcon');

    if(!b) return;

    const on = isLooping();

    b.style.background = on
      ? 'linear-gradient(#2a2,#070)'
      : 'linear-gradient(#e23,#a10)';

    b.style.borderColor = on ? '#7f7' : '#fff6';

    const glyph = document.getElementById('turGlyph');

    if(glyph) glyph.textContent = on ? '🔁' : '🏆';

    b.title = on
      ? 'Pętla turnieju 1vs1: WŁĄCZONA – dotknij / T aby zatrzymać'
      : 'Pętla turnieju 1vs1: wyłączona – dotknij / T aby włączyć';

    updateTimer();
  }

  // ---- ikonka czasu (odliczanie do odświeżenia) ----
  function updateTimer(){
    const t = document.getElementById('turTimer');

    if(!t) return;

    const on = isLooping();

    let secs;

    if(on){
      const next = parseInt(localStorage.getItem(NEXT_KEY) || '0', 10);

      secs = next
        ? Math.max(0, Math.ceil((next - Date.now()) / 1000))
        : Math.ceil(REFRESH_TIME / 1000); // jeszcze nie zaplanowano (trwa wejście do gry)
    } else {
      secs = Math.ceil(REFRESH_TIME / 1000);
    }

    t.textContent = '⏱' + secs + 's';
    t.style.background = on ? '#070' : '#a10';
    t.style.borderColor = on ? '#7f7' : '#fff6';
  }

  function makeIcon(){

    if(document.getElementById('turIcon')) return;

    const b = document.createElement('div');

    b.id = 'turIcon';
    b.title = 'Wejdź do turnieju 1vs1';

    b.style.cssText =
      'position:fixed;left:14px;top:160px;z-index:999998;' +
      'width:48px;height:48px;display:flex;align-items:center;justify-content:center;' +
      'font-size:26px;background:linear-gradient(#e23,#a10);' +
      'border-radius:12px;border:2px solid #fff6;' +
      'box-shadow:0 3px 10px rgba(0,0,0,.5);cursor:pointer;user-select:none;' +
      '-webkit-user-select:none;touch-action:none';

    // symbol (puchar / pętla) – osobny element, żeby odliczanie czasu go nie kasowało
    const glyph = document.createElement('span');
    glyph.id = 'turGlyph';
    glyph.textContent = '🏆';
    glyph.style.cssText = 'pointer-events:none;line-height:1';
    b.appendChild(glyph);

    // ikonka czasu – odliczanie sekund do odświeżenia (pod ikoną, jedzie razem z nią)
    const timer = document.createElement('span');
    timer.id = 'turTimer';
    timer.style.cssText =
      'position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:5px;' +
      'font:bold 12px monospace;color:#fff;background:#a10;' +
      'padding:2px 6px;border-radius:8px;border:1px solid #fff6;' +
      'box-shadow:0 2px 6px rgba(0,0,0,.5);pointer-events:none;white-space:nowrap';
    b.appendChild(timer);

    let moved = false;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    let dragging = false;

    const startDrag = (x, y) => {
      dragging = true;
      moved = false;
      sx = x;
      sy = y;

      const r = b.getBoundingClientRect();

      ox = r.left;
      oy = r.top;
    };

    const moveDrag = (x, y) => {
      if(!dragging) return;

      const dx = x - sx;
      const dy = y - sy;

      if(Math.abs(dx) + Math.abs(dy) > 6){
        moved = true;
      }

      // trzymamy ikonę w widocznym obszarze ekranu
      const maxX = window.innerWidth - b.offsetWidth;
      const maxY = window.innerHeight - b.offsetHeight;

      b.style.left = Math.max(0, Math.min(maxX, ox + dx)) + 'px';
      b.style.top = Math.max(0, Math.min(maxY, oy + dy)) + 'px';
      b.style.right = 'auto';
    };

    const endDrag = () => {
      if(!dragging) return;

      dragging = false;

      if(!moved){
        toggleLoop();
      }
    };

    // Na urządzeniach dotykowych przeglądarka po dotyku wywołuje JESZCZE
    // emulowane zdarzenia myszy (mousedown/mouseup). Bez tej flagi jedno
    // dotknięcie przełączało pętlę DWA razy (włącz -> od razu wyłącz),
    // przez co na telefonie ikona "nie zmieniała się" i pętla nie ruszała.
    let touchMode = false;

    // ---- DOTYK ----
    b.addEventListener('touchstart', e => {
      touchMode = true;
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    }, { passive:true });

    b.addEventListener('touchmove', e => {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive:true });

    b.addEventListener('touchend', e => {
      // blokujemy emulowane zdarzenia myszy / click po dotyku
      if(e.cancelable) e.preventDefault();
      endDrag();
    }, { passive:false });

    b.addEventListener('touchcancel', endDrag);

    // ---- MYSZ (pomijana na urządzeniach dotykowych) ----
    b.addEventListener('mousedown', e => {
      if(touchMode) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    });

    window.addEventListener('mousemove', e => {
      if(touchMode) return;
      moveDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if(touchMode) return;
      endDrag();
    });

    document.body.appendChild(b);

    updateIcon();

    // żywe odliczanie na ikonce czasu
    clearInterval(window.__turTimerInt);
    window.__turTimerInt = setInterval(updateTimer, 250);
  }

  // ---- klawisz T (zgodnie z opisem skryptu; przyda się z klawiaturą BT) ----
  window.addEventListener('keydown', e => {
    if(e.key !== 't' && e.key !== 'T') return;

    const el = document.activeElement;

    const typing = el && (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable
    );

    if(typing) return;

    toggleLoop();
  });

  // ---- powrót do karty / wybudzenie ekranu: nadrabiamy odświeżenie i wake lock ----
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState !== 'visible') return;
    if(!isLooping()) return;

    requestWakeLock();

    const next = parseInt(localStorage.getItem(NEXT_KEY) || '0', 10);

    // jeśli odświeżenie "zaległo" (karta była w tle / ekran zgaszony) – robimy je teraz
    if(next && Date.now() >= next){
      doReload();
    }
  });

  // ---- start / wznowienie po przeładowaniu ----
  function init(){
    makeIcon();

    if(isLooping()){
      localStorage.removeItem(NEXT_KEY); // świeży obieg – kasujemy zaległy znacznik
      requestWakeLock();
      toast('Pętla turnieju aktywna…', '#5cf');

      // dajemy stronie chwilę po przeładowaniu, potem kolejny obieg
      setTimeout(enterTurniej, 800);
    }
  }

  if(document.body){
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

  console.log(
    '%c[Turniej 1vs1] gotowe - dotknij ikonę 🏆 lub wciśnij T (pętla, mobile-friendly)',
    'color:#5f5'
  );

})();
