
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Area } from '@/types/interfaces';
import { procesoService } from '@/services/proyectos/proceso.service';
import AreaForm from './components/form';
import ProcesoWizard from './components/proceso-wizard';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProcesoTree from './components/proceso-tree';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AreaPage() {
    const [records, setRecords] = useState<Area[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<Area | null>(null);
    const [parentId, setParentId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procesoService.getAll();
            const data = response.data || [];
            setRecords(data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudieron cargar los procesos.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsLoading(false);
            setHasFetched(true);
        }
    }, [toast]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleEdit = (record: Area) => {
        setSelectedRecord(record);
        setParentId(null);
        setIsFormOpen(true);
    };

    const handleAddRoot = () => setIsWizardOpen(true);

    const handleAddChild = (codigoPadre: number) => {
        setSelectedRecord(null);
        setParentId(codigoPadre);
        setIsFormOpen(true);
    };

    const handleSuccess = () => {
        fetchRecords();
        setIsFormOpen(false);
        setSelectedRecord(null);
        setParentId(null);
    };

    const handleCancel = () => {
        setIsFormOpen(false);
        setSelectedRecord(null);
        setParentId(null);
    };

    const handleWizardSuccess = () => {
        fetchRecords();
        setIsWizardOpen(false);
    };

    // Profundidad en el organigrama (0 = Macroproceso, 1 = Proceso, 2 = Subproceso, ...).
    const profundidad = (codigo: number | null | undefined): number => {
        let d = 0;
        let actual = codigo ? records.find((r) => r.codigo_proceso === codigo) : undefined;
        while (actual?.codigo_proceso_padre && d < 20) {
            d++;
            actual = records.find((r) => r.codigo_proceso === actual!.codigo_proceso_padre);
        }
        return d;
    };

    const parent = parentId ? records.find((r) => r.codigo_proceso === parentId) ?? null : null;
    const parentNombre = parent?.nombre_proceso ?? null;
    const parentCentro = parent?.centro ?? '';
    const parentCorreos = parent?.correos_proceso ?? '';

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Procesos (Organigrama)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Estructura jerárquica: Macroproceso → Proceso (obligatorio) y, opcionalmente, Subproceso → Línea → Puesto de Trabajo → Tarea.</p>
                </CardContent>
            </Card>

            {!hasFetched || isLoading ? (
                <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <ProcesoTree
                            records={records}
                            onAddRoot={handleAddRoot}
                            onAddChild={handleAddChild}
                            onEdit={handleEdit}
                        />
                    </CardContent>
                </Card>
            )}

            <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Nuevo Proceso</DialogTitle>
                        <DialogDescription>Alta guiada de un proceso dentro del organigrama.</DialogDescription>
                    </DialogHeader>
                    <ProcesoWizard
                        records={records}
                        onSuccess={handleWizardSuccess}
                        onRefresh={fetchRecords}
                        onCancel={() => setIsWizardOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isFormOpen} onOpenChange={(o) => { if (!o) handleCancel(); }}>
                <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Proceso</DialogTitle>
                        <DialogDescription>Formulario de alta o edición de un nodo del organigrama.</DialogDescription>
                    </DialogHeader>
                    {isFormOpen && (
                        <AreaForm
                            record={selectedRecord}
                            parentId={parentId}
                            parentNombre={parentNombre}
                            parentCentro={parentCentro}
                            parentCorreos={parentCorreos}
                            nivel={selectedRecord ? profundidad(selectedRecord.codigo_proceso) : parentId ? profundidad(parentId) + 1 : 0}
                            onSuccess={handleSuccess}
                            onCancel={handleCancel}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
