const STORAGE_KEY = "paipai-workbench-v1";
const defaultState = {
  date: new Date().toDateString(),
  tasks: [],
  words: 0,
  skills: { 听力: false, 口语: false, 阅读: false, 写作: false },
  water: 0,
  mood: "",
  review: "",
  growthVisits: 0
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(defaultState);
    if (saved.date !== new Date().toDateString()) {
      return { ...structuredClone(defaultState), tasks: [] };
    }
    return { ...structuredClone(defaultState), ...saved };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
let activePanel = "";

const panel = document.querySelector("#panel");
const panelContent = document.querySelector("#panelContent");
const overlay = document.querySelector("#overlay");

const infoPanels = {
  news: {
    icon: "◌", small: "新闻", title: "今天，世界发生了什么？",
    tabs: [{ id: "china", label: "国内" }, { id: "world", label: "国际" }]
  },
  ai: {
    icon: "✦", small: "AI", title: "看看 AI 又向前走了多远",
    tabs: [{ id: "ai", label: "最新" }, { id: "popular", label: "热门" }]
  },
  growth: {
    icon: "❉", small: "成长", title: "让能力像珊瑚一样生长",
    tabs: [{ id: "growth", label: "成长" }]
  }
};

let activeFeedTab = "";

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateWorld();
}

function calculateScore() {
  const taskScore = state.tasks.length ? state.tasks.filter(t => t.done).length / state.tasks.length : 0;
  const wordScore = state.words / 50;
  const skillScore = Object.values(state.skills).filter(Boolean).length / 4;
  const waterScore = Math.min(state.water / 2000, 1);
  const reviewScore = state.review.trim() ? 1 : 0;
  return Math.round((taskScore * .28 + wordScore * .23 + skillScore * .22 + waterScore * .17 + reviewScore * .1) * 100);
}

function updateWorld() {
  const done = state.tasks.filter(t => t.done).length;
  document.querySelector("#taskBadge").textContent = `${done}/${state.tasks.length}`;
  document.querySelector("#wordBadge").textContent = `${state.words}/50`;
  const waterPercent = Math.min(Math.round(state.water / 2000 * 100), 100);
  document.querySelector("#waterBadge").textContent = `${waterPercent}%`;
  document.querySelector("#mapWaterFill").style.height = `${waterPercent}%`;
  document.querySelector("#overallScore").textContent = `${calculateScore()}%`;
}

function formatDate() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long", day: "numeric", weekday: "long"
  }).format(new Date());
}

function openPanel(type) {
  activePanel = type;
  if (["today", "work", "ielts", "water", "review"].includes(type)) {
    panelContent.replaceChildren(document.querySelector(`#${type}Template`).content.cloneNode(true));
  } else {
    panelContent.replaceChildren(document.querySelector("#infoTemplate").content.cloneNode(true));
    renderInfo(type);
  }
  bindPanel(type);
  panel.classList.add("open");
  overlay.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
}

function closePanel() {
  panel.classList.remove("open");
  overlay.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  activePanel = "";
}

function bindPanel(type) {
  if (type === "today") renderToday();
  if (type === "work") bindWork();
  if (type === "ielts") bindIelts();
  if (type === "water") bindWater();
  if (type === "review") bindReview();
}

function renderToday() {
  const done = state.tasks.filter(t => t.done).length;
  document.querySelector("#todayTasks").textContent = `${done}/${state.tasks.length}`;
  document.querySelector("#todayWords").textContent = `${state.words}/50`;
  document.querySelector("#todayWater").textContent = `${state.water} ml`;
  const target = document.querySelector("#todayPriorityList");
  const priorityTasks = state.tasks.filter(t => t.priority).slice(0, 3);
  target.innerHTML = priorityTasks.length
    ? priorityTasks.map(t => `<div class="mini-item">${t.done ? "✓" : "□"} ${escapeHtml(t.text)}</div>`).join("")
    : `<div class="empty-list">还没有重点工作，去“工作”里写下今天最重要的事吧。</div>`;
}

