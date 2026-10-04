import { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Loader2, MapPin, Trash2, ArrowRightLeft, Plus } from 'lucide-react';
import { API_URL } from '../../config/api';

// Piezas de un producto por ubicación. Aquí se acomodan piezas nuevas en un
// estante, se corrige un conteo, se mueven piezas entre estantes o se quita
// el producto de uno. La existencia es lo que hay en estantes menos lo
// apartado en pedidos.

export interface ShelvedProduct {
    id: number;
    name: string;
    alias?: string;
    reserved: number;
}

export interface Shelf {
    location_id: number;
    code: string;
    quantity: number;
}

interface LocationOption {
    id: number;
    code: string;
    description: string | null;
}

interface Props {
    product: ShelvedProduct;
    onClose: () => void;
    // Se llama tras cada cambio con las ubicaciones nuevas y la existencia
    onChange: (shelves: Shelf[], stock: number) => void;
    onMessage: (message: string, type?: 'success' | 'error') => void;
}

const errorDetail = (err: unknown, fallback: string) =>
    (axios.isAxiosError(err) && err.response?.data?.detail) || fallback;

const inputClass = 'min-h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white';

export function ProductShelvesModal({ product, onClose, onChange, onMessage }: Props) {
    const [shelves, setShelves] = useState<Shelf[]>([]);
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [moving, setMoving] = useState<{ from: number; to: string; quantity: string } | null>(null);
    const [newLocation, setNewLocation] = useState('');
    const [newQuantity, setNewQuantity] = useState('');

    const located = shelves.reduce((sum, s) => sum + s.quantity, 0);
    const stock = Math.max(located - product.reserved, 0);

    const load = async () => {
        const res = await axios.get(`${API_URL}/locations/product/${product.id}/locations`);
        const next: Shelf[] = res.data.map((l: Shelf) => ({ location_id: l.location_id, code: l.code, quantity: l.quantity ?? 0 }));
        setShelves(next);
        setDrafts(Object.fromEntries(next.map(s => [s.location_id, String(s.quantity)])));
        return next;
    };

    useEffect(() => {
        Promise.all([load(), axios.get(`${API_URL}/locations`).then(res => setLocations(res.data))])
            .catch(() => onMessage('No se pudieron cargar las ubicaciones', 'error'))
            .finally(() => setLoading(false));
    }, [product.id]);

    // Corre un cambio y recarga las ubicaciones para reflejar lo guardado
    const run = async (action: () => Promise<unknown>, success: string, fallback: string) => {
        setBusy(true);
        try {
            await action();
            const next = await load();
            onChange(next, Math.max(next.reduce((sum, s) => sum + s.quantity, 0) - product.reserved, 0));
            onMessage(success);
            return true;
        } catch (err) {
            onMessage(errorDetail(err, fallback), 'error');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const saveQuantity = (shelf: Shelf) => {
        const quantity = parseInt(drafts[shelf.location_id]);
        if (isNaN(quantity) || quantity < 0 || quantity === shelf.quantity) return;
        run(
            () => axios.put(`${API_URL}/locations/${shelf.location_id}/products/${product.id}`, { quantity }),
            `${shelf.code}: ${quantity} piezas`,
            'No se pudo guardar la cantidad',
        );
    };

    const removeShelf = (shelf: Shelf) => run(
        () => axios.delete(`${API_URL}/locations/${shelf.location_id}/products/${product.id}`),
        `Se quitó de ${shelf.code}`,
        'No se pudo quitar de la ubicación',
    );

    const move = async () => {
        if (!moving) return;
        const quantity = parseInt(moving.quantity);
        const to = parseInt(moving.to);
        if (isNaN(quantity) || quantity <= 0 || isNaN(to)) return;
        const done = await run(
            () => axios.post(`${API_URL}/locations/move`, { product_id: product.id, from_location_id: moving.from, to_location_id: to, quantity }),
            'Piezas movidas',
            'No se pudieron mover las piezas',
        );
        if (done) setMoving(null);
    };

    const addShelf = async (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = parseInt(newQuantity);
        const locationId = parseInt(newLocation);
        if (isNaN(quantity) || quantity <= 0 || isNaN(locationId)) return;
        const code = locations.find(l => l.id === locationId)?.code ?? '';
        const done = await run(
            () => axios.post(`${API_URL}/locations/${locationId}/products`, { product_id: product.id, quantity }),
            `${quantity} piezas agregadas en ${code}`,
            'No se pudieron agregar las piezas',
        );
        if (done) { setNewLocation(''); setNewQuantity(''); }
    };

    const freeLocations = locations.filter(l => !shelves.some(s => s.location_id === l.id));

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="shelves-title"
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative animate-scale-in space-y-5"
            >
                <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 dark:bg-gray-700 p-2 rounded-full">
                    <X className="w-5 h-5" />
                </button>
                <div className="pr-10">
                    <h2 id="shelves-title" className="text-lg font-black text-gray-900 dark:text-white leading-tight">{product.alias || product.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Piezas por ubicación</p>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-2">
                        <dt className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">En estantes</dt>
                        <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{located}</dd>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-2">
                        <dt className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400">Apartadas</dt>
                        <dd className="text-xl font-black tabular-nums text-gray-900 dark:text-white">{product.reserved}</dd>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-2">
                        <dt className="text-[11px] font-semibold uppercase text-amber-800 dark:text-amber-300">Disponibles</dt>
                        <dd className="text-xl font-black tabular-nums text-amber-900 dark:text-amber-200">{stock}</dd>
                    </div>
                </dl>

                {loading ? (
                    <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-amber-600 mx-auto" aria-label="Cargando ubicaciones" /></div>
                ) : (
                    <>
                        {shelves.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-300">Este producto todavía no está en ninguna ubicación. Agrégalo abajo para darle existencia.</p>
                        ) : (
                            <ul className="space-y-2" aria-label="Ubicaciones del producto">
                                {shelves.map(shelf => {
                                    const draft = drafts[shelf.location_id] ?? '';
                                    const changed = draft !== String(shelf.quantity);
                                    return (
                                        <li key={shelf.location_id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex-1 min-w-0 inline-flex items-center gap-1.5 font-mono font-bold text-gray-900 dark:text-white">
                                                    <MapPin className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />{shelf.code}
                                                </span>
                                                <label htmlFor={`qty-${shelf.location_id}`} className="sr-only">Piezas en {shelf.code}</label>
                                                <input
                                                    id={`qty-${shelf.location_id}`}
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={0}
                                                    value={draft}
                                                    disabled={busy}
                                                    onChange={(e) => setDrafts(prev => ({ ...prev, [shelf.location_id]: e.target.value }))}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') saveQuantity(shelf); }}
                                                    className={`${inputClass} w-20 px-2 text-center font-black tabular-nums`}
                                                />
                                                {changed ? (
                                                    <button type="button" onClick={() => saveQuantity(shelf)} disabled={busy} className="min-h-11 px-3 rounded-xl bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 disabled:opacity-50">Guardar</button>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => setMoving(moving?.from === shelf.location_id ? null : { from: shelf.location_id, to: '', quantity: String(shelf.quantity) })} disabled={busy || shelf.quantity === 0 || locations.length < 2} aria-label={`Mover piezas de ${shelf.code}`} title="Mover a otra ubicación" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
                                                            <ArrowRightLeft className="w-4 h-4" />
                                                        </button>
                                                        <button type="button" onClick={() => removeShelf(shelf)} disabled={busy} aria-label={`Quitar de ${shelf.code}`} title="Quitar de esta ubicación" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {moving?.from === shelf.location_id && (
                                                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                                                    <label className="flex-1 min-w-32 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                        Mover a
                                                        <select value={moving.to} onChange={(e) => setMoving({ ...moving, to: e.target.value })} className={`${inputClass} mt-1 w-full px-2 text-sm normal-case font-semibold`}>
                                                            <option value="">Elige ubicación</option>
                                                            {locations.filter(l => l.id !== shelf.location_id).map(l => <option key={l.id} value={l.id}>{l.code}{l.description ? ` · ${l.description}` : ''}</option>)}
                                                        </select>
                                                    </label>
                                                    <label className="w-20 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                                                        Piezas
                                                        <input type="number" inputMode="numeric" min={1} max={shelf.quantity} value={moving.quantity} onChange={(e) => setMoving({ ...moving, quantity: e.target.value })} className={`${inputClass} mt-1 w-full px-2 text-center font-black tabular-nums`} />
                                                    </label>
                                                    <button type="button" onClick={move} disabled={busy || !moving.to || !(parseInt(moving.quantity) > 0)} className="min-h-11 px-3 rounded-xl bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 disabled:opacity-50">Mover</button>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <form onSubmit={addShelf} className="rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 space-y-2">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Agregar piezas en una ubicación</p>
                            {locations.length === 0 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300">Primero crea una ubicación en el módulo Ubicaciones.</p>
                            ) : (
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="flex-1 min-w-32">
                                        <span className="sr-only">Ubicación</span>
                                        <select value={newLocation} onChange={(e) => setNewLocation(e.target.value)} className={`${inputClass} w-full px-2 text-sm font-semibold`}>
                                            <option value="">Elige ubicación</option>
                                            {/* Si ya está en la ubicación, se suman las piezas */}
                                            {shelves.map(s => <option key={s.location_id} value={s.location_id}>{s.code} (ya tiene {s.quantity})</option>)}
                                            {freeLocations.map(l => <option key={l.id} value={l.id}>{l.code}{l.description ? ` · ${l.description}` : ''}</option>)}
                                        </select>
                                    </label>
                                    <label className="w-20">
                                        <span className="sr-only">Piezas</span>
                                        <input type="number" inputMode="numeric" min={1} placeholder="Pzas" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className={`${inputClass} w-full px-2 text-center font-black tabular-nums`} />
                                    </label>
                                    <button type="submit" disabled={busy || !newLocation || !(parseInt(newQuantity) > 0)} className="min-h-11 px-3 rounded-xl bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center gap-1">
                                        <Plus className="w-4 h-4" aria-hidden="true" /> Agregar
                                    </button>
                                </div>
                            )}
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
