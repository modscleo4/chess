(function applyTheme() {
    const theme = localStorage.getItem('theme');
    if (!theme) {
        return;
    }

    document.querySelector('html').setAttribute('theme', theme);
})();
