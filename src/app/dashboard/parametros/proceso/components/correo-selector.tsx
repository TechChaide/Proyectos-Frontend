"use client";

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const HEREDAR = 'heredar';
const OTRO = 'otro';

interface CorreoSelectorProps {
    value: string;
    onChange: (v: string) => void;
    /** Correo del nivel superior; si existe se ofrece reutilizarlo. */
    heredado?: string;
    placeholder?: string;
    disabled?: boolean;
}

// Agiliza el ingreso de correos: reutiliza el del nivel superior o permite escribir uno nuevo.
export default function CorreoSelector({ value, onChange, heredado = '', placeholder = 'Ej: sistemas@chaide.com', disabled }: CorreoSelectorProps) {
    const hereda = heredado.trim();
    const [modo, setModo] = useState<string>(!hereda || !value || value === hereda ? HEREDAR : OTRO);

    // Si cambia el correo del nivel superior y se está heredando, se acompaña el cambio.
    useEffect(() => {
        if (hereda && modo === HEREDAR && value !== hereda) onChange(hereda);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hereda, modo]);

    if (!hereda) {
        return <Input placeholder={placeholder} maxLength={50} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    }

    const cambiarModo = (m: string) => {
        setModo(m);
        onChange(m === HEREDAR ? hereda : '');
    };

    return (
        <div className="grid gap-2">
            <Select value={modo} onValueChange={cambiarModo} disabled={disabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={HEREDAR}>Usar el del nivel superior: {hereda}</SelectItem>
                    <SelectItem value={OTRO}>Ingresar otro correo…</SelectItem>
                </SelectContent>
            </Select>
            {modo === OTRO && (
                <Input placeholder={placeholder} maxLength={50} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
            )}
        </div>
    );
}
