import { useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTaskStore } from '../store';
import { byCategoryPosition, CATEGORY_COLORS, CATEGORY_NAME_MAX } from '../lib/categories';
import type { Category } from '../lib/types';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from './ui/alert-dialog';

const inputClass =
    'h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * Renk seçici.
 *
 * Yerel `input[type=color]` bilinçli tercih: değeri her zaman '#rrggbb'
 * biçiminde küçük harf döndürür, yani veritabanı kısıtını istemcide ayrıca
 * doğrulamak gerekmez. `list` ile önerilen paleti gösterir ama kullanıcıyı
 * onunla sınırlamaz.
 */
function ColorInput({ value, onChange, label }: {
    value: string;
    onChange: (color: string) => void;
    label: string;
}) {
    const listId = useId();

    return (
        <>
            <input
                type="color"
                value={value}
                aria-label={label}
                onChange={(e) => onChange(e.target.value)}
                list={listId}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
            />
            <datalist id={listId}>
                {CATEGORY_COLORS.map((color) => (
                    <option key={color} value={color} />
                ))}
            </datalist>
        </>
    );
}

/**
 * Tek bir kategori satırı.
 *
 * Ad taslağı yerel tutulur ve yalnızca odak kaybında ya da Enter'da işlenir;
 * her tuş vuruşunda store'a yazmak kategoriyi sürekli "gönderilmeyi bekliyor"
 * durumuna sokardı.
 */
function CategoryRow({ category, taskCount }: { category: Category; taskCount: number }) {
    const updateCategory = useTaskStore((state) => state.updateCategory);
    const deleteCategory = useTaskStore((state) => state.deleteCategory);

    const [draft, setDraft] = useState(category.name);

    const commitName = () => {
        const trimmed = draft.trim();

        if (!trimmed) {
            setDraft(category.name);
            return;
        }
        if (trimmed === category.name) return;

        updateCategory(category.id, { name: trimmed });

        // Store adı reddetmiş olabilir (aynı ad başka kategoride kullanılıyor).
        const saved = useTaskStore.getState().categories.find((c) => c.id === category.id);
        if (saved?.name !== trimmed) {
            setDraft(category.name);
            toast.error(`"${trimmed}" adı zaten kullanılıyor.`);
            return;
        }
        toast.success('Kategori güncellendi.');
    };

    const handleDelete = () => {
        deleteCategory(category.id);
        toast.success(
            taskCount > 0
                ? `"${category.name}" silindi. ${taskCount} görev kategorisiz oldu.`
                : `"${category.name}" silindi.`
        );
    };

    return (
        <li className="flex items-center gap-2">
            <ColorInput
                value={category.color}
                onChange={(color) => updateCategory(category.id, { color })}
                label={`${category.name} kategorisinin rengi`}
            />

            <input
                value={draft}
                maxLength={CATEGORY_NAME_MAX}
                aria-label={`${category.name} kategorisinin adı`}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                        setDraft(category.name);
                        e.currentTarget.blur();
                    }
                }}
                className={inputClass}
            />

            <span className="w-20 shrink-0 text-xs text-muted-foreground text-right tabular-nums">
                {taskCount} görev
            </span>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <button
                        type="button"
                        aria-label={`"${category.name}" kategorisini sil`}
                        className="p-2 shrink-0 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>"{category.name}" silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {taskCount > 0
                                ? `Bu kategoriye bağlı ${taskCount} görev silinmez, "Kategorisiz" olarak listede kalır.`
                                : 'Bu kategoriye bağlı görev yok.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sil</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </li>
    );
}

export function CategoryManager() {
    const categories = useTaskStore((state) => state.categories);
    const tasks = useTaskStore((state) => state.tasks);
    const addCategory = useTaskStore((state) => state.addCategory);

    const [name, setName] = useState('');
    const [color, setColor] = useState(CATEGORY_COLORS[0]);
    const fieldId = useId();

    const sorted = [...categories].sort(byCategoryPosition);

    const countFor = (categoryId: string) =>
        tasks.filter((task) => task.categoryId === categoryId).length;

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmed = name.trim();
        if (!trimmed) {
            toast.error('Kategori adı boş olamaz.');
            return;
        }

        if (!addCategory(trimmed, color)) {
            toast.error(`"${trimmed}" adı zaten kullanılıyor.`);
            return;
        }

        setName('');
        // Bir sonraki kategori farklı bir renkle gelsin; kullanıcı her
        // seferinde elle değiştirmek zorunda kalmasın.
        setColor(CATEGORY_COLORS[(categories.length + 1) % CATEGORY_COLORS.length]);
        toast.success(`"${trimmed}" eklendi.`);
    };

    return (
        <div className="space-y-4">
            {sorted.length > 0 ? (
                <ul className="space-y-2">
                    {sorted.map((category) => (
                        <CategoryRow
                            key={category.id}
                            category={category}
                            taskCount={countFor(category.id)}
                        />
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Henüz kategori yok. Aşağıdan ekleyebilirsiniz.
                </p>
            )}

            <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2 border-t border-border">
                <ColorInput value={color} onChange={setColor} label="Yeni kategorinin rengi" />
                <label htmlFor={`${fieldId}-name`} className="sr-only">
                    Yeni kategori adı
                </label>
                <input
                    id={`${fieldId}-name`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={CATEGORY_NAME_MAX}
                    placeholder="Yeni kategori"
                    className={inputClass}
                />
                <button
                    type="submit"
                    className="flex items-center gap-1.5 h-10 px-4 shrink-0 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                    <Plus size={16} />
                    Ekle
                </button>
            </form>
        </div>
    );
}
