// Rigid, no-slip straight-line driveline. The displayed gear geometry is 8.2:1
// two-stage helical reduction: Stage 1 = 41/15, Stage 2 = 60/20 = 3.0.
// Changing the scenario ratio changes kinematics, not the authored gear teeth.
const STAGE1_RATIO = 41 / 15;

export function drivetrainKinematics({ distanceM, speedMps, tractiveForceN = 0, assumptions }) {
  const radius = assumptions.wheelRadiusM;
  const gearRatio = assumptions.gearRatio;
  const wheelAngle = distanceM / radius;
  const wheelAngularVelocityRadS = speedMps / radius;
  const motorAngularVelocityRadS = wheelAngularVelocityRadS * gearRatio;
  const intermediateAngularVelocityRadS = -motorAngularVelocityRadS / STAGE1_RATIO;
  const wheelRpm = wheelAngularVelocityRadS * 60 / (2 * Math.PI);
  const motorRpm = wheelRpm * gearRatio;
  const intermediateRpm = -motorRpm / STAGE1_RATIO;
  const wheelTorqueNm = tractiveForceN * radius;
  const motorShaftTorqueNm = gearRatio > 0 ? wheelTorqueNm / gearRatio : 0;
  return {
    wheelAngle,
    wheelAngularVelocityRadS,
    motorAngularVelocityRadS,
    intermediateAngularVelocityRadS,
    wheelRpm,
    motorRpm,
    intermediateRpm,
    wheelTorqueNm,
    motorShaftTorqueNm,
    differential: {
      mode: "straight-line-open-50-50",
      carrierAngularVelocityRadS: wheelAngularVelocityRadS,
      leftAxleAngularVelocityRadS: wheelAngularVelocityRadS,
      rightAxleAngularVelocityRadS: wheelAngularVelocityRadS,
      leftAxleTorqueNm: wheelTorqueNm * 0.5,
      rightAxleTorqueNm: wheelTorqueNm * 0.5,
    },
    rotations: {
      MotorRotor: wheelAngle * gearRatio,
      GearIntermediate: -wheelAngle * gearRatio / STAGE1_RATIO,
      Differential: wheelAngle,
      DriveShaft_L: wheelAngle,
      DriveShaft_R: wheelAngle,
    },
  };
}
