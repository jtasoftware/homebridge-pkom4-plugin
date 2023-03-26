import {
  AccessoryPlugin,
  CharacteristicValue,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  HAP,
  Logging,
  Service,
  PlatformConfig
} from "homebridge";

const MANUFACTURER_NAME = "Pichler";
const MODEL_NAME_FULL = "PKOM4 Classic";
const MODEL_NAME_LIGHT = "PKOM4 Trend";
const SERIAL_NUMBER = "Q87E31YL";
const FIRMWARE_VERSION = "1.0";
const MANUAL_MODE_DURATION = 600000;
const MODBUS_POLLING_PERIOD = 300000;
const MODBUS_INTERACTIVE_UPDATE_PERIOD = 5000;
const FAN_SPEED_TOLERANCE = 2;

const PKOM_AIR_QUALITY_SCALE = [ 0.0, 0.0, 400.0, 1000.0, 1500.0, 2000.0 ];
const PKOM_AIR_ROTATION_SCALE = [ 25.0, 50.0, 75.0, 90.0 ];

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

const PKOM_PURIFIER_HYSTERESIS = 250.0;
const PKOM_DEHUMID_HYSTERESIS = 15.0;
const PKOM_MIN_BOILER_TEMP = 35;
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
const PKOM_FILTER_DURATION_ALERT = 8280.0;	// 15 days before 1 year
const PKOM_FILTER_MAX_DURATION = 8760.0; // 1 year

const PKOM_DEMO_BOILER_TEMP = 47.0;
const PKOM_DEMO_BOILER_THRESHOLD = 55.0;
const PKOM_DEMO_COOL_TEMP = 26.0;
const PKOM_DEMO_HEAT_TEMP = 22.0;
const PKOM_DEMO_AIR_HUMID = 65.0;
const PKOM_DEMO_AIR_TEMP = 25.0;
const PKOM_DEMO_AIR_DIOXIDE = 851.0;
const PKOM_DEMO_DIOXIDE_THRESHOLD = 1000.0;
const PKOM_DEMO_HUMID_THRESHOLD = 70.0;
const PKOM_DEMO_FILTER_DURATION = 4320;	// 24*180 days
const PKOM_DEMO_BOILER_ENERGY = 1;
const PKOM_DEMO_SENSORS = 3;
const PKOM_DEMO_OPTIONS = 4;

const MODBUS_FLOAT_EPSILON = 0.01;	// Maximal precision being 2 digits, ignore lower value delta
const MODBUS_ADDR_MODE = 0;						// ENUM, RW
const MODBUS_ADDR_COOLING = 9;					// BOOL, RW
const MODBUS_ADDR_SPEED_LEVEL = 46;				// ENUM, RW
const MODBUS_ADDR_AUTO_SPEED_LEVEL = 58;		// ENUM, RW
const MODBUS_ADDR_HEATING = 136;				// BOOL, RW
const MODBUS_ADDR_ECO_TIME = 137;				// BOOL, RW
const MODBUS_ADDR_COOL_ENABLED = 1001;			// BOOL, RW
const MODBUS_ADDR_HEAT_ENABLED = 1002;			// BOOL, RW
const MODBUS_ADDR_HUMID_ENABLED = 1003;			// BOOL, RW
const MODBUS_ADDR_DIOXIDE_ENABLED = 1004;		// BOOL, RW
const MODBUS_ADDR_HEAT_THRESHOLD = 201;			// FIXED, RW
const MODBUS_ADDR_COOL_THRESHOLD = 29;			// FIXED, RW
const MODBUS_ADDR_MAX_HUMID_THRESHOLD = 102;	// FIXED, RW
const MODBUS_ADDR_MIN_HUMID_THRESHOLD = 103;	// FIXED, RW
const MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD = 101;	// INT, RW
const MODBUS_ADDR_MIN_BOILER_THRESHOLD = 166;	// FIXED, RW
const MODBUS_ADDR_AIR_DIOXIDE = 483;			// INT, RO
const MODBUS_ADDR_AIR_HUMID = 484;				// FIXED, RO
const MODBUS_ADDR_AIR_TEMP = 153;				// FIXED, RO
const MODBUS_ADDR_BOILER_TEMP = 196;			// FIXED, RO
const MODBUS_ADDR_BOILER_ENERGY = 38;			// INT, RO
const MODBUS_ADDR_BOILER_HEATING = 1005;		// BOOL, RO
const MODBUS_ADDR_FILTER_DURATION = 315;		// INT, RO
const MODBUS_ADDR_SERIAL_NUMBER = 1006;			// STRING, RO
const MODBUS_ADDR_FIRMWARE_VERSION = 36;		// FIXED, RO
const MODBUS_ADDR_FIRM_VMC_VERSION = 11;		// FIXED, RO
const MODBUS_ADDR_FIRM_PUMP_VERSION = 208;		// FIXED, RO
const MODBUS_ADDR_HARDWARE_OPTIONS = 149;		// INT, RO
const MODBUS_ADDR_HARDWARE_SENSORS = 16;		// INT, RO

const CMV_NAME = "CMV";
const OUT_FILTER_NAME = "Outdoor Air Filter Maintenance";
const IN_FILTER_NAME = "Extracted Air Filter Maintenance";
const AIR_QUALITY_NAME = "Air Quality Sensor";
const AIR_CONDITIONER_NAME = "Air Conditioner";
const PURIFIER_NAME = "Carbon Dioxide Purifier";
const DEHUMIDIFIER_NAME = "Dehumidifier";
const BOILER_NAME = "Water Heater";
const ECO_MODE_NAME = "Eco Mode";

const { spawn } = require('child_process');
const scriptsFolder = (__dirname + "/../scripts/");
const pythonPath = "/usr/bin/python3";

class ModbusSession {
  private registersValue: Record<number, any>;
  private registersCache: Record<number, any>;
  private registersModified: Record<number, boolean>;
  private readonly registersAddress: Array<number>;
  private readonly readOnly: boolean;
  private readonly demoMode: boolean;
  private readonly debugLevel: number;
  private readonly log: Logging;
  public  ongoing: boolean;

  constructor(log: Logging, readOnly: boolean, demoMode: boolean, debugLevel: number) {
  	this.log = log;
  	this.readOnly = readOnly;
  	this.demoMode = demoMode;
  	this.debugLevel = debugLevel;
	this.ongoing = false;
	
	this.registersCache = {};
	this.registersValue = {};
	this.registersModified = {};
	this.registersAddress = [
  		MODBUS_ADDR_MODE,
  		MODBUS_ADDR_COOLING,
  		MODBUS_ADDR_SPEED_LEVEL,
  		MODBUS_ADDR_AUTO_SPEED_LEVEL,
  		MODBUS_ADDR_HEATING,
  		MODBUS_ADDR_ECO_TIME,
  		MODBUS_ADDR_COOL_ENABLED,
  		MODBUS_ADDR_HEAT_ENABLED,
  		MODBUS_ADDR_HUMID_ENABLED,
  		MODBUS_ADDR_DIOXIDE_ENABLED,
  		MODBUS_ADDR_HEAT_THRESHOLD,
  		MODBUS_ADDR_COOL_THRESHOLD,
  		MODBUS_ADDR_MAX_HUMID_THRESHOLD,
  		MODBUS_ADDR_MIN_HUMID_THRESHOLD,
  		MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD,
  		MODBUS_ADDR_MIN_BOILER_THRESHOLD,
  		MODBUS_ADDR_AIR_DIOXIDE,
  		MODBUS_ADDR_AIR_HUMID,
  		MODBUS_ADDR_AIR_TEMP,
  		MODBUS_ADDR_BOILER_TEMP,
  		MODBUS_ADDR_BOILER_ENERGY,
  		MODBUS_ADDR_BOILER_HEATING,
  		MODBUS_ADDR_FILTER_DURATION,
  		MODBUS_ADDR_SERIAL_NUMBER,
		MODBUS_ADDR_FIRMWARE_VERSION,
  		MODBUS_ADDR_HARDWARE_OPTIONS,
  		MODBUS_ADDR_HARDWARE_SENSORS
	];
	
	this.initToDefaults(this.demoMode);
	this.log.info("Modbus session created with log level: %d", debugLevel);
  }
  
