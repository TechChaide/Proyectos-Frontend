
"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, UserPlus } from 'lucide-react';
import type { FichaSocialHistorica, Responsable } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
const PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

interface ResponsableTableProps {
  records: Responsable[];
  personas: FichaSocialHistorica[];
  isLoading: boolean;
  onEdit: (record: Responsable) => void;
  onAddNew: () => void;
}

interface ResponsableRow extends Responsable {
  nombre: string;
  departamento: string;
  jefeInmediato: string;
}

export default function ResponsableTable({ records, personas, isLoading, onEdit, onAddNew }: ResponsableTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState("");

  // Mapa de personas por código para resolver nombre, departamento y jefe inmediato
  const personaMap = useMemo(
    () => new Map(personas.map(p => [p.CODIGO, p])),
    [personas]
  );

  const enrichedRecords = useMemo<ResponsableRow[]>(() => {
    return records.map(record => {
      const persona = personaMap.get(record.codigo_empleado);
      const jefeCodigo = persona?.CODIGO_JEFE;
      const jefe = jefeCodigo ? personaMap.get(jefeCodigo) : undefined;
      return {
        ...record,
        nombre: persona?.NOMBRE || '-',
        departamento: persona?.DEPARTAMENTO || '-',
        jefeInmediato: jefe?.NOMBRE || jefeCodigo || '-',
      };
    });
  }, [records, personaMap]);

  // Filtrado por código de empleado, nombre o departamento
  const filteredRecords = useMemo(() => {
    if (!filter.trim()) return enrichedRecords;
    const f = filter.toLowerCase();
    return enrichedRecords.filter(r =>
      r.codigo_empleado?.toLowerCase().includes(f) ||
      r.nombre?.toLowerCase().includes(f) ||
      r.departamento?.toLowerCase().includes(f)
    );
  }, [enrichedRecords, filter]);

  const totalRows = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  // Corrige la página si cambia el número de filas por página o el filtro
  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Listado de Responsables</CardTitle>
            <CardDescription>Responsables registrados.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Responsable
        </Button>
      </CardHeader>
      <CardContent>
        {/* Input de filtrado */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por código, nombre o departamento..."
            value={filter}
            onChange={e => {
              setFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Código de Empleado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Jefe Inmediato</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? renderSkeleton() : paginatedRecords.map((record) => (
                    <TableRow key={record.codigo_responsable}>
                    <TableCell className="font-medium">{record.codigo_responsable}</TableCell>
                    <TableCell>{record.codigo_empleado}</TableCell>
                    <TableCell>{record.nombre}</TableCell>
                    <TableCell>{record.departamento}</TableCell>
                    <TableCell>{record.jefeInmediato}</TableCell>
                    <TableCell>{record.correo_responsable || '-'}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(record)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))}
                 {!isLoading && paginatedRecords.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                            No se encontraron responsables.
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
        {/* Paginador */}
        <div className="flex items-center justify-end gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Items per page:</span>
            <select
              className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={rowsPerPage}
              onChange={e => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <span className="text-sm">
            {totalRows === 0
              ? '0'
              : `${(page - 1) * rowsPerPage + 1} – ${Math.min(page * rowsPerPage, totalRows)} of ${totalRows}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(1)}
              disabled={page === 1}
              aria-label="Primera página"
            >
              <span className="sr-only">Primera página</span>
              &#x23ee;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
            >
              <span className="sr-only">Página anterior</span>
              &#x2039;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
            >
              <span className="sr-only">Página siguiente</span>
              &#x203a;
            </button>
            <button
              className="p-1 rounded disabled:opacity-50 hover:bg-gray-100"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              aria-label="Última página"
            >
              <span className="sr-only">Última página</span>
              &#x23ed;
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
