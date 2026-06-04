import { ImgHTMLAttributes, RefObject, useEffect, useRef, useState } from 'react';

const CACHE_NAME = 'echo-photo-cache-v1';

interface CachedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export default function CachedImage({ src, alt = '', className = '', ...props }: CachedImageProps) {
  const imgRef = useRef<HTMLElement | null>(null);
  const objectUrlRef = useRef('');
  const [active, setActive] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState('');

  useEffect(() => {
    const element = imgRef.current;
    if (!element || !src) return;
    if (!('IntersectionObserver' in window)) {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (!active || !src) return;
    let cancelled = false;

    async function load() {
      if (/^(blob:|data:)/.test(src) || !('caches' in window)) {
        if (!cancelled) setResolvedSrc(src);
        return;
      }

      try {
        const cache = await caches.open(CACHE_NAME);
        let response = await cache.match(src);
        if (!response) {
          response = await fetch(src, { credentials: 'same-origin', cache: 'force-cache' });
          if (response.ok) await cache.put(src, response.clone());
        }
        const blob = await response.blob();
        if (cancelled) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(blob);
        setResolvedSrc(objectUrlRef.current);
      } catch {
        if (!cancelled) setResolvedSrc(src);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [active, src]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return (
    resolvedSrc ? (
      <img
        ref={imgRef as RefObject<HTMLImageElement>}
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
        {...props}
      />
    ) : (
      <div
        ref={imgRef as RefObject<HTMLDivElement>}
        className={`${className} bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800`}
        aria-hidden="true"
      />
    )
  );
}
