import { dracoDecoderUrl } from './runtime-paths';

let registration: Promise<void> | undefined;

export function registerModelViewer(): Promise<void> {
  const runtime = globalThis as typeof globalThis & {
    ModelViewerElement?: { dracoDecoderLocation?: string };
  };

  runtime.ModelViewerElement ??= {};
  runtime.ModelViewerElement.dracoDecoderLocation = dracoDecoderUrl;
  registration ??= import('@google/model-viewer').then(() => undefined);
  return registration;
}
