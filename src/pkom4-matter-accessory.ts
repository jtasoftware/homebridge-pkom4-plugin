/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
import { PichlerPlatform } from "./pichler-platform.js";
import { MatterAccessory, MatterAPI } from "homebridge";
import { ModbusSession, MODBUS_ADDR_MODE, MODBUS_ADDR_COOLING, MODBUS_ADDR_USER_SPEED_LEVEL, MODBUS_ADDR_AUTO_SPEED_LEVEL, MODBUS_ADDR_ACTUAL_SPEED_LEVEL, MODBUS_ADDR_HEATING } from "./modbus.js";
import { /*MODBUS_ADDR_ECO_TIME,*/ MODBUS_ADDR_COOL_ENABLED, MODBUS_ADDR_HUMID_ENABLED, MODBUS_ADDR_DIOXIDE_ENABLED, MODBUS_ADDR_NORMAL_THRESHOLD, MODBUS_ADDR_ECO_THRESHOLD } from "./modbus.js";
import { /*MODBUS_ADDR_HEAT_THRESHOLD,*/ MODBUS_ADDR_COOL_THRESHOLD, MODBUS_ADDR_MAX_HUMID_THRESHOLD, MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD, MODBUS_ADDR_MIN_BOILER_THRESHOLD } from "./modbus.js";
import { MODBUS_ADDR_AIR_DIOXIDE, MODBUS_ADDR_AIR_HUMID, MODBUS_ADDR_AIR_TEMP, /*MODBUS_ADDR_BOILER_ENABLED,*/ MODBUS_ADDR_BOILER_TEMP, MODBUS_ADDR_OUTDOOR_TEMP } from "./modbus.js";
import { MODBUS_ADDR_BOILER_HEATING, MODBUS_ADDR_FILTER_ELAPSED_TIME, MODBUS_ADDR_SERIAL_NUMBER, MODBUS_ADDR_FIRMWARE_VERSION, MODBUS_ADDR_HARDWARE_OPTIONS, MODBUS_ADDR_HARDWARE_SENSORS } from "./modbus.js";
import { MODBUS_ADDR_VCM_POWER, /*MODBUS_ADDR_WATER_RESIST_POWER,*/ MODBUS_ADDR_AIR_RESIST_POWER, MODBUS_ADDR_WATER_PUMP_POWER, MODBUS_ADDR_AIR_PUMP_POWER } from "./modbus.js";
import { /*MODBUS_ADDR_FAN_ENERGY, MODBUS_ADDR_HEAT_ENERGY, MODBUS_ADDR_COOL_ENERGY,*/ MODBUS_ADDR_GLOBAL_ENERGY, MODBUS_ADDR_BOILER_ENERGY } from "./modbus.js";

// const MANUAL_MODE_DURATION = 3600000;	// 60 min
const MODBUS_POLLING_PERIOD = 120000;	// 2 min
const ENERGY_POLLING_PERIOD = 60000;	// 1 min
const MODBUS_INTERACTIVE_UPDATE_PERIOD = 5000;	// 5s while using accessories
const FAN_SPEED_TOLERANCE = 2;

export const PKOM_MODEL_NAME_FULL = "PKOM4 Classic";
export const PKOM_MODEL_NAME_LIGHT = "PKOM4 Trend";

export const PKOM_FAN_NAME = "Fan";
export const PKOM_ENERGY_NAME = "Energy Sensor";
export const PKOM_AIR_QUALITY_NAME = "Air Quality Sensor";
export const PKOM_HUMIDITY_SENSOR_NAME = "Humidity Sensor";
export const PKOM_HEATER_NAME = "Water Heater";

export const PKOM_FAN_ID = "fan";
export const PKOM_ENERGY_ID = "energy";
export const PKOM_AIR_QUALITY_ID = "air-quality";
export const PKOM_HUMIDITY_SENSOR_ID = "humidity";
export const PKOM_HEATER_ID = "water-heater";

const PKOM_AIR_QUALITY_SCALE = [ 0.0, 1.0, 850.0, 1100.0, 1600.0, 2100.0, 2600.0 ];	// See ANSES 2012-SA-0093
const PKOM_FAN_ROTATION_SCALE = [ 25.0, 50.0, 75.0, 90.0 ];
const PKOM_FAN_ROTATION_LOW_SCALE = 0;
const PKOM_FAN_ROTATION_HIGH_SCALE = 2;

const PKOM_MODE_UNSUPPORTED = -1;
const PKOM_MODE_OFF = 0;
const PKOM_MODE_SUMMER = 1;
const PKOM_MODE_WINTER = 2;
const PKOM_MODE_AUTO = 3;
const PKOM_MODE_HOLIDAYS = 4;
const PKOM_MODE_BOILER = 5;
// const PKOM_SPEED_LEVEL_AUTO = 0;
const PKOM_SPEED_LEVEL_LOW = 1;
const PKOM_SPEED_LEVEL_NORMAL = 2;
const PKOM_SPEED_LEVEL_ACTIVE = 3;
const PKOM_SPEED_LEVEL_HIGH = 4;
const PKOM_COOLING_OFF = 0;
const PKOM_COOLING_ECO = 2;
const PKOM_PURIFIER_HYSTERESIS = 250.0;
const PKOM_DEHUMID_HYSTERESIS = 15.0;
const PKOM_HEAT_HYSTERESIS = 0.5;
const PKOM_MIN_BOILER_TEMP = 45;
const PKOM_MAX_BOILER_PUMP_TEMP = 55;
const PKOM_MAX_BOILER_RESISTANCE_TEMP = 65;
const PKOM_MIN_DEHUMID_HUMID = 60;
const PKOM_MAX_DEHUMID_HUMID = 80;
const PKOM_MIN_HUMID_HUMID = 30;
const PKOM_MIN_COOL_TEMP = 22.0;
const PKOM_MAX_COOL_TEMP = 28.0;
const PKOM_MIN_HEAT_TEMP = 18.0;
const PKOM_MAX_HEAT_TEMP = 25.0;
const PKOM_WATER_HEAT_STEP = 0.5;
const PKOM_WATER_COOL_STEP = 0.1;
const PKOM_WATER_HYSTERESIS = 2.0;
// const PKOM_HUMID_STEP = 1;
const PKOM_HUMID_LEVEL = PKOM_SPEED_LEVEL_LOW;
const PKOM_DEHUMID_LEVEL = PKOM_SPEED_LEVEL_ACTIVE;
const PKOM_PURIFIER_LEVEL = PKOM_SPEED_LEVEL_HIGH;
const PKOM_FILTER_DURATION_ALERT = 0.0;		// 0 hours - alert is displayed after the period elapsed
const PKOM_FILTER_MAX_DURATION = 2400.0; 	// 100 days (hours)

export class PKOM4MatterAccessory {

	private readonly matter: MatterAPI;
	private readonly session: ModbusSession;
	private readonly platform: PichlerPlatform;
	private readonly roomConditionerAccessory: MatterAccessory;

	private simulate = false;
	private dryRegion = false;
	private readOnly = false;
	private inited = false;
	private modbusPendingSave = false;
	private modbusDebugLevel = 0;
	private modbusSaveRefcon = 0;
	private modbusLoadTimestamp = 0.0;
	private simulatedSensors = 0;
	private simulatedOptions = 0;
	
	private pkomMode = 0;
	private pkomUserSpeedLevel = 0;
	private pkomActualSpeedLevel = 0;
	private pkomAutoSpeedLevel = 0;
	private pkomEcoTime = false;
	private pkomCurrentlyCooling = false;
	private pkomCurrentlyHeating = false;
	private pkomCurrentlyWaterHeating = false;
	private pkomHasWaterHeater = false;
	private pkomHasDioxideSensor = false;
	private pkomHasHumiditySensor = false;
	private pkomHasWaterResistance = true;
	private pkomHasAirResistance = true;
	private pkomPurifierWaterHeating = false;
	private pkomSerialNumber = "";
	private pkomFirwmareVersion = 0.0;
	private pkomFilterDuration = 0;
	private pkomCurrentPower = 0.0;
	private pkomCumulatedEnergy = 0.0;
	private pkomOutdoorTemperature = 0.0;

	private fanSwitchedOn = false;
	private fanCurrentSpeedLevel = 0;
	private fanPreviousSpeedLevel = 0;
	private fanRotationSpeed = 0;
	private fanRotationScale = PKOM_FAN_ROTATION_SCALE;
	private fanManualMode = false;

	private byPassOpened = false;
	
	private filterChangeAlert = false;
	private filterLifeLevel = 0.0;
	
	private purifierActive = false;
	private purifierAirQuality = 0;
	private purifierAirQualityScale = PKOM_AIR_QUALITY_SCALE;
	private purifierDioxideLevel = 0.0;
	private purifierDioxideThreshold = 0.0;
// 	private purifierCurrentState = 0;
// 	private purifierTargetState = 0;
	private purifierManualMode = false;
	private purifierPreviouslyActivated = false;

	private dehumidifierActive = false;
// 	private dehumidifierCurrentState = 0;
// 	private dehumidifierTargetState = 0;
	private dehumidifierCurrentHumidity = 0.0;
	private dehumidifierHumidityThreshold = PKOM_MIN_DEHUMID_HUMID;
	private dehumidifierManualMode = false;
	private dehumidifierPreviouslyActivated = false;

	private conditionerActive = false;
	private conditionerTargetState = 0;
	private conditionerCurrentTemperature = 0.0;
	private conditionerHeatingThreshold = PKOM_MIN_HEAT_TEMP;
	private conditionerCoolingThreshold = PKOM_MIN_COOL_TEMP;
	private conditionerPreviouslyActivated = false;

	private waterHeaterActive = false;
	private waterHeaterTargetState = 0;
	private waterHeaterCurrentTemperature = 0.0;
	private waterHeaterHeatingThreshold = PKOM_MIN_BOILER_TEMP;
	
	private holidaysEndDate: Date;
	private lastPeriodDate: Date;
	private lastPeriodEnergy = 0.0;
	private lastSimulatedPower = 0.0;

