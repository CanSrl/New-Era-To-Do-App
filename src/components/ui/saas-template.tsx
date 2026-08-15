import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight,
    Briefcase,
    CalendarClock,
    Check,
    CheckCircle2,
    Menu,
    WifiOff,
    X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Pazarlama sayfası — kök adreste (`/`) yaşar, uygulama `/app` altındadır.
 *
 * 21st.dev'deki bir landing şablonundan uyarlandı. Özgün hâlinden üç şey
 * bilinçli olarak çıkarıldı:
 *
 * 1. **Global `* { font-family }` seçicisi ve Google Fonts `@import`'u.**
 *    Bileşen içine gömülü bir `<style>` etiketiyle geliyorlardı; mount olduğu
 *    anda bütün uygulamanın yazı tipini değiştirir ve her açılışta dış ağ
 *    isteği yaparlardı. Sayfa artık uygulamanın kendi yığınını kullanıyor.
 * 2. **Dış görseller** (`i.postimg.cc`). Uygulama çevrimdışı çalışan bir PWA;
 *    hero görseli üçüncü taraf bir servise bağlı olamaz. Parıltı CSS gradyanı
 *    oldu, ekran görüntüsünün yerini aşağıdaki `AppPreview` maketi aldı.
 *    Gerçek ekran görüntüleri Faz 6'da, i18n tamamlandıktan sonra çekilecek.
 * 3. **Sabit siyah/gri renkler.** Hepsi token'a çevrildi; sayfa açık ve koyu
 *    temada da doğru görünüyor.
 *
 * "Sign in / Sign Up" ikilisi de tek bir CTA'ya indi: uygulama local-first,
 * giriş isteğe bağlı. Kayıt duvarı olmayan bir ürüne kayıt butonu koymak
 * ziyaretçiye yanlış söz verirdi.
 */

const NAV_LINKS = [{ href: '#features', labelKey: 'nav.features' }] as const;

/** Hero'nun arkasındaki parıltı. Görsel değil gradyan: 0 byte, temaya uyar. */
function HeroGlow() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden"
        >
            <div className="absolute left-1/2 top-[-180px] h-[420px] w-[820px] max-w-[140vw] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>
    );
}

/**
 * Ürünün kendisini gösteren küçük maket.
 *
 * Stok bir dashboard ekran görüntüsü yerine uygulamanın gerçek arayüz
 * dilini — görev kartı, müşteri rozeti, tamamlama dairesi — kendi
 * token'larımızla çiziyor. Böylece tema değiştiğinde birlikte değişir ve
 * ürünle arasındaki fark zamanla açılmaz.
 */
function AppPreview() {
    const { t } = useTranslation();

    const rows = [
        { key: t('landing.previewTaskOne'), done: false, badge: true },
        { key: t('landing.previewTaskTwo'), done: false, badge: true },
        { key: t('landing.previewTaskThree'), done: true, badge: false },
    ];

    return (
        <div
            role="img"
            aria-label={t('landing.previewLabel')}
            className="w-full rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        >
            <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <CheckCircle2 size={16} className="text-primary" />
                <span className="text-sm font-semibold">{t('app.name')}</span>
            </div>

            <ul className="space-y-2">
                {rows.map((row) => (
                    <li
                        key={row.key}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3"
                    >
                        <span
                            className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                row.done
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-muted-foreground/30'
                            )}
                        >
                            {row.done && <Check size={12} strokeWidth={3} />}
                        </span>

                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate text-sm',
                                row.done && 'text-muted-foreground line-through'
                            )}
                        >
                            {row.key}
                        </span>

                        {row.badge && (
                            <span className="hidden shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:flex">
                                <Briefcase size={12} />
                                {t('landing.previewClient')}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function LandingNav() {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                        <CheckCircle2 size={18} strokeWidth={2.5} />
                    </span>
                    {t('app.name')}
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map(({ href, labelKey }) => (
                        <a
                            key={href}
                            href={href}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t(labelKey)}
                        </a>
                    ))}
                </div>

                {/*
                  * Dil seçici bilinçli olarak yok: tarayıcıdan algılanıyor ve
                  * ayarlar sayfasında değiştirilebiliyor. Buradaki seçici
                  * ayarlar ölçüsünde bir kontrol olurdu.
                  */}
                <div className="hidden items-center gap-3 md:flex">
                    <Link
                        to="/app"
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
                    >
                        {t('landing.cta')}
                        <ArrowRight size={16} />
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    aria-expanded={isMenuOpen}
                    aria-label={isMenuOpen ? t('landing.menuClose') : t('landing.menuOpen')}
                    className="rounded-md p-2 text-foreground transition-colors hover:bg-muted md:hidden"
                >
                    {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </nav>

            {isMenuOpen && (
                <div className="border-t border-border bg-background/95 backdrop-blur-md md:hidden">
                    <div className="flex flex-col gap-4 px-6 py-4">
                        {NAV_LINKS.map(({ href, labelKey }) => (
                            <a
                                key={href}
                                href={href}
                                onClick={() => setIsMenuOpen(false)}
                                className="py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {t(labelKey)}
                            </a>
                        ))}
                        <div className="flex flex-col gap-3 border-t border-border pt-4">
                            <Link
                                to="/app"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
                            >
                                {t('landing.cta')}
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

function Hero() {
    const { t } = useTranslation();

    return (
        <section className="relative flex flex-col items-center px-6 pb-20 pt-32 md:pt-40">
            <HeroGlow />

            <p className="mb-8 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 backdrop-blur-sm">
                <span className="text-xs text-muted-foreground">{t('landing.badge')}</span>
                <a
                    href="#features"
                    className="flex items-center gap-1 text-xs font-medium text-foreground transition-opacity hover:opacity-70"
                >
                    {t('landing.badgeLink')}
                    <ArrowRight size={12} />
                </a>
            </p>

            <h1 className="mb-6 max-w-3xl text-balance text-center text-4xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl">
                {t('landing.title')}
            </h1>

            <p className="mb-10 max-w-2xl text-pretty text-center text-sm text-muted-foreground md:text-base">
                {t('landing.subtitle')}
            </p>

            <div className="mb-4 flex items-center gap-4">
                <Link
                    to="/app"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95"
                >
                    {t('landing.cta')}
                    <ArrowRight size={18} />
                </Link>
            </div>

            <p className="mb-16 text-xs text-muted-foreground">{t('landing.ctaSecondary')}</p>

            <div className="w-full max-w-3xl">
                <AppPreview />
            </div>
        </section>
    );
}

function Features() {
    const { t } = useTranslation();

    const items = [
        {
            icon: Briefcase,
            title: t('landing.featureLinkTitle'),
            body: t('landing.featureLinkBody'),
        },
        {
            icon: CalendarClock,
            title: t('landing.featureDeliveryTitle'),
            body: t('landing.featureDeliveryBody'),
        },
        {
            icon: WifiOff,
            title: t('landing.featureOfflineTitle'),
            body: t('landing.featureOfflineBody'),
        },
    ];

    return (
        <section id="features" className="border-t border-border px-6 py-20 scroll-mt-20">
            <div className="mx-auto max-w-5xl">
                <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight md:text-3xl">
                    {t('landing.featuresTitle')}
                </h2>

                <ul className="grid gap-4 md:grid-cols-3">
                    {items.map(({ icon: Icon, title, body }) => (
                        <li key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Icon size={20} />
                            </span>
                            <h3 className="mb-1 font-semibold tracking-tight">{title}</h3>
                            <p className="text-sm text-muted-foreground">{body}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

export function SaasTemplate() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <LandingNav />
            <Hero />
            <Features />
        </main>
    );
}