  initToDefaults(demoMode: boolean) {
  	// Default values (demo mode)
  	// TBD: move to Python interface using "demo" verb
  	this.registersValue[MODBUS_ADDR_FIRMWARE_VERSION] = (demoMode ? FIRMWARE_VERSION : "");
  	this.registersValue[MODBUS_ADDR_SERIAL_NUMBER] = (demoMode ? SERIAL_NUMBER : "");
  	this.registersValue[MODBUS_ADDR_COOLING] = false;
  	this.registersValue[MODBUS_ADDR_HEATING] = false;
  	this.registersValue[MODBUS_ADDR_BOILER_HEATING] = false;
  	this.registersValue[MODBUS_ADDR_COOL_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_HUMID_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_DIOXIDE_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_MODE] = (demoMode ? PKOM_MODE_AUTO : PKOM_MODE_OFF);
  	this.registersValue[MODBUS_ADDR_SPEED_LEVEL] = PKOM_SPEED_LEVEL_NORMAL;
  	this.registersValue[MODBUS_ADDR_AUTO_SPEED_LEVEL] = PKOM_SPEED_LEVEL_NORMAL;
  	this.registersValue[MODBUS_ADDR_AIR_DIOXIDE] = (demoMode ? PKOM_DEMO_AIR_DIOXIDE : 0.0);
  	this.registersValue[MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD] = (demoMode ? PKOM_DEMO_DIOXIDE_THRESHOLD : 0.0);
  	this.registersValue[MODBUS_ADDR_MAX_HUMID_THRESHOLD] = (demoMode ? PKOM_DEMO_HUMID_THRESHOLD : PKOM_MIN_DEHUMID_HUMID);
  	this.registersValue[MODBUS_ADDR_AIR_HUMID] = (demoMode ? PKOM_DEMO_AIR_HUMID : 0.0);
  	this.registersValue[MODBUS_ADDR_AIR_TEMP] = (demoMode ? PKOM_DEMO_AIR_TEMP : 0.0);
  	this.registersValue[MODBUS_ADDR_HEAT_THRESHOLD] = (demoMode ? PKOM_DEMO_HEAT_TEMP : PKOM_MIN_HEAT_TEMP);
  	this.registersValue[MODBUS_ADDR_COOL_THRESHOLD] = (demoMode ? PKOM_DEMO_COOL_TEMP : PKOM_MIN_COOL_TEMP);
  	this.registersValue[MODBUS_ADDR_BOILER_TEMP] = (demoMode ? PKOM_DEMO_BOILER_TEMP : 0.0);
  	this.registersValue[MODBUS_ADDR_MIN_BOILER_THRESHOLD] = (demoMode ? PKOM_DEMO_BOILER_THRESHOLD : PKOM_MIN_BOILER_TEMP);
  	this.registersValue[MODBUS_ADDR_FILTER_DURATION] = (demoMode ? PKOM_DEMO_FILTER_DURATION : 0);
  	this.registersValue[MODBUS_ADDR_BOILER_ENERGY] = (demoMode ? PKOM_DEMO_BOILER_ENERGY : 0);
  	this.registersValue[MODBUS_ADDR_HARDWARE_SENSORS] = (demoMode ? PKOM_DEMO_SENSORS : 0);
  	this.registersValue[MODBUS_ADDR_HARDWARE_OPTIONS] = (demoMode ? PKOM_DEMO_OPTIONS : 0);
  }

  async begin(): Promise<any> {
  	if (this.ongoing) throw 'Session error: begin/end calls are unbalanced';
  	this.ongoing = true;
  	
	for (let address of this.registersAddress) {
		this.registersModified[address] = false;
	}
	
	this.log.info("Async modbus 'get registers' called");
	
	// Use Python command to read registers. This will loose any previous change
	// that was not sent. It will also behave as a slave considering any concurent change
	// that occurred. From that point, and until end() call will turn into a master
	// for pending changes (will overwrite concurent changes).
	let promise = await this.callPython("modbus.py", "get", this.registersValue)
		.then((result: Record<number, any>) => {
     		this.registersValue = result;
     		if (this.debugLevel > 1) {
	   			this.log.debug("Async modbus completed with registers: %s", this.registersValue);
     		}
  		})
  		.catch((error: Error) => {
    		this.log.info("Error getting modbus registers %s", error.message);
  		});

  	return promise;
  }

  async end(): Promise<any> {
    if (!this.ongoing) throw 'Session error: begin/end calls are unbalanced';
   
	// Filter registers that were modified - avoid erasing concurent changes for
	//	not conflicting registers. Won't manage real conflicts however.
	this.registersCache = {};
	
  	for (let address of this.registersAddress) {
		if (this.registersModified[address] && !this.readOnly) {
			this.registersCache[address] = this.registersValue[address];
		}
	}
	
	if (Object.keys(this.registersCache).length > 0) {
		this.log.info("Async modbus 'set registers' called with: %s", this.registersCache);
 	} else {
 		this.log.info("Async modbus 'set registers' skipped (no modification)");
 	}

 	this.ongoing = false;

	// Use Python command to write modified registers
	let promise = await this.callPython("modbus.py", "set", this.registersCache)
		.catch((error: Error) => {
			this.log.info("Error setting modbus registers %s", error.message);
		});
 	
  	return promise;
  }

  async callPython(scriptName: string, verb: string, param?: any): Promise<any> {
	return new Promise(function(successCallback, failureCallback) {
		try {
			const pyArgs = [scriptsFolder + scriptName, verb, JSON.stringify(param)];
			const pyProcess = spawn(pythonPath, pyArgs );
			let result = "";
			let errorMsg = "";
	
			pyProcess.stdout.on('data', (data: any) => {
				result += data.toString();
			});

			pyProcess.stderr.on('data', (data: any) => {
				errorMsg += data.toString();
			});

			pyProcess.stdout.on("end", () => {
				if (errorMsg == "") {
					successCallback(JSON.parse(result));
					successCallback(result);
				} else {
					const error = new Error(errorMsg);
					failureCallback(error);
				}
			})
		}
		catch(error) {
			failureCallback(error);
		}
	});
  }

  writeRegister(address: number, value: any) {
  	// As the client acts as master between begin/end block, we shouldn't assume
  	// value will be preserved if it's not overwritten.
  	// However this is a huge optimisation that need to be considered as well:
  	//	- For floats, only negligeable delta will be lost - should not be problematic
  	//	- For ints, state change will always be reported
  	//	- Only unchanged int might become out-of-synch. It will be fixed on next begin/end block
  	//	and simply means that concurrency favor changed state over status quo.
  	//	Could be problematic for linked variables which is not the case here.
  	//	The only caution point here is about local caches such as time-bombed manual modes.
	if (Math.abs(this.registersValue[address] - value) > MODBUS_FLOAT_EPSILON) {
   		this.registersValue[address] = value;
    	this.registersModified[address] = true;
    	if (address > 1000 && this.debugLevel > 0) {
  			this.log.debug("Modified modbus registers to %d (#%d)", value, address);
  		} else if (this.debugLevel > 0) {
  			this.log.debug("Modified modbus registers to %f (#%d)", value, address);
  		}
	} else if (address > 1000 && this.debugLevel > 0) {
  		this.log.debug("Ignored modbus registers change from %d to %d (#%d)", this.registersValue[address], value, address);
	} else if (this.debugLevel > 0) {
  		this.log.debug("Ignored modbus registers change from %f to %f (#%d)", this.registersValue[address], value, address);
	}
  }
  