	constructor(platform: PichlerPlatform, accessory: MatterAccessory, session: ModbusSession) {
		this.matter = platform.api.matter!;
		this.session = session;
		this.simulate = platform.config.simulate;
		this.readOnly = platform.config.readOnly;
		this.modbusDebugLevel = platform.config.modbusDebugLevel;
		this.dryRegion = false;
		this.inited = false;
		this.holidaysEndDate = new Date();
		this.platform = platform;		
		this.roomConditionerAccessory = accessory;

		// Get simulator options
		const options = platform.config.simulatedOptions;
		this.simulatedSensors = (options >= 2 ? options : 0);
		this.simulatedOptions = (options >= 1 ? 3 : 0);
		
		this.platform.log.info("Platform config: " + (this.simulate && this.readOnly ? "simulate, read-only" : (this.simulate ? "simulate" : (this.readOnly ? "read-only" : "none"))));

		// Restore status from previous context
		this.lastPeriodEnergy = this.roomConditionerAccessory.context.lastPeriodEnergy;
		this.lastPeriodDate = this.roomConditionerAccessory.context.lastPeriodDate;
		this.lastSimulatedPower = this.roomConditionerAccessory.context.lastSimulatedPower;
		if (this.lastPeriodEnergy != 0) {
			this.platform.log.info("Restored periodic energy from context: %dkWh", (this.lastPeriodEnergy / 1000.0).toFixed(3));
		}
	}

	async connectAndSetup(): Promise<any> {
		const accessory = this;
		return new Promise((resolve) => {
			void (async () => {
				accessory.platform.log.info("");
				accessory.platform.log.info("Starting initial modbus connection…");
				
				// Get live options & informations
				await accessory.loadModbusStatus();
				accessory.platform.log.info("Initial modbus connection done");
				
				accessory.platform.log.info("");
				accessory.platform.log.info("Starting Matter accessory setup…");
				
				// Setup services asynchronously after modbus read
				await accessory.initAccessory();
				await accessory.initAccessoryParts();
		
				// Launch periodic update
				await accessory.startPollingModbusStatus();
				await accessory.startPollingEnergyMeasure();
				accessory.platform.log.info("Matter accessory setup done");
				
				resolve("");
			})();
		});
	}
	
	async initAccessory() {
	
		// Get options & informations
		const sensors = (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor ? "humidity & dioxide" : (this.pkomHasDioxideSensor ? "dioxide" : (this.pkomHasHumiditySensor ? "humidity" : "none")));
		const options = (this.pkomHasWaterResistance && this.pkomHasAirResistance ? "water resist. & duct battery" : (this.pkomHasWaterResistance ? "water resist." : (this.pkomHasAirResistance ? "duct bat" : "none")));
		this.platform.log.info("Available PKOM model: %s", (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT));
		this.platform.log.info("Available PKOM sensors: %s", sensors);
		this.platform.log.info("Available PKOM options: %s", options);
		
		// Complete accessory cluster map. At this stage accessory is not yet registered.
		this.roomConditionerAccessory.serialNumber = this.pkomSerialNumber;
		this.roomConditionerAccessory.firmwareRevision = this.pkomFirwmareVersion.toString();
		this.roomConditionerAccessory.model = (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT);

		// Configure conditionner clusters
		// Note: as Apple Home do not provide separated fan management (FanOnly mode), we declare a part instead of a cluster
		this.roomConditionerAccessory.clusters = {
			onOff: { onOff: this.conditionerActive },
			thermostat: {
				externalMeasuredIndoorTemperature: this.conditionerCurrentTemperature * 100.0,
				occupiedHeatingSetpoint: this.conditionerHeatingThreshold * 100.0,
				minHeatSetpointLimit: PKOM_MIN_HEAT_TEMP * 100.0,
				maxHeatSetpointLimit: PKOM_MAX_HEAT_TEMP * 100.0,
				occupiedCoolingSetpoint: this.conditionerCoolingThreshold * 100.0,
				minCoolSetpointLimit: PKOM_MIN_COOL_TEMP * 100.0,
				maxCoolSetpointLimit: PKOM_MAX_COOL_TEMP * 100.0,
				minSetpointDeadBand: PKOM_HEAT_HYSTERESIS * 4.0 * 10.0,
				controlSequenceOfOperation: 4,
				systemMode: this.conditionerTargetState,
				externallyMeasuredOccupancy: (this.pkomMode != PKOM_MODE_HOLIDAYS),
				outdoorTemperature: this.pkomOutdoorTemperature * 100.0,
			},
// 			fanControl: {
// 				fanMode: this.matter.types.FanControl.FanMode.Low,
// 				fanModeSequence: this.matter.types.FanControl.FanModeSequence.OffLowMedHigh,
// 				percentSetting: 50,
// 				percentCurrent: 90,
// 			},
		};
		
		// Configure conditionner handlers
		this.roomConditionerAccessory.handlers = {
			onOff: {
				on: async () => {
					this.willObserveModbusStatus();
					
					if (!this.conditionerActive) {
						this.conditionerActive = true;
						this.conditionerActivationChanged();
					}
					this.platform.log.info("Air conditioner set to " + (this.conditionerActive? "active" : "inactive"));
				},
				off: async () => {
					this.willObserveModbusStatus();
					
					if (this.conditionerActive) {
						this.conditionerActive = false;
						this.conditionerActivationChanged();
					}
					this.platform.log.info("Air conditioner set to " + (this.conditionerActive? "active" : "inactive"));
				},
			},
			thermostat: {
				occupiedHeatingSetpointChange: async ({ occupiedHeatingSetpoint }) => {
					this.willObserveModbusStatus();
						
					this.conditionerHeatingThreshold = occupiedHeatingSetpoint / 100.0;
					this.conditionerThresholdChanged();
					this.platform.log.info("Air conditioner heating threshold set to %f °C", this.conditionerHeatingThreshold);
				},
				occupiedCoolingSetpointChange: async ({ occupiedCoolingSetpoint }) => {
					this.willObserveModbusStatus();
						
					this.conditionerCoolingThreshold = occupiedCoolingSetpoint / 100.0;
					this.conditionerThresholdChanged();
					this.platform.log.info("Air conditioner cooling threshold set to %f °C", this.conditionerCoolingThreshold);
				},
				systemModeChange: async ({ systemMode }) => {
					// Batch change on/off and system mode
					this.willObserveModbusStatus();
					this.willChangeModbusStatus();
					
					const conditionerActive = (systemMode != this.matter.types.Thermostat.SystemMode.Off);
					if (conditionerActive != this.conditionerActive) {
						this.conditionerActive = conditionerActive;
						this.conditionerActivationChanged();
					}
					
					if (systemMode != null && systemMode != this.conditionerTargetState) {
						this.conditionerTargetState = systemMode;
						this.conditionerTargetStateChanged();
					}
					
					this.didChangeModbusStatus();
					
					const modeNames = ["off", "auto", "reserved", "cool", "heat", "emergency heating", "precooling", "fan only"];
					const modeName = modeNames[systemMode] || `Unknown (${systemMode})`;
					this.platform.log.info("Air conditioner mode set to " + modeName);
				},
			},
// 			fanControl: {
// 				fanModeChange: async ({ fanMode }) => {
// 					this.handleFanModeChange(fanMode);
// 				},
// 				percentSettingChange: async ({ percentSetting }) => {
// 					if (percentSetting) {
// 						this.handleFanPercentSettingChange(percentSetting);
// 					}
// 				},
// 			},
		};

		this.platform.log.info("Room conditioner initialized with Matter initial state '%s'", this.roomConditionerAccessory.clusters.thermostat);
	}
	
