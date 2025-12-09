import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { Despesa } from "@/types/despesa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  despesas: Despesa[];
  filtrosAtivos: {
    responsavel: string;
    tipo: string;
    categoria: string;
  };
  simple?: boolean;
}

export const ExportButton = ({ despesas, filtrosAtivos, simple = false }: ExportButtonProps) => {
  const exportToPDF = (groupBy: "usuario" | "tipo" | "categoria" | "data" | "todas") => {
    console.log("Iniciando exportação PDF...", { groupBy, despesasCount: despesas?.length });

    if (!despesas || !Array.isArray(despesas)) {
      console.error("Dados de despesas inválidos:", despesas);
      alert("Erro: Dados de despesas inválidos para exportação.");
      return;
    }

    try {
      const doc = new jsPDF();

      // Título
      doc.setFontSize(18);
      doc.text("Relatório de Despesas", 14, 20);

      // Informações dos filtros
      doc.setFontSize(10);
      let yPos = 30;
      if (filtrosAtivos?.responsavel && filtrosAtivos.responsavel !== "todos") {
        doc.text(`Responsável: ${filtrosAtivos.responsavel}`, 14, yPos);
        yPos += 5;
      }
      if (filtrosAtivos?.tipo && filtrosAtivos.tipo !== "todos") {
        doc.text(`Tipo: ${filtrosAtivos.tipo}`, 14, yPos);
        yPos += 5;
      }
      if (filtrosAtivos?.categoria && filtrosAtivos.categoria !== "todas") {
        doc.text(`Categoria: ${filtrosAtivos.categoria}`, 14, yPos);
        yPos += 5;
      }

      yPos += 5;

      if (despesas.length === 0) {
        doc.text("Nenhuma despesa encontrada para exportar.", 14, yPos);
        doc.save(`relatorio-vazio-${new Date().toISOString().split("T")[0]}.pdf`);
        return;
      }

      // Ordenar despesas por data (mais recente para mais antiga)
      const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date(0);
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day);
      };

      const despesasOrdenadas = [...despesas].sort((a, b) => {
        const dateA = parseDate(a.Data);
        const dateB = parseDate(b.Data);
        return dateB.getTime() - dateA.getTime();
      });

      // Usar despesasOrdenadas para o resto da função
      const despesasParaExportar = despesasOrdenadas;

      if (groupBy === "todas") {
        // Exportar todas as despesas sem agrupamento
        const tableData = despesasParaExportar.map(d => [
          d.Data || "-",
          d.Descrição || "-",
          d.Responsavel || "-",
          d.Categoria || "-",
          d.Tipo || "-",
          d.Parcelas || "-",
          `R$ ${(d.valor || 0).toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [["Data", "Descrição", "Responsável", "Categoria", "Tipo", "Parcelas", "Valor"]],
          body: tableData,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [33, 150, 243] },
        });

        // Total
        const total = despesasParaExportar.reduce((sum, d) => sum + (d.valor || 0), 0);
        const finalY = (doc as any).lastAutoTable?.finalY || yPos + 10;
        doc.setFontSize(12);
        doc.text(`Total: R$ ${total.toFixed(2)}`, 14, finalY + 10);

      } else if (groupBy === "usuario") {
        const grouped = despesasParaExportar.reduce((acc, d) => {
          const resp = d.Responsavel || "Sem responsável";
          if (!acc[resp]) acc[resp] = [];
          acc[resp].push(d);
          return acc;
        }, {} as Record<string, Despesa[]>);

        Object.entries(grouped).forEach(([responsavel, items], index) => {
          const prevY = (doc as any).lastAutoTable?.finalY || yPos;
          if (index > 0) yPos = prevY + 15;

          // Check if we need a new page
          if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(12);
          doc.text(`Responsável: ${responsavel}`, 14, yPos);
          yPos += 5;

          const tableData = items.map(d => [
            d.Data || "-",
            d.Descrição || "-",
            d.Categoria || "-",
            d.Tipo || "-",
            `R$ ${(d.valor || 0).toFixed(2)}`,
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Data", "Descrição", "Categoria", "Tipo", "Valor"]],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 150, 243] },
          });

          const subtotal = items.reduce((sum, d) => sum + (d.valor || 0), 0);
          const finalY = (doc as any).lastAutoTable?.finalY || yPos;
          doc.setFontSize(10);
          doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 14, finalY + 7);
        });

      } else if (groupBy === "tipo") {
        const grouped = despesasParaExportar.reduce((acc, d) => {
          const tipo = d.Tipo || "Outros";
          if (!acc[tipo]) acc[tipo] = [];
          acc[tipo].push(d);
          return acc;
        }, {} as Record<string, Despesa[]>);

        Object.entries(grouped).forEach(([tipo, items], index) => {
          const prevY = (doc as any).lastAutoTable?.finalY || yPos;
          if (index > 0) yPos = prevY + 15;

          if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(12);
          doc.text(`Tipo: ${tipo}`, 14, yPos);
          yPos += 5;

          const tableData = items.map(d => [
            d.Data || "-",
            d.Descrição || "-",
            d.Responsavel || "-",
            d.Categoria || "-",
            `R$ ${(d.valor || 0).toFixed(2)}`,
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Data", "Descrição", "Responsável", "Categoria", "Valor"]],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 150, 243] },
          });

          const subtotal = items.reduce((sum, d) => sum + (d.valor || 0), 0);
          const finalY = (doc as any).lastAutoTable?.finalY || yPos;
          doc.setFontSize(10);
          doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 14, finalY + 7);
        });

      } else if (groupBy === "categoria") {
        const grouped = despesasParaExportar.reduce((acc, d) => {
          const cat = d.Categoria || "Sem categoria";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(d);
          return acc;
        }, {} as Record<string, Despesa[]>);

        Object.entries(grouped).forEach(([categoria, items], index) => {
          const prevY = (doc as any).lastAutoTable?.finalY || yPos;
          if (index > 0) yPos = prevY + 15;

          if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(12);
          doc.text(`Categoria: ${categoria}`, 14, yPos);
          yPos += 5;

          const tableData = items.map(d => [
            d.Data || "-",
            d.Descrição || "-",
            d.Responsavel || "-",
            d.Tipo || "-",
            `R$ ${(d.valor || 0).toFixed(2)}`,
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Data", "Descrição", "Responsável", "Tipo", "Valor"]],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 150, 243] },
          });

          const subtotal = items.reduce((sum, d) => sum + (d.valor || 0), 0);
          const finalY = (doc as any).lastAutoTable?.finalY || yPos;
          doc.setFontSize(10);
          doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 14, finalY + 7);
        });

      } else if (groupBy === "data") {
        const grouped = despesasParaExportar.reduce((acc, d) => {
          const mes = d.Data ? d.Data.substring(3) : "Data inválida"; // MM/YYYY
          if (!acc[mes]) acc[mes] = [];
          acc[mes].push(d);
          return acc;
        }, {} as Record<string, Despesa[]>);

        Object.entries(grouped).forEach(([mes, items], index) => {
          const prevY = (doc as any).lastAutoTable?.finalY || yPos;
          if (index > 0) yPos = prevY + 15;

          if (yPos > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(12);
          doc.text(`Período: ${mes}`, 14, yPos);
          yPos += 5;

          const tableData = items.map(d => [
            d.Data || "-",
            d.Descrição || "-",
            d.Responsavel || "-",
            d.Categoria || "-",
            d.Tipo || "-",
            `R$ ${(d.valor || 0).toFixed(2)}`,
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Data", "Descrição", "Responsável", "Categoria", "Tipo", "Valor"]],
            body: tableData,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 150, 243] },
          });

          const subtotal = items.reduce((sum, d) => sum + (d.valor || 0), 0);
          const finalY = (doc as any).lastAutoTable?.finalY || yPos;
          doc.setFontSize(10);
          doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 14, finalY + 7);
        });
      }

      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString("pt-BR")}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`relatorio-despesas-${groupBy}-${new Date().toISOString().split("T")[0]}.pdf`);
      console.log("Exportação concluída com sucesso");
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      alert(`Erro ao gerar o PDF: ${error.message || error}`);
    }
  };

  if (simple) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToPDF("todas")}>
        <Download className="h-4 w-4" />
        Exportar PDF
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToPDF("todas")}>
          Todas as despesas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF("usuario")}>
          Agrupar por Usuário
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF("tipo")}>
          Agrupar por Tipo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF("categoria")}>
          Agrupar por Categoria
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF("data")}>
          Agrupar por Período
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
