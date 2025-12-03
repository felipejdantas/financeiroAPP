import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function Scheduling() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-card-foreground">Agendamentos</h1>
                <p className="text-muted-foreground mt-2">
                    Gerencie despesas recorrentes e agendadas
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Despesas Agendadas
                    </CardTitle>
                    <CardDescription>
                        Página em desenvolvimento - Em breve você poderá agendar despesas recorrentes
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
