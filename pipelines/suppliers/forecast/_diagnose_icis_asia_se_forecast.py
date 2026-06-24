import pandas as pd
from pathlib import Path

base = Path('.')
model = pd.read_csv(base / 'data/processed/current/supplier/Data_Standardized_Front_End_Data_Model.csv')
curve_df = pd.read_excel(base / 'data/processed/current/indexes/suppliers/AsiaSE_final_forecast.xlsx', sheet_name='in')
curve_df['forecast_month'] = pd.to_datetime(curve_df['forecast_month'])
curve = {(int(d.year), int(d.month)): float(v) for d, v in zip(curve_df['forecast_month'], curve_df['point_forecast'])}

cfg = {
    'Panama': {'lag': 2, 'resin': 'FOB Price', 'total': 'DDP Price', 'mode': 'simple'},
    'Peru': {'lag': 2, 'resin': 'FOB Price', 'total': 'DDP Price', 'mode': 'simple'},
    'Argentina': {'lag': 2, 'resin': 'FOB Price', 'total': 'DDP Price', 'mode': 'simple'},
    'Dominican Republic': {'lag': 2, 'resin': 'FOB Price', 'total': 'DDP Price', 'mode': 'simple'},
    'Uruguay': {'lag': 1, 'resin': 'Resina FOB Asia', 'total': 'Precio final en planta v PET', 'mode': 'uruguay'},
    'Brazil': {'lag': 1, 'resin': 'Resin with assumptions', 'total': 'Total V-PET USD/ton', 'mode': 'brazil'},
}


def prev_month(y, m, lag):
    m2 = m - lag
    y2 = y
    while m2 < 1:
        m2 += 12
        y2 -= 1
    return y2, m2


f = model[(model['Data Type'].str.lower() == 'forecast') & (
    ((model['Time Period Year'] > 2026) | ((model['Time Period Year'] == 2026) & (model['Time Period Month'] >= 7))) &
    ((model['Time Period Year'] < 2027) | ((model['Time Period Year'] == 2027) & (model['Time Period Month'] <= 5)))
)]

print('Horizon forecast rows:', len(f))
print('Resin curve checks (max abs diff vs expected):')
for dest, c in cfg.items():
    s = f[(f['Destination Country'] == dest) & (f['Raw Cost Breakdown'] == c['resin'])]
    if s.empty:
        print(f'{dest:20s} missing resin rows')
        continue
    diffs = []
    for _, r in s.iterrows():
        y = int(r['Time Period Year'])
        m = int(r['Time Period Month'])
        sy, sm = prev_month(y, m, c['lag'])
        exp = curve.get((sy, sm))
        if exp is None:
            continue
        diffs.append(abs(float(r['Value ']) - exp))
    if diffs:
        print(f'{dest:20s} max diff={max(diffs):.6f}, rows={len(diffs)}')
    else:
        print(f'{dest:20s} no comparable rows')

print('\nFormula checks (max abs error):')
for dest, c in cfg.items():
    s = f[f['Destination Country'] == dest].copy()
    if s.empty:
        print(f'{dest:20s} no rows')
        continue
    errs = []
    for (_, _, _), g in s.groupby(['Time Period Year', 'Time Period Month', 'Location']):
        val = {k: float(v) for k, v in zip(g['Raw Cost Breakdown'], g['Value '])}
        if c['mode'] == 'simple':
            if 'FOB Price' in val and 'Ocean Freight' in val and 'Import Clearance (%)' in val and c['total'] in val:
                exp = val['FOB Price'] + val['Ocean Freight'] + val['Import Clearance (%)']
                errs.append(abs(val[c['total']] - exp))
        elif c['mode'] == 'uruguay':
            need = ['Resina FOB Asia', 'Flete internacional', 'Otros gastos', 'Gasto de internacion y puesta en Silos', c['total']]
            if all(k in val for k in need):
                exp = (val['Resina FOB Asia'] + val['Flete internacional'] + val['Otros gastos']) * (1 + val['Gasto de internacion y puesta en Silos'])
                errs.append(abs(val[c['total']] - exp))
        elif c['mode'] == 'brazil':
            need = ['Resin with assumptions', 'Discount', 'Drewry (t-1) with discount', 'Importation', 'Import Tax', 'Surcharge', 'Indorama Discount', c['total']]
            if all(k in val for k in need):
                exp = (((val['Resin with assumptions'] * (1 - val['Discount'])) + val['Drewry (t-1) with discount']) * (1 + val['Importation'] + val['Import Tax'])) + val['Surcharge'] + val['Indorama Discount']
                errs.append(abs(val[c['total']] - exp))
    if errs:
        print(f'{dest:20s} max error={max(errs):.6f}')
    else:
        print(f'{dest:20s} no comparable groups')
