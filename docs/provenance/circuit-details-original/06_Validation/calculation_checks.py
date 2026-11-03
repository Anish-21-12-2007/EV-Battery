from fractions import Fraction
from math import pi, tanh
import json
from pathlib import Path

# Calculation audit utility. Inputs are documentary assumptions, not measurements.
def divider(rt, rb, vin, tol=0.01, c=100e-9):
    ratio_fraction = Fraction(int(rb), int(rt + rb))
    ratio = float(ratio_fraction)
    direct = vin * rb / (rt + rb)
    via_ratio = vin * ratio
    assert abs(direct - via_ratio) < 1e-12
    ratio_min = rb * (1-tol) / (rt * (1+tol) + rb * (1-tol))
    ratio_max = rb * (1+tol) / (rt * (1-tol) + rb * (1+tol))
    rth = rt * rb / (rt + rb)
    return {
        'ratio_fraction': f'{ratio_fraction.numerator}/{ratio_fraction.denominator}',
        'ratio': ratio, 'ratio_min_1pct': ratio_min, 'ratio_max_1pct': ratio_max,
        'thevenin_ohm': rth, 'rc_cutoff_100nf_hz': 1 / (2*pi*rth*c),
        'independent_ratio_crosscheck_abs_error': abs(direct-via_ratio),
    }

voltage = divider(68000, 10000, 18)
current = divider(27000, 20000, 18)
voltage.update({
    'node_at_18v_nominal_v': 18*voltage['ratio'],
    'node_at_18v_worst_v': 18*voltage['ratio_max_1pct'],
    'input_for_2p45v_worst_v': 2.45/voltage['ratio_max_1pct'],
    'divider_current_at_18v_a': 18/(68000+10000),
    'total_resistor_power_at_18v_w': 18**2/(68000+10000),
    'top_resistor_power_at_18v_w': (18/(68000+10000))**2*68000,
    'bottom_resistor_power_at_18v_w': (18/(68000+10000))**2*10000,
})
current.update({
    'zero_adc_node_v_at_5v_vcc': 2.5*current['ratio'],
    'plus_30a_nominal_adc_node_v': (2.5+30*0.066)*current['ratio'],
    'minus_30a_nominal_adc_node_v': (2.5-30*0.066)*current['ratio'],
    'adc_sensitivity_v_per_a': 0.066*current['ratio'],
    'adc_sensitivity_mv_per_a': 1000*0.066*current['ratio'],
    'adc_node_with_5p5v_sensor_rail_worst_v': 5.5*current['ratio_max_1pct'],
    'equivalent_current_for_60mv_adc_error_a': 0.060/(0.066*current['ratio']),
})
legacy_voltage = {
    'ratio': 22/(120+22), 'node_at_18v_v': 18*22/(120+22),
    'node_at_18v_1pct_worst_v': 18*(22*1.01)/(120*.99+22*1.01),
    'input_for_2p45v_nominal_v': 2.45/(22/(120+22)),
    'input_for_2p45v_worst_v': 2.45/((22*1.01)/(120*.99+22*1.01)),
}
legacy_current = {
    'ratio': 20/(15+20),
    'positive_30a_adc_node_v': (2.5+30*.066)*20/(15+20),
    'positive_current_at_2p45v_a': (2.45/(20/(15+20))-2.5)/.066,
}

# Existing simulator defaults and exact source-code equations at 50% SOC, flat road, speed cap.
etadrive = .90*.93
cd = .5*1.225*.34*1.9
fd = cd*22**2
fr = .012*720*9.81
froad = fd+fr
pwheel = froad*22
psteady = pwheel/etadrive+180
pfull = 18000/etadrive+180
whkm_steady = psteady/(22*3.6)
whkm_full = pfull/(22*3.6)
pack_wh = 96*150
ocv_lo = 96+13*tanh(3.5*(0-.5))
ocv_50 = 96+13*tanh(3.5*(.5-.5))
ocv_hi = 96+13*tanh(3.5*(1-.5))

# DOE LHV (Btu/US gal) converted with international Btu and US liquid gallon.
btu_kwh = 0.00029307107
usgal_l = 3.785411784
lhv_kwh_l = [x*btu_kwh/usgal_l for x in (112114,116090)]
epa_kg_l = 8.887/usgal_l

