import { Logging } from "homebridge";

export const MODBUS_ADDR_MODE = 0;					// ENUM, RW
export const MODBUS_ADDR_COOLING = 37;				// INT, RO (W)
export const MODBUS_ADDR_USER_SPEED_LEVEL = 46;		// ENUM, RW
export const MODBUS_ADDR_AUTO_SPEED_LEVEL = 58;		// ENUM, RW
export const MODBUS_ADDR_ACTUAL_SPEED_LEVEL = 191;	// ENUM, RO	- see also 194
export const MODBUS_ADDR_HEATING = 37;				// INT, RO (W)
export const MODBUS_ADDR_ECO_TIME = 137;			// BOOL, RW
export const MODBUS_ADDR_COOL_ENABLED = 9;			// INT, RW (No, Yes, Eco)
export const MODBUS_ADDR_HEAT_ENABLED = 56;			// BOOL, RW
export const MODBUS_ADDR_HUMID_ENABLED = 75;		// BOOL, RW
export const MODBUS_ADDR_DIOXIDE_ENABLED = 71;		// BOOL, RW
export const MODBUS_ADDR_NORMAL_THRESHOLD = 10;		// FIXED, RW
export const MODBUS_ADDR_ECO_THRESHOLD = 11;		// FIXED, RW
export const MODBUS_ADDR_HEAT_THRESHOLD = 201;		// FIXED, RW
export const MODBUS_ADDR_COOL_THRESHOLD = 19;		// FIXED, RW
export const MODBUS_ADDR_MAX_HUMID_THRESHOLD = 102;	// FIXED, RW
export const MODBUS_ADDR_MIN_HUMID_THRESHOLD = 103;	// FIXED, RW
export const MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD = 101;// INT, RW
export const MODBUS_ADDR_MIN_BOILER_THRESHOLD = 129;// FIXED, RW
export const MODBUS_ADDR_AIR_DIOXIDE = 483;			// INT, RO
export const MODBUS_ADDR_AIR_HUMID = 484;			// FIXED, RO
export const MODBUS_ADDR_AIR_TEMP = 1019;			// FIXED, RO
export const MODBUS_ADDR_BOILER_ENABLED = 136;		// BOOL, RW
export const MODBUS_ADDR_BOILER_TEMP = 162;			// FIXED, RO
export const MODBUS_ADDR_BOILER_ENERGY = 38;		// INT, RO (kWh)
export const MODBUS_ADDR_BOILER_HEATING = 30;		// INT, RO (Remaining time) - see also 24 (W)
export const MODBUS_ADDR_BYPASS_STATE = 205;		// INT, RO
export const MODBUS_ADDR_FILTER_ELAPSED_TIME = 315;	// INT, RW
export const MODBUS_ADDR_SERIAL_NUMBER = 1006;		// STRING, RO
export const MODBUS_ADDR_FIRMWARE_VERSION = 36;		// FIXED, RO
export const MODBUS_ADDR_HARDWARE_OPTIONS = 149;	// INT, RO (Temp sensor, Heat resistance)
export const MODBUS_ADDR_HARDWARE_SENSORS = 16;		// INT, RW (CO2 & Hum sensors)

const MODBUS_FLOAT_EPSILON = 0.01;	// Maximal precision being 2 digits, ignore lower value delta

const PKOM_DEMO_MODE = 3;
const PKOM_DEMO_SPEED_LEVEL = 2;
const PKOM_DEMO_BOILER_TEMP = 47.0;
const PKOM_DEMO_BOILER_THRESHOLD = 55.0;
const PKOM_DEMO_COOL_TEMP = 26.0;
const PKOM_DEMO_HEAT_TEMP = 22.0;
const PKOM_DEMO_AIR_HUMID = 65.0;
const PKOM_DEMO_AIR_TEMP = 25.0;
const PKOM_DEMO_AIR_DIOXIDE = 851.0;
const PKOM_DEMO_DIOXIDE_THRESHOLD = 1000.0;
const PKOM_DEMO_HUMID_THRESHOLD = 70.0;
const PKOM_DEMO_FILTER_DURATION = 2208.0;	// 8 days remaining (over 2400 hours)
const PKOM_DEMO_BOILER_ENERGY = 1;
const PKOM_DEMO_SENSORS = 3;
const PKOM_DEMO_OPTIONS = 4;

