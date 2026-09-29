// ==UserScript==
// @name         Lucky Jet Frame Test
// @namespace    https://github.com/GBAOPAMIRES-rgb/-jetLucky1_bot
// @version      1.0.0
// @description  Diagnostic only: confirms whether Userscripts runs in the Lucky Jet page or iframe.
// @match        https://1wmljx.life/*
// @match        https://1play.gamedev-tech.cc/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  const isFrame = window.top !== window;
  const message = isFrame
    ? 'Lucky Jet: SCRIPT RUNNING IN FRAME'
    : 'Lucky Jet: SCRIPT RUNNING IN MAIN PAGE';

  function show() {
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', show, { once: true });
      return;
    }
    if (document.getElementById('lucky-jet-userscript-test')) return;
    const box = document.createElement('div');
    box.id = 'lucky-jet-userscript-test';
    box.textContent = message;
    box.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2147483647;background:#111;color:#0f0;padding:10px;font:14px Arial;border:2px solid #0f0;border-radius:8px';
    document.documentElement.appendChild(box);
  }
  show();
})();
