import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";
import { PeriodosMensaisManager } from "@/components/dashboard/PeriodosMensaisManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function Settings() {
    const [userId, setUserId] = useState<string | null>(null);
    const [configMesesOpen, setConfigMesesOpen] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id);
        });
    }, []);

    const loadUserProfile = async (uid: string) => {
        // Reload any necessary data after configuration changes
        console.log("User profile reloaded for:", uid);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-card-foreground">Configurações</h1>
                <p className="text-muted-foreground mt-2">
                    Gerencie as configurações da aplicação
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SettingsIcon className="h-5 w-5" />
                        Períodos Mensais
                    </CardTitle>
                    <CardDescription>
                        Configure os períodos de faturamento do cartão de crédito
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => setConfigMesesOpen(true)}>
                        Configurar Meses
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Outras Configurações</CardTitle>
                    <CardDescription>
                        Mais opções de configuração em breve
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-12">
                        Funcionalidades adicionais em desenvolvimento...
                    </p>
                </CardContent>
            </Card>

            {userId && configMesesOpen && (
                <PeriodosMensaisManager
                    userId={userId}
                    onUpdate={() => loadUserProfile(userId)}
                    open={configMesesOpen}
                    onOpenChange={setConfigMesesOpen}
                />
            )}
        </div>
    );
}
