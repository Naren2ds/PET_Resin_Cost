import React from "react";
import type { CountryCost } from "../types";
import { formatAmount } from "../types";
import { Card, CardContent } from "@/components/ui/card";

type VendorBreakdownItem = {
  label: string;
  amount: string | number | null | undefined;
};

type SummaryCardsProps = {
  country: CountryCost;
  supplierPrice: number;
  vendorBreakdown?: VendorBreakdownItem[];
};

const SummaryCards: React.FC<SummaryCardsProps> = ({
  country,
  supplierPrice,
  vendorBreakdown = [],
}) => {
  const tlc = country.breakdown.find((b) =>
    b.label.toLowerCase().includes("total landed cost")
  );
  const diff = country.breakdown.find((b) =>
    b.label.toLowerCase().includes("difference")
  );

  const vendorTlc = vendorBreakdown.find(
    (item) =>
      item.label.trim().toLowerCase() ===
      "total resin price abi virgin formula".toLowerCase()
  );

  const vendorTlcDisplay =
    typeof vendorTlc?.amount === "number"
      ? `$${formatAmount(vendorTlc.amount)}/MT`
      : vendorTlc?.amount
        ? String(vendorTlc.amount)
        : "$0/MT";

  const diffValue = typeof diff?.amount === "number" ? diff.amount : null;
  const isNegativeDelta = diffValue !== null && diffValue < 0;

  return (
    <section className="grid grid-cols-4 gap-3.5 animate-fade-in-up max-lg:grid-cols-2 max-sm:grid-cols-1">
      <Card className="py-4 px-4 hover:-translate-y-0.5 transition-transform">
        <CardContent className="p-0 flex items-center gap-3.5">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Research (Deloitte) TLC
            </span>
            <strong className="block mt-1 text-base font-bold text-foreground">
              {typeof tlc?.amount === "number"
                ? `$${formatAmount(tlc.amount)}/MT`
                : formatAmount(tlc?.amount)}
            </strong>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`py-4 px-4 hover:-translate-y-0.5 transition-transform ${
          isNegativeDelta ? "border-destructive/25" : "border-success/25"
        }`}
      >
        <CardContent className="p-0 flex items-center gap-3.5">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier TLC - Market Research TLC
            </span>
            <strong
              className={`block mt-1 text-base font-bold ${
                isNegativeDelta ? "text-destructive" : "text-success"
              }`}
            >
              {diffValue !== null
                ? `${diffValue > 0 ? "+" : ""}$${formatAmount(diffValue)}/MT`
                : "$0/MT"}
            </strong>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/3 py-4 px-4 hover:-translate-y-0.5 transition-transform">
        <CardContent className="p-0 flex items-center gap-3.5">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier TLC
            </span>
            <strong className="block mt-1 text-base font-bold text-primary">
              {vendorTlcDisplay || `$${formatAmount(supplierPrice)}/MT`}
            </strong>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

export default SummaryCards;
