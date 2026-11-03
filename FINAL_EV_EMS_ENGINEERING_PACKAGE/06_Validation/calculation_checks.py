from fractions import Fraction
from math import pi, tanh
import json
from pathlib import Path

# ==============================================================================
# EV-EMS Circuit & Battery Monitoring — Documentary Engineering Calculation Audit
# Disposition: Mathematical & datasheet limit verification only.
# No physical hardware was energized or tested.
# ==============================================================================

def divider(rt, rb, vin, tol=0.01, c=100e-9):
    ratio_fraction = Fraction(int(round(rb * 100)), int(round((rt + rb) * 100)))
    ratio = float(ratio_fraction)
    direct = vin * rb / (rt + rb)
    via_ratio = vin * ratio
    assert abs(direct - via_ratio) < 1e-12
    ratio_min = rb * (1 - tol) / (rt * (1 + tol) + rb * (1 - tol))
    ratio_max = rb * (1 + tol) / (rt * (1 - tol) + rb * (1 + tol))
    rth = rt * rb / (rt + rb)
    return {
        "r_top_ohm": rt,
        "r_bottom_ohm": rb,
        "tolerance_fraction": tol,
        "ratio_fraction": f"{ratio_fraction.numerator}/{ratio_fraction.denominator}",
        "ratio": ratio,
        "ratio_min_corner": ratio_min,
        "ratio_max_corner": ratio_max,
        "thevenin_ohm": rth,
        "rc_cutoff_100nf_hz": 1.0 / (2.0 * pi * rth * c),
        "independent_ratio_crosscheck_abs_error": abs(direct - via_ratio),
    }

# 1. Proposed Branch Voltage Divider: 68 kOhm / 10 kOhm (1% and 0.1% comparison)
voltage = divider(68000, 10000, 18.0, tol=0.01, c=100e-9)
voltage_0p1pct = divider(68000, 10000, 18.0, tol=0.001, c=100e-9)

voltage.update({
    "node_at_12v_nominal_v": 12.0 * voltage["ratio"],
    "node_at_12v_min_1pct_v": 12.0 * voltage["ratio_min_corner"],
    "node_at_12v_max_1pct_v": 12.0 * voltage["ratio_max_corner"],
    "node_at_18v_nominal_v": 18.0 * voltage["ratio"],
    "node_at_18v_min_1pct_v": 18.0 * voltage["ratio_min_corner"],
    "node_at_18v_worst_v": 18.0 * voltage["ratio_max_corner"],
    "node_at_18v_worst_0p1pct_v": 18.0 * voltage_0p1pct["ratio_max_corner"],
    "input_for_0p15v_nominal_v": 0.15 / voltage["ratio"],
    "input_for_0p15v_worst_low_v": 0.15 / voltage["ratio_min_corner"],
    "input_for_2p45v_nominal_v": 2.45 / voltage["ratio"],
    "input_for_2p45v_worst_v": 2.45 / voltage["ratio_max_corner"],
    "input_for_3p30v_nominal_v": 3.30 / voltage["ratio"],
    "input_for_3p60v_abs_max_worst_v": 3.60 / voltage["ratio_max_corner"],
    "divider_current_at_12v_a": 12.0 / (68000 + 10000),
    "divider_current_at_18v_a": 18.0 / (68000 + 10000),
    "total_resistor_power_at_12v_w": (12.0 ** 2) / (68000 + 10000),
    "total_resistor_power_at_18v_w": (18.0 ** 2) / (68000 + 10000),
    "top_resistor_power_at_18v_w": ((18.0 / (68000 + 10000)) ** 2) * 68000,
    "bottom_resistor_power_at_18v_w": ((18.0 / (68000 + 10000)) ** 2) * 10000,
    "equivalent_source_error_for_60mv_adc_error_v": 0.060 / voltage["ratio"],
    "open_bottom_resistor_fault_injection_current_at_18v_powered_3v3_a": (18.0 - 3.6) / 68000.0,
    "unpowered_mcu_injection_current_at_18v_via_68k_a": (18.0 - 0.3) / 68000.0,
})

