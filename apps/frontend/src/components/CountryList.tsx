import React from "react";
import type { CountryCost } from "../types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

type CountryListProps = {
    countries: CountryCost[];
    activeCountry: string;
    search: string;
    onSearch: (value: string) => void;
    onSelect: (country: string) => void;
};

const CountryList: React.FC<CountryListProps> = ({
    countries,
    activeCountry,
    search,
    onSearch,
    onSelect,
}) => (
    <div className="bg-card/30 border border-border rounded-xl p-4 flex flex-col">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-foreground">Source Countries</h3>
            <Badge className="bg-primary text-primary-foreground text-[11px] px-2.5 py-0">
                {countries.length}
            </Badge>
        </div>

        <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
                placeholder="Search country…"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 bg-secondary border-border text-foreground h-9 text-sm"
            />
        </div>

        {countries.length > 0 ? (
            <div className="space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Selected Source Country
                </label>
                <select
                    value={activeCountry}
                    onChange={(e) => onSelect(e.target.value)}
                    className="w-full h-10 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                    {countries.map((item) => (
                        <option key={item.country} value={item.country}>
                            {item.country} 
                        </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                    Use search to filter the dropdown options.
                </p>
            </div>
        ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
                No countries match your search.
            </div>
        )}
    </div>
);

export default CountryList;
