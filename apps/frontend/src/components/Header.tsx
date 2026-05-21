import React from "react";
import abinbevLogo from "../assets/ABInbev.png";


type HeaderProps = {
    month: string;
    supplierPrice: number;
};

const Header: React.FC<HeaderProps> = ({ month: _month, supplierPrice: _supplierPrice }) => (
    <div className="animate-fade-in-up">
        <div className="flex items-center gap-3.5 mb-5">
            <img src={abinbevLogo} alt="AB InBev" className="brand-logo" />
            <div>
                <h1 className="text-xl font-bold leading-tight text-foreground">
                    PET resin : Supplier Quotes vs Market Research
                </h1>
            </div>
        </div>

        {/* <div className="grid grid-cols-2 gap-2.5">
            <Card className="bg-secondary/50 border-border py-3 px-3">
                <CardContent className="p-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Month
                    </span>
                    <strong className="block mt-1 text-base font-bold text-foreground">
                        {month}
                    </strong>
                </CardContent>
            </Card>
            <Card className="bg-secondary/50 border-border py-3 px-3">
                <CardContent className="p-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Supplier Price
                    </span>
                    <strong className="block mt-1 text-base font-bold text-foreground">
                        ${formatAmount(supplierPrice)}/MT
                    </strong>
                </CardContent>
            </Card>
        </div> */}
    </div>
);

export default Header;
