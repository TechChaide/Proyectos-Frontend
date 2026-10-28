
"use client";

import { Building, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AreaBlock } from '../types';

interface ProcesoSelectorProps {
    blocks: AreaBlock[];
    onSelect: (codigoArea: number) => void;
    singular?: string;
    plural?: string;
    mensajeVacio?: string;
}

export default function ProcesoSelector({
    blocks,
    onSelect,
    singular = 'proyecto',
    plural = 'proyectos',
    mensajeVacio = 'Todavía no hay proyectos creados en ninguna proceso.',
}: ProcesoSelectorProps) {
    if (blocks.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    {mensajeVacio}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {blocks.map(({ area, count }) => (
                <Card
                    key={area.codigo_proceso}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(area.codigo_proceso)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelect(area.codigo_proceso);
                    }}
                    className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Building className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-base">{area.nombre_proceso}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <FolderKanban className="h-4 w-4" />
                            {count} {count === 1 ? singular : plural}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