  readRegister(address: number): any {
    if (this.debugLevel > 1) {
		this.log.debug("Reading modbus register %d:%d", address, this.registersValue[address]);
	}
	return this.registersValue[address];
  }
}

export class PKOM4Accessory implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly hap: HAP;
  private readonly name: string;
  private readonly session: ModbusSession;

  private simulate = false;
  private dryRegion = false;
  private readOnly = false;
  private inited = false;
  private modbusPendingSave = false;
  private modbusDebugLevel = 0;
  private modbusSaveRefcon = 0;
  private modbusLoadTimestamp = 0.0;
  
  private pkomMode = 0;
  private pkomSpeedLevel = 0;
  private pkomCurrentlyCooling = false;
  private pkomCurrentlyHeating = false;
  private pkomCurrentlyWaterHeating = false;
  private pkomAutoSpeedLevel = 0;
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

  private holidaysModeSwitchedOn = false;

  private readonly informationService: Service;
  private readonly fanService: Service;
  private readonly filterService: Service;
  private readonly sensorService: Service;
  private readonly purifierService: Service;
  private readonly dehumidifierService: Service;
  private readonly conditionerService: Service;
  private readonly heaterService: Service;
  private readonly holidaysModeService: Service;

  constructor(hap: HAP, log: Logging, config: PlatformConfig, name: string) {
	this.hap = hap;
    this.log = log;
    this.name = name;
	this.simulate = config["simulate"];
	this.readOnly = config["readOnly"];
	this.modbusDebugLevel = config["modbusDebugLevel"]
	this.dryRegion = false;
	this.inited = false;

	this.log.info("Platform config: " + (this.simulate && this.readOnly ? "simulate, read-only" : (this.simulate ? "simulate" : (this.readOnly ? "read-only" : "none"))));	
	
    this.informationService = new this.hap.Service.AccessoryInformation(name)
    this.informationService.setCharacteristic(this.hap.Characteristic.Manufacturer, MANUFACTURER_NAME)
      .setCharacteristic(this.hap.Characteristic.Model, "PKOM4")
      .setCharacteristic(this.hap.Characteristic.SerialNumber, "--------")
      .setCharacteristic(this.hap.Characteristic.FirmwareRevision, FIRMWARE_VERSION);
    this.log.info("Hardware informations for '%s' created", name);
  	
    this.fanService = new this.hap.Service.Fan(CMV_NAME);
    this.fanService.setPrimaryService(true);
    this.log.info("Mechanical ventilation for '%s' created", name);
    
    this.filterService = new this.hap.Service.FilterMaintenance(OUT_FILTER_NAME);
    this.filterService.subtype = OUT_FILTER_NAME;
    this.log.info("Filter maintenance for '%s' created", name);

	this.sensorService = new this.hap.Service.AirQualitySensor(AIR_QUALITY_NAME);
	this.log.info("Air quality sensor for '%s' created", name);

	this.purifierService = new this.hap.Service.AirPurifier(PURIFIER_NAME);
    this.purifierService.addLinkedService(this.fanService);
	this.purifierService.addLinkedService(this.sensorService);
	this.purifierService.addLinkedService(this.filterService);
	this.log.info("Air purifier for '%s' created", name);

	this.dehumidifierService = new this.hap.Service.HumidifierDehumidifier(DEHUMIDIFIER_NAME);
    this.dehumidifierService.addLinkedService(this.fanService);
	this.log.info("Dehumidifier for '%s' created", name);

    this.conditionerService = new this.hap.Service.HeaterCooler(AIR_CONDITIONER_NAME);
    this.conditionerService.subtype = AIR_CONDITIONER_NAME;
    this.conditionerService.addLinkedService(this.fanService);
    this.log.info("Air conditioner for '%s' created", name);

	this.heaterService = new this.hap.Service.HeaterCooler(BOILER_NAME);
	this.heaterService.subtype = BOILER_NAME;
	this.log.info("Water heater for '%s' created", name);
	
	// Holidays mode is currently unused (replaced with Fan off state)
	this.holidaysModeService = new this.hap.Service.Switch(ECO_MODE_NAME);
	this.holidaysModeService.addLinkedService(this.fanService);
    this.log.info("Holidays mode switch for '%s' created", name);
    
   	this.session = new ModbusSession(this.log, this.readOnly, this.simulate, this.modbusDebugLevel);
	this.initAccessories();
  }

  async initAccessories() {
	
	this.log.info("Initial Modbus status loading…");

	await this.loadModbusStatus();
	
	let sensors = (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor ? "humidity & dioxide" : (this.pkomHasDioxideSensor ? "dioxide" : (this.pkomHasHumiditySensor ? "humidity" : "none")));
	let options = (this.pkomHasWaterResistance && this.pkomHasAirResistance ? "water resist. & duct battery" : (this.pkomHasWaterResistance ? "water resist." : (this.pkomHasAirResistance ? "duct bat" : "none")));
	this.log.info("Available PKOM model: %s", (this.pkomHasWaterHeater ? MODEL_NAME_FULL : MODEL_NAME_LIGHT));
	this.log.info("Available PKOM sensors: %s", sensors);
	this.log.info("Available PKOM options: %s", options);
	this.log.info("Initial Modbus status load done");
	
	this.log.info("Accessories characteristics initializing…");
	this.willChangeModbusStatus();
	
	this.informationService.updateCharacteristic(this.hap.Characteristic.Model, (this.pkomHasWaterHeater ? MODEL_NAME_FULL : MODEL_NAME_LIGHT))
		.updateCharacteristic(this.hap.Characteristic.SerialNumber, this.pkomSerialNumber)
		.updateCharacteristic(this.hap.Characteristic.FirmwareRevision, this.pkomFirwmareVersion);
	this.informationService.getCharacteristic(this.hap.Characteristic.Identify)
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.log.info("Identifying device #" + this.pkomSerialNumber);
		callback();
	  });

	this.fanService.getCharacteristic(this.hap.Characteristic.On)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Mechanical ventilation is " + (this.fanSwitchedOn? "on" : "off"));
		callback(undefined, this.fanSwitchedOn);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		let fanSwitchedOn = value as boolean
		if (this.fanSwitchedOn != fanSwitchedOn) {
			this.fanSwitchedOn = fanSwitchedOn;
			this.fanActivationChanged();
	
			this.log.info("Mechanical ventilation state set to " + (fanSwitchedOn? "on" : "off"));
		}
		callback();
	  });
	this.fanService.getCharacteristic(this.hap.Characteristic.RotationSpeed)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Mechanical ventilation rotation speed is %f%% (level %d)", this.fanRotationSpeed, this.fanCurrentSpeedLevel + 1);
		callback(undefined, this.fanRotationSpeed);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.fanRotationSpeed = value as number;
		this.fanSpeedChanged();
	
		this.log.info("Mechanical ventilation rotation level set to %d (%f%%)", this.fanCurrentSpeedLevel + 1, this.fanRotationSpeed);
		callback();
	  });

	this.filterService.getCharacteristic(this.hap.Characteristic.FilterChangeIndication)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Filter change alert is " + (this.filterChangeAlert? "on" : "off"));
		callback(undefined, (this.filterChangeAlert? this.hap.Characteristic.FilterChangeIndication.CHANGE_FILTER : this.hap.Characteristic.FilterChangeIndication.FILTER_OK));
	  });
	this.filterService.getCharacteristic(this.hap.Characteristic.FilterLifeLevel)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Filter life level is %d%%", this.filterLifeLevel);
		callback(undefined, this.filterLifeLevel);
	  });
	this.filterService.getCharacteristic(this.hap.Characteristic.ResetFilterIndication)
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.log.info("Filter alert reseted");
		callback();
	  });

	this.sensorService.getCharacteristic(this.hap.Characteristic.AirQuality)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air quality sensor air quality is " + this.purifierAirQuality);
		callback(undefined, this.purifierAirQuality);
	  });
	this.sensorService.getCharacteristic(this.hap.Characteristic.CarbonDioxideLevel)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air quality sensor dioxide level is %d ppm", this.purifierDioxideLevel.toFixed(1));
		callback(undefined, this.purifierDioxideLevel);
	  });

	this.purifierService.getCharacteristic(this.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air purifier is " + (this.purifierActive? "active" : "inactive"));
		callback(undefined, this.purifierActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.purifierActive = value as boolean;
		this.purifierActivationChanged();

		this.log.info("Air purifier set to " + (this.purifierActive? "active" : "inactive"));
		callback();
	  });
	this.purifierService.getCharacteristic(this.hap.Characteristic.CurrentAirPurifierState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Current air purifier state is " + this.purifierCurrentState);
		callback(undefined, this.purifierCurrentState);
	  });
	this.purifierService.getCharacteristic(this.hap.Characteristic.TargetAirPurifierState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Target air purifier state is " + this.purifierTargetState);
		callback(undefined, this.purifierTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.purifierTargetState = value as number;
		this.purifierTargetStateChanged();

		this.log.info("Air purifier state set to " + this.purifierTargetState);
		callback();
	  });

	this.dehumidifierService.getCharacteristic(this.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {  		
		this.willObserveModbusStatus();
		this.log.debug("Dehumidifier is " + (this.dehumidifierActive? "active" : "inactive"));
		callback(undefined, this.dehumidifierActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierActive = value as boolean;
		this.dehumidifierActivationChanged();

		this.log.info("Dehumidifier set to " + (this.dehumidifierActive? "active" : "inactive"));
		callback();
	  });
	this.dehumidifierService.getCharacteristic(this.hap.Characteristic.CurrentHumidifierDehumidifierState)
	  .updateValue(this.dehumidifierCurrentState)
	  .setProps({ validValues: [0, 1, 3] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Current dehumidifier purifier state is " + this.dehumidifierCurrentState);
		callback(undefined, this.dehumidifierCurrentState);
	  });
	this.dehumidifierService.getCharacteristic(this.hap.Characteristic.TargetHumidifierDehumidifierState)
	  .updateValue(this.dehumidifierTargetState)
	  .setProps({ validValues: [0, 2] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Target dehumidifier state is " + this.dehumidifierTargetState);
		callback(undefined, this.dehumidifierTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierTargetState = value as number;
		this.dehumidifierTargetStateChanged();

		this.log.info("Dehumidifier state set to " + this.dehumidifierTargetState);
		callback();
	  });
	this.dehumidifierService.getCharacteristic(this.hap.Characteristic.CurrentRelativeHumidity)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Dehumidifier humidity is %d%%", this.dehumidifierCurrentHumidity.toFixed(1));
		callback(undefined, this.dehumidifierCurrentHumidity);
	  });
	this.dehumidifierService.getCharacteristic(this.hap.Characteristic.RelativeHumidityDehumidifierThreshold)
	  .updateValue(this.dehumidifierHumidityThreshold)
	  .setProps({ minValue: PKOM_MIN_DEHUMID_HUMID, maxValue: PKOM_MAX_DEHUMID_HUMID, minStep: PKOM_HUMID_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Dehumidifier dehumidifying threshold is %d%%", this.dehumidifierHumidityThreshold);
		callback(undefined, this.dehumidifierHumidityThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.dehumidifierHumidityThreshold = value as number;
		this.dehumidifierThresholdChanged();
	
		this.log.info("Dehumidifier dehumidifying threshold set to %d%%", this.dehumidifierHumidityThreshold);
		callback();
	  });

	this.conditionerService.getCharacteristic(this.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {  		
		this.willObserveModbusStatus();
		this.log.debug("Air conditioner is " + (this.conditionerActive? "active" : "inactive"));
		callback(undefined, this.conditionerActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerActive = value as boolean;
		this.conditionerActivationChanged();

		this.log.info("Air conditioner set to " + (this.conditionerActive? "active" : "inactive"));
		callback();
	  });
	this.conditionerService.getCharacteristic(this.hap.Characteristic.CurrentHeaterCoolerState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Current air conditioner state is " + this.conditionerCurrentState);
		callback(undefined, this.conditionerCurrentState);
	  });
	this.conditionerService.getCharacteristic(this.hap.Characteristic.TargetHeaterCoolerState)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Target air conditioner state is " + this.conditionerTargetState);
		callback(undefined, this.conditionerTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerTargetState = value as number;
		this.conditionerTargetStateChanged();
	
		this.log.info("Air conditioner state set to " + this.conditionerTargetState);
		callback();
	  });
	this.conditionerService.getCharacteristic(this.hap.Characteristic.CurrentTemperature)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air conditioner temperature %f°C", this.conditionerCurrentTemperature.toFixed(1));
		callback(undefined, this.conditionerCurrentTemperature);
	  });
	this.conditionerService.getCharacteristic(this.hap.Characteristic.HeatingThresholdTemperature)
	  .updateValue(this.conditionerHeatingThreshold)
	  .setProps({ minValue: PKOM_MIN_HEAT_TEMP, maxValue: PKOM_MAX_HEAT_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air conditioner heating threshold is %f°C", this.conditionerHeatingThreshold);
		callback(undefined, this.conditionerHeatingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerHeatingThreshold = value as number;
		this.conditionerThresholdChanged();
	
		this.log.info("Air conditioner heating threshold set to %f°C", this.conditionerHeatingThreshold);
		callback();
	  });
	this.conditionerService.getCharacteristic(this.hap.Characteristic.CoolingThresholdTemperature)
	  .updateValue(this.conditionerCoolingThreshold)
	  .setProps({ minValue: PKOM_MIN_COOL_TEMP, maxValue: PKOM_MAX_COOL_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Air conditioner cooling threshold is %f°C", this.conditionerCoolingThreshold);
		callback(undefined, this.conditionerCoolingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.conditionerCoolingThreshold = value as number;
		this.conditionerThresholdChanged();
	
		this.log.info("Air conditioner cooling threshold set to %f°C", this.conditionerCoolingThreshold);
		callback();
	  });

	this.heaterService.getCharacteristic(this.hap.Characteristic.Active)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
		this.willObserveModbusStatus();
		this.log.debug("Water heater is " + (this.waterHeaterActive? "active" : "inactive"));
		callback(undefined, this.waterHeaterActive);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterActive = value as boolean;
  		this.waterHeaterActivationChanged();
  		
		this.log.info("Water heater set to " + (this.waterHeaterActive? "active" : "inactive"));
		callback();
	  });
	this.heaterService.getCharacteristic(this.hap.Characteristic.CurrentHeaterCoolerState)
	  .updateValue(this.waterHeaterCurrentState)
	  .setProps({ validValues: [0, 1, 2] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.log.debug("Current water heater state is " + this.waterHeaterCurrentState);
		callback(undefined, this.waterHeaterCurrentState);
	  });
	this.heaterService.getCharacteristic(this.hap.Characteristic.TargetHeaterCoolerState)
	  .updateValue(this.waterHeaterTargetState)
	  .setProps({ validValues: [1] })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.log.debug("Target water heater state is " + this.waterHeaterTargetState);
		callback(undefined, this.waterHeaterTargetState);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterTargetState = value as number;
  		this.waterHeaterTargetStateChanged();
		
		this.log.info("Water heater state set to " + this.waterHeaterTargetState);
		callback();
	  });
	this.heaterService.getCharacteristic(this.hap.Characteristic.CurrentTemperature)
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.log.debug("Water heater temperature is %f°C", this.waterHeaterCurrentTemperature.toFixed(1));
		callback(undefined, this.waterHeaterCurrentTemperature);
	  });
	// Avoid generating an exception by changing first max, then current value, then min
	this.heaterService.getCharacteristic(this.hap.Characteristic.HeatingThresholdTemperature)
	  .setProps({ maxValue:(this.pkomHasWaterResistance ? PKOM_MAX_BOILER_RESISTANCE_TEMP : PKOM_MAX_BOILER_PUMP_TEMP), minStep: PKOM_TEMP_STEP })
	  .updateValue(this.waterHeaterHeatingThreshold)
	  .setProps({ minValue: PKOM_MIN_BOILER_TEMP, minStep: PKOM_TEMP_STEP })
	  .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
		this.log.debug("Water heater threshold is %f°C", this.waterHeaterHeatingThreshold);
		callback(undefined, this.waterHeaterHeatingThreshold);
	  })
	  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		this.waterHeaterHeatingThreshold = value as number;
  		this.waterHeaterTargetStateChanged();
		
		this.log.info("Water heater threshold set to %f°C", this.waterHeaterHeatingThreshold);
		callback();
	  });

    this.holidaysModeService.getCharacteristic(this.hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
      	this.willObserveModbusStatus();
        this.log.debug("Holidays mode is " + (this.holidaysModeSwitchedOn? "on" : "off"));
        callback(undefined, this.holidaysModeSwitchedOn);
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.holidaysModeSwitchedOn = value as boolean;
		this.holidaysModeChanged();
	    
       	this.log.info("Holidays mode set to " + (this.holidaysModeSwitchedOn? "on" : "off"));
        callback();
      });
    
    // Update pre-computed characteristics    
    this.fanSpeedLevelChanged();
	this.purifierActivationChanged();
    this.didChangeModbusStatus();
    this.log.info("Accessories characteristics init done");

    this.startPollingModbusStatus();
  }
  
  identify() {
    this.log.info("Identifying Pichler PKOM4 device");
  }

  holidaysModeChanged() {
	if (this.fanSwitchedOn == this.holidaysModeSwitchedOn) {
		this.willChangeModbusStatus();
		
	  	this.fanSwitchedOn = !this.holidaysModeSwitchedOn;
	  	this.fanService.updateCharacteristic(this.hap.Characteristic.On, this.fanSwitchedOn);
	  	this.fanActivationChanged();
	  	
	  	this.fanManualMode = false;
   	 	this.didChangeModbusStatus();
  	}
  }
  
  fanActivationChanged() {
  	if (!this.fanSwitchedOn) {
	    this.willChangeModbusStatus();
  		this.fanManualMode = true;
  	
  		this.dehumidifierPreviouslyActivated = this.dehumidifierActive;
  		if (this.dehumidifierActive) {
			this.dehumidifierActive = false;
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierActivationChanged();
			this.log.info("Linked deactivation: dehumidifier stored to " + (this.dehumidifierPreviouslyActivated? "active" : "inactive"));
  		}

  		this.conditionerPreviouslyActivated = this.conditionerActive;
  		if (this.conditionerActive) {
			this.conditionerActive = false;
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerActivationChanged();
			this.log.info("Linked deactivation: conditioner stored to " + (this.conditionerPreviouslyActivated? "active" : "inactive"));
		}

  		this.purifierPreviouslyActivated = this.purifierActive;
  		if (this.purifierActive) {
			this.purifierActive = false;
			this.purifierService.updateCharacteristic(this.hap.Characteristic.Active, this.purifierActive);
			this.purifierActivationChanged();
			this.log.info("Linked deactivation: purifier stored to " + (this.purifierPreviouslyActivated? "active" : "inactive"));
		}
	  	
	  	this.didChangeModbusStatus();
	  	
  	} else if (this.fanManualMode) {
	    this.willChangeModbusStatus();
  		this.fanManualMode = false;
  		
  		if (this.dehumidifierActive != this.dehumidifierPreviouslyActivated) {
			this.dehumidifierActive = this.dehumidifierPreviouslyActivated;
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierActivationChanged();
			this.log.info("Linked deactivation: dehumidifier restored to " + (this.dehumidifierActive? "active" : "inactive"));
  		}

  		if (this.conditionerActive != this.conditionerPreviouslyActivated) {
			this.conditionerActive = this.conditionerPreviouslyActivated;
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerActivationChanged();
			this.log.info("Linked deactivation: conditioner restored to " + (this.conditionerActive? "active" : "inactive"));
  		}

  		if (this.purifierActive != this.purifierPreviouslyActivated) {
			this.purifierActive = this.purifierPreviouslyActivated;
			this.purifierService.updateCharacteristic(this.hap.Characteristic.Active, this.purifierActive);
			this.purifierActivationChanged();
			this.log.info("Linked deactivation: purifier restored to " + (this.purifierService? "active" : "inactive"));
  		}
  		
	  	this.didChangeModbusStatus();
  	}
  }
   
  fanSpeedLevelChanged() {
    this.willChangeModbusStatus();
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
    this.fanService.updateCharacteristic(this.hap.Characteristic.RotationSpeed, this.fanRotationSpeed);
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
  		this.fanService.updateCharacteristic(this.hap.Characteristic.On, this.fanSwitchedOn);
 	  	this.fanActivationChanged();
  	}

	// Adjust purifier mode
    if (this.purifierActive) {
		this.purifierCurrentState = this.hap.Characteristic.CurrentAirPurifierState.IDLE;
		this.purifierService.updateCharacteristic(this.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
    } else {
		this.purifierCurrentState = this.hap.Characteristic.CurrentAirPurifierState.INACTIVE;
		this.purifierService.updateCharacteristic(this.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
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
    
	if (this.purifierTargetState == this.hap.Characteristic.TargetAirPurifierState.MANUAL) {
		this.purifierCurrentState = this.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
		this.purifierService.updateCharacteristic(this.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);

		let timer = setTimeout(()=>{ this.purifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
		this.log.info("Air purifier started a timer");
			
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
		this.log.info("Ventilation speed back to default level");
		
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
		this.log.info("Ventilation speed increased to level %d", PKOM_PURIFIER_LEVEL);
	
		this.fanSpeedLevelChanged();
		this.didChangeModbusStatus();
    }
  }

  purifierManualModeEllapsed() {
    if (this.purifierManualMode) {
  		this.willChangeModbusStatus();
  		
      	this.purifierManualMode = false;
		this.purifierTargetState = this.hap.Characteristic.TargetAirPurifierState.AUTO;
		this.purifierService.updateCharacteristic(this.hap.Characteristic.TargetAirPurifierState, this.purifierTargetState);
		this.log.info("Air purifier timer elapsed, state is back to " + this.purifierTargetState);

		this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
		this.log.info("Ventilation speed back to default level");
	
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
  		this.fanService.updateCharacteristic(this.hap.Characteristic.On, this.fanSwitchedOn);
 	  	this.fanActivationChanged();
  	}
	
	this.didChangeModbusStatus();
  }
  
  dehumidifierTargetStateChanged() {
    this.willChangeModbusStatus();
    
	if (this.dehumidifierTargetState == this.hap.Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER) {
		let timer = setTimeout(()=>{ this.dehumidifierManualModeEllapsed(); }, MANUAL_MODE_DURATION);
		this.log.info("Dehumidifier started a timer");
		
		this.dehumidifierEnteredManualMode();
	} else {
		this.dehumidifierEnteredAutoMode();
	}

  	this.didChangeModbusStatus();
  }
  
  dehumidifierThresholdChanged() {
	this.willChangeModbusStatus();
  	this.didChangeModbusStatus();
  }

  dehumidifierEnteredAutoMode() {
  	if (this.dehumidifierManualMode) {
  		this.willChangeModbusStatus();
  		this.dehumidifierManualMode = false;
  		
  		this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
		this.log.info("Ventilation speed back to default level");
		
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
		this.log.info("Ventilation speed increased to level %d", PKOM_DEHUMID_LEVEL);
	
		this.fanSpeedLevelChanged();
		this.didChangeModbusStatus();
	}
  }

  dehumidifierManualModeEllapsed() {
    if (this.dehumidifierManualMode) {
  		this.willChangeModbusStatus();
  		
  		this.dehumidifierManualMode = false;
		this.dehumidifierTargetState = this.hap.Characteristic.TargetHumidifierDehumidifierState.AUTO;
		this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
		this.log.info("Dehumidifier timer elapsed, state is back to " + this.dehumidifierTargetState);
	
		this.fanCurrentSpeedLevel = this.fanPreviousSpeedLevel;
		this.log.info("Ventilation speed back to default level");
	
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
  		this.fanService.updateCharacteristic(this.hap.Characteristic.On, this.fanSwitchedOn);
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
			this.log.info("Modbus recurrent checking ongoing…");
		
			// Load new register values
			await this.loadModbusStatus(this.simulate);		
			if (this.simulate) {
				// Persist updated attributes using session registers
				this.iterateSimulation();
				await this.saveModbusStatus(true);
			}

			// Update implied characteristics
			this.fanService.updateCharacteristic(this.hap.Characteristic.On, this.fanSwitchedOn);
			this.fanService.updateCharacteristic(this.hap.Characteristic.RotationSpeed, this.fanRotationSpeed);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.Active, this.conditionerActive);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.CurrentHeaterCoolerState, this.conditionerCurrentState);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.TargetHeaterCoolerState, this.conditionerTargetState);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.CurrentTemperature, this.conditionerCurrentTemperature);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.HeatingThresholdTemperature, this.conditionerHeatingThreshold);
			this.conditionerService.updateCharacteristic(this.hap.Characteristic.CoolingThresholdTemperature, this.conditionerCoolingThreshold);
			this.purifierService.updateCharacteristic(this.hap.Characteristic.Active, this.purifierActive);
			this.purifierService.updateCharacteristic(this.hap.Characteristic.CurrentAirPurifierState, this.purifierCurrentState);
			this.purifierService.updateCharacteristic(this.hap.Characteristic.TargetAirPurifierState, this.purifierTargetState);
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.Active, this.dehumidifierActive);
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.CurrentHumidifierDehumidifierState, this.dehumidifierCurrentState);
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.TargetHumidifierDehumidifierState, this.dehumidifierTargetState);
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.CurrentRelativeHumidity, this.dehumidifierCurrentHumidity);
			this.dehumidifierService.updateCharacteristic(this.hap.Characteristic.RelativeHumidityDehumidifierThreshold, this.dehumidifierHumidityThreshold);
			this.heaterService.updateCharacteristic(this.hap.Characteristic.Active, this.waterHeaterActive);
			this.heaterService.updateCharacteristic(this.hap.Characteristic.CurrentHeaterCoolerState, this.waterHeaterCurrentState);
			this.heaterService.updateCharacteristic(this.hap.Characteristic.TargetHeaterCoolerState, this.waterHeaterTargetState);
			this.heaterService.updateCharacteristic(this.hap.Characteristic.CurrentTemperature, this.waterHeaterCurrentTemperature);
			this.heaterService.updateCharacteristic(this.hap.Characteristic.HeatingThresholdTemperature, this.waterHeaterHeatingThreshold);
			this.sensorService.updateCharacteristic(this.hap.Characteristic.AirQuality, this.purifierAirQuality);
			this.sensorService.updateCharacteristic(this.hap.Characteristic.CarbonDioxideLevel, this.purifierDioxideLevel);
		
			this.log.info("Modbus recurrent checking done");
		})();
	}, MODBUS_POLLING_PERIOD);
	this.log.info("Modbus recurrent checking is on");
  }

  willObserveModbusStatus() {
  	// No need for sync update, we're simply accelerating refresh rate
  	// Update timestamp before async call to avoid massive parallel updates
    if ((Date.now() - this.modbusLoadTimestamp) > MODBUS_INTERACTIVE_UPDATE_PERIOD) {
		this.log.info("Modbus interactive checking ongoing…");
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
	await this.session.begin();
  	if (!keepSession) {
		await this.session.end();
  	}
  	
	this.log.debug("End of async modbus %s", (keepSession ? "call" : "calls"));

  	// Readwrite register are persisted by session under simulation mode
	this.pkomMode = this.session.readRegister(MODBUS_ADDR_MODE);
	this.pkomSpeedLevel = this.session.readRegister(MODBUS_ADDR_SPEED_LEVEL);
	this.pkomAutoSpeedLevel = this.session.readRegister(MODBUS_ADDR_AUTO_SPEED_LEVEL);
	this.purifierDioxideThreshold = this.session.readRegister(MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD);
	this.dehumidifierHumidityThreshold = this.session.readRegister(MODBUS_ADDR_MAX_HUMID_THRESHOLD);
	this.conditionerHeatingThreshold = this.session.readRegister(MODBUS_ADDR_HEAT_THRESHOLD);
	this.conditionerCoolingThreshold = this.session.readRegister(MODBUS_ADDR_COOL_THRESHOLD);
	this.waterHeaterHeatingThreshold = this.session.readRegister(MODBUS_ADDR_MIN_BOILER_THRESHOLD);
	this.pkomFilterDuration = this.session.readRegister(MODBUS_ADDR_FILTER_DURATION);
	this.pkomSerialNumber = this.session.readRegister(MODBUS_ADDR_SERIAL_NUMBER);
	this.pkomFirwmareVersion = this.session.readRegister(MODBUS_ADDR_FIRMWARE_VERSION);
  	  	
  	// Those readonly registers are skipped to ensure persistance under simulation mode
  	if (!this.simulate || !this.inited) {
		this.pkomCurrentlyCooling = this.session.readRegister(MODBUS_ADDR_COOLING);
		this.pkomCurrentlyHeating = this.session.readRegister(MODBUS_ADDR_HEATING);
		this.pkomCurrentlyWaterHeating = this.session.readRegister(MODBUS_ADDR_BOILER_HEATING);
		this.purifierDioxideLevel = this.session.readRegister(MODBUS_ADDR_AIR_DIOXIDE);
		this.dehumidifierCurrentHumidity = this.session.readRegister(MODBUS_ADDR_AIR_HUMID);
		this.conditionerCurrentTemperature = this.session.readRegister(MODBUS_ADDR_AIR_TEMP);
		this.waterHeaterCurrentTemperature = this.session.readRegister(MODBUS_ADDR_BOILER_TEMP);
  	}

	let coolEnabled = this.session.readRegister(MODBUS_ADDR_COOL_ENABLED);
  	let dehumidifierActive = this.session.readRegister(MODBUS_ADDR_HUMID_ENABLED);
  	let purifierActive = this.session.readRegister(MODBUS_ADDR_DIOXIDE_ENABLED);
	let boilerEnergy = this.session.readRegister(MODBUS_ADDR_BOILER_ENERGY);
	let sensorType = this.session.readRegister(MODBUS_ADDR_HARDWARE_SENSORS);
	let options = this.session.readRegister(MODBUS_ADDR_HARDWARE_OPTIONS);
  	
	// Following status are computed
	this.fanCurrentSpeedLevel = (this.pkomSpeedLevel != PKOM_SPEED_LEVEL_AUTO ? this.pkomSpeedLevel - 1 : this.pkomAutoSpeedLevel - 1);
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
	this.filterChangeAlert = (this.pkomFilterDuration > PKOM_FILTER_DURATION_ALERT);
	this.filterLifeLevel = Math.round(this.pkomFilterDuration / PKOM_FILTER_MAX_DURATION * 100.0);
	this.waterHeaterActive = this.pkomCurrentlyWaterHeating;
	
	let currentConditionerStatus = this.hap.Characteristic.CurrentHeaterCoolerState.IDLE;
	if (this.pkomCurrentlyCooling) {
		currentConditionerStatus = this.hap.Characteristic.CurrentHeaterCoolerState.COOLING;
	} else if (this.pkomCurrentlyHeating) {
		currentConditionerStatus = this.hap.Characteristic.CurrentHeaterCoolerState.HEATING;
	}

	// Adjust current status based on internal manual mode
	let currentPurifierStatus = (this.purifierManualMode ? this.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR : this.hap.Characteristic.CurrentAirPurifierState.IDLE);
	let currentHumidifierStatus = (this.dehumidifierManualMode ? this.hap.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING : this.hap.Characteristic.CurrentHumidifierDehumidifierState.IDLE);
	let currentWaterHeaterStatus = (this.pkomCurrentlyWaterHeating ? this.hap.Characteristic.CurrentHeaterCoolerState.HEATING : this.hap.Characteristic.CurrentHeaterCoolerState.IDLE);
	
	// Adjust current status based on PKOM automatic behaviour
	if (this.pkomSpeedLevel >= PKOM_DEHUMID_LEVEL && this.dehumidifierCurrentHumidity > this.dehumidifierHumidityThreshold) {
		currentPurifierStatus = this.hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
	} else if (this.pkomSpeedLevel >= PKOM_PURIFIER_LEVEL && this.purifierDioxideLevel > this.purifierDioxideThreshold) {
		currentHumidifierStatus = this.hap.Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING;
	} 

  	switch (this.pkomMode) {
  		case PKOM_MODE_OFF:
	  		this.fanSwitchedOn = false;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_SUMMER:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = coolEnabled;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.COOL;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_WINTER:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = true;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_AUTO:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = true;
	  		this.conditionerCurrentState = currentConditionerStatus;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_HOLIDAYS:
	  		this.fanSwitchedOn = true;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
  		case PKOM_MODE_BOILER:
	  		this.fanSwitchedOn = false;
	  		this.conditionerActive = false;
	  		this.conditionerCurrentState = this.hap.Characteristic.CurrentHeaterCoolerState.INACTIVE;
			this.conditionerTargetState = this.hap.Characteristic.TargetHeaterCoolerState.AUTO;
			this.waterHeaterCurrentState = currentWaterHeaterStatus;
  			this.waterHeaterTargetState = this.hap.Characteristic.TargetHeaterCoolerState.HEAT;
	  		break;
	  		
	  	default:
	  		this.log.info("Unknown device mode - behaviour might be erratic");
	  		break;
  	}
  	
  	// Purifier & dehumidifier status depends on fan mode
  	this.purifierActive = (this.fanSwitchedOn && purifierActive);
	this.purifierCurrentState = (this.fanSwitchedOn ? currentPurifierStatus : this.hap.Characteristic.CurrentAirPurifierState.INACTIVE);
  	this.purifierTargetState = this.hap.Characteristic.TargetAirPurifierState.AUTO;
	this.dehumidifierActive = (this.fanSwitchedOn && dehumidifierActive);
	this.dehumidifierCurrentState = (this.fanSwitchedOn ? currentHumidifierStatus : this.hap.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE);
  	this.dehumidifierTargetState = this.hap.Characteristic.TargetHumidifierDehumidifierState.AUTO;

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
		case 2:
			this.pkomHasWaterResistance = true;
			this.pkomHasAirResistance = false;
			break;
		case 3:
			this.pkomHasWaterResistance = false;
			this.pkomHasAirResistance = true;
			break;
		case 4:
			this.pkomHasWaterResistance = true;
			this.pkomHasAirResistance = true;
			break;
	}
	
	// Update air quality status
  	this.purifierDioxideChanged();
  	this.modbusLoadTimestamp = Date.now();
  	this.inited = true;
	
	this.log.info("Modbus status loaded (total duration %d ms)", Date.now() - startTime);
  }

  async saveModbusStatus(keepSession = false) {
	if (this.modbusPendingSave) return;
	  
	// Load all registers
	let startTime = Date.now();
  	this.modbusPendingSave = true;
	if (!keepSession) {
  		await this.session.begin();
		this.log.debug("End of async modbus call");
	}
	
	// Save readwrite registers
  	this.session.writeRegister(MODBUS_ADDR_HEAT_THRESHOLD, this.conditionerHeatingThreshold);
   	this.session.writeRegister(MODBUS_ADDR_COOL_THRESHOLD, this.conditionerCoolingThreshold);
   	this.session.writeRegister(MODBUS_ADDR_MAX_HUMID_THRESHOLD, this.dehumidifierHumidityThreshold);
  	this.session.writeRegister(MODBUS_ADDR_MIN_BOILER_THRESHOLD, this.waterHeaterHeatingThreshold);

  	let pkomSpeedLevel = (this.simulate || this.purifierManualMode || this.dehumidifierManualMode) ? this.fanCurrentSpeedLevel + 1 : PKOM_SPEED_LEVEL_AUTO;
	let pkomMode = PKOM_MODE_AUTO;
	
	if (this.holidaysModeSwitchedOn) {
 		pkomMode = PKOM_MODE_HOLIDAYS;
	} else if (!this.fanSwitchedOn && !this.conditionerActive) {
	  	pkomMode = PKOM_MODE_BOILER;
 	} else if (this.fanSwitchedOn && !this.conditionerActive) {
		pkomMode = PKOM_MODE_SUMMER;
	} else if (this.fanSwitchedOn && this.conditionerActive && this.conditionerTargetState == this.hap.Characteristic.TargetHeaterCoolerState.HEAT) {
		pkomMode = PKOM_MODE_WINTER;
	} else if (this.fanSwitchedOn && this.conditionerActive && this.conditionerTargetState == this.hap.Characteristic.TargetHeaterCoolerState.COOL) {
		pkomMode = PKOM_MODE_SUMMER;
 	}
	
 	this.session.writeRegister(MODBUS_ADDR_SPEED_LEVEL, pkomSpeedLevel);
 	this.session.writeRegister(MODBUS_ADDR_MODE, pkomMode);
  	this.session.writeRegister(MODBUS_ADDR_COOL_ENABLED, this.conditionerActive);
  	this.session.writeRegister(MODBUS_ADDR_HUMID_ENABLED, this.dehumidifierActive);
  	this.session.writeRegister(MODBUS_ADDR_DIOXIDE_ENABLED, this.purifierActive);
  	this.session.writeRegister(MODBUS_ADDR_BOILER_HEATING, this.waterHeaterActive);
  	
	// Send modified registers
  	await this.session.end();
  	this.modbusPendingSave = false;
  	
	this.log.debug("End of async modbus call");
	this.log.info("Modbus status saved (total duration %d ms)", Date.now() - startTime);
  }
  
  iterateSimulation() {
    let dioxideIncrement = 0;
    let humidityIncrement = 0;
    let increaseRate = Math.max((PKOM_MIN_DEHUMID_HUMID - this.dehumidifierCurrentHumidity) / 100.0, 0.1) ** 2;
    let decreaseRate = Math.max((this.dehumidifierCurrentHumidity - PKOM_MIN_HUMID_HUMID) / 100.0, 0.1) ** 2;
	this.pkomSpeedLevel = this.fanCurrentSpeedLevel + 1;
    
	if (this.fanSwitchedOn) {
		switch (this.pkomSpeedLevel) {
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
	this.log.info("Simulation - air quality modulating (∆h:%d, ∆d:%d)", humidityIncrement, dioxideIncrement);

	if (this.purifierActive && this.purifierDioxideLevel > this.purifierDioxideThreshold && this.pkomSpeedLevel < PKOM_PURIFIER_LEVEL) {
		this.pkomSpeedLevel = PKOM_PURIFIER_LEVEL;
		this.log.info("Simulation - starting purifying speed increase");
	} else if (this.dehumidifierActive && this.dehumidifierCurrentHumidity > this.dehumidifierHumidityThreshold && this.pkomSpeedLevel < PKOM_DEHUMID_LEVEL) {
		this.pkomSpeedLevel = PKOM_DEHUMID_LEVEL;
		this.log.info("Simulation - starting dehumidifying speed increase");
	} else if (this.dehumidifierActive && this.dehumidifierCurrentHumidity < PKOM_MIN_HUMID_HUMID && this.pkomSpeedLevel > PKOM_HUMID_LEVEL) {
		this.pkomSpeedLevel = PKOM_HUMID_LEVEL;
		this.log.info("Simulation - starting humidifying speed decrease");
	} else if (this.pkomSpeedLevel == PKOM_PURIFIER_LEVEL && !this.fanManualMode && !this.dehumidifierManualMode && !this.purifierManualMode
			&& (!this.purifierActive || this.purifierDioxideLevel <= (this.purifierDioxideThreshold - PKOM_PURIFIER_HYSTERESIS))) {
		this.pkomSpeedLevel = PKOM_SPEED_LEVEL_NORMAL;
		this.log.info("Simulation - back to normal speed");
	} else if (this.pkomSpeedLevel == PKOM_DEHUMID_LEVEL && !this.fanManualMode && !this.dehumidifierManualMode && !this.purifierManualMode
			&& (!this.dehumidifierActive || this.dehumidifierCurrentHumidity <= (this.dehumidifierHumidityThreshold - PKOM_DEHUMID_HYSTERESIS))
			&& (!this.dehumidifierActive || this.dehumidifierCurrentHumidity >= (PKOM_MIN_HUMID_HUMID + PKOM_DEHUMID_HYSTERESIS))) {
		this.pkomSpeedLevel = PKOM_SPEED_LEVEL_NORMAL;
		this.log.info("Simulation - back to normal speed");
	} else {
		this.log.debug("Simulation - humid:%d of %d%%, diox:%d of %d ppm, fan:%s, dehumid:%s, purif:%s", this.dehumidifierCurrentHumidity.toFixed(2), this.dehumidifierHumidityThreshold, this.purifierDioxideLevel, this.purifierDioxideThreshold, (this.fanManualMode ? "manual" : "auto"), (this.dehumidifierManualMode ? "manual" : "auto"), (this.purifierManualMode ? "manual" : "auto"));
	}

    this.pkomCurrentlyWaterHeating = this.waterHeaterActive;
	if (this.pkomCurrentlyWaterHeating) {
		this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature + 0.5;
		if (this.waterHeaterCurrentTemperature >= this.waterHeaterHeatingThreshold) {
			this.pkomCurrentlyWaterHeating = false;
			this.log.info("Simulation - stoping water heating");
		} else {
			this.log.debug("Simulation - water:%d of %d°C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
		}
	} else {
		this.waterHeaterCurrentTemperature = this.waterHeaterCurrentTemperature - 0.1;
		if (this.waterHeaterCurrentTemperature <= PKOM_MIN_BOILER_TEMP) {
			this.pkomCurrentlyWaterHeating = true;
			this.log.info("Simulation - starting water heating");
		} else {
			this.log.debug("Simulation - water:%d of %d°C", this.waterHeaterCurrentTemperature.toFixed(2), this.waterHeaterHeatingThreshold);
		}
	}
	
	if (!this.pkomCurrentlyHeating && this.conditionerCurrentTemperature < this.conditionerHeatingThreshold) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = true;
		this.log.info("Simulation - starting air heating");
	} else if (!this.pkomCurrentlyCooling && this.conditionerCurrentTemperature > this.conditionerCoolingThreshold) {
		this.pkomCurrentlyCooling = true;
		this.pkomCurrentlyHeating = false;
		this.log.info("Simulation - starting air cooling");
	} else if (this.pkomCurrentlyHeating && this.conditionerCurrentTemperature <= this.conditionerCoolingThreshold && this.conditionerCurrentTemperature >= this.conditionerHeatingThreshold) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = false;
		this.log.info("Simulation - stoping air heating");
	} else if (this.pkomCurrentlyCooling && this.conditionerCurrentTemperature <= this.conditionerCoolingThreshold && this.conditionerCurrentTemperature >= this.conditionerHeatingThreshold) {
		this.pkomCurrentlyCooling = false;
		this.pkomCurrentlyHeating = false;
		this.log.info("Simulation - stoping air cooling");
	}

	this.fanCurrentSpeedLevel = this.pkomSpeedLevel - 1;
    this.fanRotationSpeed = this.fanRotationScale[this.fanCurrentSpeedLevel];
  }

  getServices(): Service[] {
  	if (this.pkomHasWaterHeater && this.pkomHasDioxideSensor && this.pkomHasHumiditySensor) {
		return [
		  this.informationService,
		  this.fanService,
		  this.filterService,
		  this.sensorService,
		  this.purifierService,
		  this.dehumidifierService,
		  this.conditionerService,
		  this.heaterService
		];
	} else if (this.pkomHasWaterHeater && this.pkomHasDioxideSensor) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.filterService,
		  this.purifierService,
		  this.conditionerService,
		  this.heaterService
		];
    } else if (this.pkomHasWaterHeater && this.pkomHasHumiditySensor) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.sensorService,
		  this.dehumidifierService,
		  this.conditionerService,
		  this.heaterService
		];
    } else if (this.pkomHasWaterHeater) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.conditionerService,
		  this.heaterService
		];
    } else if (this.pkomHasDioxideSensor && this.pkomHasHumiditySensor) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.filterService,
		  this.sensorService,
		  this.purifierService,
		  this.dehumidifierService,
		  this.conditionerService
		];
    } else if (this.pkomHasDioxideSensor) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.filterService,
		  this.purifierService,
		  this.conditionerService
		];
    } else if (this.pkomHasHumiditySensor) {
    	return [
		  this.informationService,
		  this.fanService,
		  this.sensorService,
		  this.dehumidifierService,
		  this.conditionerService
		];
    } else {
    	return [
		  this.informationService,
		  this.fanService,
		  this.conditionerService
		];
    }
  }
}
