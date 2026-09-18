import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight,
    Briefcase,
    CalendarClock,
    Check,
    CheckCircle2,
    Clock,
    Menu,
    Sparkles,
    WifiOff,
    X,
    Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { InteractiveBackground } from './InteractiveBackground';
import { InteractiveIcon } from './InteractiveIcon';

/**
 * Pazarlama sayfası — kök adreste (`/`) yaşar, uygulama `/app` altındadır.
 *
 * 21st.dev'deki bir landing şablonundan uyarlandı.
 * Yeni tasarım dili: Zümrüt Yeşili (Emerald) & Elektrik Camgöbeği (Cyan)
 * İnteraktif parçacık tuvali ve mikro-etkileşimli ikonlar.
 */

const NAV_LINKS = [{ href: '#features', labelKey: 'nav.features' }] as const;

/* ─── Background Effects ─── */

function HeroGlow() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
            {/* Primary emerald orb */}
            <div className="absolute left-1/2 top-[-20%] h-[600px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/20 via-accent/15 to-transparent blur-[110px]" />
            {/* Secondary cyan orb */}
            <div className="absolute right-[-10%] top-[30%] h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
            {/* Ambient mint glow */}
            <div className="absolute left-[-10%] top-[45%] h-[380px] w-[380px] rounded-full bg-primary/10 blur-[130px]" />
            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
    );
}

function GridBackground() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-20 bg-grid-pattern opacity-60"
        />
    );
}

/* ─── App Preview Mock ─── */

