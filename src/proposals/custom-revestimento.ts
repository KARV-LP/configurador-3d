/** Contrato exclusivo de proposta; não é PublicMaterial da Biblioteca KARV. */
export interface CustomRevestimento {
  readonly kind: 'custom';
  readonly proposal_id: string;
  readonly surface_id: string;
  readonly asset_version: number;
  readonly validation_status: 'draft' | 'approved' | 'rejected';
  readonly base_color: Readonly<{
    uri: string;
    media_type: 'image/webp';
    sha256: string;
    byte_length: number;
    width_px: number;
    height_px: number;
  }>;
  readonly physical_size_mm: Readonly<{ width: number; height: number }>;
  readonly orientation: 'canonical-uv';
  readonly lifecycle: 'archive-on-replacement';
}
