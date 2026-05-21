# PET Backend Market Research Flow

## Runtime Files

- API entry point: `PET_UI/PET-Backend/main.py`
- Market Research loader: `PET_UI/PET-Backend/market_research_data_model.py`
- Supplier loader: `PET_UI/PET-Backend/supplier_data_model.py`
- Market Research model: `market_research/standardization/outputs/Data_Standardized_MR_Front_End_Data_Model.xlsx`
- Supplier model: `front_end_data_model/outputs/Data_Standardized_Front_End_Data_Model.xlsx`

## API Flow

1. Frontend calls:

   ```text
   GET /countries?destination=<destination>&month=<month>&year=<year>
   ```

2. `main.py` applies defaults when filters are missing:

   ```text
   destination = Colombia
   month = March
   year = 2026
   ```

3. `build_market_research_countries()` reads the standardized Market Research model.

4. The Market Research rows are filtered by:

   ```text
   Destination Country
   Time Period Month
   Time Period Year
   ```

5. Rows are grouped by source country from:

   ```text
   Supplier Name
   ```

6. Each source-country card is built from the 22 Market Research cost rows:

   ```text
   PET resin cost (FOB)
   Freight cost
   Insurance
   Taxes and duties
   Destination port transportation
   Total landed cost (PET resin)
   ```

7. Market Research rows are mapped to the same common component structure used by the Supplier rows:

   | Market Research Mapping Columns | Common Component |
   | --- | --- |
   | Resin Index vPET | Resin Index |
   | Freight | Freight |
   | Insurance | Insurance |
   | Tax | Duty & Import Taxes |
   | Customs clearance | Local Taxes & Fees |
   | Others | Logistics & Other Costs |
   | Total Landing Cost | Total Landed Cost (PET Resin) |

8. `Total landed cost (PET resin)` becomes the country card amount and rank basis.

9. The API then calls `build_vendor_breakdowns()` from the Supplier model using the same source-country list.

10. A derived difference row is added to each Market Research country card:

   ```text
   Supplier TLC - Market Research TLC
   ```

11. Final response contains:

    ```text
    destination
    month
    year
    countries
    vendorBreakdowns
    supplierPrice
    ```

## Actual And Forecast Coverage

- February 2026 rows come from `Data Type = Actual`.
- March 2026 to December 2026 rows come from `Data Type = Forecast`.
- No dummy monthly scaling is used in the backend now.
- The frontend month selector allows February through December for 2026.

## Destination Alias

The UI destination `El Salvador and Honduras` is mapped to the Market Research destination `El Salvador`, matching the supplier-side combined destination behavior.