function bindWork() {
  document.querySelector("#taskForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = document.querySelector("#taskInput");
    const text = input.value.trim();
    if (!text) return;
    const wantsPriority = document.querySelector("#priorityInput").checked;
    const priorityCount = state.tasks.filter(t => t.priority).length;
    state.tasks.push({
      id: crypto.randomUUID(), text, done: false,
      priority: wantsPriority && priorityCount < 3
    });
    input.value = "";
    document.querySelector("#priorityInput").checked = false;
    saveState();
    renderTasks();
  });
  renderTasks();
}

function renderTasks() {
  const list = document.querySelector("#taskList");
  if (!list) return;
  if (!state.tasks.length) {
    list.innerHTML = `<div class="empty-list">船长日志还是空的。<br>写下今天第一件要做的事吧。</div>`;
    return;
  }
  list.innerHTML = state.tasks.map(task => `
    <div class="task-item ${task.done ? "done" : ""} ${task.priority ? "priority" : ""}" data-id="${task.id}">
      <input type="checkbox" ${task.done ? "checked" : ""} aria-label="完成任务" />
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="priority-button" title="设为重点">${task.priority ? "★" : "☆"}</button>
      <button class="delete-button" title="删除">×</button>
    </div>
  `).join("");
  list.querySelectorAll(".task-item").forEach(row => {
    const task = state.tasks.find(t => t.id === row.dataset.id);
    row.querySelector("input").addEventListener("change", e => {
      task.done = e.target.checked; saveState(); renderTasks();
    });
    row.querySelector(".priority-button").addEventListener("click", () => {
      const count = state.tasks.filter(t => t.priority).length;
      if (!task.priority && count >= 3) return;
      task.priority = !task.priority; saveState(); renderTasks();
    });
    row.querySelector(".delete-button").addEventListener("click", () => {
      state.tasks = state.tasks.filter(t => t.id !== task.id); saveState(); renderTasks();
    });
  });
}

function bindIelts() {
  const range = document.querySelector("#wordRange");
  const count = document.querySelector("#wordCount");
  range.value = state.words;
  count.textContent = state.words;
  range.addEventListener("input", () => {
    state.words = Number(range.value);
    count.textContent = state.words;
    saveState();
  });
  document.querySelectorAll("#skillChecks input").forEach(input => {
    const skill = input.dataset.skill;
    input.checked = state.skills[skill];
    input.addEventListener("change", () => {
      state.skills[skill] = input.checked; saveState();
    });
  });
}

function bindWater() {
  renderWater();
  document.querySelectorAll("[data-water]").forEach(button => {
    button.addEventListener("click", () => {
      state.water = Math.min(state.water + Number(button.dataset.water), 4000);
      saveState(); renderWater();
    });
  });
  document.querySelector("#resetWater").addEventListener("click", () => {
    state.water = 0; saveState(); renderWater();
  });
}

function renderWater() {
  const percent = Math.min(Math.round(state.water / 2000 * 100), 100);
  document.querySelector("#panelWaterFill").style.height = `${percent}%`;
  document.querySelector("#waterAmount").textContent = state.water;
  document.querySelector("#waterPercent").textContent = `${percent}%`;
}

