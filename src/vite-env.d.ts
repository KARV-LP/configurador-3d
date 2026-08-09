/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

interface ModelViewerAttributes extends HTMLAttributes<HTMLElement> {
  src: string;
  alt: string;
  loading?: 'auto' | 'lazy' | 'eager';
  reveal?: 'auto' | 'manual' | 'interaction';
  exposure?: string;
  'camera-controls'?: boolean;
  'disable-zoom'?: boolean;
  'interaction-prompt'?: 'auto' | 'none';
  'camera-orbit'?: string;
  'min-camera-orbit'?: string;
  'max-camera-orbit'?: string;
  'camera-target'?: string;
  'field-of-view'?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<ModelViewerAttributes, HTMLElement>;
    }
  }
}
