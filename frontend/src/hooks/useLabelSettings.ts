import { useState, useEffect } from 'react';

// 1. Exportar los TIPOS (Fundamental para que otros archivos los vean)
export type LabelSize = '1.5x1' | '2x1';
export type NameSource = 'always_name' | 'always_alias' | 'alias_if_available';

// 2. Exportar la INTERFAZ
export interface LabelSettings {
    companyName: string;
    size: LabelSize;
    nameSource: NameSource;
}

const DEFAULT_SETTINGS: LabelSettings = {
    companyName: "PlantArte",
    size: '1.5x1',
    nameSource: 'alias_if_available'
};

// 3. Exportar el HOOK (La función principal)
export function useLabelSettings() {
    const [settings, setSettings] = useState<LabelSettings>(() => {
        try {
            const saved = localStorage.getItem('label_settings');
            return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    });

    useEffect(() => {
        localStorage.setItem('label_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    return { settings, updateSettings };
}