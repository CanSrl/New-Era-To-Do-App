import { useState } from 'react';
import { useTaskStore } from '../store';
import { CATEGORIES, PRIORITIES, type Task, type Category, type Priority } from '../lib/types';
import { Calendar as CalendarIcon, Tag } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
} from './ui/dialog';

interface TaskFormProps {
    onClose: () => void;
    taskToEdit?: Task;
}

const PRIORITY_STYLES: Record<Priority, string> = {
    'Düşük': 'bg-green-500/10 text-green-600 dark:text-green-500 border-green-500/20',
    'Orta': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
    'Yüksek': 'bg-red-500/10 text-red-600 dark:text-red-500 border-red-500/20',
};

export function TaskForm({ onClose, taskToEdit }: TaskFormProps) {
    const addTask = useTaskStore(state => state.addTask);
    const updateTask = useTaskStore(state => state.updateTask);

    const [title, setTitle] = useState(taskToEdit?.title || '');
    const [description, setDescription] = useState(taskToEdit?.description || '');
    const [priority, setPriority] = useState<Priority>(taskToEdit?.priority || 'Orta');
    const [category, setCategory] = useState<Category>(taskToEdit?.category || 'Kişisel');
    // dueDate zaten 'YYYY-MM-DD' — date input'unun beklediği biçimle aynı.
    const [dueDate, setDueDate] = useState<string>(taskToEdit?.dueDate ?? '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Görev başlığı zorunludur!');
            return;
        }

        if (taskToEdit) {
            updateTask(taskToEdit.id, {
                title,
                description,
                priority,
                category,
                dueDate: dueDate || undefined
            });
            toast.success('Görev başarıyla güncellendi!');
        } else {
            addTask({
                title,
                description,
                priority,
                category,
                completed: false,
                dueDate: dueDate || undefined
            });
            toast.success('Yeni görev eklendi!');
        }

        onClose();
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {taskToEdit ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                    <div className="p-5 overflow-y-auto flex-1 space-y-5">
                        <div className="space-y-1.5">
                            <label htmlFor="title" className="text-sm font-medium">
                                Başlık <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="title"
                                autoFocus
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Örn: Yıllık raporu tamamla"
                                className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="description" className="text-sm font-medium">
                                Açıklama <span className="text-muted-foreground font-normal">(Opsiyonel)</span>
                            </label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Görev detayları..."
                                className="flex min-h-[80px] w-full rounded-xl border border-input bg-transparent px-3 py-2 justify-start text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label htmlFor="dueDate" className="text-sm font-medium flex items-center gap-1.5">
                                    <CalendarIcon size={14} className="text-muted-foreground" />
                                    Son Tarih
                                </label>
                                <input
                                    id="dueDate"
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="category" className="text-sm font-medium flex items-center gap-1.5">
                                    <Tag size={14} className="text-muted-foreground" />
                                    Kategori
                                </label>
                                <select
                                    id="category"
                                    value={category}
                                    onChange={e => setCategory(e.target.value as Category)}
                                    className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium mb-2">Öncelik</legend>
                            <div className="flex gap-2">
                                {PRIORITIES.map(p => (
                                    <button
                                        type="button"
                                        key={p}
                                        onClick={() => setPriority(p)}
                                        aria-pressed={priority === p}
                                        className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-all ${priority === p
                                            ? `${PRIORITY_STYLES[p]} ring-2 ring-primary/20 shadow-sm`
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted font-normal'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <DialogFooter>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-medium text-foreground hover:bg-muted transition-colors border border-transparent hover:border-border"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/30 active:scale-95 transition-all"
                        >
                            {taskToEdit ? 'Güncelle' : 'Görev Ekle'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
