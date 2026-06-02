import { useState } from 'react';
import { motion } from 'framer-motion';

const PAGE_SIZE = 9;

export default function PaginatedGridGallery({ images, onPreview }: { images: string[]; onPreview?: (url: string, index: number) => void }) {
  const [page, setPage] = useState(0);
  const pages = Array.from({ length: Math.ceil(images.length / PAGE_SIZE) }, (_, i) =>
    images.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE)
  );

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < -60 && page < pages.length - 1) setPage(p => p + 1);
    else if (info.offset.x > 60 && page > 0) setPage(p => p - 1);
  };

  if (images.length === 0) return null;

  return (
    <div>
      <motion.div
        className="flex overflow-hidden"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <motion.div
          className="grid grid-cols-3 gap-1 w-full shrink-0"
          animate={{ x: `-${page * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {images.slice(0, PAGE_SIZE * pages.length).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onPreview?.(url, i)}
              loading="lazy"
            />
          ))}
        </motion.div>
      </motion.div>
      {/* Page indicator */}
      {pages.length > 1 && (
        <div className="flex justify-center mt-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 bg-black/40 px-2 py-0.5 rounded-full">{page + 1}/{pages.length}</span>
        </div>
      )}
    </div>
  );
}
