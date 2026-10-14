// Shared by the server root layout and the client theme provider.
export const THEME_STORAGE_KEY = "ej-theme";

// Runs before React hydrates so a stored dark preference never flashes light.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}}catch(e){}})();`;
