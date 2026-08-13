import { useState } from 'react';
import { Download, LogIn, LogOut, Monitor, Moon, Sun, Upload, User } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme, type Theme } from '../components/ThemeProvider';
import { useAuth } from '../components/AuthProvider';
import { SyncIndicator } from '../components/SyncIndicator';
import { AuthDialog } from '../components/AuthDialog';
import { CategoryManager } from '../components/CategoryManager';
import { useTaskStore } from '../store';
import { cn } from '../lib/utils';

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Açık', icon: Sun },
    { value: 'system', label: 'Sistem', icon: Monitor },
    { value: 'dark', label: 'Koyu', icon: Moon },
];

function Section({ title, description, children }: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-bold tracking-tight mb-1">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
            <div className={description ? '' : 'mt-4'}>{children}</div>
        </section>
    );
}

export function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const { user, isConfigured, signOut } = useAuth();
    const tasks = useTaskStore(state => state.tasks);
    const importTasks = useTaskStore(state => state.importTasks);
    const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);

    const handleExport = () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', 'yapilacaklar_export.json');
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Görevler başarıyla dışa aktarıldı');
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (!Array.isArray(imported)) {
                    toast.error('Geçersiz dosya formatı');
                    return;
                }
                const added = importTasks(imported);
                if (added === 0) {
                    toast.info('İçe aktarılacak yeni görev bulunamadı');
                } else {
                    toast.success(`${added} görev içe aktarıldı`);
                }
            } catch {
                toast.error('Dosya okunamadı');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (error) {
            toast.error(error);
            return;
        }
        toast.success('Çıkış yapıldı. Görevlerin bu cihazda duruyor.');
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Ayarlar</h2>

            <div className="space-y-4">
                <Section title="Görünüm" description="Uygulamanın tema tercihi.">
                    <div
                        role="radiogroup"
                        aria-label="Tema"
                        className="flex gap-2"
                    >
                        {THEMES.map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                role="radio"
                                aria-checked={theme === value}
                                onClick={() => setTheme(value)}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all',
                                    theme === value
                                        ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20'
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                )}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        ))}
                    </div>
                </Section>

                {isConfigured && (
                    <Section
                        title="Hesap"
                        description="Giriş yapmak isteğe bağlıdır. Görevleriniz her hâlükârda bu cihazda saklanır; giriş yaparsanız cihazlar arasında eşitlenir."
                    >
                        {user ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                                        <User size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{user.email}</p>
                                        <SyncIndicator />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                                >
                                    <LogOut size={16} />
                                    Çıkış Yap
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsAuthDialogOpen(true)}
                                className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                            >
                                <LogIn size={16} />
                                Giriş Yap
                            </button>
                        )}
                    </Section>
                )}

                <Section
                    title="Kategoriler"
                    description="Görevlerinizi gruplamak için kendi kategorilerinizi tanımlayın. Bir kategoriyi silmek görevlerini silmez."
                >
                    <CategoryManager />
                </Section>

                <Section
                    title="Veri"
                    description="Görevlerinizi JSON dosyası olarak yedekleyin veya geri yükleyin."
                >
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                        >
                            <Download size={16} />
                            Dışa Aktar
                        </button>
                        <label className="flex items-center gap-2 h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors cursor-pointer">
                            <Upload size={16} />
                            İçe Aktar
                            <input
                                type="file"
                                accept=".json"
                                className="sr-only"
                                onChange={handleImport}
                            />
                        </label>
                    </div>
                </Section>
            </div>

            <AuthDialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen} />
        </div>
    );
}
