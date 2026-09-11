import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { CheckCircle, AlertCircle, ListTodo } from 'lucide-react';
import { isDueToday } from '../lib/tasks';
import { InteractiveIcon } from './ui/InteractiveIcon';

export function StatsDashboard() {
    const { t } = useTranslation();
    const tasks = useTaskStore((state) => state.tasks);

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    const dueToday = tasks.filter(t => isDueToday(t)).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 stagger-children">

            {/* Total tasks - Cyber Cyan */}
            <div className="group bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300">
                <InteractiveIcon type="bounce" glowColor="rgba(6, 182, 212, 0.4)">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0 shadow-sm">
                        <ListTodo size={24} />
                    </div>
                </InteractiveIcon>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.total')}</p>
                    <p className="text-2xl font-bold tracking-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{total}</p>
                </div>
            </div>

            {/* Completed - Mint Emerald */}
            <div className="group bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300">
                <InteractiveIcon type="spin" glowColor="rgba(16, 185, 129, 0.4)">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
                        <CheckCircle size={24} />
                    </div>
                </InteractiveIcon>
                <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <p className="text-sm text-muted-foreground font-medium">{t('stats.completed')}</p>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">%{percent}</span>
                    </div>
                    <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden mt-1.5">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Due today - Coral Alert */}
            <div className="group bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-lg hover:shadow-rose-500/10 hover:border-rose-500/30 transition-all duration-300 relative overflow-hidden">
                <InteractiveIcon type="wiggle" glowColor="rgba(244, 63, 94, 0.4)">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/15 to-amber-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-sm">
                        <AlertCircle size={24} />
                    </div>
                </InteractiveIcon>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.dueToday')}</p>
                    <p className="text-2xl font-bold tracking-tight flex items-center gap-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {dueToday}
                        {dueToday > 0 && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                            </span>
                        )}
                    </p>
                </div>
                {dueToday > 0 && (
                    <div className="absolute top-0 right-0 w-max bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs px-2.5 py-1 rounded-bl-xl font-semibold border-b border-l border-rose-500/20">
                        {t('stats.urgent')}
                    </div>
                )}
            </div>

        </div>
    );
}
