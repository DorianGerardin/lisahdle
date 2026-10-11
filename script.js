(() => {
"use strict";

// --- Données : chargées depuis data/people.json (édité avec Sveltia via /admin) ---
let PEOPLE = [];
let SORTED = [];
let TARGET = null;
const FIELDS = [["equipe","Équipe"],["tutelles","Tutelle"],["sexe","Sexe"],["statut","Statut"],["role","Rôle"],["localisation","Lieu"]];

// --- Défi du jour : l'index dépend uniquement de la date locale ---
function dayKey(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function hash(s){
  let h = 2166136261;
  for(const c of s){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

const DAY = dayKey();
const KEY = "lisahdle:" + DAY;

let guesses = [];
try { guesses = JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { guesses = []; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(guesses)); } catch(e) {} }

const $ = id => document.getElementById(id);
const won = () => guesses.includes(TARGET.nom);
const toArr = v => (Array.isArray(v) ? v : [v]).map(x => String(x ?? "").trim()).filter(Boolean);
function compareField(p, k){
  const vals = toArr(p[k]);
  const cible = toArr(TARGET[k]).map(norm);
  const shared = vals.filter(x => cible.includes(norm(x)));
  return { ok: shared.length > 0, shown: shared.length ? shared : vals };
}
const LABELS = [...FIELDS.map(f => f[1]), "Alphabet"];
function alphaKey(n){
  const i = n.indexOf(" ");
  const prenom = i < 0 ? "" : n.slice(0, i);
  const nom = i < 0 ? n : n.slice(i + 1);
  return norm(nom) + "|" + norm(prenom);
}
function compare(p){
  const r = FIELDS.map(([k]) => compareField(p, k));
  if(!r.every(x => x.ok)){
    r.push({ ok: false, hidden: true, shown: ["?"] });
  } else if(p.nom === TARGET.nom){
    r.push({ ok: true, shown: ["✓"] });
  } else {
    const c = alphaKey(TARGET.nom).localeCompare(alphaKey(p.nom));
    r.push({ ok: false, shown: c < 0 ? ["↑", "avant"] : ["↓", "après"] });
  }
  return r;
}

const REVEAL_MS = FIELDS.length * 140 + 450;

let justAdded = null;
let locked = false;

const MIN_FONT = 9;
function fitCells(){
  hideTip();
  document.querySelectorAll(".cell").forEach(c => {
    const b = c.querySelector("b");
    const small = c.querySelector("small");
    // Réinitialisation
    b.style.fontSize = "";
    b.style.webkitLineClamp = "";
    b.classList.remove("clamp");
    c.classList.remove("clipped");
    c.removeAttribute("title");

    let size = parseFloat(getComputedStyle(b).fontSize);
    while(c.scrollHeight > c.clientHeight + 1 && size > MIN_FONT){
      size -= 0.5;
      b.style.fontSize = size + "px";
    }
    if(c.scrollHeight > c.clientHeight + 1){
      const cs = getComputedStyle(c);
      const bs = getComputedStyle(b);
      const lh = parseFloat(bs.lineHeight) || parseFloat(bs.fontSize) * 1.2;
      const smallH = small.offsetHeight + parseFloat(getComputedStyle(small).marginBottom || 0);
      const avail = c.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - smallH;
      const lines = Math.max(1, Math.floor(avail / lh));
      b.classList.add("clamp");
      b.style.webkitLineClamp = lines;
      if(b.scrollHeight > b.clientHeight + 1){
        c.classList.add("clipped");
        c.title = b.textContent;
      }
    }
  });
}

// Infobulle : toucher une case tronquée affiche son texte complet
let tipEl = null;
function hideTip(){ if(tipEl){ tipEl.remove(); tipEl = null; } }
function showTip(cell){
  hideTip();
  const b = cell.querySelector("b");
  tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.setAttribute("role", "tooltip");
  tipEl.textContent = b.textContent;
  document.body.appendChild(tipEl);
  const r = cell.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  const m = 8;
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(m, Math.min(left, window.innerWidth - t.width - m));
  let top = r.top - t.height - 6;
  if(top < m) top = r.bottom + 6;
  tipEl.style.left = left + "px";
  tipEl.style.top = top + "px";
}
document.addEventListener("click", e => {
  const cell = e.target.closest(".cell.clipped");
  if(cell){
    if(tipEl && tipEl.dataset.for === cell.querySelector("small").textContent + cell.parentNode.parentNode.querySelector("h2").textContent){ hideTip(); return; }
    showTip(cell);
    tipEl.dataset.for = cell.querySelector("small").textContent + cell.parentNode.parentNode.querySelector("h2").textContent;
  } else hideTip();
});
window.addEventListener("scroll", hideTip, true);
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCells, 120); });

function render(){
  const list = $("list");
  list.innerHTML = "";
  if(!guesses.length) list.innerHTML = '<p class="empty">Aucun essai pour le moment.</p>';
  $("viewBar").classList.toggle("on", guesses.length > 0);

  [...guesses].reverse().forEach(name => {
    const p = PEOPLE.find(x => x.nom === name);
    if(!p) return;
    const r = compare(p);
    const g = document.createElement("div");
    g.className = "guess" + (name === justAdded ? " new" : "");
    g.innerHTML = "<h2></h2><div class='cells'></div>";
    g.querySelector("h2").textContent = p.nom;
    const cells = g.querySelector(".cells");
    r.forEach((res, i) => {
      const label = LABELS[i];
      const c = document.createElement("div");
      c.className = "cell " + (res.hidden ? "hid" : res.ok ? "ok" : "ko");
      c.style.setProperty("--i", i);
      c.innerHTML = "<small></small><b></b>";
      c.querySelector("small").textContent = label;
      c.querySelector("b").textContent = res.shown.join("\n");
      cells.appendChild(c);
    });
    list.appendChild(g);
  });
  fitCells();

  if(justAdded !== null){
    locked = true;
    $("q").disabled = true;
    setTimeout(renderEnd, REVEAL_MS);
  } else {
    renderEnd();
  }
}

function renderEnd(){
  locked = false;
  $("q").disabled = false;
  if(!won() && justAdded !== null) $("q").focus({preventScroll:true});
  $("searchBox").style.display = won() ? "none" : "";
  const w = $("win");
  w.innerHTML = "";
  if(won()){
    const n = guesses.length;
    const lignes = [...guesses].reverse()
      .map(nm => PEOPLE.find(x => x.nom === nm))
      .filter(Boolean)
      .map(p => compare(p).map(b => b.ok ? "🟩" : b.hidden ? "⬛" : "🟥").join(""))
      .join("\n");
    const txt = "LISAHDLE " + DAY + "\nTrouvé en " + n + " essai" + (n>1 ? "s" : "") + "\n" + lignes;
    w.className = "win" + (justAdded === TARGET.nom ? " new" : "");
    w.innerHTML = "<p><b></b></p><pre></pre><button id='copy'>Copier pour partager</button>";
    w.querySelector("b").textContent = "C'était " + TARGET.nom + ". Trouvé en " + n + " essai" + (n>1 ? "s" : "") + ".";
    w.querySelector("pre").textContent = txt;
    $("copy").onclick = async () => {
      try { await navigator.clipboard.writeText(txt + "\nhttps://lisahdle.mrdo.fr"); }
      catch(e){
        const r = document.createRange();
        r.selectNodeContents(w.querySelector("pre"));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand("copy"); } catch(_) {}
      }
      $("copy").textContent = "Copié";
      setTimeout(() => { if($("copy")) $("copy").textContent = "Copier pour partager"; }, 1800);
    };
    $("foot").textContent = "Prochaine personne à minuit.";
  } else {
    w.className = "";
    $("foot").textContent = "";
  }
}

