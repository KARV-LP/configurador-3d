declare module 'qrcode' {
  interface QRCodeColorOptions {
    readonly dark?: string;
    readonly light?: string;
  }

  interface QRCodeSvgOptions {
    readonly type: 'svg';
    readonly errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    readonly margin?: number;
    readonly width?: number;
    readonly color?: QRCodeColorOptions;
  }

  interface QRCodeApi {
    toString(text: string, options: QRCodeSvgOptions): Promise<string>;
  }

  const QRCode: QRCodeApi;
  export default QRCode;
}
