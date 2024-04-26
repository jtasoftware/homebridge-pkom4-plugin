import { CharacteristicValue, CharacteristicEventTypes, CharacteristicGetCallback, CharacteristicSetCallback, HAP, Logging, Service, PlatformConfig, PlatformAccessory } from "homebridge";
import { MANUFACTURER_NAME, APP_MATCHING_ID, PLUGIN_VERSION } from "./settings";
import { ModbusSession, MODBUS_ADDR_MODE, MODBUS_ADDR_COOLING, MODBUS_ADDR_USER_SPEED_LEVEL, MODBUS_ADDR_AUTO_SPEED_LEVEL, MODBUS_ADDR_ACTUAL_SPEED_LEVEL, MODBUS_ADDR_HEATING } from "./modbus";
import { MODBUS_ADDR_ECO_TIME, MODBUS_ADDR_COOL_ENABLED, MODBUS_ADDR_HUMID_ENABLED, MODBUS_ADDR_DIOXIDE_ENABLED, MODBUS_ADDR_NORMAL_THRESHOLD, MODBUS_ADDR_ECO_THRESHOLD } from "./modbus";
import { MODBUS_ADDR_HEAT_THRESHOLD, MODBUS_ADDR_COOL_THRESHOLD, MODBUS_ADDR_MAX_HUMID_THRESHOLD, MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD, MODBUS_ADDR_MIN_BOILER_THRESHOLD } from "./modbus";
import { MODBUS_ADDR_AIR_DIOXIDE, MODBUS_ADDR_AIR_HUMID, MODBUS_ADDR_AIR_TEMP, MODBUS_ADDR_BOILER_ENABLED, MODBUS_ADDR_BOILER_TEMP, MODBUS_ADDR_BOILER_ENERGY } from "./modbus";
import { MODBUS_ADDR_BOILER_HEATING, MODBUS_ADDR_FILTER_ELAPSED_TIME, MODBUS_ADDR_SERIAL_NUMBER, MODBUS_ADDR_FIRMWARE_VERSION, MODBUS_ADDR_HARDWARE_OPTIONS, MODBUS_ADDR_HARDWARE_SENSORS } from "./modbus";
import { PichlerPlatform } from "./pichler-platform";

const MANUAL_MODE_DURATION = 600000;
const MODBUS_POLLING_PERIOD = 60000;
const MODBUS_INTERACTIVE_UPDATE_PERIOD = 5000;
const FAN_SPEED_TOLERANCE = 2;

export const PKOM_ACCESSORY_NAME = "PKOM 4";
export const PKOM_ACCESSORY_UUID = "2FE3C6CF-FA12-43C4-9E5B-9A0CED436307";

const PKOM_AIR_QUALITY_SCALE = [ 0.0, 0.0, 400.0, 1000.0, 1500.0, 2000.0 ];
const PKOM_AIR_ROTATION_SCALE = [ 25.0, 50.0, 75.0, 90.0 ];

const PKOM_MODEL_NAME_FULL = "PKOM4 Classic";
const PKOM_MODEL_NAME_LIGHT = "PKOM4 Trend";

const PKOM_FAN_NAME = "CMV";
const PKOM_FILTER_NAME = "Air Filter Maintenance";
const PKOM_AIR_QUALITY_NAME = "Air Quality Sensor";
const PKOM_AIR_CONDITIONER_NAME = "Air Conditioner";
const PKOM_PURIFIER_NAME = "Air Purifier";
const PKOM_DEHUMIDIFIER_NAME = "Dehumidifier";
const PKOM_BOILER_NAME = "Water Heater";

const PKOM_INFO_UUID = "000000FF-0000-2000-8000-000000000001";
const PKOM_FAN_UUID = "000000FF-0000-2000-8000-000000000002";
const PKOM_IN_FILTER_UUID = "000000FF-0000-2000-8000-000000000003";
const PKOM_OUT_FILTER_UUID = "000000FF-0000-2000-8000-000000000004";
const PKOM_AIR_QUALITY_UUID = "000000FF-0000-2000-8000-000000000005";
const PKOM_AIR_CONDITIONER_UUID = "000000FF-0000-2000-8000-000000000006";
const PKOM_PURIFIER_UUID = "000000FF-0000-2000-8000-000000000007";
const PKOM_DEHUMIDIFIER_UUID = "000000FF-0000-2000-8000-000000000008";
const PKOM_BOILER_UUID = "000000FF-0000-2000-8000-000000000009";

const PKOM_INFO_TYPE = "com.pichler.pkom.infos";
const PKOM_FAN_TYPE = "com.pichler.pkom.fan";
const PKOM_IN_FILTER_TYPE = "com.pichler.pkom.filter.in";
const PKOM_OUT_FILTER_TYPE = "com.pichler.pkom.filter.out";
const PKOM_AIR_QUALITY_TYPE = "com.pichler.pkom.air";
const PKOM_AIR_CONDITIONER_TYPE = "com.pichler.pkom.conditioner";
const PKOM_PURIFIER_TYPE = "com.pichler.pkom.purifier";
const PKOM_DEHUMIDIFIER_TYPE = "com.pichler.pkom.dehumidifier";
const PKOM_BOILER_TYPE = "com.pichler.pkom.boiler";

const PKOM_MODE_UNSUPPORTED = -1;
const PKOM_MODE_OFF = 0;
const PKOM_MODE_SUMMER = 1;
const PKOM_MODE_WINTER = 2;
const PKOM_MODE_AUTO = 3;
const PKOM_MODE_HOLIDAYS = 4;
const PKOM_MODE_BOILER = 5;
const PKOM_SPEED_LEVEL_AUTO = 0;
const PKOM_SPEED_LEVEL_LOW = 1;
const PKOM_SPEED_LEVEL_NORMAL = 2;
const PKOM_SPEED_LEVEL_ACTIVE = 3;
const PKOM_SPEED_LEVEL_HIGH = 4;
const PKOM_COOLING_OFF = 0;
const PKOM_COOLING_ON = 1;
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
const PKOM_TEMP_STEP = 0.5;
const PKOM_HUMID_STEP = 1;
const PKOM_HUMID_LEVEL = PKOM_SPEED_LEVEL_LOW;
const PKOM_DEHUMID_LEVEL = PKOM_SPEED_LEVEL_ACTIVE;
const PKOM_PURIFIER_LEVEL = PKOM_SPEED_LEVEL_HIGH;
const PKOM_FILTER_DURATION_ALERT = 360.0;	// 15 days (hours)
const PKOM_FILTER_MAX_DURATION = 2400.0; 	// 100 days (hours)