function bindReview() {
  const text = document.querySelector("#reviewText");
  text.value = state.review;
  document.querySelectorAll("#moods button").forEach(button => {
    button.classList.toggle("selected", button.dataset.mood === state.mood);
    button.addEventListener("click", () => {
      state.mood = button.dataset.mood;
      document.querySelectorAll("#moods button").forEach(b => b.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
  document.querySelector("#saveReview").addEventListener("click", () => {
    state.review = text.value;
    saveState();
    document.querySelector("#reviewHint").textContent = "已保存。今天辛苦了。";
  });
}

function renderInfo(type) {
  const data = infoPanels[type];
  document.querySelector("#infoIcon").textContent = data.icon;
  document.querySelector("#infoSmall").textContent = data.small;
  document.querySelector("#infoTitle").textContent = data.title;
  const tabs = document.querySelector("#feedTabs");
  tabs.innerHTML = data.tabs.map((tab, index) =>
    `<button data-feed-tab="${tab.id}" class="${index === 0 ? "active" : ""}">${tab.label}</button>`
  ).join("");
  activeFeedTab = data.tabs[0].id;
  tabs.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      activeFeedTab = button.dataset.feedTab;
      loadLiveFeed(type, activeFeedTab);
    });
  });
  document.querySelector("#feedRefresh").addEventListener("click", () => loadLiveFeed(type, activeFeedTab));
  loadLiveFeed(type, activeFeedTab);
}

async function loadLiveFeed(type, tab) {
  const feed = document.querySelector("#liveFeed");
  const status = document.querySelector("#feedStatus");
  const refresh = document.querySelector("#feedRefresh");
  if (!feed || !status) return;
  refresh.disabled = true;
  status.textContent = "正在获取最新内容…";
  feed.innerHTML = `<div class="empty-list">鱼群正在带回消息…</div>`;
  try {
    let items = [];
    if (type === "news") items = await fetchFeedData(tab);
    else if (type === "ai") items = await fetchFeedData(tab);
    else items = getGrowthIdeas();
    renderFeedItems(items);
    status.textContent = `更新于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date())} · 点击标题查看原文`;
  } catch (error) {
    feed.innerHTML = `<div class="feed-error"><strong>暂时没有捕捉到信号</strong><p>数据源可能繁忙或当前网络限制了访问。稍后点击“刷新”重试。</p></div>`;
    status.textContent = "实时数据获取失败";
  } finally {
    refresh.disabled = false;
  }
}

async function fetchFeedData(section) {
  const response = await fetch(`news-data.json?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`News data ${response.status}`);
  const data = await response.json();
  const items = Array.isArray(data[section]) ? data[section] : [];
  if (!items.length) throw new Error(`No items for ${section}`);
  return items;
}

function getGrowthIdeas() {
  return [
    { title: "阅读20分钟，并写下一个新观点", url: "#", source: "今日建议", date: "约20分钟" },
    { title: "用自己的话解释一个刚学会的概念", url: "#", source: "输出练习", date: "约10分钟" },
    { title: "回顾本周最想提升的一项能力", url: "#", source: "成长复盘", date: "约5分钟" }
  ];
}

function renderFeedItems(items) {
  const feed = document.querySelector("#liveFeed");
  if (!items.length) {
    feed.innerHTML = `<div class="empty-list">这一刻没有找到新内容。</div>`;
    return;
  }
  feed.innerHTML = items.map(item => `
    <a class="feed-item" href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">
      <h3>${escapeHtml(item.title)}</h3>
      <div class="feed-meta"><span class="feed-source">${escapeHtml(item.source)}</span><time>${escapeHtml(item.date)}</time></div>
    </a>
  `).join("");
}

function parseGdeltDate(value) {
  if (!value || value.length < 14) return "刚刚";
  const date = new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(8,10)}:${value.slice(10,12)}:${value.slice(12,14)}Z`);
  return formatRelativeDate(date);
}

function formatRelativeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes || 1}分钟前`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}小时前`;
  return `${Math.round(minutes / 1440)}天前`;
}

function escapeAttribute(value) {
  return String(value || "#").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

document.querySelector("#todayDate").textContent = formatDate();
document.querySelectorAll("[data-panel]").forEach(button => {
  button.addEventListener("click", () => openPanel(button.dataset.panel));
});
document.querySelector("#closePanel").addEventListener("click", closePanel);
overlay.addEventListener("click", closePanel);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closePanel();
});

updateWorld();
