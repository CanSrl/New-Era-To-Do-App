import { useEffect, useRef, useState } from 'react';

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
    const [isReducedMotion, setIsReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setIsReducedMotion(mediaQuery.matches);
        const handleChange = () => setIsReducedMotion(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        };
        window.addEventListener('resize', handleResize);

        // Color palettes (Emerald & Cyber Cyan)
        const isDark = document.documentElement.classList.contains('dark');
        const particleColors = isDark
            ? ['#10b981', '#06b6d4', '#14b8a6', '#34d399', '#38bdf8']
            : ['#059669', '#0891b2', '#0d9488', '#10b981', '#0284c7'];

        const particleCount = variant === 'full'
            ? Math.min(Math.floor((width * height) / 22000), 55)
            : Math.min(Math.floor((width * height) / 38000), 28);

        let particles: Particle[] = [];

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                const color = particleColors[Math.floor(Math.random() * particleColors.length)];
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

        // Mouse listeners
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
                const spotlightGradient = ctx.createRadialGradient(
                    mouse.x,
                    mouse.y,
                    0,
                    mouse.x,
                    mouse.y,
                    variant === 'full' ? 260 : 180
                );
                const spotlightColor = isDark
                    ? 'rgba(16, 185, 129, 0.09)'
                    : 'rgba(5, 150, 105, 0.06)';
                const spotlightAccent = isDark
                    ? 'rgba(6, 182, 212, 0.06)'
                    : 'rgba(8, 145, 178, 0.04)';

                spotlightGradient.addColorStop(0, spotlightColor);
                spotlightGradient.addColorStop(0.5, spotlightAccent);
                spotlightGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                ctx.fillStyle = spotlightGradient;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, variant === 'full' ? 260 : 180, 0, Math.PI * 2);
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
                            const lineAlpha = (1 - dist / mouseInteractionDistance) * (isDark ? 0.35 : 0.22);
                            ctx.strokeStyle = `rgba(16, 185, 129, ${lineAlpha})`;
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
                        const alpha = (1 - dist / maxDistance) * (isDark ? 0.18 : 0.12);
                        ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
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