export class PKOM4Accessory {

  private readonly session: ModbusSession;
  private readonly platform: PichlerPlatform;
  private readonly accessory: PlatformAccessory;

  private simulate = false;
  private dryRegion = false;
  private readOnly = false;
  private inited = false;
  private modbusPendingSave = false;
  private modbusDebugLevel = 0;
  private modbusSaveRefcon = 0;
  private modbusLoadTimestamp = 0.0;
  
  private pkomMode = 0;
  private pkomUserSpeedLevel = 0;
  private pkomActualSpeedLevel = 0;
  private pkomAutoSpeedLevel = 0;
  private pkomEcoTime = false;
  private pkomCurrentlyCooling = false;
  private pkomCurrentlyHeating = false;
  private pkomCurrentlyWaterHeating = false;
  private pkomHasWaterHeater = true;
  private pkomHasDioxideSensor = true;
  private pkomHasHumiditySensor = true;
  private pkomHasWaterResistance = true;
  private pkomHasAirResistance = true;
  private pkomPurifierWaterHeating = false;
  private pkomSerialNumber = "";
  private pkomFirwmareVersion = "";
  private pkomFilterDuration = 0;

  private fanSwitchedOn = false;
  private fanCurrentSpeedLevel = 0;
  private fanPreviousSpeedLevel = 0;
  private fanRotationSpeed = 0;
  private fanRotationScale = PKOM_AIR_ROTATION_SCALE;
  private fanManualMode = false;
  
  private filterChangeAlert = false;
  private filterLifeLevel = 0.0;
  
  private purifierActive = false;
  private purifierAirQuality = 0;
  private purifierAirQualityScale = PKOM_AIR_QUALITY_SCALE;
  private purifierDioxideLevel = 0.0;
  private purifierDioxideThreshold = 0.0;
  private purifierCurrentState = 0;
  private purifierTargetState = 0;
  private purifierManualMode = false;
  private purifierPreviouslyActivated = false;

  private dehumidifierActive = false;
  private dehumidifierCurrentState = 0;
  private dehumidifierTargetState = 0;
  private dehumidifierCurrentHumidity = 0.0;
  private dehumidifierHumidityThreshold = PKOM_MIN_DEHUMID_HUMID;
  private dehumidifierManualMode = false;
  private dehumidifierPreviouslyActivated = false;

  private conditionerActive = false;
  private conditionerCurrentState = 0;
  private conditionerTargetState = 0;
  private conditionerCurrentTemperature = 0.0;
  private conditionerHeatingThreshold = PKOM_MIN_HEAT_TEMP;
  private conditionerCoolingThreshold = PKOM_MIN_COOL_TEMP;
  private conditionerPreviouslyActivated = false;

  private waterHeaterActive = false;
  private waterHeaterCurrentState = 0;
  private waterHeaterTargetState = 1;
  private waterHeaterCurrentTemperature = 0.0;
  private waterHeaterHeatingThreshold = PKOM_MIN_BOILER_TEMP;

  private informationService: Service;
  private fanService: Service;
  private filterService: Service;
  private sensorService: Service;
  private purifierService: Service;
  private dehumidifierService: Service;
  private conditionerService: Service;
  private heaterService: Service;

