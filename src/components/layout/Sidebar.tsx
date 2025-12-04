import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Home,
    CreditCard,
    Tag,
    Target,
    Calendar,
    User,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface SidebarProps {
    className?: string;
}

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Transações", href: "/transactions", icon: CreditCard },
    { name: "Categorias", href: "/categories", icon: Tag },
    { name: "Planejamento", href: "/planning", icon: Target },
    { name: "Agendamentos", href: "/scheduling", icon: Calendar },
    { name: "Perfil", href: "/profile", icon: User },
    { name: "Configurações", href: "/settings", icon: Settings },
];

export const Sidebar = ({ className }: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast({
                title: "Erro ao sair",
                description: error.message,
                variant: "destructive",
            });
        } else {
            navigate("/auth");
        }
    };

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-card border-r border-border transition-all duration-300",
                collapsed ? "w-16" : "w-64",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                {!collapsed && (
                    <h2 className="text-lg font-semibold text-card-foreground">
                        Fin DantasInfo
                    </h2>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="ml-auto"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                            title={collapsed ? item.name : undefined}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout Button */}
            <div className="p-2 border-t border-border">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                        collapsed && "justify-center"
                    )}
                    onClick={handleLogout}
                    title={collapsed ? "Sair" : undefined}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>Sair</span>}
                </Button>
            </div>
        </div>
    );
};