# 2. Proposed Motor Current Scaler: 27 kOhm / 20 kOhm on ACS712ELCTR-30A-T
current = divider(27000, 20000, 5.0, tol=0.01, c=100e-9)
current.update({
    "zero_adc_node_v_at_5v_vcc": 2.5 * current["ratio"],
    "plus_30a_nominal_adc_node_v": (2.5 + 30.0 * 0.066) * current["ratio"],
    "plus_30a_worst_1pct_adc_node_v": (2.5 + 30.0 * 0.066) * current["ratio_max_corner"],
    "plus_30a_worst_sens_69mv_and_1pct_v": (2.5 + 30.0 * 0.069) * current["ratio_max_corner"],
    "minus_30a_nominal_adc_node_v": (2.5 - 30.0 * 0.066) * current["ratio"],
    "minus_30a_worst_1pct_adc_node_v": (2.5 - 30.0 * 0.066) * current["ratio_min_corner"],
    "adc_sensitivity_v_per_a": 0.066 * current["ratio"],
    "adc_sensitivity_mv_per_a": 1000.0 * 0.066 * current["ratio"],
    "adc_node_with_5p5v_sensor_rail_worst_v": 5.5 * current["ratio_max_corner"],
    "equivalent_current_for_60mv_adc_error_a": 0.060 / (0.066 * current["ratio"]),
    "ratiometric_vcc_2pct_drift_zero_shift_raw_v": 0.5 * 5.0 * 0.02,
    "ratiometric_vcc_2pct_drift_equivalent_current_error_a": (0.5 * 5.0 * 0.02) / 0.066,
    "unpowered_mcu_zero_current_node_v": 2.5 * current["ratio"],
    "unpowered_mcu_injection_current_at_2p5v_out_a": (2.5 - 0.3) / 27000.0,
    "unpowered_mcu_injection_current_at_4p48v_out_a": (4.48 - 0.3) / 27000.0,
})

# 3. Small Light Branch (0.5 A) Current Sensor Resolution Comparison
light_sensor_comparison = {
    "example_light_current_a": 0.50,
    "acs712_30a_66mv_per_a": {
        "raw_signal_shift_at_0p5a_mv": 0.50 * 66.0,
        "scaled_adc_shift_at_0p5a_mv": 0.50 * 66.0 * current["ratio"],
        "equivalent_60mv_adc_error_a": 0.060 / (0.066 * current["ratio"]),
        "relative_error_from_60mv_adc_at_0p5a_pct": (0.060 / (0.066 * current["ratio"])) / 0.50 * 100.0,
        "suitability": "UNSUITABLE for 0.5 A light branch (signal shift is 14.04 mV vs +/-60 mV ADC error budget = +/-427.3% error).",
    },
    "acs712_05b_185mv_per_a_candidate": {
        "raw_signal_shift_at_0p5a_mv": 0.50 * 185.0,
        "scaled_adc_shift_at_0p5a_mv": 0.50 * 185.0 * current["ratio"],
        "scaled_sensitivity_mv_per_a": 185.0 * current["ratio"],
        "plus_5a_scaled_adc_node_nominal_v": (2.5 + 5.0 * 0.185) * current["ratio"],
        "equivalent_60mv_adc_error_a": 0.060 / (0.185 * current["ratio"]),
        "relative_error_from_60mv_adc_at_0p5a_pct": (0.060 / (0.185 * current["ratio"])) / 0.50 * 100.0,
        "suitability": "MARGINAL on ESP32 ADC1 (signal shift 39.36 mV at 0.5 A vs +/-60 mV ADC error = +/-152.4% error without multipoint calibration).",
    },
    "ina219_i2c_0p1ohm_shunt_candidate": {
        "shunt_resistor_ohm": 0.10,
        "shunt_voltage_at_0p5a_mv": 0.50 * 100.0,
        "shunt_power_at_0p5a_mw": (0.50 ** 2) * 0.10 * 1000.0,
        "lsb_step_12bit_40mv_pga_uv": 10.0,
        "current_lsb_at_0p1ohm_ma": 0.10,
        "suitability": "RECOMMENDED ARCHITECTURAL ALTERNATIVE if S_L is <3 A: digital I2C output at 3.3 V eliminates ESP32 ADC non-linearity, 5V ratiometric drift, and single-ended ground drop.",
    },
}

