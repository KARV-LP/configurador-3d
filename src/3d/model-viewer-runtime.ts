import { dracoDecoderUrl } from './runtime-paths';

let registration: Promise<void> | undefined;

export function registerModelViewer(): Promise<void> {
  registration ??= import('@google/model-viewer').then(({ ModelViewerElement }) => {
    ModelViewerElement.dracoDecoderLocation = dracoDecoderUrl;
  });
  return registration;
}
