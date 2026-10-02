/**
 * Getting and sharing a `GPUDevice` (#289).
 *
 * One device per page, reference-counted, because two globes can exist at once —
 * the landing hero and a globe mounted into the `/dox` chat rail — and a second
 * device would double the driver-side cost for nothing.
 *
 * Everything here reports failure by rejecting or by calling back. None of it
 * writes to the page: the caller's job is to fall back to canvas-2D, and a
 * reader should never learn that a GPU was involved.
 *
 * ## Why the device comes before the canvas
 *
 * `HTMLCanvasElement.getContext("webgpu")` permanently sets the element's
 * context mode; after it, the same element can never return a 2D context. So the
 * device is requested first and a canvas is only created once it succeeds,
 * leaving the fallback a clean element to use.
 */

/** Verified defaults, so a device is never asked for more than it must give. */
export interface DeviceBundle {
  device: GPUDevice;
  /** The format a canvas on this adapter prefers — `bgra8unorm` on Apple silicon. */
  canvasFormat: GPUTextureFormat;
  /** Release this holder's claim. The device closes when the last one lets go. */
  release(): void;
}

interface Shared {
  device: GPUDevice;
  canvasFormat: GPUTextureFormat;
  holders: number;
}

let shared: Shared | null = null;
let pending: Promise<Shared> | null = null;

/**
 * A device, shared with any other globe on the page.
 *
 * Rejects when WebGPU is unavailable for any reason — no `navigator.gpu`, an
 * adapter the browser will not hand out (the common case in a headless browser
 * with no GPU flags), or a device request that fails. Every one of those is an
 * ordinary "use the fallback", not an error worth surfacing.
 */
export async function acquireDevice(
  onLost?: (reason: string) => void,
): Promise<DeviceBundle> {
  if (!("gpu" in navigator)) throw new Error("navigator.gpu is unavailable");

  if (!shared && !pending) {
    pending = requestShared().finally(() => {
      pending = null;
    });
  }
  const bundle = shared ?? (await pending!);
  shared = bundle;
  bundle.holders++;

  let released = false;

  if (onLost) {
    /* `device.lost` resolves once and never rejects. A `destroyed` reason is our
       own teardown, which is not a failure; anything else is the driver or the
       browser taking the GPU away, and the caller needs to know — unless it
       has already released. The handler cannot be detached, so a globe that
       mounted and unmounted leaves one behind, and it must not call back into
       a renderer that has torn down. */
    void bundle.device.lost.then((info) => {
      if (info.reason === "destroyed") return;
      // A lost device is dead for everyone holding it, released or not.
      if (shared?.device === bundle.device) shared = null;
      if (released) return;
      onLost(info.message || info.reason || "device lost");
    });
  }

  return {
    device: bundle.device,
    canvasFormat: bundle.canvasFormat,
    release() {
      if (released) return;
      released = true;
      bundle.holders--;
      if (bundle.holders <= 0) {
        if (shared === bundle) shared = null;
        bundle.device.destroy();
      }
    },
  };
}

async function requestShared(): Promise<Shared> {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("no WebGPU adapter");

  /* No optional features and no raised limits: every pipeline here fits inside
     the spec's defaults, which is what keeps the globe working on a modest
     phone and on a software adapter in CI. */
  const device = await adapter.requestDevice({ label: "gmt-globe" });

  /* Anything the error scopes below do not catch arrives here. Logging rather
     than throwing, because by the time it fires the frame is already submitted;
     the renderer's own scopes are what decide to fall back. */
  device.addEventListener?.("uncapturederror", (event) => {
    const { error } = event as GPUUncapturedErrorEvent;
    // The message, not the object: a bare error logs as "[object GPUValidationError]".
    console.error(`globe: uncaptured WebGPU error — ${error.message}`);
  });

  return {
    device,
    canvasFormat: navigator.gpu.getPreferredCanvasFormat(),
    holders: 0,
  };
}

/**
 * Build a shader module and surface anything wrong with it as a rejection.
 *
 * `createShaderModule` never throws, even for source that cannot compile — the
 * messages arrive through `getCompilationInfo()`. Without this check a bad
 * shader shows up much later as a pipeline failure or, worse, a blank globe.
 *
 * The scope is popped before anything is awaited; see `withValidation`.
 */
export async function createCheckedShaderModule(
  device: GPUDevice,
  label: string,
  code: string,
): Promise<GPUShaderModule> {
  device.pushErrorScope("validation");
  let module: GPUShaderModule;
  try {
    module = device.createShaderModule({ label, code });
  } catch (error) {
    // Popped either way, so a throw cannot leave the scope open.
    void device.popErrorScope().catch(() => null);
    throw error;
  }
  const scope = device.popErrorScope();
  const [info, scopeError] = await Promise.all([
    module.getCompilationInfo(),
    scope,
  ]);
  const errors = info.messages.filter((message) => message.type === "error");

  if (errors.length > 0) {
    throw new Error(
      `shader "${label}" failed to compile: ${errors
        .map((m) => `${m.lineNum}:${m.linePos} ${m.message}`)
        .join("; ")}`,
    );
  }
  if (scopeError) {
    throw new Error(
      `shader "${label}" failed validation: ${scopeError.message}`,
    );
  }
  for (const message of info.messages) {
    console.warn(`globe shader "${label}" ${message.type}: ${message.message}`);
  }
  return module;
}

/**
 * Run `work` with a validation and an out-of-memory scope round it, rejecting
 * on the first error either caught.
 *
 * `work` must be synchronous, and is refused otherwise. A device's error
 * scopes are one stack, and the device is shared by every globe on the page:
 * a scope held open across an `await` catches whatever another globe does
 * meanwhile, and the pops cross over — one globe reports the other's error and
 * falls back for nothing, while the one that failed carries on with an invalid
 * object. So both scopes are popped in the same run that pushed them, and only
 * the popped promises are awaited. Async work that reports its own failures,
 * such as `createRenderPipelineAsync`, needs no scope at all.
 */
export async function withValidation<T>(
  device: GPUDevice,
  what: string,
  work: () => T,
): Promise<T> {
  device.pushErrorScope("validation");
  device.pushErrorScope("out-of-memory");
  let result: T | undefined;
  let failure: unknown = null;
  try {
    result = work();
    if (result instanceof Promise) {
      // Not awaited: its errors would land outside the scopes regardless.
      result.catch(() => {});
      failure = new Error(`${what}: withValidation needs synchronous work`);
    }
  } catch (error) {
    failure = error;
  }
  const memoryScope = device.popErrorScope();
  const validationScope = device.popErrorScope();
  const [memoryError, validationError] = await Promise.all([
    memoryScope,
    validationScope,
  ]);
  if (failure) throw failure;
  if (memoryError) throw new Error(`${what}: ${memoryError.message}`);
  if (validationError) throw new Error(`${what}: ${validationError.message}`);
  return result as T;
}
