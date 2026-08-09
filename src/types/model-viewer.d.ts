import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string;
  alt?: string;
  'camera-controls'?: boolean;
  'disable-zoom'?: boolean;
  'camera-orbit'?: string;
  'min-camera-orbit'?: string;
  'max-camera-orbit'?: string;
  'camera-target'?: string;
  'field-of-view'?: string;
  exposure?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
  'interaction-prompt'?: string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}

export {};
