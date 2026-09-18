import { useEffect, useRef, useSyncExternalStore } from 'react';

interface InteractiveBackgroundProps {
    variant?: 'full' | 'subtle';
    className?: string;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    alpha: number;
    baseAlpha: number;
}

/*
 * Hareket tercihi `useSyncExternalStore` ile okunur.
 *
 * Efekt gövdesinden `setState` çağırmak `react-hooks/set-state-in-effect`
 * kuralına takılıyor (bu dosya bir süre lint'i kırık bıraktı) ve efektle
 * kurulan state ilk karede yanlış değeri gösteriyordu. Aynı gerekçe
 * `features/time/useElapsed.ts` için de yazılı.
 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

function getReducedMotion() {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/*
 * Canvas paleti CSS token'larından okunur, koda gömülmez.
 *
 * Eskiden burada ham hex/rgba değerleri (`#10b981`, `rgba(6, 182, 212, …)`)
 * duruyordu: tema değiştiğinde arka plan eski markanın renginde kalıyor ve
 * kimse fark etmiyordu, çünkü hiçbir test canvas'ın rengine bakmıyor.
 * `--primary` gibi token'lar "243 75% 59%" biçiminde üçlü tutuluyor, bu
 * yüzden alfa eklemek düz metin birleştirmesiyle mümkün.
 */
function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
    const value = styles.getPropertyValue(name).trim();
    return value === '' ? fallback : value;
}

interface Palette {
    /** Parçacık renkleri; tam opak, alfa çizim sırasında veriliyor. */
    particles: string[];
    /** Fareye çekilen ışın. */
    ray: (alpha: number) => string;
    /** Parçacıklar arası takımyıldız çizgisi. */
    link: (alpha: number) => string;
    /** İmleç etrafındaki ışık havuzunun iki durağı. */
    spotlight: [string, string];
    isDark: boolean;
}

function readPalette(): Palette {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const isDark = root.classList.contains('dark');

    const primary = readToken(styles, '--primary', '243 75% 59%');
    const accent = readToken(styles, '--accent', '262 80% 62%');
    const highlight = readToken(styles, '--highlight', '38 92% 50%');

    return {
        particles: [
            `hsl(${primary})`,
            `hsl(${accent})`,
            `hsl(${primary})`,
            `hsl(${highlight})`,
            `hsl(${accent})`,
        ],
        ray: (alpha) => `hsl(${primary} / ${alpha})`,
        link: (alpha) => `hsl(${accent} / ${alpha})`,
        spotlight: [
            `hsl(${primary} / ${isDark ? 0.1 : 0.07})`,
            `hsl(${accent} / ${isDark ? 0.07 : 0.05})`,
        ],
        isDark,
    };
}

export function InteractiveBackground({
    variant = 'full',
    className = '',
}: InteractiveBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
        x: -1000,
        y: -1000,
        active: false,
    });

    const isReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        let palette = readPalette();

        const particleCount = variant === 'full'
            ? Math.min(Math.floor((width * height) / 22000), 55)
            : Math.min(Math.floor((width * height) / 38000), 28);

        let particles: Particle[] = [];

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                const color = palette.particles[Math.floor(Math.random() * palette.particles.length)];
                const baseAlpha = variant === 'full' ? 0.35 + Math.random() * 0.45 : 0.2 + Math.random() * 0.3;
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * (variant === 'full' ? 0.8 : 0.4),
                    vy: (Math.random() - 0.5) * (variant === 'full' ? 0.8 : 0.4),
                    radius: Math.random() * 2 + 1.2,
                    color,
                    alpha: baseAlpha,
                    baseAlpha,
                });
            }
        };
        initParticles();

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        };
        window.addEventListener('resize', handleResize);

        /*
         * Tema `documentElement` üzerindeki `dark` sınıfıyla değişiyor
         * (bkz. `ThemeProvider`). Gözlemci olmasaydı palet yalnızca mount
         * anında okunur, kullanıcı temayı değiştirince arka plan eski
         * renklerde kalırdı.
         */
        const themeObserver = new MutationObserver(() => {
            const next = readPalette();
            const changed = next.isDark !== palette.isDark
                || next.particles[0] !== palette.particles[0];
            palette = next;
            if (changed) initParticles();
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
            mouseRef.current.active = true;
        };

        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);

        // Render loop
        const render = () => {
            ctx.clearRect(0, 0, width, height);

            const mouse = mouseRef.current;
            const maxDistance = variant === 'full' ? 140 : 100;
            const mouseInteractionDistance = variant === 'full' ? 180 : 120;

            // Draw radial spotlight around cursor
            if (mouse.active && !isReducedMotion) {
                const radius = variant === 'full' ? 260 : 180;
                const spotlightGradient = ctx.createRadialGradient(
                    mouse.x,
                    mouse.y,
                    0,
                    mouse.x,
                    mouse.y,
                    radius
                );

                spotlightGradient.addColorStop(0, palette.spotlight[0]);
                spotlightGradient.addColorStop(0.5, palette.spotlight[1]);
                spotlightGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = spotlightGradient;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            // Update and draw particles
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                if (!isReducedMotion) {
                    p.x += p.vx;
                    p.y += p.vy;

                    // Bounce off boundaries
                    if (p.x < 0 || p.x > width) p.vx *= -1;
                    if (p.y < 0 || p.y > height) p.vy *= -1;

                    // Mouse repulsion & interaction
                    if (mouse.active) {
                        const dx = p.x - mouse.x;
                        const dy = p.y - mouse.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        if (dist < mouseInteractionDistance) {
                            // Gentle push away
                            const force = (mouseInteractionDistance - dist) / mouseInteractionDistance;
                            const angle = Math.atan2(dy, dx);
                            p.x += Math.cos(angle) * force * 2.5;
                            p.y += Math.sin(angle) * force * 2.5;

                            // Draw laser line to mouse
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(mouse.x, mouse.y);
                            const lineAlpha = (1 - dist / mouseInteractionDistance) * (palette.isDark ? 0.35 : 0.22);
                            ctx.strokeStyle = palette.ray(lineAlpha);
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    }
                }

                // Draw particle node
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
                ctx.globalAlpha = 1;

                // Inter-particle constellation lines
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < maxDistance) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        const alpha = (1 - dist / maxDistance) * (palette.isDark ? 0.18 : 0.12);
                        ctx.strokeStyle = palette.link(alpha);
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            themeObserver.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, [variant, isReducedMotion]);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 z-0 ${className}`}
        />
    );
}
