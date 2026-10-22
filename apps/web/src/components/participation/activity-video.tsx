import { youtubeVideoId } from "@/lib/participation/youtube";

export function ActivityVideo({ url, title }: { url: string; title: string }) {
  const videoId = youtubeVideoId(url);
  if (!videoId) return <p className="mt-3 text-sm text-muted-foreground">El enlace del video no es válido. Solicita al consultor que lo revise.</p>;

  return <div className="mt-4 min-w-0 space-y-2">
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?hl=es&playsinline=1`}
        title={`Video de la actividad: ${title}`}
        className="aspect-video min-h-[200px] w-full border-0"
        loading="lazy"
        allow="encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Si el video no se reproduce aquí, puedes abrirlo en YouTube.</p>
    <a href={url} target="_blank" rel="noopener noreferrer" className="rti-link inline-block text-sm">Ver video en YouTube</a>
  </div>;
}