  constructor(platform: PichlerPlatform, accessory: PlatformAccessory) {
	this.accessory = accessory;
	this.simulate = platform.config["simulate"];
	this.readOnly = platform.config["readOnly"];
	this.modbusDebugLevel = platform.config["modbusDebugLevel"]
	this.dryRegion = false;
	this.inited = false;
	
	this.platform = platform;
	this.platform.log.info("Platform config: " + (this.simulate && this.readOnly ? "simulate, read-only" : (this.simulate ? "simulate" : (this.readOnly ? "read-only" : "none"))));
	
	this.informationService = this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation) || this.accessory.addService(this.platform.api.hap.Service.AccessoryInformation, this.accessory.displayName, PKOM_INFO_TYPE);
    this.informationService.setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, MANUFACTURER_NAME)
      .setCharacteristic(this.platform.api.hap.Characteristic.Model, "PKOM4")
      .setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, "--------")
      .setCharacteristic(this.platform.api.hap.Characteristic.AppMatchingIdentifier, APP_MATCHING_ID)
      .setCharacteristic(this.platform.api.hap.Characteristic.SoftwareRevision, PLUGIN_VERSION);
    this.platform.log.info("Hardware informations for '%s' created", this.accessory.displayName);
  	
    this.fanService = this.accessory.getService(this.platform.api.hap.Service.Fan) || this.accessory.addService(this.platform.api.hap.Service.Fan, PKOM_FAN_NAME, PKOM_FAN_TYPE);
    this.fanService.setPrimaryService(true);
    this.platform.log.info("Mechanical ventilation for '%s' created", this.accessory.displayName);

    this.filterService = this.accessory.getService(this.platform.api.hap.Service.FilterMaintenance) || this.accessory.addService(this.platform.api.hap.Service.FilterMaintenance, PKOM_FILTER_NAME, PKOM_IN_FILTER_TYPE);
    this.platform.log.info("Filter maintenance for '%s' created", this.accessory.displayName);

    this.sensorService = this.accessory.getService(this.platform.api.hap.Service.AirQualitySensor) || this.accessory.addService(this.platform.api.hap.Service.AirQualitySensor, PKOM_AIR_QUALITY_NAME, PKOM_AIR_QUALITY_TYPE);
	this.platform.log.info("Air quality sensor for '%s' created", this.accessory.displayName);

    this.purifierService = this.accessory.getService(this.platform.api.hap.Service.AirPurifier) || this.accessory.addService(this.platform.api.hap.Service.AirPurifier, PKOM_PURIFIER_NAME, PKOM_PURIFIER_TYPE);
	this.purifierService.addLinkedService(this.sensorService);
	this.purifierService.addLinkedService(this.filterService);
	this.platform.log.info("Air purifier for '%s' created", this.accessory.displayName);

    this.dehumidifierService = this.accessory.getService(this.platform.api.hap.Service.HumidifierDehumidifier) || this.accessory.addService(this.platform.api.hap.Service.HumidifierDehumidifier, PKOM_DEHUMIDIFIER_NAME, PKOM_DEHUMIDIFIER_TYPE);
    this.dehumidifierService.addLinkedService(this.fanService);
	this.platform.log.info("Dehumidifier for '%s' created", this.accessory.displayName);
    
    this.conditionerService = this.accessory.getService(PKOM_AIR_CONDITIONER_NAME) || this.accessory.addService(this.platform.api.hap.Service.HeaterCooler, PKOM_AIR_CONDITIONER_NAME, PKOM_AIR_CONDITIONER_TYPE);
    this.conditionerService.addLinkedService(this.fanService);
    this.platform.log.info("Air conditioner for '%s' created", this.accessory.displayName);

    this.heaterService = this.accessory.getService(PKOM_BOILER_NAME) || this.accessory.addService(this.platform.api.hap.Service.HeaterCooler, PKOM_BOILER_NAME, PKOM_BOILER_TYPE);
	this.platform.log.info("Water heater for '%s' created", this.accessory.displayName);
	
 	// Setup services asynchronously after modbus read
  	this.session = new ModbusSession(this.platform.log, this.readOnly, this.simulate, this.modbusDebugLevel);
  	this.session.install("");
	this.initAccessories();
  }

  async initAccessories() {	
	this.platform.log.info("Initial Modbus status loading…");

	await this.loadModbusStatus();
    
	let sensors = (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor ? "humidity & dioxide" : (this.pkomHasDioxideSensor ? "dioxide" : (this.pkomHasHumiditySensor ? "humidity" : "none")));
	let options = (this.pkomHasWaterResistance && this.pkomHasAirResistance ? "water resist. & duct battery" : (this.pkomHasWaterResistance ? "water resist." : (this.pkomHasAirResistance ? "duct bat" : "none")));
	this.platform.log.info("Available PKOM model: %s", (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT));
	this.platform.log.info("Available PKOM sensors: %s", sensors);
	this.platform.log.info("Available PKOM options: %s", options);
	this.platform.log.info("Initial Modbus status load done");
	
	this.platform.log.info("Accessories characteristics initializing…");
	this.willChangeModbusStatus();
	
	this.informationService.updateCharacteristic(this.platform.api.hap.Characteristic.Model, (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT))
		.updateCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, this.pkomSerialNumber)
		.updateCharacteristic(this.platform.api.hap.Characteristic.FirmwareRevision, this.pkomFirwmareVersion);
	this.informationService.getCharacteristic(this.platform.api.hap.Characteristic.Identify)
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.platform.log.info("Identifying device #" + this.pkomSerialNumber);
		callback();
	  });

	this.fanService.getCharacteristic(this.platform.api.hap.Characteristic.On)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Mechanical ventilation is " + (this.fanSwitchedOn? "on" : "off"));
		callback(undefined, this.fanSwitchedOn);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		let fanSwitchedOn = value as boolean
		if (this.fanSwitchedOn != fanSwitchedOn) {
			this.fanSwitchedOn = fanSwitchedOn;
			this.fanActivationChanged();
	
			this.platform.log.info("Mechanical ventilation state set to " + (fanSwitchedOn? "on" : "off"));
		}
		callback();
	  });
	this.fanService.getCharacteristic(this.platform.api.hap.Characteristic.RotationSpeed)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Mechanical ventilation rotation speed is %f%% (level %d)", this.fanRotationSpeed, this.fanCurrentSpeedLevel + 1);
		callback(undefined, this.fanRotationSpeed);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.fanRotationSpeed = value as number;
		this.fanSpeedChanged();
	
		this.platform.log.info("Mechanical ventilation rotation level set to %d (%f%%)", this.fanCurrentSpeedLevel + 1, this.fanRotationSpeed);
		callback();
	  });

	this.filterService.getCharacteristic(this.platform.api.hap.Characteristic.FilterChangeIndication)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Filter change alert is " + (this.filterChangeAlert? "on" : "off"));
		callback(undefined, (this.filterChangeAlert? this.platform.api.hap.Characteristic.FilterChangeIndication.CHANGE_FILTER : this.platform.api.hap.Characteristic.FilterChangeIndication.FILTER_OK));
	  });
	this.filterService.getCharacteristic(this.platform.api.hap.Characteristic.FilterLifeLevel)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Filter life level is %d%%", this.filterLifeLevel);
		callback(undefined, this.filterLifeLevel);
	  });
	this.filterService.getCharacteristic(this.platform.api.hap.Characteristic.ResetFilterIndication)
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.platform.log.info("Filter alert reseted");
		callback();
	  });

	this.sensorService.getCharacteristic(this.platform.api.hap.Characteristic.AirQuality)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air quality sensor air quality is " + this.purifierAirQuality);
		callback(undefined, this.purifierAirQuality);
	  });
	this.sensorService.getCharacteristic(this.platform.api.hap.Characteristic.CarbonDioxideLevel)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air quality sensor dioxide level is %d ppm", this.purifierDioxideLevel.toFixed(1));
		callback(undefined, this.purifierDioxideLevel);
	  });

	this.purifierService.getCharacteristic(this.platform.api.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air purifier is " + (this.purifierActive? "active" : "inactive"));
		callback(undefined, this.purifierActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.purifierActive = value as boolean;
		this.purifierActivationChanged();

		this.platform.log.info("Air purifier set to " + (this.purifierActive? "active" : "inactive"));
		callback();
	  });
	this.purifierService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentAirPurifierState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Current air purifier state is " + this.purifierCurrentState);
		callback(undefined, this.purifierCurrentState);
	  });
	this.purifierService.getCharacteristic(this.platform.api.hap.Characteristic.TargetAirPurifierState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Target air purifier state is " + this.purifierTargetState);
		callback(undefined, this.purifierTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.purifierTargetState = value as number;
		this.purifierTargetStateChanged();

		this.platform.log.info("Air purifier state set to " + this.purifierTargetState);
		callback();
	  });

	this.dehumidifierService.getCharacteristic(this.platform.api.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {  		
		this.willObserveModbusStatus();
		this.platform.log.debug("Dehumidifier is " + (this.dehumidifierActive? "active" : "inactive"));
		callback(undefined, this.dehumidifierActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierActive = value as boolean;
		this.dehumidifierActivationChanged();

		this.platform.log.info("Dehumidifier set to " + (this.dehumidifierActive? "active" : "inactive"));
		callback();
	  });
	this.dehumidifierService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState)
	  .updateValue(this.dehumidifierCurrentState)
	  .setProps({ validValues: [0, 1, 3] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Current dehumidifier purifier state is " + this.dehumidifierCurrentState);
		callback(undefined, this.dehumidifierCurrentState);
	  });
	this.dehumidifierService.getCharacteristic(this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState)
	  .updateValue(this.dehumidifierTargetState)
	  .setProps({ validValues: [0, 2] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Target dehumidifier state is " + this.dehumidifierTargetState);
		callback(undefined, this.dehumidifierTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierTargetState = value as number;
		this.dehumidifierTargetStateChanged();

		this.platform.log.info("Dehumidifier state set to " + this.dehumidifierTargetState);
		callback();
	  });
	this.dehumidifierService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentRelativeHumidity)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Dehumidifier humidity is %d%%", this.dehumidifierCurrentHumidity.toFixed(1));
		callback(undefined, this.dehumidifierCurrentHumidity);
	  });
	this.dehumidifierService.getCharacteristic(this.platform.api.hap.Characteristic.RelativeHumidityDehumidifierThreshold)
	  .updateValue(this.dehumidifierHumidityThreshold)
      .setProps({ minValue: 0, maxValue: 100, minStep: PKOM_HUMID_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Dehumidifier dehumidifying threshold is %d%%", this.dehumidifierHumidityThreshold);
		callback(undefined, this.dehumidifierHumidityThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierHumidityThreshold = value as number;
		this.dehumidifierThresholdChanged();
	
		this.platform.log.info("Dehumidifier dehumidifying threshold set to %d%%", this.dehumidifierHumidityThreshold);
		callback();
	  });

	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {  		
		this.willObserveModbusStatus();
		this.platform.log.debug("Air conditioner is " + (this.conditionerActive? "active" : "inactive"));
		callback(undefined, this.conditionerActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerActive = value as boolean;
		this.conditionerActivationChanged();

		this.platform.log.info("Air conditioner set to " + (this.conditionerActive? "active" : "inactive"));
		callback();
	  });
	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentHeaterCoolerState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Current air conditioner state is " + this.conditionerCurrentState);
		callback(undefined, this.conditionerCurrentState);
	  });
	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.TargetHeaterCoolerState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Target air conditioner state is " + this.conditionerTargetState);
		callback(undefined, this.conditionerTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerTargetState = value as number;
		this.conditionerTargetStateChanged();
	
		this.platform.log.info("Air conditioner state set to " + this.conditionerTargetState);
		callback();
	  });
	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air conditioner temperature %f °C", this.conditionerCurrentTemperature.toFixed(1));
		callback(undefined, this.conditionerCurrentTemperature);
	  });
	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.HeatingThresholdTemperature)
	  .updateValue(this.conditionerHeatingThreshold)
	  .setProps({ minValue: PKOM_MIN_HEAT_TEMP, maxValue: PKOM_MAX_HEAT_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air conditioner heating threshold is %f °C", this.conditionerHeatingThreshold);
		callback(undefined, this.conditionerHeatingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerHeatingThreshold = value as number;
		this.conditionerThresholdChanged();
	
		this.platform.log.info("Air conditioner heating threshold set to %f °C", this.conditionerHeatingThreshold);
		callback();
	  });
	this.conditionerService.getCharacteristic(this.platform.api.hap.Characteristic.CoolingThresholdTemperature)
	  .updateValue(this.conditionerCoolingThreshold)
	  .setProps({ minValue: PKOM_MIN_COOL_TEMP, maxValue: PKOM_MAX_COOL_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Air conditioner cooling threshold is %f °C", this.conditionerCoolingThreshold);
		callback(undefined, this.conditionerCoolingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerCoolingThreshold = value as number;
		this.conditionerThresholdChanged();
	
		this.platform.log.info("Air conditioner cooling threshold set to %f °C", this.conditionerCoolingThreshold);
		callback();
	  });

	this.heaterService.getCharacteristic(this.platform.api.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.platform.log.debug("Water heater is " + (this.waterHeaterActive? "active" : "inactive"));
		callback(undefined, this.waterHeaterActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterActive = value as boolean;
  		this.waterHeaterActivationChanged();
  		
		this.platform.log.info("Water heater set to " + (this.waterHeaterActive? "active" : "inactive"));
		callback();
	  });
	this.heaterService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentHeaterCoolerState)
	  .updateValue(this.waterHeaterCurrentState)
	  .setProps({ validValues: [0, 1, 2] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.platform.log.debug("Current water heater state is " + this.waterHeaterCurrentState);
		callback(undefined, this.waterHeaterCurrentState);
	  });
	this.heaterService.getCharacteristic(this.platform.api.hap.Characteristic.TargetHeaterCoolerState)
	  .updateValue(this.waterHeaterTargetState)
	  .setProps({ validValues: [1] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.platform.log.debug("Target water heater state is " + this.waterHeaterTargetState);
		callback(undefined, this.waterHeaterTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterTargetState = value as number;
  		this.waterHeaterTargetStateChanged();
		
		this.platform.log.info("Water heater state set to " + this.waterHeaterTargetState);
		callback();
	  });
	this.heaterService.getCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.platform.log.debug("Water heater temperature is %f °C", this.waterHeaterCurrentTemperature.toFixed(1));
		callback(undefined, this.waterHeaterCurrentTemperature);
	  });
	// Avoid generating an exception by changing max first, then current value, then min
	this.heaterService.getCharacteristic(this.platform.api.hap.Characteristic.HeatingThresholdTemperature)
	  .setProps({ maxValue:(this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP), minStep: PKOM_TEMP_STEP })
	  .updateValue(this.waterHeaterHeatingThreshold)
	  .setProps({ minValue: PKOM_MIN_BOILER_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.platform.log.debug("Water heater threshold is %f °C", this.waterHeaterHeatingThreshold);
		callback(undefined, this.waterHeaterHeatingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterHeatingThreshold = value as number;
  		this.waterHeaterTargetStateChanged();
		
		this.platform.log.info("Water heater threshold set to %f °C", this.waterHeaterHeatingThreshold);
		callback();
	  });
    
    // Update pre-computed characteristics    
    this.fanSpeedLevelChanged();
	this.purifierActivationChanged();
    this.didChangeModbusStatus();
    this.platform.log.info("Accessories characteristics init done");

    this.startPollingModbusStatus();
  }
  
  identify() {
    this.platform.log.info("Identifying Pichler PKOM4 device");
  }
  
  fanActivationChanged() {
  	if (!this.fanSwitchedOn) {
	    this.willChangeModbusStatus();
  		this.fanManualMode = true;
  	
  		this.dehumidifierPreviouslyActivated = this.dehumidifierActive;
  		if (this.dehumidifierActive) {
			this.dehumidifierActive = false;
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierActivationChanged();
			this.platform.log.info("Linked deactivation: dehumidifier stored to " + (this.dehumidifierPreviouslyActivated? "active" : "inactive"));
  		}

  		this.conditionerPreviouslyActivated = this.conditionerActive;
  		if (this.conditionerActive) {
			this.conditionerActive = false;
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerActivationChanged();
			this.platform.log.info("Linked deactivation: conditioner stored to " + (this.conditionerPreviouslyActivated? "active" : "inactive"));
		}

  		this.purifierPreviouslyActivated = this.purifierActive;
  		if (this.purifierActive) {
			this.purifierActive = false;
			this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.purifierActive);
			this.purifierActivationChanged();
			this.platform.log.info("Linked deactivation: purifier stored to " + (this.purifierPreviouslyActivated? "active" : "inactive"));
		}
	  	
	  	this.didChangeModbusStatus();
	  	
  	} else if (this.fanManualMode) {
	    this.willChangeModbusStatus();
  		this.fanManualMode = false;
  		
  		if (this.dehumidifierActive != this.dehumidifierPreviouslyActivated) {
			this.dehumidifierActive = this.dehumidifierPreviouslyActivated;
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierActivationChanged();
			this.platform.log.info("Linked deactivation: dehumidifier restored to " + (this.dehumidifierActive? "active" : "inactive"));
  		}

  		if (this.conditionerActive != this.conditionerPreviouslyActivated) {
			this.conditionerActive = this.conditionerPreviouslyActivated;
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerActivationChanged();
			this.platform.log.info("Linked deactivation: conditioner restored to " + (this.conditionerActive? "active" : "inactive"));
  		}

  		if (this.purifierActive != this.purifierPreviouslyActivated) {
			this.purifierActive = this.purifierPreviouslyActivated;
			this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.purifierActive);
			this.purifierActivationChanged();
			this.platform.log.info("Linked deactivation: purifier restored to " + (this.purifierService? "active" : "inactive"));
  		}
  		
	  	this.didChangeModbusStatus();
  	}
  }
   
  fanSpeedLevelChanged() {
    this.willChangeModbusStatus();
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
    this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.RotationSpeed, this.fanRotationSpeed);
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
		for (var index = 0; index < this.fanRotationScale.length; index++) {
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
  }

  purifierActivationChanged() {
    this.willChangeModbusStatus();
    
    // Individual activation will stop any pending global deactivation
  	if (this.purifierActive && !this.fanSwitchedOn) {
  		this.fanSwitchedOn = true;
  		this.fanManualMode = false;
  		this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.On, this.fanSwitchedOn);
 	  	this.fanActivationChanged();
  	}

	// Adjust purifier mode
    if (this.purifierActive) {
		this.purifierCurrentState = this.platform.api.hap.Characteristic.CurrentAirPurifierState.IDLE;
		this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
    } else {
		this.purifierCurrentState = this.platform.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE;
		this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
    }
    
    this.purifierEnteredAutoMode();
    this.didChangeModbusStatus();
  }
  
  purifierDioxideChanged() {
    // Private attribute, no need to propagate to modbus
	this.purifierAirQuality = 0;

	for (var index = 0; index < this.purifierAirQualityScale.length; index++) {
		if (this.purifierDioxideLevel > this.purifierAirQualityScale[index]) {
			this.purifierAirQuality = index;
		}
	}
  }
  
  purifierTargetStateChanged() {
    this.willChangeModbusStatus();
    
	if (this.purifierTargetState == this.platform.api.hap.Characteristic.TargetAirPurifierState.MANUAL) {
		this.purifierCurrentState = this.platform.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
		this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);

		let timer = setTimeout(()=>{ this.purifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
		this.platform.log.info("Air purifier started a timer");
			
		this.purifierEnteredManualMode();
	} else {
		this.purifierEnteredAutoMode();
	}
	
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
		this.purifierTargetState = this.platform.api.hap.Characteristic.TargetAirPurifierState.AUTO;
		this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetAirPurifierState, this.purifierTargetState);
		this.platform.log.info("Air purifier timer elapsed, state is back to " + this.purifierTargetState);

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
  		this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.On, this.fanSwitchedOn);
 	  	this.fanActivationChanged();
  	}
	
	this.didChangeModbusStatus();
  }
  
  dehumidifierTargetStateChanged() {
    this.willChangeModbusStatus();
    
	if (this.dehumidifierTargetState == this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER) {
		let timer = setTimeout(()=>{ this.dehumidifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
		this.platform.log.info("Dehumidifier started a timer");
		
		this.dehumidifierEnteredManualMode();
	} else {
		this.dehumidifierEnteredAutoMode();
	}

  	this.didChangeModbusStatus();
  }
  
  dehumidifierThresholdChanged() {
	this.willChangeModbusStatus();
	if (this.dehumidifierHumidityThreshold < PKOM_MIN_DEHUMID_HUMID) {
		this.dehumidifierHumidityThreshold = PKOM_MIN_DEHUMID_HUMID;
		this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
	} else if (this.dehumidifierHumidityThreshold > PKOM_MAX_DEHUMID_HUMID) {
		this.dehumidifierHumidityThreshold = PKOM_MAX_DEHUMID_HUMID;
		this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
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
		this.dehumidifierTargetState = this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState.AUTO;
		this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
		this.platform.log.info("Dehumidifier timer elapsed, state is back to " + this.dehumidifierTargetState);
	
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
  		this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.On, this.fanSwitchedOn);
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
  
  startPollingModbusStatus() {
	let timer = setInterval(() => {
    	void (async () => {
			this.platform.log.info("Modbus recurrent checking ongoing…");
		
			// Load new register values
			await this.loadModbusStatus(this.simulate);		
			if (this.simulate) {
				// Persist updated attributes using session registers
				this.iterateSimulation();
				await this.saveModbusStatus(true);
			}

			// Update available services
			let heaterService = this.accessory.getService(PKOM_BOILER_NAME);
			if (this.pkomHasWaterHeater && !heaterService) {
				this.accessory.addService(this.heaterService);
				this.platform.log.info("Air quality sensor is now available");
			} else if (!this.pkomHasWaterHeater && heaterService) {
				this.accessory.removeService(heaterService);
				this.platform.log.info("Air quality sensor is no more available");
			}
			
			let purifierService = this.accessory.getService(this.platform.api.hap.Service.AirPurifier);
			if (this.pkomHasDioxideSensor && !purifierService) {
				this.accessory.addService(this.purifierService);
				this.platform.log.info("Air purifier is now available");
			} else if (!this.pkomHasDioxideSensor && purifierService) {
				this.accessory.removeService(purifierService);
				this.platform.log.info("Air purifier is no more available");
			}
			
			let sensorService = this.accessory.getService(this.platform.api.hap.Service.AirQualitySensor);
			if (this.pkomHasDioxideSensor && !sensorService) {
				this.accessory.addService(this.sensorService);
				this.platform.log.info("Water heater is now available");
			} else if (!this.pkomHasDioxideSensor && sensorService) {
				this.accessory.removeService(sensorService);
				this.platform.log.info("Water heater is no more available");
			}
			
			let dehumidifierService = this.accessory.getService(this.platform.api.hap.Service.HumidifierDehumidifier);
			if (this.pkomHasHumiditySensor && !dehumidifierService) {
				this.accessory.addService(this.dehumidifierService);
				this.platform.log.info("Dehumidifier is now available");
			} else if (!this.pkomHasHumiditySensor && dehumidifierService) {
				this.accessory.removeService(dehumidifierService);
				this.platform.log.info("Dehumidifier is no more available");
			}
	
			// Update implied characteristics
			this.informationService.updateCharacteristic(this.platform.api.hap.Characteristic.Model, (this.pkomHasWaterHeater ? PKOM_MODEL_NAME_FULL : PKOM_MODEL_NAME_LIGHT))
				.updateCharacteristic(this.platform.api.hap.Characteristic.FirmwareRevision, this.pkomFirwmareVersion);
			this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.On, this.fanSwitchedOn);
			this.fanService.updateCharacteristic(this.platform.api.hap.Characteristic.RotationSpeed, this.fanRotationSpeed);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentHeaterCoolerState, this.conditionerCurrentState);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetHeaterCoolerState, this.conditionerTargetState);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature, this.conditionerCurrentTemperature);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.HeatingThresholdTemperature, this.conditionerHeatingThreshold);
			this.conditionerService.updateCharacteristic(this.platform.api.hap.Characteristic.CoolingThresholdTemperature, this.conditionerCoolingThreshold);
			this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.purifierActive);
			this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
			this.purifierService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetAirPurifierState, this.purifierTargetState);
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState, this.dehumidifierCurrentState);
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentRelativeHumidity, this.dehumidifierCurrentHumidity);
			this.dehumidifierService.updateCharacteristic(this.platform.api.hap.Characteristic.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
			this.heaterService.updateCharacteristic(this.platform.api.hap.Characteristic.Active, this.waterHeaterActive);
			this.heaterService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentHeaterCoolerState, this.waterHeaterCurrentState);
			this.heaterService.updateCharacteristic(this.platform.api.hap.Characteristic.TargetHeaterCoolerState, this.waterHeaterTargetState);
			this.heaterService.updateCharacteristic(this.platform.api.hap.Characteristic.CurrentTemperature, this.waterHeaterCurrentTemperature);
			this.heaterService.updateCharacteristic(this.platform.api.hap.Characteristic.HeatingThresholdTemperature, this.waterHeaterHeatingThreshold);
			this.sensorService.updateCharacteristic(this.platform.api.hap.Characteristic.AirQuality, this.purifierAirQuality);
 			this.sensorService.updateCharacteristic(this.platform.api.hap.Characteristic.CarbonDioxideLevel, this.purifierDioxideLevel);

			this.platform.log.info("Modbus recurrent checking done");
		})();
	}, MODBUS_POLLING_PERIOD);
	this.platform.log.info("Modbus recurrent checking is on");
  }

  willObserveModbusStatus() {
  	// No need for sync update, we're simply accelerating refresh rate
  	// Update timestamp before async call to avoid massive parallel updates
    if ((Date.now() - this.modbusLoadTimestamp) > MODBUS_INTERACTIVE_UPDATE_PERIOD) {
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

 	// Fetch modbus registers (trigger an empty save cycle)	
	let startTime = Date.now();
	let beginPromise = await this.session.begin()
		.catch((error: Error) => {
			this.platform.log.info("Modbus session is busy operation will be ignored");
		});
		
  	if (!keepSession) {
		let endPromise = await this.session.end()
			.catch((error: Error) => {
				this.platform.log.info("Modbus session is busy operation will be ignored");
			});
  	}
  	
	this.platform.log.debug("End of async modbus %s", (keepSession ? "call" : "calls"));

  	// Readwrite register are persisted by session under simulation mode
	this.pkomMode = this.session.readRegister(MODBUS_ADDR_MODE);
  	this.pkomEcoTime = this.session.readRegister(MODBUS_ADDR_ECO_TIME);
	this.pkomUserSpeedLevel = this.session.readRegister(MODBUS_ADDR_USER_SPEED_LEVEL);
	this.pkomActualSpeedLevel = this.session.readRegister(MODBUS_ADDR_ACTUAL_SPEED_LEVEL);
	this.pkomAutoSpeedLevel = this.session.readRegister(MODBUS_ADDR_AUTO_SPEED_LEVEL);
	this.purifierDioxideThreshold = this.session.readRegister(MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD);
	this.dehumidifierHumidityThreshold = this.session.readRegister(MODBUS_ADDR_MAX_HUMID_THRESHOLD);
	this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_HEAT_THRESHOLD);
	this.conditionerCoolingThreshold = this.session.readRegister(MODBUS_ADDR_COOL_THRESHOLD);
	this.waterHeaterHeatingThreshold = this.session.readRegister(MODBUS_ADDR_MIN_BOILER_THRESHOLD);
	this.pkomFilterDuration = PKOM_FILTER_MAX_DURATION - this.session.readRegister(MODBUS_ADDR_FILTER_ELAPSED_TIME);
	this.pkomSerialNumber = this.session.readRegister(MODBUS_ADDR_SERIAL_NUMBER);
	this.pkomFirwmareVersion = this.session.readRegister(MODBUS_ADDR_FIRMWARE_VERSION);
  	
  	// Those dynamic registers are skipped under simulation mode
	if (!this.simulate && this.pkomEcoTime) {
		this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_ECO_THRESHOLD);
	} else if (!this.simulate) {
		this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_NORMAL_THRESHOLD);
	}
  	
  	// Those readonly registers are skipped to ensure persistance under simulation mode
  	if (!this.simulate || !this.inited) {
		this.pkomCurrentlyWaterHeating = this.session.readRegister(MODBUS_ADDR_BOILER_HEATING);
		this.purifierDioxideLevel = this.session.readRegister(MODBUS_ADDR_AIR_DIOXIDE);
		this.dehumidifierCurrentHumidity = this.session.readRegister(MODBUS_ADDR_AIR_HUMID);
		this.conditionerCurrentTemperature = this.session.readRegister(MODBUS_ADDR_AIR_TEMP);
		this.waterHeaterCurrentTemperature = this.session.readRegister(MODBUS_ADDR_BOILER_TEMP);
		this.waterHeaterActive = this.session.readRegister(MODBUS_ADDR_BOILER_ENABLED);
		
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

	let coolEnabled = (this.session.readRegister(MODBUS_ADDR_COOL_ENABLED) != PKOM_COOLING_OFF);
  	let dehumidifierActive = this.session.readRegister(MODBUS_ADDR_HUMID_ENABLED);
  	let purifierActive = this.session.readRegister(MODBUS_ADDR_DIOXIDE_ENABLED);
	let boilerEnergy = this.session.readRegister(MODBUS_ADDR_BOILER_ENERGY);
	let sensorType = this.session.readRegister(MODBUS_ADDR_HARDWARE_SENSORS);
	let options = this.session.readRegister(MODBUS_ADDR_HARDWARE_OPTIONS);
  	
	// Following status are computed
	this.fanCurrentSpeedLevel = (this.pkomActualSpeedLevel - 1);
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
	this.filterChangeAlert = (this.pkomFilterDuration < PKOM_FILTER_DURATION_ALERT);
	this.filterLifeLevel = Math.round(this.pkomFilterDuration / PKOM_FILTER_MAX_DURATION * 100.0);
	
	let currentConditionerStatus = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
	if (this.pkomCurrentlyCooling) {
		currentConditionerStatus = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.COOLING;
	} else if (this.pkomCurrentlyHeating) {
		currentConditionerStatus = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.HEATING;
	}

	// Adjust current status based on internal manual mode
	let currentPurifierStatus = (this.purifierManualMode ? this.platform.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR : this.platform.api.hap.Characteristic.CurrentAirPurifierState.IDLE);
	let currentHumidifierStatus = (this.dehumidifierManualMode ? this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING : this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState.IDLE);
	let currentWaterHeaterStatus = (this.pkomCurrentlyWaterHeating ? this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.HEATING : this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.IDLE);
	
	// Adjust current status based on PKOM automatic behaviour
	if (this.fanCurrentSpeedLevel >= PKOM_DEHUMID_LEVEL && this.dehumidifierCurrentHumidity > this.dehumidifierHumidityThreshold) {
		currentPurifierStatus = this.platform.api.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
	} else if (this.fanCurrentSpeedLevel >= PKOM_PURIFIER_LEVEL && this.purifierDioxideLevel > this.purifierDioxideThreshold) {
		currentHumidifierStatus = this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
	} 

  	switch (this.pkomMode) {
  		case PKOM_MODE_OFF:
	  		this.fanSwitchedOn = false;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_SUMMER:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = coolEnabled;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.COOL;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_WINTER:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = true;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_AUTO:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = true;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_HOLIDAYS:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_BOILER:
	  		this.fanSwitchedOn = false;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
	  	default:
	  		this.platform.log.info("Unknown device mode - behaviour might be erratic");
	  		break;
  	}
  	
  	// Purifier & dehumidifier status depends on fan mode
  	this.purifierActive = (this.fanSwitchedOn && purifierActive);
	this.purifierCurrentState = (this.purifierActive ? currentPurifierStatus : this.platform.api.hap.Characteristic.CurrentAirPurifierState.INACTIVE);
  	this.purifierTargetState = (this.purifierManualMode ? this.platform.api.hap.Characteristic.TargetAirPurifierState.MANUAL : this.platform.api.hap.Characteristic.TargetAirPurifierState.AUTO);
	this.dehumidifierActive = (this.fanSwitchedOn && dehumidifierActive);
	this.dehumidifierCurrentState = (this.dehumidifierActive ? currentHumidifierStatus : this.platform.api.hap.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE);
  	this.dehumidifierTargetState = this.platform.api.hap.Characteristic.TargetHumidifierDehumidifierState.AUTO;

	// Fetch hardware infos
	this.pkomHasWaterHeater = (boilerEnergy > 0);

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

	// Update air quality status
  	this.purifierDioxideChanged();
  	this.modbusLoadTimestamp = Date.now();
  	this.inited = true;
	
	this.platform.log.info("Modbus status loaded (total duration %d ms)", Date.now() - startTime);
  }

  async saveModbusStatus(keepSession = false) {
	if (this.modbusPendingSave) return;
	  
	// Load all registers
	let startTime = Date.now();
  	this.modbusPendingSave = true;
	if (!keepSession) {
  		let beginPromise = await this.session.begin()
		.catch((error: Error) => {
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
	//  (e.g turning off fan then water then conditioner to turn all off). In this case register writing is postponed to next valid configuration.
	// It means in particular that specific features such as anti-frozen, anti-legionel, bypass, etc are always active.
  	let pkomUserSpeedLevel = (this.simulate || this.purifierManualMode || this.dehumidifierManualMode) ? this.fanCurrentSpeedLevel + 1 : PKOM_SPEED_LEVEL_AUTO;
	let pkomMode = PKOM_MODE_UNSUPPORTED;
	
	if (!this.fanSwitchedOn && !this.waterHeaterActive && !this.conditionerActive) {
	  	pkomMode = PKOM_MODE_OFF;		// All is off
	} else if (!this.fanSwitchedOn && this.waterHeaterActive && !this.conditionerActive) {
	  	pkomMode = PKOM_MODE_BOILER;	// Water only
	} else if (this.fanSwitchedOn && !this.waterHeaterActive && this.conditionerActive) {
 		pkomMode = PKOM_MODE_AUTO;		// No Water, need to stop boiler pump as well
	} else if (this.fanSwitchedOn && !this.waterHeaterActive && !this.conditionerActive) {
 		pkomMode = PKOM_MODE_HOLIDAYS;	// Fan only, need to specify duration
 	} else if (this.fanSwitchedOn && this.waterHeaterActive && !this.conditionerActive) {
		pkomMode = PKOM_MODE_SUMMER;	// No conditioner, need to stop cooling as well
	} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.platform.api.hap.Characteristic.TargetHeaterCoolerState.HEAT) {
		pkomMode = PKOM_MODE_WINTER;	// Forced heating
	} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.platform.api.hap.Characteristic.TargetHeaterCoolerState.COOL) {
		pkomMode = PKOM_MODE_SUMMER;	// Forced cooling
 	} else if (this.fanSwitchedOn && this.waterHeaterActive && this.conditionerActive && this.conditionerTargetState == this.platform.api.hap.Characteristic.TargetHeaterCoolerState.AUTO) {
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
 	if (pkomMode != PKOM_MODE_UNSUPPORTED) {
	 	this.session.writeRegister(MODBUS_ADDR_MODE, pkomMode);
	  	this.session.writeRegister(MODBUS_ADDR_COOL_ENABLED, (this.conditionerActive || (pkomMode != PKOM_MODE_SUMMER)));
	  	this.session.writeRegister(MODBUS_ADDR_BOILER_ENABLED, (this.waterHeaterActive || (pkomMode != PKOM_MODE_AUTO)));
 	}
  	
	// Send modified registers
	let endPromise = await this.session.end()
		.catch((error: Error) => {
			this.platform.log.info("Modbus session is busy operation will be ignored");
		});

  	this.modbusPendingSave = false;
  	
	this.platform.log.debug("End of async modbus call");
	this.platform.log.info("Modbus status saved (total duration %d ms)", Date.now() - startTime);
  }
  
  iterateSimulation() {
    let dioxideIncrement = 0;
    let humidityIncrement = 0;
    let increaseRate = Math.max((PKOM_MIN_DEHUMID_HUMID - this.dehumidifierCurrentHumidity) / 100.0, 0.1) ** 2;
    let decreaseRate = Math.max((this.dehumidifierCurrentHumidity - PKOM_MIN_HUMID_HUMID) / 100.0, 0.1) ** 2;
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
	this.dehumidifierCurrentHumidity =  Math.min(Math.max(this.dehumidifierCurrentHumidity + humidityIncrement, 10), 89);
	this.platform.log.info("Simulation - air quality modulating (∆h:%d, ∆d:%d)", humidityIncrement, dioxideIncrement);

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

    this.pkomCurrentlyWaterHeating = (this.waterHeaterCurrentState == this.platform.api.hap.Characteristic.CurrentHeaterCoolerState.HEATING);
	if (this.pkomCurrentlyWaterHeating) {
		this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature + 0.5;
		if (this.waterHeaterCurrentTemperature >= this.waterHeaterHeatingThreshold) {
			this.pkomCurrentlyWaterHeating = false;
			this.platform.log.info("Simulation - stoping water heating");
		} else {
			this.platform.log.debug("Simulation - water:%d of %d °C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
		}
	} else {
		this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature - 0.1;
		if (this.waterHeaterCurrentTemperature <= PKOM_MIN_BOILER_TEMP) {
			this.pkomCurrentlyWaterHeating = true;
			this.platform.log.info("Simulation - starting water heating");
		} else {
			this.platform.log.debug("Simulation - water:%d of %d °C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
		}
	}
	
	if (!this.pkomCurrentlyHeating && this.conditionerCurrentTemperature < (this.conditionerHeatingThreshold - PKOM_HEAT_HYSTERESIS)) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = true;
		this.platform.log.info("Simulation - starting air heating");
	} else if (!this.pkomCurrentlyCooling && this.conditionerCurrentTemperature > (this.conditionerCoolingThreshold + PKOM_HEAT_HYSTERESIS)) {
		this.pkomCurrentlyCooling = true;
		this.pkomCurrentlyHeating = false;
		this.platform.log.info("Simulation - starting air cooling");
	} else if (this.pkomCurrentlyHeating && this.conditionerCurrentTemperature <= (this.conditionerCoolingThreshold + PKOM_HEAT_HYSTERESIS) && this.conditionerCurrentTemperature >= (this.conditionerHeatingThreshold + PKOM_HEAT_HYSTERESIS)) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = false;
		this.platform.log.info("Simulation - stoping air heating");
	} else if (this.pkomCurrentlyCooling && this.conditionerCurrentTemperature <= (this.conditionerCoolingThreshold - PKOM_HEAT_HYSTERESIS) && this.conditionerCurrentTemperature >= (this.conditionerHeatingThreshold - PKOM_HEAT_HYSTERESIS)) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = false;
		this.platform.log.info("Simulation - stoping air cooling");
	}

	this.fanCurrentSpeedLevel = this.pkomUserSpeedLevel - 1;
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
  }
}
