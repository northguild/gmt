/**
 * loading: the placeholder a host shows while a widget's chunk loads.
 *
 * An `<output>` (an implicit polite status) holding "Loading <title>…". The host
 * writes it with `setHtml` before the template, and the template replaces it, so
 * a screen-reader user hears that something is coming. `title` is required and is
 * escaped like any builder value.
 */
import { html, type SafeHtml } from "./html";
import styles from "./loading.module.css";

export interface LoadingOptions {
  /** The widget's name, as the reader knows it. Required. */
  title: string;
}

export function loading(o: LoadingOptions): SafeHtml {
  return html`<output class="${styles.root}">Loading ${o.title}…</output>`;
}