# Synthetic arithmetic example only, not a tariff/load measurement.
light_wh = 12.0*0.5*2.0
motor_wh = 12.0*4.0*0.25
example_wh = light_wh+motor_wh
example_cost_inr = example_wh/1000*8.0

result = {
    'method': 'Python binary floating point formulas independently cross-checked by exact Fraction divider ratios and direct-formula multiplication; no physical measurements or simulations.',
    'assumptions': {
        'divider_resistors_ohm': {'current': [27000,20000], 'voltage_each_branch': [68000,10000]},
        'resistor_tolerance_fraction': 0.01,
        'capacitor_f': 100e-9,
        'assumed_maximum_dc_sense_voltage_v': 18.0,
        'classic_esp32_adc_characterized_upper_range_v': 2.45,
        'acs712_30a_nominal_zero_v_at_vcc_5v': 2.5,
        'acs712_30a_typical_sensitivity_v_per_a': 0.066,
        'acs_output_bound_for_scaler_only_v': 5.5,
        'ev_defaults': {'mass_kg':720,'wheel_radius_m':.31,'max_motor_power_w':18000,'max_speed_m_s':22,'aux_w':180,'Cd':.34,'frontal_area_m2':1.9,'Crr':.012,'motor_efficiency':.90,'inverter_efficiency':.93,'regen_fraction':.28,'pack_v_nominal':96,'pack_ah':150,'R_internal_ohm':.035},
        'cost_example': {'voltage_v':12,'light_current_a':.5,'light_hours':2,'motor_current_a':4,'motor_hours':.25,'tariff_inr_per_kwh':8},
    },
    'current_divider': current,
    'voltage_divider_per_load': voltage,
    'legacy_120k_22k_voltage_divider': legacy_voltage,
    'legacy_15k_20k_current_divider': legacy_current,
    'buck_example_input_a': 5*.60/(.75*10.5)+.010,
    'nominal_energy_12v_7p6ah_wh': round(12*7.6,1),
    'nominal_energy_96v_150ah_wh': pack_wh,
    'ev_ocv_curve_outputs_v': {'soc_0':ocv_lo,'soc_50':ocv_50,'soc_100':ocv_hi},
    'ev_road_load_at_22m_s': {'drag_coefficient_n_per_mps2':cd,'drag_n':fd,'rolling_n':fr,'road_load_n':froad,'wheel_power_w':pwheel,'combined_motor_inverter_efficiency':etadrive,'battery_power_steady_w':psteady,'steady_wh_per_km':whkm_steady,'full_throttle_model_mechanical_power_w':18000,'full_throttle_model_force_at_22m_s_n':18000/22,'full_throttle_model_battery_power_w':pfull,'full_throttle_model_wh_per_km':whkm_full,'nominal_pack_range_arithmetic_steady_km':pack_wh/whkm_steady,'nominal_pack_range_arithmetic_full_throttle_km':pack_wh/whkm_full,'half_nominal_energy_range_arithmetic_steady_km':pack_wh*.5/whkm_steady,'half_nominal_energy_range_arithmetic_full_throttle_km':pack_wh*.5/whkm_full,'regen_effective_fraction_before_caps':.90*.93*.28,'nominal_11kw_charger_current_at_96v_a':11000/96,'dcdc_180w_input_at_88pct_w':180/.88},
    'petrol_factors': {'EPA_CO2_kg_per_litre':epa_kg_l,'old_2p31_kg_per_l_at_7p2_l_100km_kg_per_100km':7.2*2.31,'EPA_factor_at_7p2_l_100km_kg_per_100km':7.2*epa_kg_l,'DOE_gasoline_E10_LHV_kwh_per_litre_range':lhv_kwh_l},
    'synthetic_cost_example': {'light_wh':light_wh,'motor_wh':motor_wh,'total_wh':example_wh,'total_kwh':example_wh/1000,'cost_inr_at_assumed_tariff':example_cost_inr},
}
print(json.dumps(result,indent=2))
Path(__file__).with_name('calculation_results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
