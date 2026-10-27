/** The part of `pngjs` that `build-social-preview.ts` uses; the package ships no types. */
declare module "pngjs" {
  export class PNG {
    constructor(options?: { width: number; height: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG): Buffer;
    };
  }
}
