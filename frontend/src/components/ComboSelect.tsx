import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface ComboSelectProps {
    options: any[];
    value: string;
    onChange: (val: string) => void;
    getOptionValue: (o: any) => string;
    getOptionLabel: (o: any) => string;
    placeholder: string;
}

const ComboSelect: React.FC<ComboSelectProps> = ({
    options,
    value,
    onChange,
    getOptionValue,
    getOptionLabel,
    placeholder
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = options.filter(o => {
        const label = getOptionLabel(o).toLowerCase();
        const q = query.toLowerCase();
        return q ? label.includes(q) : true;
    });

    const selectedLabel = (() => {
        const sel = options.find(o => getOptionValue(o) === value);
        return sel ? getOptionLabel(sel) : '';
    })();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((prev) => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const item = filtered[highlight];
            if (item) {
                onChange(getOptionValue(item));
                setOpen(false);
                setQuery('');
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setQuery('');
        }
    };

    return (
        <div className="relative" ref={boxRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
                <span className="text-sm text-slate-700">{selectedLabel || placeholder}</span>
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
                    <div className="relative p-2 border-b border-slate-100">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Buscar..."
                            className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                        />
                    </div>
                    <ul className="max-h-60 overflow-auto">
                        {filtered.map((o, idx) => (
                            <li
                                key={getOptionValue(o)}
                                onMouseEnter={() => setHighlight(idx)}
                                onClick={() => { onChange(getOptionValue(o)); setOpen(false); setQuery(''); }}
                                className={`px-3 py-2 cursor-pointer text-sm ${idx === highlight ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                                {getOptionLabel(o)}
                            </li>
                        ))}
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-400">Nenhum resultado</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ComboSelect;