const PKOM4_DEMO_SERIAL_NUMBER = "F220100001";
const PKOM4_DEMO_FIRMWARE_VERSION = "1.0";

const scriptsFolder = (__dirname + "/../scripts");
const pythonRelativePath = "bin/python3";
const shPath = "/bin/sh";
const { spawn } = require('child_process');

export class ModbusSession {
  private registersValue: Record<number, any>;
  private registersCache: Record<number, any>;
  private registersModified: Record<number, boolean>;
  private readonly registersAddress: Array<number>;
  private readonly registersIsDecimal: Array<boolean>;
  private readonly readOnly: boolean;
  private readonly demoMode: boolean;
  private readonly debugLevel: number;
  private readonly log: Logging;
  private pythonVirtualEnv: string;
  private installed: boolean;
  public  ongoing: boolean;

  constructor(log: Logging, readOnly: boolean, demoMode: boolean, debugLevel: number) {
  	this.log = log;
  	this.readOnly = readOnly;
  	this.demoMode = demoMode;
  	this.debugLevel = debugLevel;
	this.ongoing = false;
	this.installed = false;
	this.pythonVirtualEnv = "";
	
	this.registersCache = {};
	this.registersValue = {};
	this.registersModified = {};
	this.registersAddress = [
  		MODBUS_ADDR_MODE,
  		MODBUS_ADDR_COOLING,
  		MODBUS_ADDR_USER_SPEED_LEVEL,
  		MODBUS_ADDR_AUTO_SPEED_LEVEL,
  		MODBUS_ADDR_ACTUAL_SPEED_LEVEL,
  		MODBUS_ADDR_HEATING,
  		MODBUS_ADDR_ECO_TIME,
  		MODBUS_ADDR_COOL_ENABLED,
  		MODBUS_ADDR_HEAT_ENABLED,
  		MODBUS_ADDR_HUMID_ENABLED,
  		MODBUS_ADDR_DIOXIDE_ENABLED,
  		MODBUS_ADDR_NORMAL_THRESHOLD,
  		MODBUS_ADDR_ECO_THRESHOLD,
  		MODBUS_ADDR_HEAT_THRESHOLD,
  		MODBUS_ADDR_COOL_THRESHOLD,
  		MODBUS_ADDR_MAX_HUMID_THRESHOLD,
  		MODBUS_ADDR_MIN_HUMID_THRESHOLD,
  		MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD,
  		MODBUS_ADDR_MIN_BOILER_THRESHOLD,
  		MODBUS_ADDR_AIR_DIOXIDE,
  		MODBUS_ADDR_AIR_HUMID,
  		MODBUS_ADDR_AIR_TEMP,
  		MODBUS_ADDR_BOILER_ENABLED,
  		MODBUS_ADDR_BOILER_TEMP,
  		MODBUS_ADDR_BOILER_ENERGY,
  		MODBUS_ADDR_BOILER_HEATING,
  		MODBUS_ADDR_BYPASS_STATE,
  		MODBUS_ADDR_FILTER_ELAPSED_TIME,
  		MODBUS_ADDR_SERIAL_NUMBER,
		MODBUS_ADDR_FIRMWARE_VERSION,
  		MODBUS_ADDR_HARDWARE_OPTIONS,
  		MODBUS_ADDR_HARDWARE_SENSORS
	];
	this.registersIsDecimal = [
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		false,
  		true,
  		true,
  		true,
  		true,
  		true,
  		true,
  		false,
  		true,
  		false,
  		true,
  		true,
  		false,
  		true,
  		false,
  		false,
  		false,
  		false,
  		false,
		false,
  		false,
  		false
	];
	
	this.initToDefaults(this.demoMode);
	this.log.info("Modbus session created with log level: %d", debugLevel);
  }
  
