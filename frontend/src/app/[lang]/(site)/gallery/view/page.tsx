'use client';
import { TitledImagesView } from '@/components/site/titled-images-view';

export default function GalleryViewPage() {
  return <TitledImagesView endpoint="/public/gallery" back="/gallery" backLabel="pub.backGallery" />;
}
