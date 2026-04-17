const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light');
    themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('light');
    themeToggle.textContent = '🌙';
  }
}

function loadTheme() {
  const saved = localStorage.getItem('aetherlink-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

themeToggle?.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  const nextTheme = isLight ? 'light' : 'dark';
  localStorage.setItem('aetherlink-theme', nextTheme);
  applyTheme(nextTheme);
});

loadTheme();
