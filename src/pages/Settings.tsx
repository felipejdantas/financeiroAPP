import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, CreditCard, Users } from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { PeriodosMensaisManager } from "@/components/dashboard/PeriodosMensaisManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CartoesManager } from "@/components/dashboard/CartoesManager";
import { TelegramConnect } from "@/components/dashboard/TelegramConnect";
import { ResponsaveisManager } from "@/components/dashboard/ResponsaveisManager";
import { useSearchParams } from "react-router-dom";

export default function Settings() {
    const [userId, setUserId] = useState<string | null>(null);
    const [configMesesOpen, setConfigMesesOpen] = useState(false);
    const [searchParams] = useSearchParams();
    // Links "Cadastrar cartões" do Dashboard/formulário abrem o painel direto
    const [cartoesOpen, setCartoesOpen] = useState(searchParams.get("cartoes") === "1");
    const [responsaveisOpen, setResponsaveisOpen] = useState(searchParams.get("responsaveis") === "1");

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
                    <CardTitle>Geral</CardTitle>
                    <CardDescription>
                        Opções gerais do sistema
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Meus Cartões</h3>
                                <p className="text-sm text-muted-foreground">
                                    Cadastre, renomeie e organize seus cartões de crédito
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setCartoesOpen(true)}>
                            Gerenciar
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Responsáveis</h3>
                                <p className="text-sm text-muted-foreground">
                                    Cadastre os responsáveis e escolha quem aparece no dashboard
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setResponsaveisOpen(true)}>
                            Gerenciar
                        </Button>
                    </div>

                    {userId && <TelegramConnect userId={userId} />}

                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <SettingsIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Conf. Meses Crédito</h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure os períodos de faturamento do cartão
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setConfigMesesOpen(true)}>
                            Configurar
                        </Button>
                    </div>

                    {/* Placeholder para futuras configurações */}
                    <div className="flex items-center justify-between p-4 border rounded-lg opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <SettingsIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Outras Configurações</h3>
                                <p className="text-sm text-muted-foreground">
                                    Em breve
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" disabled>
                            Em breve
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {userId && (
                <CartoesManager userId={userId} open={cartoesOpen} onOpenChange={setCartoesOpen} />
            )}

            {userId && (
                <ResponsaveisManager userId={userId} open={responsaveisOpen} onOpenChange={setResponsaveisOpen} />
            )}

            {userId && configMesesOpen && (
                <PeriodosMensaisManager
                    userId={userId}
                    onUpdate={() => loadUserProfile(userId)}
                    open={configMesesOpen}
                    onOpenChange={setConfigMesesOpen}
                />
            )}


            <Card>
                <CardHeader>
                    <CardTitle>Aparência</CardTitle>
                    <CardDescription>
                        Personalize o tema e as cores do sistema
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Palette className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium">Tema do Sistema</h3>
                                <p className="text-sm text-muted-foreground">
                                    Alterne entre os modos claro/escuro e escolha a cor de destaque
                                </p>
                            </div>
                        </div>
                        <ThemeSwitcher />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
