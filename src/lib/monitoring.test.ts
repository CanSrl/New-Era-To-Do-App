import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    captureError,
    initMonitoring,
    isMonitoringConfigured,
    resetMonitoringForTests,
} from './monitoring';

/**
 * Bu testler DSN'siz kurulumu doğrular — yani starter kit'in varsayılan
 * hâlini. DSN varken Sentry gerçekten yükleneceği için burada taklit
 * edilmiyor; asıl davranış (sınırın çalışması) uçtan uca testte kapsanıyor.
 */

beforeEach(() => {
    resetMonitoringForTests();
});

describe('izleme yapılandırması', () => {
    it('DSN tanımlı değilken kapalıdır', () => {
        // Test ortamında VITE_SENTRY_DSN yok; varsayılan bu olmalı.
        expect(isMonitoringConfigured).toBe(false);
    });

    it('kapalıyken initMonitoring null döner ve hata atmaz', async () => {
        await expect(initMonitoring()).resolves.toBeNull();
    });

    it('birden fazla çağrıda aynı promise-i yeniden kullanır', () => {
        // Aksi halde her çağrı Sentry-i yeniden yükleyip yeniden başlatırdı.
        expect(initMonitoring()).toBe(initMonitoring());
    });
});

describe('captureError', () => {
    it('izleme kapalıyken hatayı konsola düşürür', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const error = new Error('patladı');

        captureError(error);

        // Sessizce yutulmaması şart: kapalı kurulumda konsol tek kayıt yeri.
        expect(spy).toHaveBeenCalledWith('Yakalanan hata:', error, '');
    });

    it('bağlamı da konsola geçirir', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const context = { boundary: 'root' };

        captureError(new Error('x'), context);

        expect(spy).toHaveBeenCalledWith('Yakalanan hata:', expect.any(Error), context);
    });

    it('Error olmayan değerleri de kabul eder', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // React bir sınıra herhangi bir değer fırlatabilir; string de gelebilir.
        expect(() => captureError('düz metin hata')).not.toThrow();
        expect(spy).toHaveBeenCalled();
    });
});
