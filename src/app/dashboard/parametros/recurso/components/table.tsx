
"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, UserPlus } from 'lucide-react';
import type { Recurso, TipoRecurso } from '@/types/interfaces';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useMemo } from 'react';
const PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

interface RecursoTableProps {
  records: Recurso[];
  tiposRecurso: TipoRecurso[];
  isLoading: boolean;
  onEdit: (record: Recurso) => void;
  onAddNew: () => void;
}

export default function RecursoTable({ records, tiposRecurso, isLoading, onEdit, onAddNew }: RecursoTableProps) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filter, setFilter] = useState("");

  const tipoMap = useMemo(() => new Map(tiposRecurso.map((t) => [t.codigo_tipo_recurso, t])), [tiposRecurso]);

  const filteredRecords = useMemo(() => {
    if (!filter.trim()) return records;
    const f = filter.toLowerCase();
    return records.filter(r => (r.nombre_recurso?.toLowerCase().includes(f) || false));
  }, [records, filter]);

  const totalRows = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  if (page > totalPages && totalPages > 0) setPage(totalPages);

  const renderSkeleton = () => (
    [...Array(5)].map((_, i) => (
        <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
    ))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Listado de Recursos</CardTitle>
            <CardDescription>Recursos disponibles para asignar a proyectos.</CardDescription>
        </div>
        <Button onClick={onAddNew}>
            <UserPlus className="mr-2 h-4 w-4" />
            Añadir Recurso
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 w-full max-w-xs text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Filtrar por nombre de recurso..."
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
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo de Recurso</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? renderSkeleton() : paginatedRecords.map((record) => (
                    <TableRow key={record.codigo_recurso}>
                    <TableCell className="font-medium">{record.nombre_recurso}</TableCell>
                    <TableCell>{tipoMap.get(record.codigo_tipo_recurso)?.nombre_recurso || record.codigo_tipo_recurso}</TableCell>
                    <TableCell>{record.costo}</TableCell>
                    <TableCell>
                        <Badge variant={record.estado === 'A' ? 'default' : 'destructive'} className={record.estado === 'A' ? 'bg-green-600' : ''}>
                         {record.estado === 'A' ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </TableCell>
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
                        <TableCell colSpan={5} className="h-24 text-center">
                            No se encontraron recursos.
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
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
