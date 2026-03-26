/* ══════════════════════════════════════════════════════════════
   POWER NOTES v2 — app.js
   Hash router · markdown loader · search + tag filter · dark mode
   ══════════════════════════════════════════════════════════════ */

// ── Dark mode ────────────────────────────────────────────────────
const html    = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const hlLight  = document.getElementById('hljs-light');
const hlDark   = document.getElementById('hljs-dark');

function applyTheme(mode) {
  html.setAttribute('data-theme', mode);
  themeIcon.textContent = mode === 'dark' ? '☽' : '☀';
  if (hlLight) hlLight.disabled = (mode === 'dark');
  if (hlDark)  hlDark.disabled  = (mode === 'light');
  localStorage.setItem('pn-theme', mode);
}
applyTheme(localStorage.getItem('pn-theme') || 'light');
themeBtn.addEventListener('click', () => {
  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ── Marked v4 setup ──────────────────────────────────────────────
const renderer = new marked.Renderer();
renderer.code = function(code, language) {
  const lang = language || 'text';
  let highlighted = code;
  try {
    highlighted = hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;
  } catch(e) { highlighted = code; }
  return `<div class="code-block"><div class="code-header"><span class="code-lang">${lang}</span><div class="code-dots"><span></span><span></span><span></span></div></div><pre><code class="hljs language-${lang}">${highlighted}</code></pre></div>`;
};
marked.setOptions({ renderer, breaks: true, gfm: true });

// ── Posts manifest ───────────────────────────────────────────────
let POSTS = [];
let ALL_TAGS = [];

async function loadManifest() {
  try {
    const res = await fetch('data/posts.json');
    POSTS = await res.json();
    // Collect unique tags
    ALL_TAGS = [...new Set(POSTS.map(p => p.tag).filter(Boolean))].sort();
  } catch(e) {
    console.error('Could not load posts.json', e);
    POSTS = [];
  }
}

// ── Router ───────────────────────────────────────────────────────
const view = document.getElementById('view');

function getRoute() {
  return window.location.hash.replace('#', '') || 'home';
}

async function navigate() {
  const route = getRoute();
  updateNavActive(route);

  if (route === 'home' || route === '') {
    renderHome();
  } else if (route === 'about') {
    renderAbout();
  } else if (route.startsWith('post/')) {
    await renderPost(route.replace('post/', ''));
  } else {
    renderNotFound();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateNavActive(route) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const r = a.dataset.route || '';
    a.classList.toggle('active', route === r || (route.startsWith('post/') && r === 'home'));
  });
}

// ── Filter state ─────────────────────────────────────────────────
let activeTag    = 'all';
let searchQuery  = '';

function getFiltered() {
  return POSTS.filter(p => {
    const matchTag    = activeTag === 'all' || p.tag === activeTag;
    const q           = searchQuery.toLowerCase();
    const matchSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      p.excerpt.toLowerCase().includes(q) ||
      (p.tag || '').toLowerCase().includes(q);
    return matchTag && matchSearch;
  });
}

// ── Home view ─────────────────────────────────────────────────────
function renderHome() {
  view.innerHTML = `
    <div class="wrap">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-inner">
          <span class="hero-kicker">Power Platform · Dataverse · ALM</span>
          <h1>Real-world notes from the <em>platform.</em></h1>
          <p class="hero-sub">
            Practical writing on Power Platform extensibility, solution architecture,
            and Dataverse — by Aya Metwally.
          </p>
          <div class="pp-pills">
            <span class="pill pill-purple">Power Apps</span>
            <span class="pill pill-blue">Dataverse</span>
            <span class="pill pill-teal">Power Automate</span>
            <span class="pill pill-yellow">Azure DevOps</span>
          </div>
        </div>
      </section>

      <!-- Filter bar -->
      <div class="filter-bar" id="filter-bar">
        <div class="search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            id="search-input"
            placeholder="Search posts…"
            value="${searchQuery}"
            autocomplete="off"
          />
        </div>

        <div class="tag-filters" id="tag-filters">
          <button class="tag-btn ${activeTag === 'all' ? 'active' : ''}" data-tag="all">All</button>
          ${ALL_TAGS.map(t => `
            <button class="tag-btn ${activeTag === t ? 'active' : ''}" data-tag="${t}">${t}</button>
          `).join('')}
        </div>

        <span class="filter-count" id="filter-count"></span>
      </div>

      <!-- Grid -->
      <div class="posts-grid" id="posts-grid"></div>
    </div>
  `;

  renderCards();
  bindFilters();
}

function renderCards() {
  const grid    = document.getElementById('posts-grid');
  const counter = document.getElementById('filter-count');
  if (!grid) return;

  const filtered = getFiltered();
  counter.textContent = `${filtered.length} post${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="no-results">No posts match your search.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const imgHtml = p.image
      ? `<img class="card-img" src="${p.image}" alt="${p.title}" loading="lazy" />`
      : `<div class="card-img-placeholder">
           <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
             <path d="M14 2L25.26 8.5V21.5L14 28L2.74 21.5V8.5L14 2Z" stroke="currentColor" stroke-width="1.5"/>
             <circle cx="14" cy="14" r="3" fill="currentColor"/>
           </svg>
         </div>`;

    return `
      <a class="post-card" href="#post/${p.slug}">
        ${imgHtml}
        <div class="card-body">
          <div class="card-top">
            <span class="card-tag">${p.tag || ''}</span>
            <time class="card-date">${p.date || ''}</time>
          </div>
          <div class="card-title">${p.title}</div>
          <p class="card-excerpt">${p.excerpt}</p>
          <div class="card-footer">
            <span class="card-read-time">${p.readTime || ''}</span>
            <span class="card-arrow">→</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function bindFilters() {
  // Search
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      searchQuery = e.target.value;
      renderCards();
    });
  }

  // Tags
  const tagContainer = document.getElementById('tag-filters');
  if (tagContainer) {
    tagContainer.addEventListener('click', e => {
      const btn = e.target.closest('.tag-btn');
      if (!btn) return;
      activeTag = btn.dataset.tag;
      tagContainer.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    });
  }
}

