import { Link } from 'react-router-dom';

export function NotFoundPage() {
    return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="text-center space-y-4">
                <p className="text-5xl">🧭</p>
                <h1 className="text-2xl font-bold tracking-tight">Sayfa bulunamadı</h1>
                <p className="text-muted-foreground">
                    Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
                </p>
                <Link
                    to="/app"
                    className="inline-block bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                >
                    Görevlere dön
                </Link>
            </div>
        </main>
    );
}
