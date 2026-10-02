import { notFound } from 'next/navigation';
import { Showcase } from './showcase';

/** Vitrine du Design System : developpement uniquement. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Showcase />;
}
