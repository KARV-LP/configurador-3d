import { useState } from 'react';
import type { PublicMaterial } from '../materials/public-catalog';

export function RevestimentoGallery({
  material,
  selected,
  onSelect,
}: {
  readonly material: PublicMaterial;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState(false);
  const images = material.media?.images.length
    ? material.media.images
    : [{ src: material.assets.preview, alt: material.name }];
  const video = material.media?.video;
  const total = images.length + (video ? 1 : 0);
  const photo = images[active];
  const change = (index: number) => {
    setActive((index + total) % total);
    setFailed(false);
  };
  return (
    <section className="revestimento-gallery" aria-label={`Galeria de ${material.name}`}>
      <div className="revestimento-gallery__stage">
        {failed ? (
          <p role="status">Mídia indisponível. Selecione outra miniatura.</p>
        ) : photo ? (
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.alt || material.name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          video && (
            <video
              key={video.src}
              src={video.src}
              poster={video.poster || material.assets.preview}
              controls
              preload="none"
              playsInline
              onError={() => setFailed(true)}
            />
          )
        )}
        {total > 1 && (
          <div className="gallery-navigation">
            <button type="button" aria-label="Mídia anterior" onClick={() => change(active - 1)}>
              ‹
            </button>
            <button type="button" aria-label="Próxima mídia" onClick={() => change(active + 1)}>
              ›
            </button>
          </div>
        )}
      </div>
      <div
        className="revestimento-gallery__info"
        data-testid={selected ? 'selected-material' : undefined}
      >
        <span>{selected ? 'Revestimento selecionado' : 'Conheça o Revestimento'}</span>
        <h3>{material.name}</h3>
        <p>
          {material.category || material.materialType}
          {material.composition && ` · ${material.composition}`}
        </p>
        {material.description && <p>{material.description}</p>}
        <button type="button" className="button" onClick={onSelect} aria-pressed={selected}>
          Selecionar este Revestimento
        </button>
      </div>
      <div className="gallery-thumbnails" aria-label="Mídias do Revestimento">
        {images.map((item, index) => (
          <button
            type="button"
            key={`${item.src}-${index}`}
            aria-label={`Foto ${index + 1}`}
            aria-pressed={active === index}
            onClick={() => change(index)}
          >
            <img src={item.thumbnail || item.src} alt="" loading="lazy" decoding="async" />
            <span>{index + 1}</span>
          </button>
        ))}
        {video && (
          <button
            type="button"
            aria-label="Ver vídeo"
            aria-pressed={active === images.length}
            onClick={() => change(images.length)}
          >
            <img
              src={video.poster || material.assets.preview}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span>▶ Vídeo</span>
          </button>
        )}
      </div>
    </section>
  );
}
