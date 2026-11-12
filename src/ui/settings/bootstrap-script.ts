import { SETTINGS_KEY } from "./storage";
import { TEXT_SCALE } from "./types";

/**
 * Runs in <head> before the page paints, so the person's theme, text size and
 * contrast are already applied on first frame (no flash of the wrong look).
 *
 * It mirrors `deriveDocumentAttributes` in ./apply.ts. A test runs both and
 * checks they agree, so they cannot drift apart.
 */
export const BOOTSTRAP_SCRIPT = `(function(){try{
var s={};try{s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}")||{}}catch(e){}
var scale=${JSON.stringify(TEXT_SCALE)};
var m=function(q){return window.matchMedia&&window.matchMedia(q).matches};
var theme=s.theme==="light"||s.theme==="dark"?s.theme:(m("(prefers-color-scheme: dark)")?"dark":"light");
var motion=s.motion==="reduce"||s.motion==="full"?s.motion:(m("(prefers-reduced-motion: reduce)")?"reduce":"full");
var r=document.documentElement;
r.dataset.theme=theme;
r.dataset.contrast=s.highContrast===true?"high":"standard";
r.dataset.motion=motion;
r.dataset.bold=s.boldText===true?"true":"false";
r.dataset.buttons=s.extraLargeButtons===true?"xl":"large";
r.dataset.spacing=s.roomySpacing===false?"normal":"roomy";
r.style.setProperty("--text-scale",String(scale[s.textSize]||${TEXT_SCALE.large}));
}catch(e){}})();`;
