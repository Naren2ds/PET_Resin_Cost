# Market Research TLC Front-End Data Model Pipeline

## Objective

Create `Data_Standardized_MR_Front_End_Data_Model` for the Market Research PET Resin Total Landed Cost calculator.

The model has the same front-end column structure as the supplier front-end data model, but it is owned separately under `market_research`.

Output files:

- `market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.xlsx`
- `market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.csv`
- `market_research/standardization/outputs/market_research_data_model_run_summary.json`

Pipeline script:

```powershell
python "market_research\scripts\build_market_research_front_end_data_model.py"
```

## Input Files

### TLC Calculator

Source:

- `MR Data/PET Resin Total landed cost calculator.xlsx`

Sheets used:

- `Lookups & references`
- `Tax references`
- `Total landed cost calculation`

The calculator provides:

- Source countries
- Destination countries
- Current PET resin FOB values
- Freight by source/destination route
- Local transport by destination country
- Tax, duty, insurance, and customs rates
- Actual model month, currently February 2026

### MR ICIS Index Table

Source:

- `Index Fprecast/Market Research Index/market_research_icis_resin_index_reference_table.csv`

This table provides monthly resin index values by sourcing country/index series.

Usage:

- February 2026 is the actual month from the TLC calculator.
- March-April 2026 use MR ICIS rows marked `Actual`.
- May-December 2026 use MR ICIS rows marked `Forecast`.

### Mapping Workbook

Source:

- `mapping files/Mapping_Columns.xlsx`
- Sheet: `MR PET Resin TLC`

This maps each raw cost component to the common front-end `Mapping Columns` and identifies whether the component is required for TLC calculation.

## Output Data Model Columns

The output uses these canonical columns:

```text
Data Type
Source File 
Supplier Name
Destination Country
Time_Period 
Time Period Year
Time Period Month
Location
Raw Cost Breakdown
Resin Index Type
Forecast Resin Index Type
Mapping Columns
Column Required for Calculation
Value 
TLC Formula
```

Market Research-specific handling:

- `Supplier Name` stores the source country.
- `Location` also stores the source country.
- `Destination Country` stores the landed-cost destination.
- `Data Type = Actual` for February 2026.
- `Data Type = Forecast` for March 2026 through December 2026.
- `Forecast Resin Index Type` is populated for forecast rows with the MR ICIS index series used.

## Source Country to MR ICIS Index Mapping

The pipeline maps TLC calculator source countries to MR ICIS index series as follows:

| TLC Source Country | MR ICIS Source | MR ICIS Index Type | Basis |
| --- | --- | --- | --- |
| Argentina | Argentina | ICIS Argentina DEL Domestic Mid | Direct source-country ICIS series |
| Brazil | Brazil | ICIS Brazil DEL Domestic Mid | Direct source-country ICIS series |
| China | China | ICIS China FOB Mid | Direct source-country ICIS series |
| India | India | ICIS India FOB Mid | Direct source-country ICIS series |
| Mexico | Mexico | ICIS Mexico FOB Export Mid | Mexico export FOB ICIS series used for landed-cost FOB resin |
| South Korea | South Korea | ICIS South Korea FOB Mid | Direct source-country ICIS series |
| Taiwan | Taiwan | ICIS Taiwan FOB Mid | Direct source-country ICIS series |
| Indonesia | Asia SE | ICIS Asia SE FOB Mid | Southeast Asia regional ICIS proxy |
| Thailand | Asia SE | ICIS Asia SE FOB Mid | Southeast Asia regional ICIS proxy |
| Vietnam | Asia SE | ICIS Asia SE FOB Mid | Southeast Asia regional ICIS proxy |
| USA | Mexico | ICIS Mexico DEL Domestic Mid | North America proxy because no USA series exists in the MR ICIS file |

The generated Excel also exposes this in the `forecast_index_mapping` sheet.

## Actual Calculation Flow

For February 2026:

1. Read source country FOB resin values from `Lookups & references`.
2. Read freight values by source/destination route from `Lookups & references`.
3. Read local transport by destination country from `Lookups & references`.
4. Read tax and customs rates by source/destination from `Tax references`.
5. Calculate each cost component for every valid source/destination pair.
6. Write one row per component plus one `Total landed cost (PET resin)` row.

## Forecast Calculation Flow

For March 2026 through December 2026:

1. Keep the same valid source/destination combinations from the calculator.
2. Fetch the monthly MR ICIS resin index value for the mapped source country/index series.
3. Replace only `PET resin cost (FOB)` with the monthly MR ICIS index value.
4. Keep the same freight, tax rates, customs rates, local transport, and destination/source setup.
5. Recalculate all dependent components.
6. Recalculate `Total landed cost (PET resin)`.
7. Write forecast rows in the same front-end format.

