'use client';
import { TitledImagesView } from '@/components/site/titled-images-view';

export default function OccasionViewPage() {
  return <TitledImagesView endpoint="/public/occasions" back="/occasions/upcoming" backLabel="pub.upcoming" />;
}
