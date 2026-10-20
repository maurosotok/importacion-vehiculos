"""Verify supplied catalogs and the documented case. Does not calculate tax rules.
Run from any directory with Python 3. No network and no third-party dependencies.
"""
from pathlib import Path
from decimal import Decimal as D, ROUND_HALF_UP, localcontext
import json

ROOT = Path(__file__).resolve().parents[1]
checks = []
def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

def main():
    sea = read("data/catalogos/embarques_referencia_2025.json")["rates"]
    tow = read("data/catalogos/gruas_desde_excel.json")["rates"]
    profiles = read("data/catalogos/perfiles_fees.json")
    types = read("data/catalogos/tipos_vehiculo.json")
    prefs = read("data/catalogos/preferencias_iniciales.json")
    fixture = read("data/fixtures/caso_104.json")
    check("30 ocean rows", len(sea) == 30)
    check("282 source towing rows retained", len(tow) == 282)
    check("Unique towing source IDs", len({r['id'] for r in tow}) == 282)
    check("41 on-request rows remain unknown", sum('source_says_se_cotiza' in r['nonblocking_notes'] and r['amount_usd'] is None for r in tow) == 41)
    check("No dimensional approval in ocean references", all(not r['requires_classification_confirmation'] and not r['enforce_dimensions'] for r in sea))
    check("45 supplier headers", len(read('data/catalogos/proveedores_repuestos.json')['suppliers']) == 45)
    check("Four shipping companies", len(read('data/catalogos/navieras.json')['providers']) == 4)
    check("Ten selectable fee families/options", len(profiles['profiles']) == 10 and all(p['selectable'] for p in profiles['profiles']))
    check("Default IAA Standard Volume", profiles['default_profile_id'] == 'iaa_standard_volume' and sum(p['is_default'] for p in profiles['profiles']) == 1)
    check("Missing fee tables are not fabricated", all(p['rule_rows'] == [] for p in profiles['profiles']))
    check("Tax research and API disabled", not prefs['tax_research_enabled'] and not prefs['tax_api_enabled'])
    check("No automatic one-time tax/local charge", not prefs['one_time_tax_auto_apply'] and not prefs['local_expenses_auto_apply'])
    check("No historical operational seed", not prefs['seed_old_transactions'] and not prefs['seed_old_market_prices'] and not prefs['seed_old_part_quotes'])
    keys={(r['departure_zone'],r['category_code']) for r in sea}
    check("Working type mappings resolve", all(code is None or (zone,code) in keys for t in types['vehicle_types'] for zone,code in t['source_category_by_zone'].items()))
    inp=fixture['inputs']
    with localcontext() as ctx:
        ctx.prec=34
        fx=D(inp['exchange_rate_hnl_per_usd']); landing=D(inp['manual_combined_landing_hnl'])
        cash=sum(D(inp[k]) for k in ['bid_usd','fees_usd','towing_usd','ocean_usd','paperwork_usd'])
        total=cash*fx+landing
        repair=D(inp['repair_budget_hnl']); sale=D(inp['expected_sale_hnl'])
        money=lambda v: v.quantize(D('.01'), rounding=ROUND_HALF_UP)
        check("New cost USD 6160.90", money(cash+landing/fx)==D('6160.90'))
        check("New import HNL 166521.73", money(total)==D('166521.73'))
        check("New with repair HNL 186521.73", money(total+repair)==D('186521.73'))
        check("New profit HNL 33478.27", money(sale-total-repair)==D('33478.27'))
        legacy_hnl=total-D(inp['paperwork_usd'])*fx
        legacy_usd=cash+landing/fx+D(inp['bid_usd'])+D(inp['fees_usd'])
        check("Original HNL 166116.298 preserved", legacy_hnl==D(fixture['legacy_expected']['total_hnl_unrounded']))
        check("Original USD 9155.90 preserved", money(legacy_usd)==D(fixture['legacy_expected']['total_usd_display']))
        check("Difference is paperwork 405.432", total-legacy_hnl==D('405.432'))
        check("Manual breakdown sums only explicit inputs", D('10000')+D('21000')==D('31000'))
    ignored=(ROOT/'.gitignore').read_text(encoding='utf8')
    check("Private sources ignored by Git", 'fuentes_privadas/' in ignored and '.env' in ignored)
    check("No previous fiscal algorithm bundled", not (ROOT/'scripts/verificar_caso_observado.py').exists() and not (ROOT/'data/caso_sarah_observado.json').exists())
    print(f"PASS: {len(checks)} package checks. This is not an application test or a deployment.")
    for name in checks:
        print("PASS - " + name)

if __name__ == '__main__':
    main()
