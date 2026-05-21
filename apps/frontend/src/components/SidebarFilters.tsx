import React from "react";

type SidebarFiltersProps = {
  destinationOptions: string[];
  monthOptions: string[];
  yearOptions: string[];
  destination: string;
  month: string;
  year: string;
  onDestinationChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
};

const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  destinationOptions,
  monthOptions,
  yearOptions,
  destination,
  month,
  year,
  onDestinationChange,
  onMonthChange,
  onYearChange,
}) => {
  return (
    <div className="bg-card/30 border border-border rounded-xl p-4 flex flex-col gap-3">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Destination Country
        </label>
        <select
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
        >
          {destinationOptions.map((destinationOption) => (
            <option key={destinationOption} value={destinationOption}>
              {destinationOption}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {monthOptions.map((monthOption) => (
              <option key={monthOption} value={monthOption}>
                {monthOption}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Year
          </label>
          <select
            value={year}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full h-9 rounded-md bg-secondary border border-border px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
          >
            {yearOptions.map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SidebarFilters;

