import { Moon, Sun, Monitor, Palette } from "lucide-react"
import { useTheme, Theme, ThemeColor } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function ThemeSwitcher() {
    const { theme, setTheme, color, setColor } = useTheme()

    const colors: { name: ThemeColor; label: string; bg: string }[] = [
        { name: "orange", label: "Laranja", bg: "bg-orange-500" },
        { name: "violet", label: "Violeta", bg: "bg-violet-500" },
        { name: "emerald", label: "Esmeralda", bg: "bg-emerald-500" },
        { name: "rose", label: "Rosa", bg: "bg-rose-500" },
        { name: "blue", label: "Azul", bg: "bg-blue-500" },
    ]

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                    <Palette className="h-4 w-4" />
                    <span className="sr-only">Alterar tema</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Aparência</DropdownMenuLabel>
                <div className="grid grid-cols-3 gap-2 p-2">
                    <Button
                        variant={theme === "light" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("light")}
                        className="w-full px-2"
                        title="Claro"
                    >
                        <Sun className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("dark")}
                        className="w-full px-2"
                        title="Escuro"
                    >
                        <Moon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={theme === "system" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("system")}
                        className="w-full px-2"
                        title="Sistema"
                    >
                        <Monitor className="h-4 w-4" />
                    </Button>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Cores</DropdownMenuLabel>
                <div className="grid grid-cols-5 gap-1 p-2">
                    {colors.map((c) => (
                        <button
                            key={c.name}
                            className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                c.bg,
                                color === c.name ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                            )}
                            onClick={() => setColor(c.name)}
                            title={c.label}
                        />
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