# 4. Legacy Superseded Divider & Scaler Networks (Audit Findings I1 & I2)
legacy_voltage = {
    "r_top_ohm": 120000,
    "r_bottom_ohm": 22000,
    "ratio_fraction": "11/71",
    "ratio": 22.0 / (120.0 + 22.0),
    "node_at_18v_v": 18.0 * 22.0 / (120.0 + 22.0),
    "node_at_18v_1pct_worst_v": 18.0 * (22.0 * 1.01) / (120.0 * 0.99 + 22.0 * 1.01),
    "input_for_2p45v_nominal_v": 2.45 / (22.0 / (120.0 + 22.0)),
    "input_for_2p45v_worst_v": 2.45 / ((22.0 * 1.01) / (120.0 * 0.99 + 22.0 * 1.01)),
    "status": "SUPERSEDED / INCORRECT AT 18V (Exceeds 2.45 V ESP32 ADC1 11 dB ceiling above 15.55 V worst-corner).",
}
legacy_current = {
    "r_top_ohm": 15000,
    "r_bottom_ohm": 20000,
    "ratio_fraction": "4/7",
    "ratio": 20.0 / (15.0 + 20.0),
    "positive_30a_adc_node_v": (2.5 + 30.0 * 0.066) * 20.0 / (15.0 + 20.0),
    "positive_30a_1pct_worst_v": (2.5 + 30.0 * 0.066) * (20.0 * 1.01) / (15.0 * 0.99 + 20.0 * 1.01),
    "positive_current_at_2p45v_a": (2.45 / (20.0 / (15.0 + 20.0)) - 2.5) / 0.066,
    "status": "SUPERSEDED / INCORRECT AT +30A (Exceeds 2.45 V ESP32 ADC1 11 dB ceiling above +27.08 A nominal).",
}

# 5. Return-Wire Ground Drop Error Sensitivity (Single-Ended Divider Limitation)
ground_drop_examples = {
    "motor_current_a": 10.0,
    "return_wire_resistance_10mohm_drop_v": 10.0 * 0.010,
    "return_wire_resistance_50mohm_drop_v": 10.0 * 0.050,
    "return_wire_resistance_100mohm_drop_v": 10.0 * 0.100,
    "power_error_at_10a_and_100mohm_w": 10.0 * (10.0 * 0.100),
    "note": "If motor return current shares impedance with logic ground JGND, single-ended voltage dividers read V_load + I_return*R_return instead of true differential load voltage.",
}

# 6. Existing 96V Illustrative EV Simulator Spot-Check (Strictly Separate from 12V Circuit)
etadrive = 0.90 * 0.93
cd = 0.5 * 1.225 * 0.34 * 1.9
fd = cd * (22.0 ** 2)
fr = 0.012 * 720.0 * 9.81
froad = fd + fr
pwheel = froad * 22.0
psteady = pwheel / etadrive + 180.0
pfull = 18000.0 / etadrive + 180.0
whkm_steady = psteady / (22.0 * 3.6)
whkm_full = pfull / (22.0 * 3.6)
pack_wh = 96.0 * 150.0
ocv_lo = 96.0 + 13.0 * tanh(3.5 * (0.0 - 0.5))
ocv_50 = 96.0 + 13.0 * tanh(3.5 * (0.5 - 0.5))
ocv_hi = 96.0 + 13.0 * tanh(3.5 * (1.0 - 0.5))

btu_kwh = 0.00029307107
usgal_l = 3.785411784
lhv_kwh_l = [x * btu_kwh / usgal_l for x in (112114, 116090)]
epa_kg_l = 8.887 / usgal_l

# Synthetic arithmetic example only, not a tariff/load measurement.
light_wh = 12.0 * 0.5 * 2.0
motor_wh = 12.0 * 4.0 * 0.25
example_wh = light_wh + motor_wh
example_cost_inr = (example_wh / 1000.0) * 8.0

