/* Lucky Jet read-only browser bridge helper.
   Run only on the official Lucky Jet page you are already authorized to view.
   It reads visible multiplier text from the DOM; it does not read cookies,
   localStorage, tokens, SSID, passwords, or place bets.
*/
(() => {
  const TOKEN = window.__LUCKYJET_BRIDGE_TOKEN__;
  const ENDPOINT = "https://jetlucky1.onrender.com/api/luckyjet-browser-event-bridge";
  if (!TOKEN) {
    console.error("Lucky Jet bridge: temporary bridge token is missing.");
    return;
  }

  const sent = new Set();
  const normalize = v => String(v || "").replace(",", ".").trim();
  const isCoeff = v => {
    const m = normalize(v).match(/^(?:x\s*)?(\d+(?:\.\d+)?)\s*x?$/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : null;
  };

  async function send(n, event) {
    const key = n + "|" + event;
    if (sent.has(key)) return;
    sent.add(key);
    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "X-LuckyJet-Bridge-Token": TOKEN
        },
        body: JSON.stringify({ coefficient: n, event })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) console.log("Lucky Jet bridge: coefficient received:", n + "x");
      else console.warn("Lucky Jet bridge rejected:", d);
    } catch (e) {
      console.warn("Lucky Jet bridge network error:", e);
    }
    setTimeout(() => sent.delete(key), 20000);
  }

  function scan() {
    const nodes = document.querySelectorAll("body *");
    for (const el of nodes) {
      if (el.children.length) continue;
      const text = (el.textContent || "").trim();
      if (!text || text.length > 20) continue;
      const n = isCoeff(text);
      if (n !== null) send(n, "visible_multiplier");
    }
  }

  scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true});

  window.__LUCKYJET_READ_ONLY_BRIDGE__ = {
    stop() {
      observer.disconnect();
      console.log("Lucky Jet bridge stopped.");
    }
  };

  console.log("Lucky Jet read-only bridge started. It reads visible text only.");
})();