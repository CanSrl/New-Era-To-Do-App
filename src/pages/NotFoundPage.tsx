import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
    const { t } = useTranslation();

    return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="text-center space-y-4">
                <p className="text-5xl">🧭</p>
                <h1 className="text-2xl font-bold tracking-tight">{t('notFound.title')}</h1>
                <p className="text-muted-foreground">{t('notFound.body')}</p>
                <Link
                    to="/app"
                    className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                >
                    {t('common.backToTasks')}
                </Link>
            </div>
        </main>
    );
}
