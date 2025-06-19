declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer;
    format: 'JPEG' | 'PNG';
    quality?: number; // 0-1 for JPEG quality
  }

  function convert(options: ConvertOptions): Promise<ArrayBuffer>;

  export = convert;
}