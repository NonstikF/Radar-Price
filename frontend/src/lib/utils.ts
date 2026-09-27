import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Une clases de Tailwind resolviendo conflictos: la última gana, así un
// className que llega por props puede pisar el valor por defecto.
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
