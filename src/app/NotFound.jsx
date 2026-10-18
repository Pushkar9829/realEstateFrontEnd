// 404 inside the public layout (header, footer, skip link to <main>), in the
// interface language and in the public site's look.
import { MapPinOff, Search } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useT } from '@/shared/i18n';

export default function NotFound() {
  const t = useT();
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-sand-50 px-4 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 inline-flex rounded-full bg-gold-50 p-4 text-gold-700 ring-1 ring-gold-200"><MapPinOff className="h-7 w-7" aria-hidden /></div>
        <h1 className="font-display text-3xl font-medium text-navy-900">{t('common.notFound.title')}</h1>
        <p className="mt-3 text-sm text-navy-600">{t('common.notFound.text')}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="navy" className="!rounded-full px-6" to="/">{t('common.notFound.home')}</Button>
          <Button variant="outline" className="!rounded-full px-6" icon={Search} to="/search">{t('common.notFound.search')}</Button>
        </div>
      </div>
    </div>
  );
}
