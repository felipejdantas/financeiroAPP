import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

export default function Profile() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-card-foreground">Perfil</h1>
                <p className="text-muted-foreground mt-2">
                    Gerencie suas informações pessoais
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Informações do Perfil
                    </CardTitle>
                    <CardDescription>
                        Página em desenvolvimento - Em breve você poderá editar seu perfil
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-12">
                        Esta funcionalidade está sendo desenvolvida...
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
