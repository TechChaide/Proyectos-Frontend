
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { TipoProyecto } from '@/types/interfaces';
import { tipoProyectoService } from '@/services/proyectos/tipoProyecto.service';
import TipoProyectoForm from './components/form';
import TipoProyectoTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TipoProyectoPage() {
    const [records, setRecords] = useState<TipoProyecto[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<TipoProyecto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await tipoProyectoService.getAll();
            const data = response.data || [];
            setRecords(data);
             if (data.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los tipos de proyecto.";
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

    const handleEdit = (record: TipoProyecto) => {
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
                    <CardTitle>Gestión de Tipos de Proyecto</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los tipos de proyecto.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <TipoProyectoForm
                    record={selectedRecord}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <TipoProyectoTable
                    records={records}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                />
            ) : null}
        </div>
    );
}
