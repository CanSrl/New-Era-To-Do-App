import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from './ThemeProvider';
import { Moon, Sun, Monitor, CheckCircle2, Clock, ListTodo, PackageOpen, PlusCircle, Settings, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { NICHE_MODULE } from '../config/features';
import type { TranslationKey } from '../i18n';
import { useTaskStore } from '../store';
import { useUiStore } from '../store/ui';
import { ActiveTimerBar } from '../features/time/ActiveTimerBar';
import { AccountMenu } from './AccountMenu';
import { AuthDialog } from './AuthDialog';
import { TaskForm } from './TaskForm';
import { InteractiveBackground } from './ui/InteractiveBackground';
import { InteractiveIcon } from './ui/InteractiveIcon';

interface NavItem {
    to: string;
    labelKey: TranslationKey;
    /** Mobil alt gezinmede yer kısıtlı; orada bu kısa etiket kullanılır. */
    shortLabelKey: TranslationKey;
    icon: typeof ListTodo;
    end: boolean;
}

/**
 * Niş öğeler (Teslim, Zaman, Müşteriler) `NICHE_MODULE` kapılıdır — rotaların
 * kendisi de öyle (bkz. `router.tsx`). İkisi ayrışırsa gezinme var olmayan
 * bir adrese götürürdü.
 *
 * Sıra kullanım sıklığına göre: Teslim ve Zaman günlük olarak okunan ekranlar,
 * müşteri/proje yönetimi ise ara sıra girilen bir kurulum ekranı.
 */
const NAV_ITEMS: NavItem[] = [
    { to: '/app', labelKey: 'nav.tasks', shortLabelKey: 'nav.tasksShort', icon: ListTodo, end: true },
    ...(NICHE_MODULE
        ? [
            {
                to: '/app/delivery',
                labelKey: 'nav.delivery' as TranslationKey,
                shortLabelKey: 'nav.deliveryShort' as TranslationKey,
                icon: PackageOpen,
                end: false,
            },
            {
                to: '/app/time',
                labelKey: 'nav.time' as TranslationKey,
                shortLabelKey: 'nav.timeShort' as TranslationKey,
                icon: Clock,
                end: false,
            },
            {
                to: '/app/clients',
                labelKey: 'nav.clients' as TranslationKey,
                shortLabelKey: 'nav.clientsShort' as TranslationKey,
                icon: Users,
                end: false,
            },
        ]
        : []),
    { to: '/app/settings', labelKey: 'nav.settings', shortLabelKey: 'nav.settings', icon: Settings, end: false },
];

/**
 * Mobil alt gezinme: merkezdeki ekleme butonu iki grubun arasında durur.
 * Öğeler ikiye bölünür ki buton her zaman ortada kalsın — sabit bir
 * `grid-cols-3` olsaydı üçüncü gezinme öğesi merkezi kaydırırdı.
 *
 * ⚠️ Öğe sayısı beşe çıktığı için bölüm 3/2: merkez buton bir öğe genişliği
 * kadar sağa kayar. Bu **kabul edilmiş** bedeldir (spec §4.3) — simetriyi
 * korumak için gezinme öğesi çıkarmayın.
 */
const NAV_SPLIT = Math.ceil(NAV_ITEMS.length / 2);

export function AppLayout() {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const tasks = useTaskStore((state) => state.tasks);
    const activeCount = tasks.filter(t => !t.completed).length;
    const openTaskForm = useUiStore((state) => state.openTaskForm);
    const closeTaskForm = useUiStore((state) => state.closeTaskForm);
    const isTaskFormOpen = useUiStore((state) => state.isTaskFormOpen);
    const editingTaskId = useUiStore((state) => state.editingTaskId);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

    // Görev formu kabukta yaşar: yüzen ekleme butonu ve mobil alt gezinmenin
    // merkez butonu her sayfada görünür, dolayısıyla form da her sayfada
    // açılabilmeli. Düzenlenen görev id üzerinden çözülür ki açık formdaki
    // kopya senkronizasyon sırasında bayatlamasın.
    const editingTask = editingTaskId
        ? tasks.find(t => t.id === editingTaskId)
        : undefined;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key.toLowerCase() === 'n' &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault();
                useUiStore.getState().openTaskForm();
            }
            if (e.key === 'Escape') {
                useUiStore.getState().closeTaskForm();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-300 relative overflow-hidden">
            {/* Subtle Interactive Ambient Canvas */}
            <InteractiveBackground variant="subtle" />

            {/* ─── Masaüstü kenar çubuğu ─── */}
            <aside className="hidden md:flex flex-col w-64 border-r border-border/50 glass-strong shrink-0 h-screen sticky top-0 p-4 z-10 backdrop-blur-xl">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-8 px-2">
                    <InteractiveIcon type="spin" glowColor="hsl(var(--primary) / 0.5)">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/25">
                            <CheckCircle2 size={18} strokeWidth={2.5} />
                        </div>
                    </InteractiveIcon>
                    <h1 className="font-bold text-lg tracking-tight text-gradient">{t('app.name')}</h1>
                </div>

                {/* Nav */}
                <nav className="flex-1 space-y-1">
                    {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) => cn(
                                'group w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-primary/10 text-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <span className="flex items-center gap-3">
                                        <span className={cn(
                                            'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6',
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                                                : 'bg-secondary/60 group-hover:bg-primary/15 group-hover:text-primary'
                                        )}>
                                            <Icon size={16} className="transition-transform duration-300" />
                                        </span>
                                        {t(labelKey)}
                                    </span>
                                    {to === '/app' && activeCount > 0 && (
                                        <span className={cn(
                                            'text-xs font-bold px-2 py-0.5 rounded-full inline-block transition-transform group-hover:scale-105',
                                            isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-primary/10 text-primary'
                                        )}>
                                            {activeCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom section */}
                <div className="pt-4 border-t border-border/50 mt-auto space-y-3">
                    <AccountMenu variant="sidebar" onSignInClick={() => setIsAuthDialogOpen(true)} />

                    <div className="flex items-center justify-between bg-secondary/40 p-1 rounded-xl">
                        <button
                            onClick={() => setTheme('light')}
                            className={cn('p-2 rounded-lg transition-all duration-200 group', theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label={t('theme.lightAria')}
                        >
                            <InteractiveIcon type="spin" interactive={theme !== 'light'}>
                                <Sun size={16} className="transition-transform group-hover:rotate-45" />
                            </InteractiveIcon>
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={cn('p-2 rounded-lg transition-all duration-200 group', theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label={t('theme.systemAria')}
                        >
                            <InteractiveIcon type="bounce" interactive={theme !== 'system'}>
                                <Monitor size={16} className="transition-transform group-hover:scale-110" />
                            </InteractiveIcon>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn('p-2 rounded-lg transition-all duration-200 group', theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            aria-label={t('theme.darkAria')}
                        >
                            <InteractiveIcon type="wiggle" interactive={theme !== 'dark'}>
                                <Moon size={16} className="transition-transform group-hover:-rotate-12" />
                            </InteractiveIcon>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ─── Mobil üst bar ─── */}
            <header className="md:hidden flex items-center justify-between p-4 border-b border-border/50 glass-strong sticky top-0 z-20">
                <div className="flex items-center gap-2.5">
                    <InteractiveIcon type="spin">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-sm">
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                        </div>
                    </InteractiveIcon>
                    <h1 className="font-bold text-lg text-gradient">{t('app.name')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <AccountMenu variant="compact" onSignInClick={() => setIsAuthDialogOpen(true)} />
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-xl bg-secondary/60 text-foreground transition-all hover:bg-secondary"
                        aria-label={theme === 'dark' ? t('theme.toggleToLight') : t('theme.toggleToDark')}
                    >
                        <InteractiveIcon type="spin">
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </InteractiveIcon>
                    </button>
                </div>
            </header>

            {/* ─── İçerik ─── */}
            <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto pb-32 md:pb-0 relative z-10">
                {/*
                  * Sayaç çubuğu kaydırılan alanın en üstünde yapışık durur:
                  * "unutulmuş açık sayaç" bu ürün kategorisinin klasik veri
                  * hatası ve tek gerçek savunması görünürlük. Kabukta olduğu
                  * için hangi sayfaya gidilirse gidilsin görünür.
                  */}
                {NICHE_MODULE && <ActiveTimerBar />}

                <div className="max-w-4xl w-full mx-auto p-4 md:p-8 flex-1">
                    <Outlet />
                </div>
            </main>

            {/* ─── Mobil alt gezinme ─── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 glass-strong z-20 pb-safe">
                <div className="flex items-center p-3">
                    <div className="flex flex-1 items-center">
                        {NAV_ITEMS.slice(0, NAV_SPLIT).map(({ to, shortLabelKey, icon: Icon, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) => cn(
                                    'group flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-200',
                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={cn(
                                            'flex h-8 w-8 items-center justify-center rounded-lg transition-all group-hover:scale-110',
                                            isActive && 'bg-primary/10'
                                        )}>
                                            <Icon size={20} />
                                        </span>
                                        <span className="text-[10px] font-semibold">{t(shortLabelKey)}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>

                    <div className="flex shrink-0 justify-center px-2">
                        <button
                            onClick={() => openTaskForm()}
                            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all -translate-y-6 group"
                            aria-label={t('tasks.addTask')}
                        >
                            <PlusCircle size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    <div className="flex flex-1 items-center">
                        {NAV_ITEMS.slice(NAV_SPLIT).map(({ to, shortLabelKey, icon: Icon, end }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                className={({ isActive }) => cn(
                                    'group flex flex-1 flex-col items-center justify-center gap-1 transition-all duration-200',
                                    isActive ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className={cn(
                                            'flex h-8 w-8 items-center justify-center rounded-lg transition-all group-hover:scale-110',
                                            isActive && 'bg-primary/10'
                                        )}>
                                            <Icon size={20} />
                                        </span>
                                        <span className="text-[10px] font-semibold">{t(shortLabelKey)}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </nav>

            {/* ─── Masaüstü yüzen ekleme butonu ─── */}
            <div className="hidden md:block fixed bottom-8 right-8 z-20">
                <button
                    onClick={() => openTaskForm()}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-primary/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-all group animate-pulse-glow"
                    title={t('tasks.addTask')}
                >
                    <PlusCircle size={28} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />

            {isTaskFormOpen && (
                <TaskForm onClose={closeTaskForm} taskToEdit={editingTask} />
            )}
        </div>
    );
}