	async initAccessoryParts() {
		
		// Complete accessory parts. At this stage accessory is not yet registered.
		// Internal state is assumed to be up-to-date so that part are configured with real values
		if (!this.roomConditionerAccessory || this.roomConditionerAccessory.parts) return;
		
		const PKOM_FAN_PART_INDEX = 0;
		const PKOM_ENERGY_PART_INDEX = 1;
		const PKOM_AIR_QUALITY_PART_INDEX = 2;
		const PKOM_HUMIDITY_PART_INDEX = 3;
		const PKOM_HEATER_PART_INDEX = 4;

		// Define possible (optional) parts configurations
		const optionalParts: MatterAccessory["parts"] = [{
			id: PKOM_ENERGY_ID,
			displayName: PKOM_ENERGY_NAME,
			deviceType: this.matter.deviceTypes.ElectricalSensor,
			clusters: {
				electricalPowerMeasurement: {
					activePower: Math.round(this.pkomCurrentPower * 1000.0),
				},
				electricalEnergyMeasurement: {
					cumulativeEnergyImported: { energy: Math.round(this.pkomCumulatedEnergy * 1000.0) },
// 					periodicEnergyImported: { energy: 0.0 },
				},
			},
		}, {
			id: PKOM_FAN_ID,
			displayName: PKOM_FAN_NAME,
			deviceType: this.matter.deviceTypes.Fan,
			clusters: {
				onOff: { onOff: this.fanSwitchedOn },
				fanControl: {
					fanMode: this.matterFanMode(),
					fanModeSequence: this.matter.types.FanControl.FanModeSequence.OffLowHigh,
					percentSetting: this.fanRotationSpeed,
					percentCurrent: this.fanRotationSpeed,
				},
			},
			handlers: {
				onOff: {
					on: async () => {
						this.willObserveModbusStatus();
						
						if (!this.fanSwitchedOn) {
							this.fanSwitchedOn = true;
							this.fanActivationChanged();
						}
						this.platform.log.info("Mechanical ventilation state set to " + (this.fanSwitchedOn? "on" : "off"));
					},
					off: async () => {
						this.willObserveModbusStatus();
						
						if (this.fanSwitchedOn) {
							this.fanSwitchedOn = false;
							this.fanActivationChanged();
						}
						this.platform.log.info("Mechanical ventilation state set to " + (this.fanSwitchedOn? "on" : "off"));
					},
				},
				fanControl: {
					fanModeChange: async ({ fanMode }) => {
						this.willObserveModbusStatus();
						
						const fanSwitchedOn = (fanMode != this.matter.types.FanControl.FanMode.Off);
						if (this.fanSwitchedOn != fanSwitchedOn) {
							this.fanSwitchedOn = fanSwitchedOn;
							this.fanActivationChanged();					
						}
						this.platform.log.info("Mechanical ventilation mode set to " + (fanSwitchedOn? "on" : "off"));
					},
					percentSettingChange: async ({ percentSetting }) => {
						this.willObserveModbusStatus();
						
						if (percentSetting != null && this.fanRotationSpeed != percentSetting) {
							this.fanRotationSpeed = percentSetting;
				 			this.fanSpeedChanged();
						}
						this.platform.log.info("Mechanical ventilation rotation level set to %d (%f%%)", this.fanCurrentSpeedLevel + 1, this.fanRotationSpeed);
					},
				},
			},
		}, {
			id: PKOM_AIR_QUALITY_ID,
			displayName: PKOM_AIR_QUALITY_NAME,
			deviceType: this.matter.deviceTypes.AirQualitySensor,
			clusters: {
				airQuality: { airQuality: this.purifierAirQuality },
			},
		}, {
			id: PKOM_HUMIDITY_SENSOR_ID,
			displayName: PKOM_HUMIDITY_SENSOR_NAME,
			deviceType: this.matter.deviceTypes.HumiditySensor,
			clusters: {
				relativeHumidityMeasurement: {
					measuredValue: this.dehumidifierCurrentHumidity * 100.0,
					minMeasuredValue: 0,
					maxMeasuredValue: 10000,
				},
			},
		}, {
			id: PKOM_HEATER_ID,
			displayName: PKOM_HEATER_NAME,
// 			deviceType: this.matter.deviceTypes.WaterHeater,
			deviceType: this.matter.deviceTypes.Thermostat,
			clusters: {
				onOff: { onOff: this.waterHeaterActive },
				thermostat: {
					externalMeasuredIndoorTemperature: this.waterHeaterCurrentTemperature * 100.0,
					occupiedHeatingSetpoint: this.waterHeaterHeatingThreshold * 100.0,
					minHeatSetpointLimit: PKOM_MIN_BOILER_TEMP * 100.0,
					maxHeatSetpointLimit: (this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP) * 100.0,
					absMinHeatSetpointLimit: PKOM_MIN_BOILER_TEMP * 100.0,
					absMaxHeatSetpointLimit: (this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP) * 100.0,
					controlSequenceOfOperation: 2,
					systemMode: (this.waterHeaterActive ? this.matter.types.Thermostat.SystemMode.Heat : this.matter.types.Thermostat.SystemMode.Off),
				},
			},
			handlers: {
				onOff: {
					on: async () => {
						this.willObserveModbusStatus();
						
						if (!this.waterHeaterActive) {
							this.waterHeaterActive = true;
							this.waterHeaterActivationChanged();
						}
						this.platform.log.info("Water heater set to " + (this.waterHeaterActive? "active" : "inactive"));
					},
					off: async () => {
						this.willObserveModbusStatus();
						
						if (this.waterHeaterActive) {
							this.waterHeaterActive = false;
							this.waterHeaterActivationChanged();
						}
						this.platform.log.info("Water heater set to " + (this.waterHeaterActive? "active" : "inactive"));
					},
				},
				thermostat: {
					occupiedHeatingSetpointChange: async ({ occupiedHeatingSetpoint }) => {
						this.willObserveModbusStatus();
						
						this.waterHeaterHeatingThreshold = occupiedHeatingSetpoint / 100.0;
						this.waterHeaterThresholdStateChanged();
						this.platform.log.info("Water heater threshold set to %f °C", this.waterHeaterHeatingThreshold);
					},
					systemModeChange: async ({ systemMode }) => {
						this.willObserveModbusStatus();
						
						const waterHeaterActive = (systemMode != this.matter.types.Thermostat.SystemMode.Off);
						if (this.waterHeaterActive != waterHeaterActive) {
							this.waterHeaterActive = waterHeaterActive;
							this.waterHeaterActivationChanged();
							this.platform.log.info("Water heater set to " + (this.waterHeaterActive? "active" : "inactive"));
						}
					},
				},
			},
		}];
		
		this.platform.log.info("Mechanical ventilation initialized with Matter initial state '%s'", optionalParts[PKOM_ENERGY_PART_INDEX].clusters.fanControl);
		this.platform.log.info("Energy sensor initialized with initial state '%s'", optionalParts[PKOM_FAN_PART_INDEX].clusters.electricalPowerMeasurement);

		if (this.pkomHasDioxideSensor) {
			this.platform.log.info("Air quality sensor initialized with Matter initial state '%s'", optionalParts[PKOM_AIR_QUALITY_PART_INDEX].clusters.airQuality);
		}
		
		if (this.pkomHasHumiditySensor) {
			this.platform.log.info("Humidity sensor initialized with Matter initial state '%s'", optionalParts[PKOM_HUMIDITY_PART_INDEX].clusters.relativeHumidityMeasurement);
		}
		
		if (this.pkomHasWaterHeater) {
			this.platform.log.info("Water heater initialized with Matter initial state '%s'", optionalParts[PKOM_HEATER_PART_INDEX].clusters.thermostat);
		}

		// Attach available part configurations based on available features
		if (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor && this.pkomHasWaterHeater) {
			this.roomConditionerAccessory.parts = optionalParts;
		} else if (this.pkomHasDioxideSensor && this.pkomHasWaterHeater) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_AIR_QUALITY_PART_INDEX],
				optionalParts[PKOM_HEATER_PART_INDEX],
			];			
		} else if (this.pkomHasHumiditySensor && this.pkomHasWaterHeater) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_HUMIDITY_PART_INDEX],
				optionalParts[PKOM_HEATER_PART_INDEX],
			];
		} else if (this.pkomHasWaterHeater) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_HEATER_PART_INDEX],
			];			
		} else if (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_AIR_QUALITY_PART_INDEX],
				optionalParts[PKOM_HUMIDITY_PART_INDEX],
			];			
		} else if (this.pkomHasDioxideSensor) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_AIR_QUALITY_PART_INDEX],
			];			
		} else if (this.pkomHasHumiditySensor) {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
				optionalParts[PKOM_HUMIDITY_PART_INDEX],
			];			
		} else {
			this.roomConditionerAccessory.parts = [
				optionalParts[PKOM_FAN_PART_INDEX],
				optionalParts[PKOM_ENERGY_PART_INDEX],
			];
		}
		
		// Missing parts from HAP
