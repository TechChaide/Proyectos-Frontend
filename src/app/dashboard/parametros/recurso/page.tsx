
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Recurso, TipoRecurso } from '@/types/interfaces';
import { recursoService } from '@/services/proyectos/recurso.service';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import RecursoForm from './components/form';
import RecursoTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RecursoPage() {
    const [records, setRecords] = useState<Recurso[]>([]);
    const [tiposRecurso, setTiposRecurso] = useState<TipoRecurso[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<Recurso | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const [recursosResp, tiposResp] = await Promise.all([
                recursoService.getAll(),
                tipoRecursoService.getAll(),
            ]);
            const data = recursosResp.data || [];
            setRecords(data);
            setTiposRecurso((tiposResp.data || []).filter((t) => t.estado === 'A'));
            if (data.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los recursos.";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
            setIsFormOpen(true);
        } finally {
            setIsLoading(false);
            setHasFetched(true);
        }
    }, [toast]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleEdit = (record: Recurso) => {
        setSelectedRecord(record);
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setSelectedRecord(null);
        setIsFormOpen(true);
    };

    const handleSuccess = () => {
        fetchRecords();
        setIsFormOpen(false);
        setSelectedRecord(null);
    }

    const handleCancel = () => {
        if (records.length > 0) {
            setIsFormOpen(false);
            setSelectedRecord(null);
        }
    }

    const showTable = hasFetched && !isFormOpen && records.length > 0;

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Recursos</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los recursos disponibles para asignar a los proyectos.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <RecursoForm
                    record={selectedRecord}
                    tiposRecurso={tiposRecurso}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <RecursoTable
                    records={records}
                    tiposRecurso={tiposRecurso}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                />
            ) : null}
        </div>
    );
}
