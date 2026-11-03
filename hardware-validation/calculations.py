"""Reproducible bounds, not a simulation or hardware measurement."""
import math, json
from pathlib import Path
def divider(rt,rb):
    return {'ratio':rb/(rt+rb),'ratio_min':rb*.99/(rt*1.01+rb*.99),
            'ratio_max':rb*1.01/(rt*.99+rb*1.01),'r_thevenin_ohm':rt*rb/(rt+rb),
            'fc_100nf_hz':1/(2*math.pi*(rt*rb/(rt+rb))*100e-9)}
a=divider(27000,20000); b=divider(68000,10000)
a.update(node_zero_nominal_v=2.5*a['ratio'],node_30A_nominal_v=4.48*a['ratio'],
         node_minus30A_nominal_v=.52*a['ratio'],sensitivity_mv_per_a=66*a['ratio'],
         node_supply_rail_bound_v=5.5*a['ratio_max'])
b.update(node_18v_max_v=18*b['ratio_max'],node_12_6v_v=12.6*b['ratio'],
         ceiling_at_2_45v_v=2.45/b['ratio_max'],divider_drain_18v_a=18/78000,
         r3_dissipation_18v_w=(18/78000)**2*68000)
result=dict(assumptions=['classic ESP32 characterized upper target 2.45 V','resistors 1% independent extremes',
                        '18 V maximum DC sense voltage design assumption, not charge/surge rating',
                        'ACS OUT bounded by 5.5V rail; excludes faults/transients/unpowered MCU',
                        'ACS nominal zero 2.5V, slope .066V/A at 5V','buck example 5V .60A, 75% efficiency at 10.5V plus .010A allowance'],
            current_divider=a,voltage_divider=b,buck_example_input_a=5*.60/(.75*10.5)+.010,
            acs_supply_2percent_offset_equivalent_a=.05/.066,
            adc_60mv_error_equivalent_current_a=.060/(.066*a['ratio']),
            adc_60mv_error_equivalent_bus_v=.060/b['ratio'],
            nominal_energy_wh=12*7.6,legacy_62k_node_18v_nominal=18*10/72,
            legacy_15k20k_node_30a=4.48*20/35)
assert a['node_supply_rail_bound_v']<2.45 and b['node_18v_max_v']<2.45
Path(__file__).with_name('calculations.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
