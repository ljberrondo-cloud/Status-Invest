/**
 * Scripts que corren en <head> antes de pintar (sin "use client": el layout del servidor necesita el texto).
 */
export const THEME_KEY = "theme";
export const PRIVACY_KEY = "privacy";

/** Aplica el tema elegido antes de pintar, para evitar el parpadeo. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Si el modo privado está activo, oculta el contenido hasta que la app lo aplique (sin parpadeo de montos). */
export const PRIVACY_SCRIPT = `try{if(localStorage.getItem("${PRIVACY_KEY}")==="1")document.documentElement.dataset.privacyPending=""}catch(e){}`;