result = {
    "package_version": "FINAL_EV_EMS_ENGINEERING_PACKAGE (2026-11-02 Upgraded Audit & Correction Release)",
    "method": "Python binary floating-point formulas independently cross-checked by exact Fraction divider ratios, worst-case corner equations, and manufacturer datasheet bounds; no physical hardware measurements or simulations.",
    "assumptions": {
        "divider_resistors_ohm": {"current_motor": [27000, 20000], "voltage_each_branch": [68000, 10000]},
        "resistor_tolerance_fraction": 0.01,
        "capacitor_f": 100e-9,
        "assumed_maximum_dc_sense_voltage_v": 18.0,
        "classic_esp32_adc_characterized_range_11db_v": [0.15, 2.45],
        "classic_esp32_gpio_abs_max_powered_3v3_v": [-0.3, 3.6],
        "classic_esp32_gpio_abs_max_unpowered_0v_v": [-0.3, 0.3],
        "acs712_30a_supply_range_v": [4.5, 5.5],
        "acs712_30a_nominal_zero_v_at_vcc_5v": 2.5,
        "acs712_30a_sensitivity_range_v_per_a": [0.063, 0.066, 0.069],
        "lm2596_ic_input_max_v": 40.0,
        "ev_defaults": {
            "mass_kg": 720, "wheel_radius_m": 0.31, "max_motor_power_w": 18000,
            "max_speed_m_s": 22, "aux_w": 180, "Cd": 0.34, "frontal_area_m2": 1.9,
            "Crr": 0.012, "motor_efficiency": 0.90, "inverter_efficiency": 0.93,
            "regen_fraction": 0.28, "pack_v_nominal": 96, "pack_ah": 150, "R_internal_ohm": 0.035,
        },
        "cost_example": {
            "voltage_v": 12.0, "light_current_a": 0.5, "light_hours": 2.0,
            "motor_current_a": 4.0, "motor_hours": 0.25, "tariff_inr_per_kwh": 8.0,
        },
    },
    "voltage_divider_per_load": voltage,
    "current_divider": current,
    "light_branch_sensor_resolution_analysis": light_sensor_comparison,
    "legacy_120k_22k_voltage_divider": legacy_voltage,
    "legacy_15k_20k_current_divider": legacy_current,
    "single_ended_ground_drop_error_analysis": ground_drop_examples,
    "buck_example_input_a": 5.0 * 0.60 / (0.75 * 10.5) + 0.010,
    "nominal_energy_12v_7p6ah_wh": round(12.0 * 7.6, 1),
    "nominal_energy_96v_150ah_wh": pack_wh,
    "ev_ocv_curve_outputs_v": {"soc_0": ocv_lo, "soc_50": ocv_50, "soc_100": ocv_hi},
    "ev_road_load_at_22m_s": {
        "drag_coefficient_n_per_mps2": cd,
        "drag_n": fd,
        "rolling_n": fr,
        "road_load_n": froad,
        "wheel_power_w": pwheel,
        "combined_motor_inverter_efficiency": etadrive,
        "battery_power_steady_w": psteady,
        "steady_wh_per_km": whkm_steady,
        "full_throttle_model_mechanical_power_w": 18000.0,
        "full_throttle_model_force_at_22m_s_n": 18000.0 / 22.0,
        "full_throttle_model_battery_power_w": pfull,
        "full_throttle_model_wh_per_km": whkm_full,
        "nominal_pack_range_arithmetic_steady_km": pack_wh / whkm_steady,
        "nominal_pack_range_arithmetic_full_throttle_km": pack_wh / whkm_full,
        "half_nominal_energy_range_arithmetic_steady_km": pack_wh * 0.5 / whkm_steady,
        "half_nominal_energy_range_arithmetic_full_throttle_km": pack_wh * 0.5 / whkm_full,
        "regen_effective_fraction_before_caps": 0.90 * 0.93 * 0.28,
        "nominal_11kw_charger_current_at_96v_a": 11000.0 / 96.0,
        "dcdc_180w_input_at_88pct_w": 180.0 / 0.88,
    },
    "petrol_factors": {
        "EPA_CO2_kg_per_litre": epa_kg_l,
        "old_2p31_kg_per_l_at_7p2_l_100km_kg_per_100km": 7.2 * 2.31,
        "EPA_factor_at_7p2_l_100km_kg_per_100km": 7.2 * epa_kg_l,
        "DOE_gasoline_E10_LHV_kwh_per_litre_range": lhv_kwh_l,
    },
    "synthetic_cost_example": {
        "light_wh": light_wh,
        "motor_wh": motor_wh,
        "total_wh": example_wh,
        "total_kwh": example_wh / 1000.0,
        "cost_inr_at_assumed_tariff": example_cost_inr,
    },
}

out_path = Path(__file__).with_name("calculation_results.json")
out_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print("Calculation check succeeded. Wrote:", out_path)
