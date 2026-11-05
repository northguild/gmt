/**
 * The inline script that loads the display font before the first paint.
 *
 * The Michroma face is in the site stylesheet as a data URI (`gmt-tokens.css`). Firefox has it at
 * first layout, but Chromium and WebKit fetch a data-URI face only once layout asks for it, so the
 * first frame is laid out in the fallback and the header, the copy and the Earth move when the
 * font arrives. A `FontFace` built from bytes is loaded the moment it is made, in every engine.
 *
 * The script sits just before the end-of-page marker (`Footer.astro`), which holds the first paint.
 * By then every stylesheet in the head has loaded, because an inline script waits for them. It
 * finds the face's data URI in those sheets, builds the same face from its bytes and adds it to
 * `document.fonts`, where it wins over the stylesheet's copy. The bytes stay in the stylesheet,
 * so the browser caches them once, and a page without scripts still gets the face from CSS.
 *
 * The source is a string so one definition serves the `<script is:inline>` and the tests.
 */

/** The display face's family name, as `gmt-tokens.css` declares it. */
export const DISPLAY_FAMILY = "Michroma";

/** The script source. */
export function displayFaceInlineSource(): string {
  const family = JSON.stringify(DISPLAY_FAMILY);
  return `(function(){
if(typeof FontFace!=="function"||!document.fonts)return;
var F=${family};
function find(rules){
for(var i=0;i<rules.length;i++){
var r=rules[i];
if(r.type===5){
if(r.style.getPropertyValue("font-family").replace(/["']/g,"").trim()!==F)continue;
var m=/data:font\\/woff2;base64,([A-Za-z0-9+\\/=]+)/.exec(r.style.getPropertyValue("src"));
if(m)return{bytes:m[1],style:r.style.getPropertyValue("font-style")||"normal",weight:r.style.getPropertyValue("font-weight")||"400"};
}else if(r.type!==1&&r.cssRules){var hit=find(r.cssRules);if(hit)return hit}
}
}
var sheets=document.styleSheets,face;
for(var i=0;i<sheets.length&&!face;i++){try{face=find(sheets[i].cssRules)}catch(x){}}
if(!face)return;
var text=atob(face.bytes),bytes=new Uint8Array(text.length);
for(var k=0;k<text.length;k++)bytes[k]=text.charCodeAt(k);
document.fonts.add(new FontFace(F,bytes.buffer,{style:face.style,weight:face.weight,display:"block"}));
})();`;
}
