import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { CheckCircle, AlertCircle, ListTodo } from 'lucide-react';
import { isDueToday } from '../lib/tasks';
import { InteractiveIcon } from './ui/InteractiveIcon';

/*
 * Üç kart, üç ayrı anlam ve her biri kendi token'ını kullanır:
 * toplam → `primary`, tamamlanan → `success`, bugün dolan → `highlight`
 * (sıcak amber). Kartlar eskiden doğrudan cyan/emerald/rose sınıfları
 * taşıyordu; palet değiştiğinde ekranın geri kalanından kopuyorlardı.
 */
export function StatsDashboard() {
    const { t } = useTranslation();
    const tasks = useTaskStore((state) => state.tasks);

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    const dueToday = tasks.filter(t => isDueToday(t)).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 stagger-children">

            {/* Toplam görev */}
            <div className="group bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4 shadow-e1 hover:shadow-e2 hover:border-primary/30 transition-all duration-300">
                <InteractiveIcon type="bounce" glowColor="hsl(var(--primary) / 0.4)">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <ListTodo size={24} />
                    </div>
                </InteractiveIcon>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.total')}</p>
                    <p className="text-2xl font-display font-bold tracking-tight tabular-nums group-hover:text-primary transition-colors">{total}</p>
                </div>
            </div>

            {/* Tamamlanan */}
            <div className="group bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4 shadow-e1 hover:shadow-e2 hover:border-success/30 transition-all duration-300">
                <InteractiveIcon type="spin" glowColor="hsl(var(--success) / 0.4)">
                    <div className="w-12 h-12 rounded-xl bg-success/10 text-success border border-success/20 flex items-center justify-center shrink-0">
                        <CheckCircle size={24} />
                    </div>
                </InteractiveIcon>
                <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <p className="text-sm text-muted-foreground font-medium">{t('stats.completed')}</p>
                        <span className="text-sm font-bold text-success tabular-nums">%{percent}</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mt-1.5">
                        <div
                            className="h-full bg-success transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Bugün dolan */}
            <div className="group bg-card border border-border/60 rounded-2xl p-5 flex items-center gap-4 shadow-e1 hover:shadow-e2 hover:border-highlight/40 transition-all duration-300 relative overflow-hidden">
                <InteractiveIcon type="wiggle" glowColor="hsl(var(--highlight) / 0.45)">
                    <div className="w-12 h-12 rounded-xl bg-highlight/15 text-highlight border border-highlight/30 flex items-center justify-center shrink-0">
                        <AlertCircle size={24} />
                    </div>
                </InteractiveIcon>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.dueToday')}</p>
                    <p className="text-2xl font-display font-bold tracking-tight tabular-nums flex items-center gap-2 group-hover:text-highlight transition-colors">
                        {dueToday}
                        {dueToday > 0 && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-highlight opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-highlight"></span>
                            </span>
                        )}
                    </p>
                </div>
                {dueToday > 0 && (
                    /* Amber zeminde beyaz metin okunmaz; rozet bu yüzden
                     * `highlight-foreground` (koyu) ile yazılır. */
                    <div className="absolute top-0 right-0 w-max bg-highlight text-highlight-foreground text-xs px-2.5 py-1 rounded-bl-xl font-semibold">
                        {t('stats.urgent')}
                    </div>
                )}
            </div>

        </div>
    );
}
