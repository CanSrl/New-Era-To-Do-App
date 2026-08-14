import { useTranslation } from 'react-i18next';
import { useTaskStore } from '../store';
import { FILTERS } from '../lib/types';
import { Search, ListFilter } from 'lucide-react';

export function FilterBar() {
    const { t } = useTranslation();
    const searchQuery = useTaskStore(state => state.searchQuery);
    const setSearchQuery = useTaskStore(state => state.setSearchQuery);
    const filter = useTaskStore(state => state.filter);
    const setFilter = useTaskStore(state => state.setFilter);

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Search size={18} />
                </div>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full h-11 pl-10 pr-3 rounded-xl border border-input shadow-sm bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder={t('tasks.searchPlaceholder')}
                />
            </div>

            <div className="flex h-11 p-1 items-center bg-card rounded-xl border border-border shadow-sm overflow-hidden min-w-[300px]">
                {FILTERS.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-1 h-full text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${filter === f
                                ? 'bg-secondary text-secondary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            }`}
                    >
                        {f === 'all' && <ListFilter size={14} />}
                        {t(`filter.${f}`)}
                    </button>
                ))}
            </div>
        </div>
    );
}