function AppPreview() {
    const { t } = useTranslation();

    const rows = [
        { key: t('landing.previewTaskOne'), done: false, badge: true, priority: 'high' },
        { key: t('landing.previewTaskTwo'), done: false, badge: true, priority: 'medium' },
        { key: t('landing.previewTaskThree'), done: true, badge: false, priority: 'low' },
    ];

    /* Maketteki noktalar uygulamanın gerçek öncelik rozetleriyle aynı
     * token'ları kullanır; ayrı sabit renkler olsaydı pazarlama sayfası
     * ürünü olduğundan farklı gösterirdi. */
    const priorityColors: Record<string, string> = {
        high: 'bg-destructive',
        medium: 'bg-warning',
        low: 'bg-success',
    };

    return (
        <div
            role="img"
            aria-label={t('landing.previewLabel')}
            className="w-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-4 shadow-2xl shadow-primary/5 sm:p-6 animate-fade-in hover:border-primary/30 transition-all duration-300"
            style={{ animationDelay: '400ms' }}
        >
            {/* Mock toolbar */}
            <div className="mb-4 flex items-center gap-2 border-b border-border/50 pb-3">
                <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-destructive/70 transition-transform hover:scale-125 cursor-pointer" />
                    <span className="h-3 w-3 rounded-full bg-highlight/80 transition-transform hover:scale-125 cursor-pointer" />
                    <span className="h-3 w-3 rounded-full bg-success/70 transition-transform hover:scale-125 cursor-pointer" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1">
                    <InteractiveIcon type="bounce">
                        <CheckCircle2 size={13} className="text-primary" />
                    </InteractiveIcon>
                    <span className="text-xs font-medium text-muted-foreground">{t('app.name')}</span>
                </div>
                <div className="w-[54px]" /> {/* Spacer for centering */}
            </div>

            {/* Task rows */}
            <ul className="space-y-2">
                {rows.map((row, i) => (
                    <li
                        key={row.key}
                        className={cn(
                            'group flex items-center gap-3 rounded-xl border border-border/30 bg-background/60 p-3 transition-all duration-300',
                            !row.done && 'hover:border-primary/30 hover:bg-background/90 hover:shadow-sm'
                        )}
                        style={{ animationDelay: `${500 + i * 100}ms` }}
                    >
                        {/* Priority indicator */}
                        <span className={cn('h-8 w-1 rounded-full transition-all group-hover:w-1.5', priorityColors[row.priority])} />

                        {/* Checkbox with interactive bounce */}
                        <span
                            className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all group-hover:scale-110',
                                row.done
                                    ? 'border-primary bg-primary text-primary-foreground scale-100'
                                    : 'border-muted-foreground/30 hover:border-primary/50'
                            )}
                        >
                            {row.done && <Check size={12} strokeWidth={3} />}
                        </span>

                        {/* Text */}
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate text-sm font-medium',
                                row.done && 'text-muted-foreground line-through'
                            )}
                        >
                            {row.key}
                        </span>

                        {/* Client badge */}
                        {row.badge && (
                            <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:flex transition-transform group-hover:scale-105">
                                <InteractiveIcon type="wiggle">
                                    <Briefcase size={11} />
                                </InteractiveIcon>
                                {t('landing.previewClient')}
                            </span>
                        )}

                        {/* Timer indicator */}
                        {!row.done && row.priority === 'high' && (
                            <span className="hidden items-center gap-1 text-xs text-accent font-mono sm:flex transition-transform group-hover:scale-105">
                                <InteractiveIcon type="spin">
                                    <Clock size={11} />
                                </InteractiveIcon>
                                2:45
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ─── Navigation ─── */

function LandingNav() {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 z-50 w-full border-b border-border/50 glass-strong">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <Link to="/" className="group flex items-center gap-2.5 font-bold tracking-tight">
                    <InteractiveIcon type="spin" glowColor="hsl(var(--primary) / 0.5)">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
                            <CheckCircle2 size={18} strokeWidth={2.5} />
                        </span>
                    </InteractiveIcon>
                    <span className="text-gradient font-display text-lg font-extrabold">{t('app.name')}</span>
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    {NAV_LINKS.map(({ href, labelKey }) => (
                        <a
                            key={href}
                            href={href}
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {t(labelKey)}
                        </a>
                    ))}
                </div>

                <div className="hidden items-center gap-3 md:flex">
                    <Link
                        to="/app"
                        className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/35 active:scale-[0.98]"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {t('landing.cta')}
                            <InteractiveIcon type="bounce">
                                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                            </InteractiveIcon>
                        </span>
                        <span className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100 animate-shimmer" />
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    aria-expanded={isMenuOpen}
                    aria-label={isMenuOpen ? t('landing.menuClose') : t('landing.menuOpen')}
                    className="rounded-lg p-2 text-foreground transition-colors hover:bg-secondary md:hidden"
                >
                    <InteractiveIcon type="wiggle">
                        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </InteractiveIcon>
                </button>
            </nav>

            {isMenuOpen && (
                <div className="border-t border-border/50 glass-strong md:hidden">
                    <div className="flex flex-col gap-4 px-6 py-4">
                        {NAV_LINKS.map(({ href, labelKey }) => (
                            <a
                                key={href}
                                href={href}
                                onClick={() => setIsMenuOpen(false)}
                                className="py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {t(labelKey)}
                            </a>
                        ))}
                        <div className="flex flex-col gap-3 border-t border-border/50 pt-4">
                            <Link
                                to="/app"
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl active:scale-[0.98]"
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

/* ─── Hero ─── */

function Hero() {
    const { t } = useTranslation();

    return (
        <section className="relative flex flex-col items-center px-6 pb-24 pt-32 md:pt-44">
            <HeroGlow />
            <GridBackground />

            {/* Badge with interactive sparkle */}
            <p className="group mb-8 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10 animate-fade-in cursor-default">
                <InteractiveIcon type="wiggle">
                    <Sparkles size={14} className="text-primary" />
                </InteractiveIcon>
                <span className="text-xs font-medium text-muted-foreground">{t('landing.badge')}</span>
                <a
                    href="#features"
                    className="flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80"
                >
                    {t('landing.badgeLink')}
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </a>
            </p>

            {/* Heading */}
            <h1
                className="mb-6 max-w-4xl text-balance text-center text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl animate-fade-in"
                style={{ animationDelay: '100ms' }}
            >
                <span className="text-gradient">{t('landing.title')}</span>
            </h1>

            {/* Subtitle */}
            <p
                className="mb-10 max-w-2xl text-pretty text-center text-base text-muted-foreground md:text-lg animate-fade-in"
                style={{ animationDelay: '200ms' }}
            >
                {t('landing.subtitle')}
            </p>

            {/* CTA */}
            <div className="mb-4 flex items-center gap-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
                <Link
                    to="/app"
                    className="group relative inline-flex h-13 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-accent px-8 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/45 active:scale-[0.97]"
                >
                    <span className="relative z-10 flex items-center gap-2.5">
                        {t('landing.cta')}
                        <InteractiveIcon type="bounce">
                            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                        </InteractiveIcon>
                    </span>
                    <span className="absolute inset-0 bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100 animate-shimmer" />
                </Link>
            </div>

            <p className="mb-20 text-xs font-medium text-muted-foreground animate-fade-in" style={{ animationDelay: '350ms' }}>
                {t('landing.ctaSecondary')}
            </p>

            {/* App Preview */}
            <div className="w-full max-w-3xl relative z-10">
                <AppPreview />
            </div>
        </section>
    );
}

/* ─── Features (Bento Grid) ─── */

function Features() {
    const { t } = useTranslation();

    const items = [
        {
            icon: Briefcase,
            title: t('landing.featureLinkTitle'),
            body: t('landing.featureLinkBody'),
            gradient: 'from-primary/10 to-accent/10',
            iconBg: 'bg-primary/10 text-primary border border-primary/20',
            interaction: 'tilt' as const,
            glow: 'hsl(var(--primary) / 0.4)',
        },
        {
            icon: CalendarClock,
            title: t('landing.featureDeliveryTitle'),
            body: t('landing.featureDeliveryBody'),
            gradient: 'from-accent/10 to-primary/10',
            iconBg: 'bg-accent/10 text-accent border border-accent/20',
            interaction: 'spin' as const,
            glow: 'hsl(var(--accent) / 0.4)',
        },
        {
            icon: WifiOff,
            title: t('landing.featureOfflineTitle'),
            body: t('landing.featureOfflineBody'),
            gradient: 'from-highlight/10 to-primary/10',
            iconBg: 'bg-highlight/15 text-highlight border border-highlight/25',
            interaction: 'wiggle' as const,
            glow: 'hsl(var(--highlight) / 0.45)',
        },
    ];

    return (
        <section id="features" className="relative border-t border-border/50 px-6 py-24 scroll-mt-20">
            <div className="mx-auto max-w-5xl">
                <div className="mb-12 text-center">
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                        <InteractiveIcon type="bounce">
                            <Zap size={12} />
                        </InteractiveIcon>
                        {t('nav.features')}
                    </span>
                    <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                        {t('landing.featuresTitle')}
                    </h2>
                </div>

                <ul className="grid gap-5 md:grid-cols-3 stagger-children">
                    {items.map(({ icon: Icon, title, body, gradient, iconBg, interaction, glow }) => (
                        <li
                            key={title}
                            className={cn(
                                'group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 shadow-sm transition-all duration-300',
                                'hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1.5',
                                'bg-gradient-to-br',
                                gradient
                            )}
                        >
                            <div className="mb-4">
                                <InteractiveIcon type={interaction} glowColor={glow}>
                                    <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform', iconBg)}>
                                        <Icon size={22} />
                                    </span>
                                </InteractiveIcon>
                            </div>
                            <h3 className="mb-2 text-lg font-bold tracking-tight group-hover:text-primary transition-colors">{title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/* ─── Footer ─── */

function Footer() {
    const { t } = useTranslation();

    return (
        <footer className="border-t border-border/50 px-6 py-12">
            <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
                <Link to="/" className="group flex items-center gap-2 font-bold">
                    <InteractiveIcon type="spin">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
                            <CheckCircle2 size={14} strokeWidth={2.5} />
                        </span>
                    </InteractiveIcon>
                    <span className="text-gradient font-display font-bold">{t('app.name')}</span>
                </Link>
                <p className="text-sm text-muted-foreground">
                    © {new Date().getFullYear()} {t('app.name')}
                </p>
            </div>
        </footer>
    );
}

/* ─── Page ─── */

export function SaasTemplate() {
    return (
        <main className="min-h-screen bg-background text-foreground relative overflow-hidden">
            {/* Interactive Particle Constellation Canvas */}
            <InteractiveBackground variant="full" />

            <div className="relative z-10">
                <LandingNav />
                <Hero />
                <Features />
                <Footer />
            </div>
        </main>
    );
}
