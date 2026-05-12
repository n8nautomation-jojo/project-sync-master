import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PlatformInvoice } from "@/hooks/usePlatformInvoices";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

export function generatePlatformInvoicePdf(invoice: PlatformInvoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Top dark header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 100, "F");

  // Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SUDA-TECHNOLOGIES LLC", margin, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoice.from_address, margin, 66);
  doc.text(invoice.from_email, margin, 80);

  // Invoice block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("INVOICE", pageWidth - margin, 48, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`No. ${invoice.invoice_number}`, pageWidth - margin, 70, { align: "right" });
  doc.text(`Issued: ${formatDate(invoice.issue_date)}`, pageWidth - margin, 84, { align: "right" });

  // Reset color
  doc.setTextColor(15, 23, 42);

  // Bill To
  let y = 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  y += 18;
  doc.text(invoice.to_organization_name, margin, y);
  if (invoice.to_email) {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(invoice.to_email, margin, y);
  }

  // Right side: invoice meta block
  let metaY = 140;
  const metaX = pageWidth - margin - 200;
  const drawMeta = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(label, metaX, metaY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(value, pageWidth - margin, metaY, { align: "right" });
    metaY += 16;
  };
  if (invoice.due_date) drawMeta("DUE DATE", formatDate(invoice.due_date));
  drawMeta("STATUS", invoice.status.toUpperCase());
  drawMeta("CURRENCY", "USD");

  // Items table
  const tableStart = Math.max(y, metaY) + 30;
  const periodLabel =
    invoice.period_start && invoice.period_end
      ? `${formatDate(invoice.period_start)}  —  ${formatDate(invoice.period_end)}`
      : "";

  autoTable(doc, {
    startY: tableStart,
    head: [["Description", "Period", "Qty", "Unit Price", "Amount"]],
    body: [
      [
        invoice.description || "Hisabaty Subscription",
        periodLabel,
        "1",
        fmt(invoice.amount_usd),
        fmt(invoice.amount_usd),
      ],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 10 },
    columnStyles: {
      2: { halign: "center", cellWidth: 40 },
      3: { halign: "right", cellWidth: 80 },
      4: { halign: "right", cellWidth: 80 },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error lastAutoTable from autoTable plugin
  let endY = doc.lastAutoTable.finalY + 24;
  const labelX = pageWidth - margin - 180;
  const valueX = pageWidth - margin;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", labelX, endY);
  doc.text(fmt(invoice.amount_usd), valueX, endY, { align: "right" });
  endY += 16;
  doc.text("Tax", labelX, endY);
  doc.text(fmt(invoice.tax_usd), valueX, endY, { align: "right" });

  endY += 22;
  doc.setDrawColor(220);
  doc.line(labelX, endY - 14, valueX, endY - 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL DUE", labelX, endY);
  doc.text(`${fmt(invoice.total_usd)} USD`, valueX, endY, { align: "right" });

  // Payment block
  endY += 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("PAYMENT METHODS", margin, endY);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  endY += 14;
  doc.text("Bank Transfer (Mercury) • Stripe • Wire Transfer", margin, endY);
  endY += 14;
  doc.text(`Bank Statement Reference: ${invoice.invoice_number}`, margin, endY);

  if (invoice.status === "paid" && invoice.paid_at) {
    endY += 30;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 139, 34);
    doc.setFontSize(14);
    doc.text(`PAID  •  ${formatDate(invoice.paid_at.slice(0, 10))}`, margin, endY);
    if (invoice.payment_reference) {
      endY += 16;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Reference: ${invoice.payment_reference}`, margin, endY);
    }
  }

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(
    "Thank you for your business. This invoice is issued by Suda-Technologies LLC, a registered company in the United States.",
    pageWidth / 2,
    pageHeight - 40,
    { align: "center", maxWidth: pageWidth - margin * 2 }
  );
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US")} • billing@suda-technologies.com`,
    pageWidth / 2,
    pageHeight - 22,
    { align: "center" }
  );

  doc.save(`${invoice.invoice_number}.pdf`);
}