// ── Post view ─────────────────────────────────────────────────────
async function renderPost(slug) {
  const meta = POSTS.find(p => p.slug === slug);

  view.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

  let content = '';
  try {
    const res = await fetch(`posts/${slug}.md`);
    if (!res.ok) throw new Error('not found');
    content = marked.parse(await res.text());
  } catch {
    renderNotFound(); return;
  }

  const hasImage = !!meta?.image;

  const heroHtml = hasImage ? `
    <div class="post-hero">
      <img class="post-hero-img" src="${meta.image}" alt="${meta?.title || ''}" />
      <div class="post-hero-overlay"></div>
      <div class="post-hero-content wrap">
        ${meta?.tag ? `<div class="post-category">${meta.tag}</div>` : ''}
        <h1 class="post-title">${meta?.title || slug}</h1>
        <div class="post-byline">
          <span>${meta?.author || 'Aya Metwally'}</span>
          ${meta?.date     ? `<span>· ${meta.date}</span>`     : ''}
          ${meta?.readTime ? `<span>· ${meta.readTime}</span>` : ''}
        </div>
      </div>
    </div>
  ` : `
    <div class="post-hero-placeholder"></div>
  `;

  const plainHeaderHtml = !hasImage ? `
    <div class="post-header-plain">
      ${meta?.tag ? `<div class="post-category">${meta.tag}</div>` : ''}
      <h1 class="post-title">${meta?.title || slug}</h1>
      <div class="post-byline">
        <span>${meta?.author || 'Aya Metwally'}</span>
        ${meta?.date     ? `<span>· ${meta.date}</span>`     : ''}
        ${meta?.readTime ? `<span>· ${meta.readTime}</span>` : ''}
      </div>
    </div>
  ` : '';

  view.innerHTML = `
    <div class="post-view">
      ${heroHtml}
      <div class="wrap">
        <a href="#home" class="back-btn">← All articles</a>
        ${plainHeaderHtml}
        <div class="prose">${content}</div>
      </div>
    </div>
  `;
}

// ── About view ────────────────────────────────────────────────────
function renderAbout() {
  view.innerHTML = `
    <div class="wrap about-view">
      <div class="about-grid">
        <aside class="about-sidebar">
          <div class="about-avatar-wrap">⬡</div>
          <div class="about-name">Aya Metwally</div>
          <div class="about-role">Power Platform Solution Architect</div>
          <div class="about-links">
            <a href="https://www.linkedin.com/in/aya-metwally/" target="_blank" rel="noopener" class="about-link">↗ LinkedIn</a>
            <a href="#home" class="about-link">✍ Writing</a>
          </div>
        </aside>

        <div class="about-content">
          <h2>Hello 👋</h2>
          <p>
            I'm a Power Platform Solution Architect based in the Middle East working with clients with multiple backgrounds across UK, Ireland, & UAE. Working at the
            intersection of low-code and enterprise-grade engineering. I design and build solutions
            on the Microsoft Power Platform — from Dataverse data models and model-driven apps to
            ALM pipelines and Azure extensibility layers.
          </p>
          <p>
            I started Power Notes because most of what I know came from reading between the lines
            of documentation, asking questions in community forums, and shipping things that broke
            in interesting ways. This blog is my way of giving that back.
          </p>

          <h2>What I work with</h2>
          <div class="skills-grid">
            <div class="skill-card">
              <h3>Power Platform</h3>
              <p>Power Apps (mostly model-driven) · Power Automate · Dataverse · Copilot Studio</p>
            </div>
            <div class="skill-card">
              <h3>Azure</h3>
              <p>Azure Functions · Azure DevOps · Azure SQL · Account Storage</p>
            </div>
            <div class="skill-card">
              <h3>ALM & Tooling</h3>
              <p>Power Platform CLI · Solution Checker · XrmToolBox · Azure Pipelines</p>
            </div>
            <div class="skill-card">
              <h3>Languages</h3>
              <p>C# · JavaScript · YAML · JSON</p>
            </div>
          </div>

          <h2>Community</h2>
          <p>
            I believe in building in public and sharing what I learn with the Power Platform
            community. You'll find me active in community forums, contributing to discussions
            on Dataverse architecture, ALM strategy, and solution design patterns.
          </p>
          <p>
            If something I've written saved you a debugging session — that's the point.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ── 404 ───────────────────────────────────────────────────────────
function renderNotFound() {
  view.innerHTML = `
    <div class="wrap not-found">
      <h2>404</h2>
      <p style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-muted)">Post not found.</p>
      <br/><a href="#home" class="back-btn">← Back home</a>
    </div>
  `;
}

// ── Boot ──────────────────────────────────────────────────────────
(async () => {
  await loadManifest();
  await navigate();
  window.addEventListener('hashchange', navigate);
})();
