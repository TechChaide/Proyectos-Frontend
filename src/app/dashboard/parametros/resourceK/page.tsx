
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { TipoRecurso } from '@/types/interfaces';
import { tipoRecursoService } from '@/services/proyectos/tipoRecurso.service';
import TipoRecursoForm from './components/form';
import TipoRecursoTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TipoRecursoPage() {
    const [records, setRecords] = useState<TipoRecurso[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TipoRecurso | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await tipoRecursoService.getAll();
            const data = response.data || [];
            setRecords(data);
             if (data.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los tipos de recurso.";
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

    const handleEdit = (record: TipoRecurso) => {
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
                    <CardTitle>Gestión de Tipos de Recurso</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los tipos de recurso.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <TipoRecursoForm
                    record={selectedRecord}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <TipoRecursoTable
                    records={records}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                />
            ) : null}
        </div>
    );
}
