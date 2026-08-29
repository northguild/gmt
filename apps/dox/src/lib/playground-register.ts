import { GMT_MODULES } from "./gmt-modules";
import type { PlaygroundSpec } from "./playground-spec";

function isSentinel(returnType: string, value: unknown): boolean {
  switch (returnType) {
    case "string":
      return value === "";
    case "number":
      return value === null;
    case "boolean":
      return value === false;
    case "array":
      return Array.isArray(value) && value.length === 0;
    default:
      return false;
  }
}

class PlaygroundElement extends HTMLElement {
  private spec!: PlaygroundSpec;
  private mod: Record<string, unknown> | null = null;
  private resultEl!: HTMLOutputElement;
  private callCodeEl!: HTMLElement;
  private copyBtn!: HTMLButtonElement;
  private copyLive!: HTMLElement;

  async connectedCallback() {
    const raw = this.dataset.spec;
    if (!raw) return;
    this.spec = JSON.parse(raw) as PlaygroundSpec;
    this.resultEl = this.querySelector(".gmt-playground-result") as HTMLOutputElement;
    this.callCodeEl = this.querySelector(".gmt-playground-call-code") as HTMLElement;
    this.copyBtn = this.querySelector(".gmt-playground-copy") as HTMLButtonElement;
    this.copyLive = this.querySelector(".gmt-playground-call [aria-live]") as HTMLElement;

    const importer = GMT_MODULES[this.spec.module];
    if (importer) {
      try {
        this.mod = (await importer()) as Record<string, unknown>;
      } catch {
        this.mod = null;
      }
    }

    this.querySelectorAll("[data-param], [data-option]").forEach((el) => {
      el.addEventListener("input", () => this.compute());
      el.addEventListener("change", () => this.compute());
    });

    if (this.copyBtn) {
      this.copyBtn.addEventListener("click", () => this.copyCall());
    }

    this.compute();
  }

  private readArgs(): unknown[] {
    const args: unknown[] = [];
    for (const p of this.spec.params) {
      const el = this.querySelector(`[data-param="${p.name}"]`) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      args.push(el ? el.value : p.value);
    }
    if (this.spec.options && this.spec.options.length > 0) {
      const opts: Record<string, string> = {};
      for (const o of this.spec.options) {
        const el = this.querySelector(`[data-option="${o.name}"]`) as
          | HTMLSelectElement
          | null;
        if (el && o.name) opts[o.name] = el.value;
      }
      args.push(opts);
    }
    return args;
  }

  private highlightCall(fn: string, args: unknown[]): string {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const span = (cls: string, text: string) =>
      `<span class="${cls}">${esc(text)}</span>`;

    const parts: string[] = [];
    parts.push(span("gmt-call-fn", fn));
    parts.push(span("gmt-call-punct", "("));

    args.forEach((a, i) => {
      if (i > 0) parts.push(span("gmt-call-punct", ", "));
      if (typeof a === "object" && a !== null) {
        parts.push(span("gmt-call-punct", "{ "));
        const entries = Object.entries(a);
        entries.forEach(([k, v], j) => {
          if (j > 0) parts.push(span("gmt-call-punct", ", "));
          parts.push(span("gmt-call-key", k));
          parts.push(span("gmt-call-punct", ": "));
          parts.push(span("gmt-call-str", JSON.stringify(v)));
        });
        parts.push(span("gmt-call-punct", " }"));
      } else {
        parts.push(span("gmt-call-str", JSON.stringify(a)));
      }
    });

    parts.push(span("gmt-call-punct", ")"));
    return parts.join("");
  }

  private renderCall(args: unknown[]) {
    if (!this.callCodeEl) return;
    const fn = this.spec.fn;
    const code = `${fn}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
    this.callCodeEl.innerHTML = this.highlightCall(fn, args);
    if (this.copyBtn) this.copyBtn.dataset.code = code;
  }

  private async copyCall() {
    const code = this.copyBtn?.dataset.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      if (this.copyLive) {
        this.copyLive.textContent = this.copyBtn.dataset.copied ?? "Copied!";
        setTimeout(() => {
          this.copyLive.textContent = "";
        }, 1500);
      }
    } catch {
      /* clipboard unavailable */
    }
  }

  private compute() {
    const args = this.readArgs();
    this.renderCall(args);
    if (!this.mod) {
      this.renderError("module failed to load");
      return;
    }
    const fn = this.mod[this.spec.fn] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof fn !== "function") {
      this.renderError(`"${this.spec.fn}" is not exported`);
      return;
    }
    try {
      const result = fn(...args);
      this.renderResult(result);
    } catch {
      this.renderResult(this.sentineledValue());
    }
  }

  private sentineledValue(): unknown {
    switch (this.spec.returnType) {
      case "number":
        return null;
      case "boolean":
        return false;
      case "array":
        return [];
      default:
        return "";
    }
  }

  private renderResult(value: unknown) {
    const returnType = this.spec.returnType;
    if (isSentinel(returnType, value)) {
      this.resultEl.classList.add("gmt-playground-sentinel");
      this.resultEl.classList.remove("gmt-playground-live");
      this.resultEl.textContent = this.spec.sentinelLabel ?? "⟨ NO SIGNAL — invalid input ⟩";
    } else {
      this.resultEl.classList.remove("gmt-playground-sentinel");
      this.resultEl.classList.add("gmt-playground-live");
      this.resultEl.textContent = typeof value === "object" ? JSON.stringify(value) : String(value);
    }
  }

  private renderError(msg: string) {
    this.resultEl.classList.remove("gmt-playground-live");
    this.resultEl.classList.add("gmt-playground-sentinel");
    this.resultEl.textContent = `⟨ ${msg} ⟩`;
  }
}

export function registerPlayground() {
  if (!customElements.get("gmt-playground")) {
    customElements.define("gmt-playground", PlaygroundElement);
  }
}
