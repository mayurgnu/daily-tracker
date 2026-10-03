/*
  GOOGLE CLOUD SYNC
  1) Deploy the companion Google Apps Script as a Web App.
  2) Paste its Web App URL below.
  3) Open this page through a browser.
  4) Every checkbox change is saved locally immediately and synced to Google.
*/
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxFiEGKcfEhVcAkQMf1d1dG_1nYZSPQisJtBP3cTuKU7Z2sUx4ED0dU_NBii0xkHkHRgw/exec";

const DEFAULT_HABITS = [
  "3 km walk / run",
  "Workout",
  "2L water",
  "No junk food",
  "Healthy meals",
  "Sleep on time"
];

const STORAGE_KEY = "monthlyHabitTracker_pastel_v1";
const state = loadState();
const now = new Date();

function monthKey(date = now) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}
function daysInMonth(date = now) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function setStatus(text, good=true) {
  const el = document.getElementById("savedStatus");
  el.textContent = text;
  el.style.color = good ? "#16a34a" : "#b91c1c";
}
function ensureMonth() {
  const key = monthKey();
  if (!state[key]) {
    state[key] = { habits: [...DEFAULT_HABITS], checks: {} };
    saveLocal();
  }
}
function labelDate(day) {
  const d = new Date(now.getFullYear(), now.getMonth(), day);
  return d.toLocaleDateString(undefined, {weekday:"short"}).slice(0,2);
}

async function cloudGet() {
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) return;
  try {
    setStatus("☁ Syncing…");
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get&month=${encodeURIComponent(monthKey())}`, {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Cloud read failed");
    const result = await response.json();
    if (result.ok && result.data) {
      state[monthKey()] = result.data;
      saveLocal();
      render();
      setStatus("✓ Cloud synced");
    }
  } catch (e) {
    setStatus("Offline — local saved", false);
  }
}

async function cloudSave() {
  saveLocal();
  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) {
    setStatus("✓ Local saved");
    return;
  }
  try {
    setStatus("☁ Saving…");
    const payload = {
      action: "save",
      month: monthKey(),
      data: state[monthKey()]
    };
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Cloud write failed");
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Cloud write failed");
    setStatus("✓ Cloud saved");
  } catch (e) {
    setStatus("✓ Local saved (offline)", false);
  }
}

function render() {
  ensureMonth();
  const data = state[monthKey()];
  const totalDays = daysInMonth();
  document.documentElement.style.setProperty("--days", totalDays);
  document.getElementById("monthTitle").textContent =
    now.toLocaleDateString(undefined,{month:"long",year:"numeric"});

  const labels=document.getElementById("dayLabels"); labels.innerHTML="";
  for(let day=1;day<=totalDays;day++){
    const el=document.createElement("div");
    el.className="day-label"+(day===now.getDate()?" today":"");
    el.innerHTML=`${day}<small>${labelDate(day)}</small>`;
    labels.appendChild(el);
  }

  const rows=document.getElementById("habitRows"); rows.innerHTML="";
  data.habits.forEach((habit,i)=>{
    const row=document.createElement("div"); row.className="habit-row";
    const name=document.createElement("div"); name.className="habit-name";
    name.textContent=habit; row.appendChild(name);
    for(let day=1;day<=totalDays;day++){
      const cell=document.createElement("div");
      cell.className="cell"+(day===now.getDate()?" today":"");
      const input=document.createElement("input");
      input.type="checkbox"; input.className="check";
      input.checked=!!data.checks[`${i}_${day}`];
      input.setAttribute("aria-label",`${habit}, day ${day}`);
      input.addEventListener("change",()=>{
        const key=`${i}_${day}`;
        if(input.checked)data.checks[key]=true; else delete data.checks[key];
        cloudSave(); updateStats();
      });
      cell.appendChild(input); row.appendChild(cell);
    }
    rows.appendChild(row);
  });
  updateStats();
}

function getCompletedDays() {
  const data=state[monthKey()]; let completed=0;
  for(let day=1;day<=daysInMonth();day++){
    if(data.habits.length && data.habits.every((_,i)=>data.checks[`${i}_${day}`])) completed++;
  }
  return completed;
}
function getStreak(){
  const data=state[monthKey()]; let streak=0;
  for(let day=now.getDate();day>=1;day--){
    if(data.habits.length && data.habits.every((_,i)=>data.checks[`${i}_${day}`])) streak++;
    else break;
  }
  return streak;
}

function updateStats(){
  const data=state[monthKey()], totalDays=daysInMonth();
  const totalDone=Object.keys(data.checks).length;
  const possible=data.habits.length*totalDays;
  const percent=possible?Math.round(totalDone/possible*100):0;
  const perfect=getCompletedDays(), streak=getStreak();

  document.getElementById("monthPercent").textContent=`${percent}%`;
  document.getElementById("daysDone").textContent=`${perfect} / ${totalDays}`;
  document.getElementById("totalDone").textContent=totalDone;
  document.getElementById("streak").textContent=streak;
  document.getElementById("progressText").textContent=
    streak?`${streak} day${streak===1?"":"s"} strong. Keep your streak alive! 🔥`:"Small steps. Big change. ♡";

  const todayDone=data.habits.reduce((s,_,i)=>
    s+(data.checks[`${i}_${now.getDate()}`]?1:0),0);
  const tp=data.habits.length?Math.round(todayDone/data.habits.length*100):0;
  document.getElementById("todayCount").textContent=`${todayDone} / ${data.habits.length} complete`;
  document.getElementById("todayPercent").textContent=`${tp}%`;
  document.getElementById("todayBar").style.width=`${tp}%`;
  const heading=document.getElementById("todayHeading");
  heading.textContent=tp===100?"You did it! 🌟":tp>=50?"You're doing great! 🌷":"You can do this! 🌱";
  document.getElementById("monthRing").style.background=
    `conic-gradient(#83b99d ${percent*3.6}deg,#ffffff99 0deg)`;
}

function openEditor() {
  document.getElementById("habitEditor").value = state[monthKey()].habits.join("\n");
  document.getElementById("modal").classList.remove("hidden");
}
function closeEditor() {
  document.getElementById("modal").classList.add("hidden");
}

document.getElementById("editBtn").addEventListener("click", openEditor);
document.getElementById("settingsBtn").addEventListener("click", openEditor);
document.getElementById("closeBtn").addEventListener("click", closeEditor);

document.getElementById("saveHabitsBtn").addEventListener("click", () => {
  const newHabits = document.getElementById("habitEditor").value
    .split("\n").map(x=>x.trim()).filter(Boolean).slice(0,12);
  if (!newHabits.length) return;

  const old = state[monthKey()];
  const checks = {};
  newHabits.forEach((_,i)=>{
    for(let day=1; day<=daysInMonth(); day++){
      if(old.checks[`${i}_${day}`]) checks[`${i}_${day}`] = true;
    }
  });
  old.habits = newHabits;
  old.checks = checks;
  saveLocal();
  closeEditor();
  render();
  cloudSave();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset all checkbox progress for this month?")) return;
  state[monthKey()].checks = {};
  cloudSave();
  render();
});

ensureMonth();
render();
cloudGet();
