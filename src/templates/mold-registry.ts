export interface MoldDefinition {
  readonly surfaceId: string;
  readonly label: string;
  readonly fileName: string;
  readonly url: string | null;
  readonly sha256: string | null;
}

export const MOLD_ARCHIVE = Object.freeze({
  fileName: 'Moldes Oficiais KARV.zip',
  url: '/moldes/karv-chair/v2/moldes-oficiais-karv.zip',
});

export const MOLD_REGISTRY = Object.freeze([
  {
    surfaceId: 'seat',
    label: 'Assento',
    fileName: 'Assento.pdf',
    url: '/moldes/karv-chair/v2/assento.pdf',
    sha256: '2ede7c770cb9cfac7e06c9cbd0fff998e8e0f919b5a73d9ae86e831ce28bab9b',
  },
  {
    surfaceId: 'backrest-front',
    label: 'Encosto Frontal',
    fileName: 'Encosto Frontal.pdf',
    url: '/moldes/karv-chair/v2/encosto-frontal.pdf',
    sha256: '955ad6cfeaf7536cbde6d2aa153fa8e3a67a119885080be7397dd35430823853',
  },
  {
    surfaceId: 'backrest-rear',
    label: 'Encosto Traseiro',
    fileName: 'Encosto Traseiro.pdf',
    url: '/moldes/karv-chair/v2/encosto-traseiro.pdf',
    sha256: '1fcb3a2c1a3a9ef50b457af7d300712208bac02d491a871ce6c2c092afc196f8',
  },
  {
    surfaceId: 'backrest-side',
    label: 'Encosto Lateral',
    fileName: 'Encosto Lateral.pdf',
    url: '/moldes/karv-chair/v2/encosto-lateral.pdf',
    sha256: '4525c842d29b9a6655132f513323112e887afc84abdf0d62aa3ce8913e57872e',
  },
  {
    surfaceId: 'side-outer',
    label: 'Lateral Externa',
    fileName: 'Lateral Externa.pdf',
    url: '/moldes/karv-chair/v2/lateral-externa.pdf',
    sha256: 'ca3c423adf3be8714bcfcf80744bb15797d16373fa67ad3fe21aec86904884fd',
  },
  {
    surfaceId: 'side-inner',
    label: 'Lateral Interna',
    fileName: 'Lateral Interna.pdf',
    url: '/moldes/karv-chair/v2/lateral-interna.pdf',
    sha256: '2515ff834b6a2e4e49d562255a3a14df461cb5674b726feed7ce37868bc2fb21',
  },
  {
    surfaceId: 'side-rear',
    label: 'Lateral Traseira',
    fileName: 'Lateral Traseira.pdf',
    url: '/moldes/karv-chair/v2/lateral-rear.pdf',
    sha256: '00ec808d024fc41ef8079b64fd3780ce65d57c7aa44d87d7f8af7810a2c4acd0',
  },
  {
    surfaceId: 'side-top',
    label: 'Tira Superior da Lateral',
    fileName: 'Tira Superior da Lateral.pdf',
    url: '/moldes/karv-chair/v2/lateral-top.pdf',
    sha256: '12ab5cf059459df35140e2340502402d90ab884a565c8de3d054707dd609f128',
  },
] as const satisfies readonly MoldDefinition[]);

export const AVAILABLE_MOLDS = Object.freeze(MOLD_REGISTRY.filter((mold) => mold.url !== null));

export function moldForSurface(surfaceId: string | null): MoldDefinition | null {
  return MOLD_REGISTRY.find((mold) => mold.surfaceId === surfaceId) ?? null;
}