This creates a continuous front-end model:

- February 2026: Actual
- March 2026: Forecast using MR ICIS Actual index values
- April 2026: Forecast using MR ICIS Actual index values
- May-December 2026: Forecast using MR ICIS Forecast index values

## TLC Component Formulae

The formulas below are calculated for each source country, destination country, and month.

Base values:

```text
R = PET resin cost (FOB)
F = Freight cost
I = Insurance
LT = Destination port to supplier location transportation
```

Insurance:

```text
I = (R + F) * 0.004
```

Tax and customs components:

```text
Import duty = import duty rate * (R + F + I)

Anti-dumping duty = anti-dumping value

IPI = IPI rate * (R + Import duty + F + I)

PIS = PIS rate * (R + F + I)

COFINS = COFINS rate * (R + F + I)

Statistical fee = statistical fee rate * (R + F + I)

Tasa consular = tasa consular rate * (R + F + I)

Customs service fee =
  customs service rate * 1
  for El Salvador and Honduras

Customs service fee =
  customs service rate * (R + F + I)
  for all other destinations

Customs insurance = customs insurance rate * (R + F + I)

IGV/IPM = IGV/IPM rate * (R + F + Import duty + Customs insurance + I)

FODINFA = FODINFA rate * (R + F + I)
```

VAT/import reference calculation:

```text
VAT base =
  F + Import duty + R + IPI + PIS + COFINS
  + Statistical fee + Customs service fee
  + Customs insurance + FODINFA + I

Taxes (VAT/Import) =
  VAT rate * VAT base
```

For Brazil, VAT is grossed up:

```text
Taxes (VAT/Import) = VAT rate * (VAT base / (1 - VAT rate))
```

Percepcion IGV:

```text
Percepcion IGV =
  percepcion IGV rate
  * (R + F + Customs insurance + Import duty + Taxes (VAT/Import) + I)
```

Non-required reference components:

```text
Additional VAT
Income tax perception
IBB
IRAE
Taxes (VAT/Import)
```

These are retained as rows for visibility, but they are not included in the final TLC sum unless the calculator logic explicitly includes them through a required component.

## Total Landed Cost Formula

Final TLC is calculated as:

```text
Total landed cost (PET resin) =
  PET resin cost (FOB)
  + Freight cost
  + Insurance
  + Import duty
  + Anti-dumping duty
  + IPI
  + PIS
  + COFINS
  + Statistical fee
  + Tasa consular
  + Customs service fee
  + Customs insurance
  + IGV/IPM
  + Percepcion IGV
  + FODINFA
  + Destination port to supplier location transportation
```

This formula is written into the `TLC Formula` column for every row in the model.

## Excel Output Sheets

The generated Excel workbook contains:

| Sheet | Purpose |
| --- | --- |
| `front_end_data_model` | Final Actual and Forecast rows for the front end |
| `calculation_audit` | February 2026 actual source/destination calculation status |
| `forecast_calculation_audit` | March-December 2026 forecast calculation status by month/source/destination |
| `forecast_index_mapping` | Source-country to MR ICIS index mapping |
| `tlc_validation` | TLC back-calculation validation for Actual and Forecast |
| `formula_notes` | TLC formula and forecast assumptions |
| `run_metadata` | Source files, row counts, run timestamp, and output paths |

## Latest Run Summary

Latest generated model:

```text
Actual period: February 2026
Forecast periods: March 2026 through December 2026
Destination countries: 11
Source countries: 11
Calculated actual combinations: 95
Calculated forecast combinations: 950
Actual model rows: 2,090
Forecast model rows: 20,900
Total model rows: 22,990
TLC validation rows: 1,045
Validation status: 1,045 validated
Max TLC validation difference: 0.0
```

## Validation Logic

The `tlc_validation` sheet back-calculates TLC for every calculated source/destination/month:

```text
Back-calculated TLC = sum of included TLC components
Difference = Output TLC row value - Back-calculated TLC
```

The current output validates with:

```text
validated = 1,045
max_abs_difference = 0.0
```

## How the Front End Should Use the Model

The front end should filter rows by:

```text
Data Type
Destination Country
Supplier Name
Time_Period
Raw Cost Breakdown
```

For the final landed cost, filter:

```text
Raw Cost Breakdown = Total landed cost (PET resin)
```

The TLC is already pre-calculated in the model. The front end does not need to recalculate the formula live.