  initToDefaults(demoMode: boolean) {
  	// Some register always init to demo values to avoid conflicts with min/max range
  	this.registersValue[MODBUS_ADDR_FIRMWARE_VERSION] = PKOM4_DEMO_FIRMWARE_VERSION;
  	this.registersValue[MODBUS_ADDR_SERIAL_NUMBER] = (demoMode ? PKOM4_DEMO_SERIAL_NUMBER : "--------");
  	this.registersValue[MODBUS_ADDR_COOLING] = false;
  	this.registersValue[MODBUS_ADDR_HEATING] = false;
    this.registersValue[MODBUS_ADDR_ECO_TIME] = 0;
  	this.registersValue[MODBUS_ADDR_BOILER_HEATING] = false;
  	this.registersValue[MODBUS_ADDR_BYPASS_STATE] = 0;
  	this.registersValue[MODBUS_ADDR_COOL_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_HUMID_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_DIOXIDE_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_MODE] = (demoMode ? PKOM_DEMO_MODE : 0);
  	this.registersValue[MODBUS_ADDR_USER_SPEED_LEVEL] = PKOM_DEMO_SPEED_LEVEL;
  	this.registersValue[MODBUS_ADDR_AUTO_SPEED_LEVEL] = PKOM_DEMO_SPEED_LEVEL;
  	this.registersValue[MODBUS_ADDR_ACTUAL_SPEED_LEVEL] = PKOM_DEMO_SPEED_LEVEL;
  	this.registersValue[MODBUS_ADDR_AIR_DIOXIDE] = (demoMode ? PKOM_DEMO_AIR_DIOXIDE : 0.0);
  	this.registersValue[MODBUS_ADDR_MAX_DIOXIDE_THRESHOLD] = (demoMode ? PKOM_DEMO_DIOXIDE_THRESHOLD : 0.0);
  	this.registersValue[MODBUS_ADDR_MAX_HUMID_THRESHOLD] = PKOM_DEMO_HUMID_THRESHOLD;
  	this.registersValue[MODBUS_ADDR_AIR_HUMID] = (demoMode ? PKOM_DEMO_AIR_HUMID : 0.0);
  	this.registersValue[MODBUS_ADDR_AIR_TEMP] = (demoMode ? PKOM_DEMO_AIR_TEMP : 0.0);
  	this.registersValue[MODBUS_ADDR_NORMAL_THRESHOLD] = PKOM_DEMO_HEAT_TEMP;
  	this.registersValue[MODBUS_ADDR_ECO_THRESHOLD] = PKOM_DEMO_HEAT_TEMP;
  	this.registersValue[MODBUS_ADDR_HEAT_THRESHOLD] = PKOM_DEMO_HEAT_TEMP;
  	this.registersValue[MODBUS_ADDR_COOL_THRESHOLD] = PKOM_DEMO_COOL_TEMP;
  	this.registersValue[MODBUS_ADDR_BOILER_ENABLED] = demoMode;
  	this.registersValue[MODBUS_ADDR_BOILER_TEMP] = (demoMode ? PKOM_DEMO_BOILER_TEMP : 0.0);
  	this.registersValue[MODBUS_ADDR_MIN_BOILER_THRESHOLD] = PKOM_DEMO_BOILER_THRESHOLD;
  	this.registersValue[MODBUS_ADDR_FILTER_ELAPSED_TIME] = (demoMode ? PKOM_DEMO_FILTER_DURATION : 0);
  	this.registersValue[MODBUS_ADDR_BOILER_ENERGY] = (demoMode ? PKOM_DEMO_BOILER_ENERGY : 0);
  	this.registersValue[MODBUS_ADDR_HARDWARE_SENSORS] = (demoMode ? PKOM_DEMO_SENSORS : 0);
  	this.registersValue[MODBUS_ADDR_HARDWARE_OPTIONS] = (demoMode ? PKOM_DEMO_OPTIONS : 0);
  }

