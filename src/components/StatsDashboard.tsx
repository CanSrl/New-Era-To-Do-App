import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { CheckCircle, AlertCircle, ListTodo } from 'lucide-react';
import { isDueToday } from '../lib/tasks';

export function StatsDashboard() {
    const { t } = useTranslation();
    const tasks = useTaskStore((state) => state.tasks);

    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    const dueToday = tasks.filter(t => isDueToday(t)).length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <ListTodo size={24} />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.total')}</p>
                    <p className="text-2xl font-bold">{total}</p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle size={24} />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <p className="text-sm text-muted-foreground font-medium">{t('stats.completed')}</p>
                        <span className="text-sm font-bold text-green-500">%{percent}</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mt-1.5">
                        <div
                            className="h-full bg-green-500 transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="w-12 h-12 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                    <AlertCircle size={24} />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">{t('stats.dueToday')}</p>
                    <p className="text-2xl font-bold flex items-center gap-2">
                        {dueToday}
                        {dueToday > 0 && (
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </p>
                </div>
                {dueToday > 0 && (
                    <div className="absolute top-0 right-0 w-max bg-red-500/10 text-red-500 text-xs px-2 py-1 rounded-bl-lg font-medium border-b border-l border-red-500/20">
                        {t('stats.urgent')}
                    </div>
                )}
            </div>

        </div>
    );
}
