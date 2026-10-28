
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { responsableService } from '@/services/proyectos/responsable.service';
import { serviciosService } from '@/services/proyectos/servicios.service';
import ResponsableForm from './components/form';
import ResponsableTable from './components/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResponsablesPage() {
    const [records, setRecords] = useState<Responsable[]>([]);
    const [personas, setPersonas] = useState<FichaSocialHistorica[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<Responsable | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const { toast } = useToast();

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await responsableService.getAll();
            const data = response.data || [];
            setRecords(data);
             if (data.length === 0) {
                setIsFormOpen(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar los responsables.";
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

    const fetchPersonas = useCallback(async () => {
        try {
            const response = await serviciosService.getInformacionPersonas();
            setPersonas(response.data || []);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo cargar la información de personas.";
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        }
    }, [toast]);

    useEffect(() => {
        fetchRecords();
        fetchPersonas();
    }, [fetchRecords, fetchPersonas]);

    const handleEdit = (record: Responsable) => {
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
                    <CardTitle>Gestión de Responsables</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Crea, edita y gestiona los responsables.</p>
                </CardContent>
            </Card>

            {isFormOpen ? (
                <ResponsableForm
                    record={selectedRecord}
                    personas={personas}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />
            ) : showTable ? (
                <ResponsableTable
                    records={records}
                    personas={personas}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onAddNew={handleAddNew}
                />
            ) : null}
        </div>
    );
}