  async install(destination: string): Promise<any> {	
	this.log.info("Installing modbus module in homebridge storage zone");

	// Empty destination means default (plugin) location 
	if (destination != "") {
	 	this.pythonVirtualEnv = destination;
	} else {
	 	this.pythonVirtualEnv = scriptsFolder;
	}

	// Use Schell command to create python virtual env & install modbus module
	let promise = await this.callSchellScript("install.sh", this.pythonVirtualEnv)
		.then(() => {		
		 	this.installed = true;
		 	if (this.debugLevel > 1) {
	   			this.log.debug("Modbus module installed successfully into %s", this.pythonVirtualEnv);
     		}
		})
		.catch((error: Error) => {
			this.log.info("Error installing modbus module %s", error.message);
		});
 	
  	return promise;
  }

  async begin(): Promise<any> {
  	if (this.ongoing) throw 'Session error: begin/end calls are unbalanced';
    if (!this.installed) throw 'Session error: modbus module is not yet ready';

	this.ongoing = true;
  	
	for (let address of this.registersAddress) {
		this.registersModified[address] = false;
	}
	
	this.log.info("Async modbus 'get registers' called");
	
	// Use Python command to read registers. This will loose any previous change
	// that was not sent. It will also behave as a slave considering any concurent change
	// that occurred. From that point, and until end() call will turn into a master
	// for pending changes (will overwrite concurent changes).
	let promise = await this.callPython(this.pythonVirtualEnv, "modbus.py", "get", this.registersValue)
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
    if (!this.installed) throw 'Session error: modbus module is not yet ready';
   
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
	let promise = await this.callPython(this.pythonVirtualEnv, "modbus.py", "set", this.registersCache)
		.catch((error: Error) => {
			this.log.info("Error setting modbus registers %s", error.message);
		});
 	
  	return promise;
  }

  async callSchellScript(scriptName: string, param: string): Promise<any> {
  	return new Promise(function(successCallback, failureCallback) {
		try {
			const shArgs = [(scriptsFolder + "/" + scriptName), param];
			const shProcess = spawn(shPath, shArgs);
			let errorMsg = "";
	
			shProcess.stderr.on('data', (data: any) => {
				errorMsg += data.toString();
			});

			shProcess.stdout.on("end", () => {
				if (errorMsg == "") {				
					successCallback("");
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

  async callPython(virtualEnv: string, scriptName: string, verb: string, param?: any): Promise<any> {
	return new Promise(function(successCallback, failureCallback) {
		try {
			const pyArgs = [(scriptsFolder + "/" + scriptName), verb, JSON.stringify(param)];
			const pythonPath = (virtualEnv + "/" + pythonRelativePath);
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
  	//	The only caution point is about local caches such as time-bombed manual modes.
	if (Math.abs(this.registersValue[address] - value) > MODBUS_FLOAT_EPSILON) {
   		this.registersValue[address] = value;
    	this.registersModified[address] = true;
    	if (this.registersIsDecimal[address] && this.debugLevel > 0) {
  			this.log.debug("Modified modbus registers to %f (#%d)", value, address);
  		} else if (this.debugLevel > 0) {
  			this.log.debug("Modified modbus registers to %d (#%d)", value, address);
  		}
	} else if (this.registersIsDecimal[address] && this.debugLevel > 0) {
  		this.log.debug("Ignored modbus registers change from %f to %f (#%d)", this.registersValue[address], value, address);
	} else if (this.debugLevel > 0) {
  		this.log.debug("Ignored modbus registers change from %d to %d (#%d)", this.registersValue[address], value, address);
	}
  }
  
  readRegister(address: number): any {
    if (this.debugLevel > 1 && address != MODBUS_ADDR_SERIAL_NUMBER) {
		this.log.debug("Reading modbus register %d:%d", address, this.registersValue[address]);
	}
	return this.registersValue[address];
  }
}