function suggestions(){
  const v = norm($("q").value.trim());
  const ul = $("sugg");
  ul.innerHTML = "";
  if(!v) return [];
  const res = SORTED.filter(p => !guesses.includes(p.nom) && norm(p.nom).includes(v)).slice(0, 6);
  res.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.nom;
    li.onclick = () => guess(p.nom);
    ul.appendChild(li);
  });
  return res;
}

function guess(name){
  if(locked || won() || guesses.includes(name)) return;
  guesses.push(name);
  justAdded = name;
  save();
  $("q").value = "";
  $("sugg").innerHTML = "";
  render();
}

$("q").addEventListener("input", suggestions);
$("q").addEventListener("keydown", e => {
  if(e.key === "Enter"){ const r = suggestions(); if(r.length) guess(r[0].nom); }
});
document.addEventListener("click", e => { if(!$("searchBox").contains(e.target)) $("sugg").innerHTML = ""; });

// --- Mode d'affichage : défilement horizontal ou tout sur la largeur (choix mémorisé) ---
const FIT_KEY = "lisahdle:fit";
let fit = false;
try { fit = localStorage.getItem(FIT_KEY) === "1"; } catch(e) {}
function setFit(on){
  document.body.classList.toggle("fit", on);
  const label = on ? "Activer le défilement horizontal" : "Tout afficher sur la largeur";
  $("view").setAttribute("aria-label", label);
  $("view").title = label;
  fitCells();
}
setFit(fit);
$("view").addEventListener("click", () => {
  fit = !fit;
  setFit(fit);
  try { localStorage.setItem(FIT_KEY, fit ? "1" : "0"); } catch(e) {}
});

// --- Démarrage : on charge le JSON, puis on tire la personne du jour ---
async function init(){
  try {
    const res = await fetch("data/people.json", {cache:"no-cache"});
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    PEOPLE = (Array.isArray(data) ? data : data.people || []).filter(p => p && p.nom);
    if(!PEOPLE.length) throw new Error("aucune personne");
  } catch(e){
    $("q").disabled = true;
    $("foot").textContent = "Impossible de charger data/people.json (" + e.message + "). Le site doit être servi par un serveur web, pas ouvert directement depuis un fichier.";
    return;
  }
  SORTED = [...PEOPLE].sort((a,b) => a.nom.localeCompare(b.nom));
  TARGET = SORTED[hash("lisahdle:" + DAY) % SORTED.length];
  const names = new Set(PEOPLE.map(p => p.nom));
  const clean = guesses.filter(n => names.has(n));
  if(clean.length !== guesses.length){ guesses = clean; save(); }
  render();
}
init();
})();