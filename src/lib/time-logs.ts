import type { ActiveTimer, Client, Project, TimeLog } from './types';
import { createId, toIsoTimestamp } from './tasks';

/** Veritabanı kısıtıyla aynı: 24 saatten uzun tek kayıt unutulmuş sayaçtır. */
export const TIME_LOG_MAX_MINUTES = 1440;
export const TIME_LOG_NOTE_MAX = 200;

/**
 * Süre veritabanı kısıtına uyuyor mu?
 *
 * Şemadaki `check (duration_minutes > 0 and duration_minutes <= 1440)` ile
 * birebir aynı. Store eylemleri buna bakmak ZORUNDA: kısıtı ihlal eden bir
 * kayıt push kuyruğuna girerse Postgres 23514 ile reddeder, o turdaki bütün
 * senkron onunla düşer ve kayıt hiç temizlenmediği için her turda aynı yerde
 * tıkanır (`normalizeClient`'taki aynı gerekçe).
 */
export function isValidDuration(minutes: unknown): boolean {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return false;
    const whole = Math.floor(minutes);
    return whole >= 1 && whole <= TIME_LOG_MAX_MINUTES;
}

/**
 * Etkin saatlik ücret.
 *
 * `??` ŞART: projenin `0` ücreti "bu proje ücretsiz" demektir ve mirası ezer.
 * `||` yazılsaydı 0 mirasa düşer, ücretsiz proje sessizce faturalanırdı.
 */
export function effectiveRate(client: Client, project?: Project | null): number {
    return project?.hourlyRate ?? client.hourlyRate;
}

/** Kaydın tutarı. Saklanmaz, her okumada hesaplanır (bkz. spec §1.2). */
export function amountFor(
    log: TimeLog,
    client: Client,
    project?: Project | null
): number {
    return (log.durationMinutes / 60) * effectiveRate(client, project);
}

/**
 * Çalışan sayacın süresi. `startedAt` damgasından türetilir — ekrandaki
 * `setInterval` bir sayaç değil, yalnızca yeniden render tetikleyicisidir.
 * Sekme uykuya dalsa da süre doğru kalır.
 */
export function elapsedMinutes(timer: ActiveTimer, now: string): number {
    const ms = new Date(now).getTime() - new Date(timer.startedAt).getTime();
    // Saat geri alındıysa negatif çıkabilir; süre negatif olamaz.
    return Math.max(0, Math.floor(ms / 60_000));
}

/** Dışarıdan gelen ham veriyi geçerli bir TimeLog'a çevirir. */
export function normalizeTimeLog(raw: unknown): TimeLog | null {
    if (!raw || typeof raw !== 'object') return null;
    const source = raw as Record<string, unknown>;

    const clientId = typeof source.clientId === 'string' ? source.clientId : '';
    if (!clientId) return null;

    const projectId = typeof source.projectId === 'string' ? source.projectId : null;

    const durationMinutes = typeof source.durationMinutes === 'number'
        ? Math.floor(source.durationMinutes)
        : NaN;
    if (
        !Number.isFinite(durationMinutes)
        || durationMinutes <= 0
        || durationMinutes > TIME_LOG_MAX_MINUTES
    ) return null;

    const createdAt = toIsoTimestamp(source.createdAt);
    const note = typeof source.note === 'string' && source.note.trim()
        ? source.note.trim().slice(0, TIME_LOG_NOTE_MAX)
        : null;

    return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        taskId: typeof source.taskId === 'string' ? source.taskId : null,
        clientId,
        projectId,
        startedAt: toIsoTimestamp(source.startedAt),
        durationMinutes,
        note,
        createdAt,
        updatedAt: source.updatedAt == null ? createdAt : toIsoTimestamp(source.updatedAt),
    };
}

/** Yeni bir zaman kaydı üretir. */
export function createTimeLog(
    input: {
        taskId?: string | null;
        clientId: string;
        projectId?: string | null;
        startedAt: string;
        durationMinutes: number;
        note?: string | null;
    },
    now: string = new Date().toISOString()
): TimeLog {
    return {
        id: createId(),
        taskId: input.taskId ?? null,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        startedAt: input.startedAt,
        durationMinutes: Math.min(
            Math.max(1, Math.floor(input.durationMinutes)),
            TIME_LOG_MAX_MINUTES
        ),
        note: input.note?.trim().slice(0, TIME_LOG_NOTE_MAX) || null,
        createdAt: now,
        updatedAt: now,
    };
}
