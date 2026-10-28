
"use client";

import { calificarPorcentaje } from '../cumplimiento';

interface GaugeCumplimientoProps {
    pct: number; // 0 a 100
    nota: number; // 0 a 5
    size?: number;
}

export default function GaugeCumplimiento({ pct, nota, size = 150 }: GaugeCumplimientoProps) {
    const stroke = 14;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const pctClamped = Math.max(0, Math.min(100, pct));
    const offset = circumference * (1 - pctClamped / 100);
    const { etiqueta, color } = calificarPorcentaje(pctClamped);

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={stroke}
                        fill="none"
                        className="text-muted"
                        stroke="currentColor"
                        opacity={0.2}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={stroke}
                        fill="none"
                        stroke={color}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{pctClamped.toFixed(0)}%</span>
                    <span className="text-xs text-muted-foreground">{nota.toFixed(2)} / 5,00</span>
                </div>
            </div>
            <span className="text-sm font-medium" style={{ color }}>{etiqueta}</span>
        </div>
    );
}
