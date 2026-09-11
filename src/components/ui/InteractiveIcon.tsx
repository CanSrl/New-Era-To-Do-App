import React, { useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

export type IconInteractionType = 'bounce' | 'spin' | 'wiggle' | 'pulse' | 'glow' | 'tilt';

interface InteractiveIconProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    children: React.ReactNode;
    type?: IconInteractionType;
    className?: string;
    glowColor?: string;
    interactive?: boolean;
}

export function InteractiveIcon({
    children,
    type = 'bounce',
    className,
    glowColor = 'hsl(var(--primary) / 0.4)',
    interactive = true,
    ...props
}: InteractiveIconProps) {
    const [isHovered, setIsHovered] = useState(false);

    if (!interactive) {
        return <div className={className}>{children}</div>;
    }

    // Animation presets
    const getHoverAnimation = () => {
        switch (type) {
            case 'spin':
                return {
                    rotate: 360,
                    scale: 1.15,
                    transition: { type: 'spring' as const, stiffness: 260, damping: 14 },
                };
            case 'wiggle':
                return {
                    rotate: [0, -14, 14, -8, 8, 0],
                    scale: 1.15,
                    transition: { duration: 0.5, ease: 'easeInOut' as const },
                };
            case 'pulse':
                return {
                    scale: [1, 1.2, 1.1],
                    transition: { duration: 0.4, repeat: 0 },
                };
            case 'tilt':
                return {
                    rotateY: 25,
                    rotateX: -15,
                    scale: 1.12,
                    transition: { type: 'spring' as const, stiffness: 300, damping: 15 },
                };
            case 'glow':
                return {
                    scale: 1.15,
                    filter: `drop-shadow(0 0 10px ${glowColor})`,
                    transition: { duration: 0.25 },
                };
            case 'bounce':
            default:
                return {
                    y: -3,
                    scale: 1.18,
                    transition: { type: 'spring' as const, stiffness: 450, damping: 15 },
                };
        }
    };

    return (
        <motion.div
            className={cn('relative inline-flex items-center justify-center cursor-pointer select-none', className)}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            whileHover={getHoverAnimation()}
            whileTap={{ scale: 0.9, rotate: -2 }}
            {...props}
        >
            {/* Ambient hover glow halo */}
            {isHovered && (
                <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1.4 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 -z-10 rounded-full blur-md"
                    style={{ backgroundColor: glowColor }}
                />
            )}
            {children}
        </motion.div>
    );
}
