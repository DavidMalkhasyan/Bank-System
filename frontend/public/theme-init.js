// Applies the saved theme before React loads, so the page never flashes the wrong colors.
(function () {
  try {
    var saved = localStorage.getItem('ledgerly_theme') || 'system';
    var dark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