// 		this.platform.log.info("Filter maintenance for '%s' initialized", this.roomConditionerAccessory.displayName);
// 		this.purifierService.getCharacteristic(hap.Characteristic.Active)
// 			this.purifierActive = value as boolean;
// 			this.purifierActivationChanged();
// 			this.platform.log.info("Air purifier set to " + (this.purifierActive? "active" : "inactive"));
// 		this.purifierService.getCharacteristic(hap.Attribute.TargetAirPurifierState)
// 			this.purifierTargetState = value as number;
// 			this.purifierTargetStateChanged();
// 			this.platform.log.info("Air purifier state set to " + this.purifierTargetState);
// 		this.dehumidifierService.getCharacteristic(hap.Attribute.Active)
// 			this.dehumidifierActive = value as boolean;
// 			this.dehumidifierActivationChanged();
// 			this.platform.log.info("Dehumidifier set to " + (this.dehumidifierActive? "active" : "inactive"));
// 		this.dehumidifierService.getCharacteristic(hap.Attribute.TargetHumidifierDehumidifierState)
// 			this.dehumidifierTargetState = value as number;
// 			this.dehumidifierTargetStateChanged();
// 			this.platform.log.info("Dehumidifier state set to " + this.dehumidifierTargetState);
// 		this.dehumidifierService.getCharacteristic(hap.Attribute.RelativeHumidityDehumidifierThreshold)
// 			this.dehumidifierHumidityThreshold = value as number;
// 			this.dehumidifierThresholdChanged();
// 			this.platform.log.info("Dehumidifier dehumidifying threshold set to %d%%", this.dehumidifierHumidityThreshold);
	}
	
	async updateAccessoryEnergyMeasurement() {
	
		if (this.roomConditionerAccessory.parts == null) return;

		// Energy measures are updated on a time-based pattern, independently from PKOM measures
		const uuid = this.roomConditionerAccessory.UUID;
		this.matter.updateAccessoryState(uuid, this.matter.clusterNames.ElectricalPowerMeasurement, { activePower: Math.round(this.pkomCurrentPower * 1000.0) }, PKOM_ENERGY_ID);
		this.platform.log.debug("Active power is %dW", (this.pkomCurrentPower).toFixed(1));
		
		this.matter.updateAccessoryState(uuid, this.matter.clusterNames.ElectricalEnergyMeasurement, { cumulativeEnergyImported: { energy: Math.round(this.pkomCumulatedEnergy * 1000.0) } }, PKOM_ENERGY_ID);
		this.platform.log.info("Cumulated energy is %dkWh", (this.pkomCumulatedEnergy / 1000.0).toFixed(3));

		const periodicEnergy = this.pkomCumulatedEnergy - this.lastPeriodEnergy;
		this.lastPeriodEnergy = this.pkomCumulatedEnergy;
		this.lastPeriodDate = new Date();
// 		this.matter.updateAccessoryState(uuid, this.matter.clusterNames.ElectricalEnergyMeasurement, { periodicEnergyImported: { energy: Math.round(periodicEnergy * 1000.0) } }, PKOM_ENERGY_ID);
		this.platform.log.info("Periodic energy is %dWh", (periodicEnergy).toFixed(3));
		
		// Persist periodic information in context 
		this.roomConditionerAccessory.context.lastPeriodDate = this.lastPeriodDate;
		this.roomConditionerAccessory.context.lastPeriodEnergy = this.lastPeriodEnergy;
		this.roomConditionerAccessory.context.lastSimulatedPower = this.lastSimulatedPower;
	}

	async updateAccessoryClustersState() {

		if (this.roomConditionerAccessory.parts == null) return;

		const uuid = this.roomConditionerAccessory.UUID;
		
		// This is a temporary fix because boiler can be identified only after few hours
		const model = (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT);
		if (this.roomConditionerAccessory.model != model) {
			this.roomConditionerAccessory.model = model;
		}

		if (this.roomConditionerAccessory.firmwareRevision != this.pkomFirwmareVersion.toString()) {
			this.roomConditionerAccessory.firmwareRevision = this.pkomFirwmareVersion.toString();
		}
		
		const onOffFan = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.OnOff, PKOM_FAN_ID);
		if (onOffFan?.onOff != this.fanSwitchedOn) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.OnOff, { onOff: this.fanSwitchedOn }, PKOM_FAN_ID);
			this.platform.log.debug("Mechanical ventilation is " + (this.fanSwitchedOn? "on" : "off"));
		}

		const fanControl = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.FanControl, PKOM_FAN_ID);
		if (fanControl?.percentCurrent != this.fanRotationSpeed) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.FanControl, { fanMode:this.matterFanMode(), percentCurrent: this.fanRotationSpeed, percentSetting: this.fanRotationSpeed }, PKOM_FAN_ID);
			this.platform.log.debug("Mechanical ventilation rotation speed is %f%% (level %d)", this.fanRotationSpeed, this.fanCurrentSpeedLevel + 1);
		}
		
		const onOffConditioner = this.roomConditionerAccessory.clusters?.onOff?.onOff;
		if (onOffConditioner != this.conditionerActive) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.OnOff, { onOff: this.conditionerActive });
			this.platform.log.debug("Air conditioner is " + (this.conditionerActive? "active" : "inactive"));
		}
		
		const conditionerIndoorTemp = this.roomConditionerAccessory.clusters?.thermostat?.externalMeasuredIndoorTemperature;
		const conditionerHeatSetpoint = this.roomConditionerAccessory.clusters?.thermostat?.occupiedHeatingSetpoint;
		const conditionerCoolSetpoint = this.roomConditionerAccessory.clusters?.thermostat?.occupiedCoolingSetpoint;
		const conditionerSystemMode = this.roomConditionerAccessory.clusters?.thermostat?.systemMode;
		const conditionerOccupancy = this.roomConditionerAccessory.clusters?.thermostat?.externallyMeasuredOccupancy;
		const conditionerOutdoorTemp = this.roomConditionerAccessory.clusters?.thermostat?.outdoorTemperature;
		const actualIndoorTemp = this.conditionerCurrentTemperature * 100.0;
		const actualHeatSetpoint = this.conditionerHeatingThreshold * 100.0;
		const actualCoolSetpoint = this.conditionerCoolingThreshold * 100.0;
		const actuallyOccupied = (this.pkomMode != PKOM_MODE_HOLIDAYS);
		const actualOutdoorTemp = this.pkomOutdoorTemperature * 100.0;

		if (conditionerIndoorTemp != actualIndoorTemp || conditionerHeatSetpoint != actualHeatSetpoint || conditionerCoolSetpoint != actualCoolSetpoint || conditionerSystemMode != this.conditionerTargetState || conditionerOccupancy != actuallyOccupied || conditionerOutdoorTemp != actualOutdoorTemp) {
			this.matter.updateAccessoryState(uuid, 'thermostat', {
				externalMeasuredIndoorTemperature: actualIndoorTemp,
				occupiedHeatingSetpoint: actualHeatSetpoint,
				occupiedCoolingSetpoint: actualCoolSetpoint,
				systemMode: this.conditionerTargetState,
				externallyMeasuredOccupancy: actuallyOccupied,
				outdoorTemperature: actualOutdoorTemp,
			});
			
			this.platform.log.debug("Air conditioner state is " + this.conditionerTargetState);
			this.platform.log.debug("Air conditioner temperature %f °C", this.conditionerCurrentTemperature.toFixed(1));
			this.platform.log.debug("Air conditioner heating threshold is %f °C", this.conditionerHeatingThreshold);
			this.platform.log.debug("Air conditioner cooling threshold is %f °C", this.conditionerCoolingThreshold);
			this.platform.log.debug("Air conditioner outdoor temperature %f °C", actualOutdoorTemp.toFixed(1));
			this.platform.log.debug("Air conditioner occupancy is " + (actuallyOccupied ? "'occupied'" : "'holidays'"));
		}
				
		const onOffHeater = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.OnOff, PKOM_HEATER_ID);
		if (onOffHeater != null && onOffHeater.onOff != this.waterHeaterActive) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.OnOff, { onOff: this.waterHeaterActive }, PKOM_HEATER_ID);
			this.platform.log.debug("Water heater is " + (this.waterHeaterActive? "active" : "inactive"));
		}

		const thermostat = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.Thermostat, PKOM_HEATER_ID);
		const actualHeaterTemp = this.waterHeaterCurrentTemperature * 100.0;
		const actualHeaterSetpoint = this.waterHeaterHeatingThreshold * 100.0;

		if (thermostat != null && (thermostat.externalMeasuredIndoorTemperature != actualHeaterTemp || thermostat.occupiedHeatingSetpoint != actualHeaterSetpoint || thermostat.systemMode != this.waterHeaterTargetState)) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.Thermostat, {
				externalMeasuredIndoorTemperature: actualHeaterTemp,
				occupiedHeatingSetpoint: actualHeaterSetpoint,
				maxHeatSetpointLimit: (this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP) * 100.0,
				absMaxHeatSetpointLimit: (this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP) * 100.0,
				systemMode: this.waterHeaterTargetState,
			}, PKOM_HEATER_ID);
		
			this.platform.log.debug("Water heater state is " + this.waterHeaterTargetState);
			this.platform.log.debug("Water heater temperature is %f °C", this.waterHeaterCurrentTemperature.toFixed(1));
			this.platform.log.debug("Water heater threshold is %f °C", this.waterHeaterHeatingThreshold);
		}

		const airQuality = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.AirQuality, PKOM_AIR_QUALITY_ID);
		if (airQuality != null && airQuality.airQuality != this.purifierAirQuality) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.AirQuality, { airQuality: this.purifierAirQuality }, PKOM_AIR_QUALITY_ID);
			this.platform.log.debug("Air quality sensor air quality is " + this.purifierAirQuality);
		}
		
		const relativeHumidity = await this.matter.getAccessoryState(uuid, this.matter.clusterNames.RelativeHumidityMeasurement, PKOM_HUMIDITY_SENSOR_ID);
		if (relativeHumidity != null && relativeHumidity.measuredValue != this.dehumidifierCurrentHumidity * 100.0) {
			this.matter.updateAccessoryState(uuid, this.matter.clusterNames.RelativeHumidityMeasurement, { measuredValue: this.dehumidifierCurrentHumidity * 100.0 }, PKOM_HUMIDITY_SENSOR_ID);
			this.platform.log.debug("Dehumidifier humidity is %d%%", this.dehumidifierCurrentHumidity.toFixed(1));
		}
		
		// Missing parts from HAP
// 		this.purifierService.updateCharacteristic(hap.Attribute.Active, this.purifierActive);
// 		this.purifierService.updateCharacteristic(hap.Attribute.CurrentAirPurifierState, this.purifierCurrentState);
// 		this.purifierService.updateCharacteristic(hap.Attribute.TargetAirPurifierState, this.purifierTargetState);
// 		this.dehumidifierService.updateCharacteristic(hap.Attribute.Active, this.dehumidifierActive);
// 		this.dehumidifierService.updateCharacteristic(hap.Attribute.CurrentHumidifierDehumidifierState, this.dehumidifierCurrentState);
// 		this.dehumidifierService.updateCharacteristic(hap.Attribute.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
// 		this.dehumidifierService.updateCharacteristic(hap.Attribute.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
// 		this.sensorService.updateCharacteristic(hap.Attribute.CarbonDioxideLevel, this.purifierDioxideLevel);
// 		this.platform.log.debug("Air quality sensor dioxide level is %d ppm", this.purifierDioxideLevel.toFixed(1));
// 		this.platform.log.debug("Air purifier is " + (this.purifierActive? "active" : "inactive"));
// 		this.platform.log.debug("Current air purifier state is " + this.purifierCurrentState);
// 		this.platform.log.debug("Target air purifier state is " + this.purifierTargetState);
// 		this.platform.log.debug("Dehumidifier is " + (this.dehumidifierActive? "active" : "inactive"));
// 		this.platform.log.debug("Target dehumidifier state is " + this.dehumidifierTargetState);
// 		this.platform.log.debug("Current dehumidifier purifier state is " + this.dehumidifierCurrentState);
// 		this.platform.log.debug("Dehumidifier dehumidifying threshold is %d%%", this.dehumidifierHumidityThreshold);
	}
	
	fanActivationChanged() {
		if (!this.fanSwitchedOn) {
			this.willChangeModbusStatus();
			this.fanManualMode = true;
		
// 			this.dehumidifierPreviouslyActivated = this.dehumidifierActive;
// 			if (this.dehumidifierActive) {
// 				this.dehumidifierActive = false;
// 				this.dehumidifierService.updateCharacteristic(hap.Attribute.Active, this.dehumidifierActive);
// 				this.dehumidifierActivationChanged();
// 				this.platform.log.info("Linked deactivation: dehumidifier stored to " + (this.dehumidifierPreviouslyActivated? "active" : "inactive"));
// 			}

			this.conditionerPreviouslyActivated = this.conditionerActive;
			if (this.conditionerActive) {
				this.conditionerActive = false;
				this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.OnOff, { onOff: this.conditionerActive });
				this.conditionerActivationChanged();
				this.platform.log.info("Linked deactivation: conditioner stored to " + (this.conditionerPreviouslyActivated? "active" : "inactive"));
			}

// 			this.purifierPreviouslyActivated = this.purifierActive;
// 			if (this.purifierActive) {
// 				this.purifierActive = false;
// 				this.purifierService.updateCharacteristic(hap.Attribute.Active, this.purifierActive);
// 				this.purifierActivationChanged();
// 				this.platform.log.info("Linked deactivation: purifier stored to " + (this.purifierPreviouslyActivated? "active" : "inactive"));
// 			}
			
			this.didChangeModbusStatus();
			
		} else if (this.fanManualMode) {
			this.willChangeModbusStatus();
			this.fanManualMode = false;
			
// 			if (this.dehumidifierActive != this.dehumidifierPreviouslyActivated) {
// 			this.dehumidifierActive = this.dehumidifierPreviouslyActivated;
// 			this.dehumidifierService.updateCharacteristic(hap.Attribute.Active, this.dehumidifierActive);
// 			this.dehumidifierActivationChanged();
// 			this.platform.log.info("Linked deactivation: dehumidifier restored to " + (this.dehumidifierActive? "active" : "inactive"));
// 			}

			if (this.conditionerActive != this.conditionerPreviouslyActivated) {
				this.conditionerActive = this.conditionerPreviouslyActivated;
				this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.OnOff, { onOff: this.conditionerActive });
				this.conditionerActivationChanged();
				this.platform.log.info("Linked deactivation: conditioner restored to " + (this.conditionerActive? "active" : "inactive"));
			}

