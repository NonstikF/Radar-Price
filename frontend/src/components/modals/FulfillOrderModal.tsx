import { useState } from 'react';
import axios from 'axios';
import { X, Loader2, MapPin, PackageCheck } from 'lucide-react';
import { API_URL } from '../../config/api';

// Surtir un pedido del almacén: quien surte indica de qué ubicación sale cada
// pieza apartada. Se proponen primero las ubicaciones con más piezas.

export interface FulfillItem {
    id: number;
    product_name: string;
    product_alias: string;
    to_pick: number;
    locations: { location_id: number; code: string; quantity: number }[];
}

interface Props {
    listId: number;
    items: FulfillItem[];
    onClose: () => void;
    onDone: () => void;
    onError: (message: string) => void;
}

type Picks = Record<number, Record<number, string>>;

const suggest = (items: FulfillItem[]): Picks =>
    Object.fromEntries(items.map(item => {
        let remaining = item.to_pick;
        const perLocation: Record<number, string> = {};
        for (const loc of item.locations) {
            const take = Math.min(loc.quantity, remaining);
            perLocation[loc.location_id] = take > 0 ? String(take) : '';
            remaining -= take;
        }
        return [item.id, perLocation];
    }));

export function FulfillOrderModal({ listId, items, onClose, onDone, onError }: Props) {
    const toPick = items.filter(item => item.to_pick > 0);
    const [picks, setPicks] = useState<Picks>(() => suggest(toPick));
    const [saving, setSaving] = useState(false);

    const picked = (item: FulfillItem) =>
        Object.values(picks[item.id] ?? {}).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    const ready = toPick.every(item => picked(item) === item.to_pick);

    const setPick = (itemId: number, locationId: number, value: string) =>
        setPicks(prev => ({ ...prev, [itemId]: { ...prev[itemId], [locationId]: value } }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ready) return;
        setSaving(true);
        try {
            const payload = toPick.flatMap(item =>
                Object.entries(picks[item.id] ?? {})
                    .map(([locationId, value]) => ({ item_id: item.id, location_id: Number(locationId), quantity: parseInt(value) || 0 }))
                    .filter(p => p.quantity > 0));
            await axios.post(`${API_URL}/shopping-lists/${listId}/fulfill`, { picks: payload });
            onDone();
        } catch (err) {
            onError((axios.isAxiosError(err) && err.response?.data?.detail) || 'No se pudo surtir el pedido');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                aria-labelledby="fulfill-title"
                className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl relative animate-scale-in"
            >
                <div className="p-6 pb-3 pr-14">
                    <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 id="fulfill-title" className="text-lg font-black text-gray-900 dark:text-white">Surtir pedido</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Indica de qué ubicación sacas cada pieza. Esas piezas salen del estante.</p>
                </div>

                <ul className="flex-1 overflow-y-auto px-6 space-y-3">
                    {toPick.length === 0 && <li className="text-sm text-gray-600 dark:text-gray-300">Este pedido no tiene piezas apartadas del almacén.</li>}
                    {toPick.map(item => {
                        const count = picked(item);
                        const done = count === item.to_pick;
                        return (
                            <li key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{item.product_alias || item.product_name}</p>
                                    <span className={`shrink-0 text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                        {count} de {item.to_pick}
                                    </span>
                                </div>
                                {item.locations.length === 0 ? (
                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">No está en ninguna ubicación. Acomódalo en Consultar inventario antes de surtir.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {item.locations.map(loc => (
                                            <label key={loc.location_id} className="flex items-center gap-2 text-sm">
                                                <MapPin className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                                                <span className="flex-1 font-mono font-bold text-gray-800 dark:text-gray-100">{loc.code}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">hay {loc.quantity}</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    max={loc.quantity}
                                                    aria-label={`Piezas de ${item.product_name} que salen de ${loc.code}`}
                                                    value={picks[item.id]?.[loc.location_id] ?? ''}
                                                    onChange={(e) => setPick(item.id, loc.location_id, e.target.value)}
                                                    placeholder="0"
                                                    className="w-16 min-h-10 px-2 text-center font-black tabular-nums bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                <div className="p-6 pt-4">
                    <button type="submit" disabled={saving || !ready} className="w-full min-h-12 bg-emerald-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors">
                        {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <><PackageCheck className="w-5 h-5" aria-hidden="true" /> Confirmar surtido</>}
                    </button>
                    {!ready && <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">Cada producto debe sumar exactamente sus piezas.</p>}
                </div>
            </form>
        </div>
    );
}
