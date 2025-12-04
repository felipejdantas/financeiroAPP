import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, X } from "lucide-react";

interface YearMonthFilterProps {
    selectedYear: number | null;
    selectedMonth: number | null;
    onYearChange: (year: number | null) => void;
    onMonthChange: (month: number | null) => void;
    onClear: () => void;
}

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function YearMonthFilter({
    selectedYear,
    selectedMonth,
    onYearChange,
    onMonthChange,
    onClear
}: YearMonthFilterProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Generate years (current year - 2 to current year + 1)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

    const handleYearSelect = (year: number) => {
        onYearChange(year);
        // Reset month when year changes
        if (selectedYear !== year) {
            onMonthChange(null);
        }
    };

    const handleMonthSelect = (monthIndex: number) => {
        onMonthChange(monthIndex + 1);
    };

    const handleClear = () => {
        onYearChange(null);
        onMonthChange(null);
        onClear();
    };

    const hasFilters = selectedYear !== null || selectedMonth !== null;

    return (
        <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
                {/* Header with toggle button */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">Filtros</h3>
                        {hasFilters && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {selectedYear && selectedMonth
                                    ? `${MONTHS[selectedMonth - 1]}/${selectedYear}`
                                    : selectedYear
                                        ? `${selectedYear}`
                                        : "Filtrado"}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                className="h-8 text-xs"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Limpar
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(!isOpen)}
                            className="h-8"
                        >
                            {isOpen ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Filter content (collapsible) */}
                {isOpen && (
                    <div className="space-y-4 pt-3 border-t">
                        {/* Year selector */}
                        <div>
                            <Label className="text-xs mb-2 block">Ano</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {years.map((year) => (
                                    <Button
                                        key={year}
                                        variant={selectedYear === year ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handleYearSelect(year)}
                                        className="h-9 text-xs"
                                    >
                                        {year}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Month selector (only show if year is selected) */}
                        {selectedYear && (
                            <div>
                                <Label className="text-xs mb-2 block">Mês</Label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                    {MONTHS.map((month, index) => (
                                        <Button
                                            key={month}
                                            variant={selectedMonth === index + 1 ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleMonthSelect(index)}
                                            className="h-9 text-xs"
                                        >
                                            {month.substring(0, 3)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