// 			if (this.purifierActive != this.purifierPreviouslyActivated) {
// 			this.purifierActive = this.purifierPreviouslyActivated;
// 			this.purifierService.updateCharacteristic(hap.Attribute.Active, this.purifierActive);
// 			this.purifierActivationChanged();
// 			this.platform.log.info("Linked deactivation: purifier restored to " + (this.purifierService? "active" : "inactive"));
// 			}
			
			this.didChangeModbusStatus();
		}
	}

	fanSpeedLevelChanged() {
		this.willChangeModbusStatus();
		this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
		this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.FanControl, { fanMode: this.matterFanMode(), percentCurrent: this.fanRotationSpeed, percentSetting: this.fanRotationSpeed }, PKOM_FAN_ID);
		this.didChangeModbusStatus();
	}
	
	fanSpeedChanged() {
		// Private attribute, modbus status is only impacted if level changes
		let	changed = false;
		
		if (this.fanRotationSpeed > 0 && this.fanRotationSpeed < this.fanRotationScale[0]) {
			// Lowest values are upgraded to minimal level if not null
			this.fanCurrentSpeedLevel = 0;
			this.fanPreviousSpeedLevel = 0;
			changed = true;
		} else {
			// Will use closest level depending on tolerance threshold
			for (let index = 0; index < this.fanRotationScale.length; index++) {
				if ((this.fanRotationScale[index] - this.fanRotationSpeed) <= FAN_SPEED_TOLERANCE) {
					this.fanCurrentSpeedLevel = index;
					this.fanPreviousSpeedLevel = index;
					changed = true;
				}
			}
		}

		if (changed) {
			this.fanSpeedLevelChanged();
		}
	
		this.fanManualMode = true;
	}

	purifierActivationChanged() {
		this.willChangeModbusStatus();
		
		// Individual activation will stop any pending global deactivation
		if (this.purifierActive && !this.fanSwitchedOn) {
			this.fanSwitchedOn = true;
			this.fanManualMode = false;
			this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.OnOff, { onOff: this.fanSwitchedOn }, PKOM_FAN_ID);
			this.fanActivationChanged();
		}

		// Adjust purifier mode
		if (this.purifierActive) {
// 		this.purifierCurrentState = hap.Attribute.CurrentAirPurifierState.IDLE;
// 		this.purifierService.updateCharacteristic(hap.Attribute.CurrentAirPurifierState, this.purifierCurrentState);
		} else {
// 		this.purifierCurrentState = hap.Attribute.CurrentAirPurifierState.INACTIVE;
// 		this.purifierService.updateCharacteristic(hap.Attribute.CurrentAirPurifierState, this.purifierCurrentState);
		}
		
		this.purifierEnteredAutoMode();
		this.didChangeModbusStatus();
	}
	
	purifierDioxideChanged() {
		// Private attribute, no need to propagate to modbus
		this.purifierAirQuality = 0;
	
		for (let index = 0; index < this.purifierAirQualityScale.length; index++) {
			if (this.purifierDioxideLevel >= this.purifierAirQualityScale[index]) {
				this.purifierAirQuality = index;
			}
		}
		
		// Bug with HomeBridge 2.4.0: raises an error with values higher than 1
		this.purifierAirQuality = Math.min(this.purifierAirQuality, 1);
	}
	
	purifierTargetStateChanged() {
		this.willChangeModbusStatus();
		
// 		if (this.purifierTargetState == hap.Attribute.TargetAirPurifierState.MANUAL) {
// 			this.purifierCurrentState = hap.Attribute.CurrentAirPurifierState.PURIFYING_AIR;
// 			this.purifierService.updateCharacteristic(hap.Attribute.CurrentAirPurifierState, this.purifierCurrentState);
// 	
// 			setTimeout(()=>{ this.purifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
// 			this.platform.log.info("Air purifier started a timer");
// 				
// 			this.purifierEnteredManualMode();
// 		} else {
// 			this.purifierEnteredAutoMode();
// 		}
		
		this.didChangeModbusStatus();
	}
	
	purifierEnteredAutoMode() {
		if (this.purifierManualMode) {
			this.willChangeModbusStatus();
			this.purifierManualMode = false;
				
			this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
			this.platform.log.info("Ventilation speed back to default level");
			
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}

	purifierEnteredManualMode() {
		if (!this.purifierManualMode && !this.dehumidifierManualMode) {
			this.willChangeModbusStatus();
			
			this.purifierManualMode = true;
			this.fanPreviousSpeedLevel = this.fanCurrentSpeedLevel;
			this.fanCurrentSpeedLevel = PKOM_PURIFIER_LEVEL - 1;
			this.platform.log.info("Ventilation speed increased to level %d", PKOM_PURIFIER_LEVEL);
		
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}

	purifierManualModeEllapsed() {
		if (this.purifierManualMode) {
			this.willChangeModbusStatus();
			
			this.purifierManualMode = false;
// 			this.purifierTargetState = hap.Attribute.TargetAirPurifierState.AUTO;
// 			this.purifierService.updateCharacteristic(hap.Attribute.TargetAirPurifierState, this.purifierTargetState);
// 			this.platform.log.info("Air purifier timer elapsed, state is back to " + this.purifierTargetState);
	
			this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
			this.platform.log.info("Ventilation speed back to default level");
		
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}
	
	dehumidifierActivationChanged() {
		// Individual activation will stop any pending global deactivation
	 	this.willChangeModbusStatus();
	 	
		if (this.dehumidifierActive && !this.fanSwitchedOn) {
			this.fanSwitchedOn = true;
			this.fanManualMode = false;
			this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.OnOff, { onOff: this.fanSwitchedOn }, PKOM_FAN_ID);
			this.fanActivationChanged();
		}
	
		this.didChangeModbusStatus();
	}
	
	dehumidifierTargetStateChanged() {
		this.willChangeModbusStatus();
		
// 		if (this.dehumidifierTargetState == hap.Attribute.TargetHumidifierDehumidifierState.DEHUMIDIFIER) {
// 			setTimeout(()=>{ this.dehumidifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
// 			this.platform.log.info("Dehumidifier started a timer");
// 			
// 			this.dehumidifierEnteredManualMode();
// 		} else {
// 			this.dehumidifierEnteredAutoMode();
// 		}

		this.didChangeModbusStatus();
	}
	
	dehumidifierThresholdChanged() {
		this.willChangeModbusStatus();
		
		if (this.dehumidifierHumidityThreshold < PKOM_MIN_DEHUMID_HUMID) {
			this.dehumidifierHumidityThreshold = PKOM_MIN_DEHUMID_HUMID;
// 			this.dehumidifierService.updateCharacteristic(hap.Attribute.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
		} else if (this.dehumidifierHumidityThreshold > PKOM_MAX_DEHUMID_HUMID) {
			this.dehumidifierHumidityThreshold = PKOM_MAX_DEHUMID_HUMID;
// 			this.dehumidifierService.updateCharacteristic(hap.Attribute.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
		}
		
		this.didChangeModbusStatus();
	}

	dehumidifierEnteredAutoMode() {
		if (this.dehumidifierManualMode) {
			this.willChangeModbusStatus();
			this.dehumidifierManualMode = false;
			
			this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
			this.platform.log.info("Ventilation speed back to default level");
			
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}

	dehumidifierEnteredManualMode() {
		if (!this.dehumidifierManualMode && !this.purifierManualMode) {
			this.willChangeModbusStatus();
			
			this.dehumidifierManualMode = true;
			this.fanPreviousSpeedLevel = this.fanCurrentSpeedLevel;
			this.fanCurrentSpeedLevel = PKOM_DEHUMID_LEVEL - 1;
			this.platform.log.info("Ventilation speed increased to level %d", PKOM_DEHUMID_LEVEL);
		
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}

	dehumidifierManualModeEllapsed() {
		if (this.dehumidifierManualMode) {
			this.willChangeModbusStatus();
			
			this.dehumidifierManualMode = false;
// 			this.dehumidifierTargetState = hap.Attribute.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER;
// 			this.dehumidifierService.updateCharacteristic(hap.Attribute.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
// 			this.platform.log.info("Dehumidifier timer elapsed, state is back to " + this.dehumidifierTargetState);
		
			this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
			this.platform.log.info("Ventilation speed back to default level");
		
			this.fanSpeedLevelChanged();
			this.didChangeModbusStatus();
		}
	}
	
	conditionerActivationChanged() {		
		// Individual activation will stop any pending global deactivation
		this.willChangeModbusStatus();
		
		if (this.conditionerActive && !this.fanSwitchedOn) {
			this.fanSwitchedOn = true;
			this.fanManualMode = false;
			this.matter.updateAccessoryState(this.roomConditionerAccessory.UUID, this.matter.clusterNames.OnOff, { onOff: this.fanSwitchedOn }, PKOM_FAN_ID);
			this.fanActivationChanged();
		}
		
		this.didChangeModbusStatus();
	}
	
	conditionerTargetStateChanged() {
		this.willChangeModbusStatus();
		this.didChangeModbusStatus();
	}
	
	conditionerThresholdChanged() {
		this.willChangeModbusStatus();
		this.didChangeModbusStatus();
	}

	waterHeaterActivationChanged() {
		this.willChangeModbusStatus();
		this.didChangeModbusStatus();
	}
	
	waterHeaterTargetStateChanged() {
		this.willChangeModbusStatus();
		this.didChangeModbusStatus();
	}
	
	waterHeaterThresholdStateChanged() {
		this.willChangeModbusStatus();
		this.didChangeModbusStatus();
	}
		
	startPollingModbusStatus() {
		setInterval(() => {
			void (async () => {
				this.platform.log.info("");
				this.platform.log.info("Modbus recurrent checking ongoing…");
			
				// Load new register values
				await this.loadModbusStatus(this.simulate);		
				if (this.simulate) {
					this.iterateAirSimulation();
					
					// Persist updated attributes using session registers
					await this.saveModbusStatus(true);
				}
	
				// Update clusters & parts
				await this.updateAccessoryClustersState();
				this.platform.log.info("Modbus recurrent checking done");
			})();
		}, MODBUS_POLLING_PERIOD);
		this.platform.log.info("Modbus recurrent checking is on");
	}
	
	startPollingEnergyMeasure() {
		setTimeout(() => {
			setInterval(() => {
				void (async () => {
					this.platform.log.info("");
					this.platform.log.info("Periodic energy measure ongoing…");
				
					if (this.simulate) {
						this.iterateEnergySimulation();
					}
	
					// Update energy cluster
					await this.updateAccessoryEnergyMeasurement();
					this.platform.log.info("Periodic energy measure done");
				})();
			}, ENERGY_POLLING_PERIOD);
		}, ENERGY_POLLING_PERIOD / 2);
		this.platform.log.info("Periodic energy measure is on");
	}

	willObserveModbusStatus() {
		// No need for sync update, we're simply accelerating refresh rate
		// Update timestamp before async call to avoid massive parallel updates
		if ((Date.now() - this.modbusLoadTimestamp) > MODBUS_INTERACTIVE_UPDATE_PERIOD) {
			this.platform.log.info("");
			this.platform.log.info("Modbus interactive checking ongoing…");
			this.modbusLoadTimestamp = Date.now();
			this.loadModbusStatus();
		}
	}

	willChangeModbusStatus() {
		this.modbusSaveRefcon = this.modbusSaveRefcon + 1;
	}
	
	didChangeModbusStatus() {
		this.modbusSaveRefcon = this.modbusSaveRefcon - 1;
			
		if (this.modbusSaveRefcon == 0) {
			this.saveModbusStatus();
		}
	}
	
	async loadModbusStatus(keepSession = false) {
		if (this.modbusPendingSave) return;
		if (this.session.ongoing) return;
	
		let modbusIsBusy = false;
		
		// Fetch modbus registers (trigger an empty save cycle)	
		const startTime = Date.now();
		await this.session.begin()
			.catch(() => {
				modbusIsBusy = true;
				this.platform.log.info("Modbus session is busy operation will be ignored");
			});
			
		if (!keepSession) {
			await this.session.end()
				.catch(() => {
					modbusIsBusy = true;
					this.platform.log.info("Modbus session is busy operation will be ignored");
				});
		}
		
		this.platform.log.debug("End of async modbus %s", (keepSession ? "call" : "calls"));
	
		// Readwrite register are persisted by session under simulation mode
		this.pkomMode = this.session.readRegister(MODBUS_ADDR_MODE);
		this.pkomEcoTime = (this.session.readRegister(MODBUS_ADDR_COOL_ENABLED) == PKOM_COOLING_ECO);//this.session.readRegister(MODBUS_ADDR_ECO_TIME);
		this.pkomUserSpeedLevel = this.session.readRegister(MODBUS_ADDR_USER_SPEED_LEVEL);
		this.purifierDioxideThreshold = this.session.readRegister(MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD);
		this.dehumidifierHumidityThreshold = this.session.readRegister(MODBUS_ADDR_MAX_HUMID_THRESHOLD);
		this.conditionerCoolingThreshold = this.session.readRegister(MODBUS_ADDR_COOL_THRESHOLD);
		this.waterHeaterHeatingThreshold = this.session.readRegister(MODBUS_ADDR_MIN_BOILER_THRESHOLD);
		this.pkomSerialNumber = this.session.readRegister(MODBUS_ADDR_SERIAL_NUMBER);
		this.pkomFirwmareVersion = this.session.readRegister(MODBUS_ADDR_FIRMWARE_VERSION);
		
		const vcmPower = this.session.readRegister(MODBUS_ADDR_VCM_POWER);
		const heatPower = this.session.readRegister(MODBUS_ADDR_AIR_RESIST_POWER);
		const firstPumpPower = this.session.readRegister(MODBUS_ADDR_WATER_PUMP_POWER);
		const secondPumpPower = this.session.readRegister(MODBUS_ADDR_AIR_PUMP_POWER);
		this.pkomCurrentPower = vcmPower + heatPower + firstPumpPower + secondPumpPower;
		this.pkomOutdoorTemperature = this.session.readRegister(MODBUS_ADDR_OUTDOOR_TEMP);

		// Those dynamic registers are skipped under simulation mode
		if (!this.simulate && this.pkomEcoTime) {
			this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_ECO_THRESHOLD);
		} else {
			this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_NORMAL_THRESHOLD);
		}
		
		// Those readonly registers are skipped to ensure persistance under simulation mode
		if (!this.simulate || !this.inited) {
			this.pkomAutoSpeedLevel = this.session.readRegister(MODBUS_ADDR_AUTO_SPEED_LEVEL);
			this.pkomActualSpeedLevel = this.session.readRegister(MODBUS_ADDR_ACTUAL_SPEED_LEVEL);
			this.pkomCurrentlyWaterHeating = this.session.readRegister(MODBUS_ADDR_BOILER_HEATING);
			this.purifierDioxideLevel = this.session.readRegister(MODBUS_ADDR_AIR_DIOXIDE);
			this.dehumidifierCurrentHumidity = this.session.readRegister(MODBUS_ADDR_AIR_HUMID);
			this.conditionerCurrentTemperature = this.session.readRegister(MODBUS_ADDR_AIR_TEMP);
			this.waterHeaterCurrentTemperature = this.session.readRegister(MODBUS_ADDR_BOILER_TEMP);
			this.pkomFilterDuration = PKOM_FILTER_MAX_DURATION - this.session.readRegister(MODBUS_ADDR_FILTER_ELAPSED_TIME);			
			this.pkomCumulatedEnergy = Math.max(this.session.readRegister(MODBUS_ADDR_GLOBAL_ENERGY) * 1000.0, this.lastPeriodEnergy);
			
			if (this.conditionerCurrentTemperature < (this.conditionerHeatingThreshold + PKOM_HEAT_HYSTERESIS)) {
				this.pkomCurrentlyHeating = (this.session.readRegister(MODBUS_ADDR_HEATING) > 0);
				this.pkomCurrentlyCooling = false;
			} else if (this.conditionerCurrentTemperature >= (this.conditionerCoolingThreshold - PKOM_HEAT_HYSTERESIS)) {
				this.pkomCurrentlyCooling = (this.session.readRegister(MODBUS_ADDR_COOLING) > 0);
				this.pkomCurrentlyHeating = false;
			} else {
				this.pkomCurrentlyHeating = false;
				this.pkomCurrentlyCooling = false;
			}
		}
	
		const coolEnabled = (this.session.readRegister(MODBUS_ADDR_COOL_ENABLED) != PKOM_COOLING_OFF);
		const dehumidifierActive = this.session.readRegister(MODBUS_ADDR_HUMID_ENABLED);
		const purifierActive = this.session.readRegister(MODBUS_ADDR_DIOXIDE_ENABLED);
		const boilerEnergy = this.session.readRegister(MODBUS_ADDR_BOILER_ENERGY);
		const sensorType = (this.simulate ? this.simulatedSensors : this.session.readRegister(MODBUS_ADDR_HARDWARE_SENSORS));
		const options = (this.simulate ? this.simulatedOptions : this.session.readRegister(MODBUS_ADDR_HARDWARE_OPTIONS));
		
		// Following status are computed
		this.fanCurrentSpeedLevel = (this.pkomActualSpeedLevel - 1);
		this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
		this.filterChangeAlert = (this.pkomFilterDuration < PKOM_FILTER_DURATION_ALERT);
		this.filterLifeLevel = Math.round(this.pkomFilterDuration / PKOM_FILTER_MAX_DURATION * 100.0);
		
// 		let currentConditionerStatus = this.matter.types.Thermostat.SystemMode.FanOnly;
// 		if (this.pkomCurrentlyCooling) {
// 			currentConditionerStatus = this.matter.types.Thermostat.SystemMode.Cool;
// 		} else if (this.pkomCurrentlyHeating) {
// 			currentConditionerStatus = this.matter.types.Thermostat.SystemMode.Heat;
// 		}
		
		// Adjust current status based on internal manual mode
// 		let currentPurifierStatus = (this.purifierManualMode ? hap.Attribute.CurrentAirPurifierState.PURIFYING_AIR : hap.Attribute.CurrentAirPurifierState.IDLE);
// 		let currentHumidifierStatus = (this.dehumidifierManualMode ? hap.Attribute.CurrentHumidifierDehumidifierState.DEHUMIDIFYING : hap.Attribute.CurrentHumidifierDehumidifierState.IDLE);
// 		const currentWaterHeaterStatus = (this.pkomCurrentlyWaterHeating ? this.matter.types.Thermostat.SystemMode.Heat : this.matter.types.Thermostat.SystemMode.Off);
		
		// Adjust current status based on PKOM automatic behaviour
// 		if (!this.dehumidifierManualMode && this.fanCurrentSpeedLevel >= PKOM_DEHUMID_LEVEL && this.dehumidifierCurrentHumidity > this.dehumidifierHumidityThreshold) {
// 			currentHumidifierStatus = hap.Attribute.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
// 		} else if (!this.purifierManualMode && this.fanCurrentSpeedLevel >= PKOM_PURIFIER_LEVEL && this.purifierDioxideLevel > this.purifierDioxideThreshold) {
// 			currentPurifierStatus = hap.Attribute.CurrentAirPurifierState.PURIFYING_AIR;
// 		}

		switch (this.pkomMode) {
			case PKOM_MODE_OFF:
				this.fanSwitchedOn = false;
				this.conditionerActive = false;
				this.waterHeaterActive = false;
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.Off;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Off;
				break;
				
			case PKOM_MODE_SUMMER:
				this.fanSwitchedOn = true;
				this.conditionerActive = coolEnabled;
				this.waterHeaterActive = this.pkomHasWaterHeater;
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.Cool;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Heat;
				break;
				
			case PKOM_MODE_WINTER:
				this.fanSwitchedOn = true;
				this.conditionerActive = true;
				this.waterHeaterActive = this.pkomHasWaterHeater;
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.Heat;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Heat;
				break;
				
			case PKOM_MODE_AUTO:
				this.fanSwitchedOn = true;
				this.conditionerActive = true;
				this.waterHeaterActive = this.pkomHasWaterHeater;	// this.session.readRegister(MODBUS_ADDR_BOILER_ENABLED);
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.Auto;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Heat;
				break;
				
			case PKOM_MODE_HOLIDAYS:
				this.fanSwitchedOn = true;
				this.conditionerActive = false;
				this.waterHeaterActive = false;
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.FanOnly;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Off;
				break;
				
			case PKOM_MODE_BOILER:
				this.fanSwitchedOn = false;
				this.conditionerActive = false;
				this.waterHeaterActive = true;
				this.conditionerTargetState = this.matter.types.Thermostat.SystemMode.FanOnly;
				this.waterHeaterTargetState = this.matter.types.Thermostat.SystemMode.Heat;
				break;
				
			default:
				this.platform.log.info("Unknown device mode - behaviour might be erratic");
				break;
		}
		
		// Purifier & dehumidifier status depends on fan mode
		this.purifierActive = (this.fanSwitchedOn && purifierActive);
// 		this.purifierCurrentState = (this.purifierActive ? currentPurifierStatus : hap.Attribute.CurrentAirPurifierState.INACTIVE);
// 		this.purifierTargetState = (this.purifierManualMode ? hap.Attribute.TargetAirPurifierState.MANUAL : hap.Attribute.TargetAirPurifierState.AUTO);
		this.dehumidifierActive = (this.fanSwitchedOn && dehumidifierActive);
// 		this.dehumidifierCurrentState = (this.dehumidifierActive ? currentHumidifierStatus : hap.Attribute.CurrentHumidifierDehumidifierState.INACTIVE);
// 		this.dehumidifierTargetState = (this.dehumidifierManualMode ? hap.Attribute.TargetHumidifierDehumidifierState.DEHUMIDIFIER : hap.Attribute.TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER);
		
		// Fetch hardware infos
		switch (sensorType) {
			case 0:
				this.pkomHasDioxideSensor = false;
				this.pkomHasHumiditySensor = false;
				break;
			case 1:
				this.pkomHasDioxideSensor = true;
				this.pkomHasHumiditySensor = false;
				break;
			case 2:
				this.pkomHasDioxideSensor = false;
				this.pkomHasHumiditySensor = true;
				break;
			case 3:
				this.pkomHasDioxideSensor = true;
				this.pkomHasHumiditySensor = true;
				break;
		}
		
		switch (options) {
			case 0:
				this.pkomHasWaterResistance = false;
				this.pkomHasAirResistance = false;
				break;
			case 1:
				this.pkomHasWaterResistance = true;
				this.pkomHasAirResistance = false;
				break;
			case 2:
				this.pkomHasWaterResistance = false;
				this.pkomHasAirResistance = true;
				break;
			case 3:
				this.pkomHasWaterResistance = true;
				this.pkomHasAirResistance = true;
				break;
		}
		
		// To be tested: use pkomHasWaterResistance even without simulation
		this.pkomHasWaterHeater = (this.simulate ? this.pkomHasWaterResistance: boilerEnergy > 0);
		
		// Update air quality status
		this.purifierDioxideChanged();
		this.modbusLoadTimestamp = Date.now();
		this.inited = !modbusIsBusy;
		
		this.platform.log.info("Modbus status loaded (total duration %d ms)", Date.now() - startTime);
	}
	
	async saveModbusStatus(keepSession = false) {
		if (this.modbusPendingSave) return;

		// Load all registers
		const startTime = Date.now();
		this.modbusPendingSave = true;
		if (!keepSession) {
			await this.session.begin()
			.catch(() => {
				this.platform.log.info("Modbus session is busy operation will be ignored");
			});
			
			this.platform.log.debug("End of async modbus call");
		}
		
		// Save writeable registers
		//
		// High-level PKOM settings are set, in particular easily-changed comfort threshold.
		// No calendar options or hardware setup are involved.
		this.session.writeRegister(MODBUS_ADDR_COOL_THRESHOLD, this.conditionerCoolingThreshold);
		this.session.writeRegister(MODBUS_ADDR_MAX_HUMID_THRESHOLD, this.dehumidifierHumidityThreshold);
		this.session.writeRegister(MODBUS_ADDR_MIN_BOILER_THRESHOLD, this.waterHeaterHeatingThreshold);
		
		// Air heating temperature always reflects eco/normal period
		if (this.pkomEcoTime) {
			this.session.writeRegister(MODBUS_ADDR_ECO_THRESHOLD, this.conditionerHeatingThreshold);
		} else {
			this.session.writeRegister(MODBUS_ADDR_NORMAL_THRESHOLD, this.conditionerHeatingThreshold);
		}
		
		// PKOM 'Mode' is used to manage services activation. 'Unsupported Mode' is a transient situation when going through multiple steps
		//	(e.g turning off fan then water then conditioner to turn all off). In this case register writing is postponed to next valid configuration.
		// It means in particular that specific features such as anti-frozen, anti-legionel, bypass, etc are always active.
		const pkomUserSpeedLevel = (this.simulate || this.fanManualMode || this.purifierManualMode || this.dehumidifierManualMode) ? this.fanCurrentSpeedLevel + 1 : this.pkomUserSpeedLevel;//PKOM_SPEED_LEVEL_AUTO;	Auto mode is documented but refused by Modbus 
		let pkomMode = PKOM_MODE_UNSUPPORTED;

		if (!this.fanSwitchedOn && !this.waterHeaterActive && !this.conditionerActive) {
			pkomMode = PKOM_MODE_OFF;		// All is off
		} else if (!this.fanSwitchedOn && this.waterHeaterActive && !this.conditionerActive) {
			pkomMode = PKOM_MODE_BOILER;	// Water only
// 	} else if (this.fanSwitchedOn && !this.waterHeaterActive && this.conditionerActive) {
//			pkomMode = PKOM_MODE_AUTO;		// No Water, need to stop boiler pump as well - no documented way to do this (currently transient)
		} else if (this.fanSwitchedOn && !this.waterHeaterActive && !this.conditionerActive) {
			pkomMode = PKOM_MODE_HOLIDAYS;	// Fan only, need to specify duration
		} else if (this.fanSwitchedOn && this.waterHeaterActive && !this.conditionerActive) {
			pkomMode = PKOM_MODE_SUMMER;	// No conditioner, need to stop cooling as well
		} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.matter.types.Thermostat.SystemMode.Heat) {
			pkomMode = PKOM_MODE_WINTER;	// Forced heating
		} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.matter.types.Thermostat.SystemMode.Cool) {
			pkomMode = PKOM_MODE_SUMMER;	// Forced cooling
		} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.matter.types.Thermostat.SystemMode.Auto) {
			pkomMode = PKOM_MODE_AUTO;		// All is on with auto mode
		}
		
		// Changing fan speed is just an 'intention'. It might be ignored in case of higher priority task
		// 	(e.g heating) ; this is equivalent to changing the speed level from PKOM terminal main menu.
		// Changing mode is equivalent to changing the mode on the PKOM terminal main menu (see also above)
		// Changing humidity control is equivalent to enabling/disabling it from PKOM terminal main menu
		// Changing dioxyde control is equivalent to enabling/disabling it from PKOM terminal main menu
		// Changing cooling behaviour is equivalent to updating 'air' settings (will toggle between on or off - do not support eco)
		// Changing boiler behaviour is equivalent to updating 'water' settings (will toggle between on or off)
		this.session.writeRegister(MODBUS_ADDR_USER_SPEED_LEVEL, pkomUserSpeedLevel);
		this.session.writeRegister(MODBUS_ADDR_HUMID_ENABLED, this.dehumidifierActive);
		this.session.writeRegister(MODBUS_ADDR_DIOXIDE_ENABLED, this.purifierActive);
		
		if (pkomMode == PKOM_MODE_HOLIDAYS) {
			// Set a default 30 days holidays period (TBD: manage date with modbus interface)
			const shiftDate = new Date();
			const dayOfMonth = shiftDate.getDate();
			
			shiftDate.setMonth(shiftDate.getMonth() + 1);
			if (shiftDate.getDate() != dayOfMonth) {
				shiftDate.setDate(0);	// If day of month does't exist, move to last of previous month
			}
			
			this.holidaysEndDate = shiftDate;
		}
		
		if (pkomMode != PKOM_MODE_UNSUPPORTED) {
			this.session.writeRegister(MODBUS_ADDR_MODE, pkomMode);
//			this.session.writeRegister(MODBUS_ADDR_COOL_ENABLED, (this.conditionerActive || (pkomMode != PKOM_MODE_SUMMER)));	Caution: undocumented value '2' is used by PKOM ; disabled until clarification
//			this.session.writeRegister(MODBUS_ADDR_BOILER_ENABLED, (this.waterHeaterActive || (pkomMode != PKOM_MODE_AUTO)));	See above missing information about turning off boiler
		}
		
		if (this.simulate) {
			this.pkomActualSpeedLevel = pkomUserSpeedLevel;
		}
		
		// Send modified registers
		await this.session.end()
			.catch(() => {
				this.platform.log.info("Modbus session is busy, operation will be ignored");
			});
	
		this.modbusPendingSave = false;
		
		this.platform.log.debug("End of async modbus call");
		this.platform.log.info("Modbus status saved (total duration %d ms)", Date.now() - startTime);
	}
	
	iterateAirSimulation() {
		let dioxideIncrement = 0;
		let humidityIncrement = 0;
		const increaseRate = Math.max((PKOM_MIN_DEHUMID_HUMID - this.dehumidifierCurrentHumidity) / 100.0, 0.1) ** 2;
		const decreaseRate = Math.max((this.dehumidifierCurrentHumidity - PKOM_MIN_HUMID_HUMID) / 100.0, 0.1) ** 2;
		this.pkomUserSpeedLevel = this.fanCurrentSpeedLevel + 1;
			
		if (this.fanSwitchedOn) {
			switch (this.pkomUserSpeedLevel) {
				case PKOM_SPEED_LEVEL_LOW:
					dioxideIncrement = 5;
					humidityIncrement = 5.0 * increaseRate;
					break;
				case PKOM_SPEED_LEVEL_NORMAL:
					dioxideIncrement = 1;
					humidityIncrement = (this.dryRegion ? -1.0 * decreaseRate : 1.0 * increaseRate);
					break;
				case PKOM_SPEED_LEVEL_ACTIVE:
					dioxideIncrement = (this.purifierDioxideLevel > 1000 ? -150 : -15);
					humidityIncrement = -10.0 * decreaseRate;
					break;
				case PKOM_SPEED_LEVEL_HIGH:
					dioxideIncrement = (this.purifierDioxideLevel > 1000 ? -300 : -30);
					humidityIncrement = -20.0 * decreaseRate;
					break;
			}
		} else {
			dioxideIncrement = 10;
			humidityIncrement = 10 * increaseRate;
		}
			
		this.purifierDioxideLevel = Math.min(Math.max(this.purifierDioxideLevel + dioxideIncrement, 450), 4999);
		this.dehumidifierCurrentHumidity =	Math.min(Math.max(this.dehumidifierCurrentHumidity + humidityIncrement, 10), 89);
		this.platform.log.info("Simulation - air quality modulating (∆h:%d%%, ∆d:%dppm)", humidityIncrement.toFixed(2), dioxideIncrement);
	
		if (this.purifierActive && this.purifierDioxideLevel > this.purifierDioxideThreshold && this.pkomUserSpeedLevel < PKOM_PURIFIER_LEVEL) {
			this.pkomUserSpeedLevel = PKOM_PURIFIER_LEVEL;
			this.platform.log.info("Simulation - starting purifying speed increase");
		} else if (this.dehumidifierActive && this.dehumidifierCurrentHumidity > this.dehumidifierHumidityThreshold && this.pkomUserSpeedLevel < PKOM_DEHUMID_LEVEL) {
			this.pkomUserSpeedLevel = PKOM_DEHUMID_LEVEL;
			this.platform.log.info("Simulation - starting dehumidifying speed increase");
		} else if (this.dehumidifierActive && this.dehumidifierCurrentHumidity < PKOM_MIN_HUMID_HUMID && this.pkomUserSpeedLevel > PKOM_HUMID_LEVEL) {
			this.pkomUserSpeedLevel = PKOM_HUMID_LEVEL;
			this.platform.log.info("Simulation - starting humidifying speed decrease");
		} else if (this.pkomUserSpeedLevel == PKOM_PURIFIER_LEVEL && !this.fanManualMode && !this.dehumidifierManualMode && !this.purifierManualMode
				&& (!this.purifierActive || this.purifierDioxideLevel <= (this.purifierDioxideThreshold - PKOM_PURIFIER_HYSTERESIS))) {
			this.pkomUserSpeedLevel = PKOM_SPEED_LEVEL_NORMAL;
			this.platform.log.info("Simulation - back to normal speed");
		} else if (this.pkomUserSpeedLevel == PKOM_DEHUMID_LEVEL && !this.fanManualMode && !this.dehumidifierManualMode && !this.purifierManualMode
				&& (!this.dehumidifierActive || this.dehumidifierCurrentHumidity <= (this.dehumidifierHumidityThreshold - PKOM_DEHUMID_HYSTERESIS))
				&& (!this.dehumidifierActive || this.dehumidifierCurrentHumidity >= (PKOM_MIN_HUMID_HUMID + PKOM_DEHUMID_HYSTERESIS))) {
			this.pkomUserSpeedLevel = PKOM_SPEED_LEVEL_NORMAL;
			this.platform.log.info("Simulation - back to normal speed");
		} else {
			this.platform.log.debug("Simulation - humid:%d of %d%%, diox:%d of %d ppm, fan:%s, dehumid:%s, purif:%s", this.dehumidifierCurrentHumidity.toFixed(2), this.dehumidifierHumidityThreshold, this.purifierDioxideLevel, this.purifierDioxideThreshold, (this.fanManualMode ? "manual" : "auto"), (this.dehumidifierManualMode ? "manual" : "auto"), (this.purifierManualMode ? "manual" : "auto"));
		}

		this.pkomCurrentlyWaterHeating = this.pkomCurrentlyWaterHeating && (this.waterHeaterTargetState == this.matter.types.Thermostat.SystemMode.Heat);
		if (this.pkomCurrentlyWaterHeating) {
			this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature + PKOM_WATER_HEAT_STEP;
			if (this.waterHeaterCurrentTemperature >= Math.max(PKOM_MAX_BOILER_PUMP_TEMP, this.waterHeaterHeatingThreshold + PKOM_WATER_HYSTERESIS)) {
				this.pkomCurrentlyWaterHeating = false;
				this.platform.log.info("Simulation - stopping water heating");
			} else {
				this.platform.log.debug("Simulation - water:%d of %d °C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
			}
		} else {
			this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature - PKOM_WATER_COOL_STEP;
			if (this.waterHeaterCurrentTemperature <= (this.waterHeaterHeatingThreshold - PKOM_WATER_HYSTERESIS)) {
				this.pkomCurrentlyWaterHeating = true;
				this.platform.log.info("Simulation - starting water heating");
			} else {
				this.platform.log.debug("Simulation - water:%d of %d °C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
			}
		}
		
		if (!this.pkomCurrentlyHeating && this.conditionerCurrentTemperature < (this.conditionerHeatingThreshold - PKOM_HEAT_HYSTERESIS)) {
			this.pkomCurrentlyCooling = false;
			this.pkomCurrentlyHeating = true;
			this.platform.log.info("Simulation - starting air heating");
		} else if (!this.pkomCurrentlyCooling && this.conditionerCurrentTemperature > (this.conditionerCoolingThreshold + PKOM_HEAT_HYSTERESIS)) {
			this.pkomCurrentlyCooling = true;
			this.pkomCurrentlyHeating = false;
			this.platform.log.info("Simulation - starting air cooling");
		} else if (this.pkomCurrentlyHeating && this.conditionerCurrentTemperature <= (this.conditionerCoolingThreshold + PKOM_HEAT_HYSTERESIS) && this.conditionerCurrentTemperature >= (this.conditionerHeatingThreshold + PKOM_WATER_HYSTERESIS)) {
			this.pkomCurrentlyCooling = false;
			this.pkomCurrentlyHeating = false;
			this.platform.log.info("Simulation - stopping air heating");
		} else if (this.pkomCurrentlyCooling && this.conditionerCurrentTemperature <= (this.conditionerCoolingThreshold - PKOM_HEAT_HYSTERESIS) && this.conditionerCurrentTemperature >= (this.conditionerHeatingThreshold - PKOM_WATER_HYSTERESIS)) {
			this.pkomCurrentlyCooling = false;
			this.pkomCurrentlyHeating = false;
			this.platform.log.info("Simulation - stopping air cooling");
		}
			
		this.pkomActualSpeedLevel = this.pkomUserSpeedLevel;
		this.fanCurrentSpeedLevel = this.pkomUserSpeedLevel - 1;
		this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];		

		const timeIncrement = 1 / 3600000 * MODBUS_POLLING_PERIOD;
		this.pkomFilterDuration = Math.max(this.pkomFilterDuration - timeIncrement, 0);
		this.platform.log.debug("Simulation - remaining filter duration %d hours", this.pkomFilterDuration.toFixed(1));
	}
	
	iterateEnergySimulation() {
		
		// Adjust power to major energy consuming features
		let	powerBaseline = 0.0;
		if (this.conditionerActive && this.pkomCurrentlyHeating) {
			powerBaseline = 1200.0;
		} else if (this.waterHeaterActive && this.pkomCurrentlyWaterHeating) {
			powerBaseline = 600.0;
		} else if (this.conditionerActive && this.pkomCurrentlyCooling) {
			powerBaseline = 300.0;
		} else if (this.fanSwitchedOn) {
			powerBaseline = 60.0;
		}
		
		// Simulate instant power
		const powerDelta = (Math.random() - 0.5) * powerBaseline / 20.0;
		this.pkomCurrentPower = Math.max(powerBaseline + powerDelta, 0.0);
		this.platform.log.info("Simulation - power modulating (∆:%s%dW)", ((this.pkomCurrentPower - this.lastSimulatedPower) > 0.0 ? "+" : ""), (this.pkomCurrentPower - this.lastSimulatedPower).toFixed(3));

		// Compute energy consomption over past period
		const timeIncrement = 1 / 3600000 * ENERGY_POLLING_PERIOD;
		this.pkomCumulatedEnergy = this.pkomCumulatedEnergy + this.lastSimulatedPower * timeIncrement;
		this.lastSimulatedPower = this.pkomCurrentPower;
		this.platform.log.debug("Simulation - current power:%dW, cumulated energy:%dkWh", (this.pkomCurrentPower).toFixed(1), (this.pkomCumulatedEnergy / 1000.0).toFixed(3));
	}
	
	matterFanMode() {
		if (!this.fanSwitchedOn) {
			return this.matter.types.FanControl.FanMode.Off;
		} else if (this.fanManualMode && this.fanCurrentSpeedLevel == PKOM_FAN_ROTATION_LOW_SCALE) {
			return this.matter.types.FanControl.FanMode.Low;
		} else if (this.fanManualMode && this.fanCurrentSpeedLevel == PKOM_FAN_ROTATION_HIGH_SCALE) {
			return this.matter.types.FanControl.FanMode.High;
		} else {
			// Bug with HomeBridge 2.4.0: raises an error with Auto mode when using sequences
// 			return this.matter.types.FanControl.FanMode.Auto;
			return this.matter.types.FanControl.FanMode.High;
		}
	}
}
