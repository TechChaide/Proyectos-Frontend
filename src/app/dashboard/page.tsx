

'use client';

import { environment } from '@/environments/environments.prod';
import Image from 'next/image';

// Página por defecto: fondo gris claro y logo centrado.
export default function DashboardPage() {
    return (
        <div className="flex flex-1 items-center justify-center min-h-full bg-muted/40">
            <div className="flex flex-col items-center gap-6">
                <div className="transition-all duration-300 hover:scale-110 hover:drop-shadow-2xl cursor-pointer">
                    <Image
                        src={`${environment.basePath}/img/icon.png`}
                        alt="Chaide Logo"
                        width={180}
                        height={80}
                        priority
                        className="select-none"
                    />
                </div>
            </div>
        </div>
    );
}
