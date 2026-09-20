import { API, Logging, PlatformConfig, DynamicPlatformPlugin, PlatformAccessory, MatterAccessory } from "homebridge";
import { PKOM4HapAccessory } from "./pkom4-hap-accessory.js";
import { PKOM4MatterAccessory } from "./pkom4-matter-accessory.js";
import { PKOM_PLATFORM_NAME, PKOM_PLUGIN_NAME, PKOM_PLUGIN_VERSION, PKOM_MANUFACTURER_NAME } from "./settings.js";
import { PKOM_ACCESSORY_UUID, PKOM_ACCESSORY_TYPE, PKOM_ACCESSORY_NAME, PKOM_GENERIC_SERIAL } from "./settings.js";
import { ModbusSession } from "./modbus.js";

export class PichlerPlatform implements DynamicPlatformPlugin {

	public readonly api: API;
	public readonly log: Logging;
	public readonly config: PlatformConfig;
	private readonly session: ModbusSession;
	private cachedAccessory?: PlatformAccessory;
	private cachedMatterAccessory?: MatterAccessory;
	private pkomHapAccessory?: PKOM4HapAccessory;
	private pkomMatterAccessory?: PKOM4MatterAccessory;
	
	constructor(log: Logging, config: PlatformConfig, api: API) {
		this.log = log;
		this.config = config;
		this.api = api;

		this.log.info("Copyright © 2022/2026 by J. Tarantino, released under EUPL license");
		this.session = new ModbusSession(log, config.readOnly, config.simulate, config.modbusDebugLevel);
		
		if (!this.log.success) {
			this.log.success = log.info;
		}
		
		// When this event is fired it means Homebridge has restored all cached accessories from disk.
		// Dynamic Platform plugins should only register new accessories after this event was fired,
		// in order to ensure they weren't added to homebridge already. This event can also be used
		// to start discovery of new accessories.
		this.api.on('didFinishLaunching', () => {
			this.discoverDevices();
		});
	}
	
	configureAccessory(accessory: PlatformAccessory) {
		this.cachedAccessory = accessory;
	}
	
	configureMatterAccessory(accessory: MatterAccessory) {
		this.cachedMatterAccessory = accessory;
	}
	
	async discoverDevices() {
		// Install modbus module for device communication
		await this.session.install("");

		this.log.info("");
		this.log.info("Pichler platform looking for accessories…");

		// Register HAP & Matter devices synchronously to ease logging coherence
		await this.discoverHAPDevices;
		
		if (this.api.isMatterEnabled()) {
			await this.discoverMatterDevices();
		}
	}
	
	async discoverHAPDevices() {
		if (!this.api.hap) return;

		// As there's only one accessory, we don't need to search devices
		if (this.cachedAccessory) {
			this.log.info('Pichler platform restoring HAP accessory from cache:', this.cachedAccessory.displayName);
		
			this.pkomHapAccessory = new PKOM4HapAccessory(this, this.cachedAccessory, this.session);
			this.api.updatePlatformAccessories([this.cachedAccessory]);
			
			this.log.info('Pichler platform Matter accessory restoration done');
		} else {
			const name = this.config.name as string;
			this.log.info('Pichler platform registering new HAP accessory: %s', name);
			
			this.cachedAccessory = new this.api.platformAccessory(name, PKOM_ACCESSORY_UUID);
			this.pkomHapAccessory = new PKOM4HapAccessory(this, this.cachedAccessory, this.session);
			this.api.registerPlatformAccessories(PKOM_PLUGIN_NAME, PKOM_PLATFORM_NAME, [this.cachedAccessory]);
			
			this.log.info('Pichler platform Matter accessory registration done');
		}
	}
	
	async discoverMatterDevices() {
		if (!this.api.matter) return;
		
		// As there's only one endpoint, we don't need to search devices
		if (this.cachedMatterAccessory) {
			this.log.info('Pichler platform restoring Matter accessory from cache:', this.cachedMatterAccessory.displayName);

			// Matter accessory registration will occur once device communication completed 
			this.pkomMatterAccessory = new PKOM4MatterAccessory(this, this.cachedMatterAccessory, this.session);
			this.pkomMatterAccessory.connectAndSetup().then(() => {
				if (this.cachedMatterAccessory) {
					this.api.matter?.updatePlatformAccessories([this.cachedMatterAccessory]);
					this.log.info('Pichler platform Matter accessory restoration done');
				}
			});
		} else {
			const name = this.config.name as string;
			this.log.info('Pichler platform registering new Matter accessory: %s', name);
			
			// Explicit requirements are needed for auto mode
			const requirements = this.api.matter.deviceRequirements.RoomAirConditioner.ThermostatServer.with('Heating', 'Cooling', 'AutoMode', 'Occupancy');
			this.cachedMatterAccessory = {
				UUID: this.api.matter.uuid.generate(PKOM_ACCESSORY_TYPE),
				deviceType: this.api.matter.deviceTypes.RoomAirConditioner.with(requirements),
				displayName: name,
				serialNumber: PKOM_GENERIC_SERIAL,
				manufacturer: PKOM_MANUFACTURER_NAME,
				model: PKOM_ACCESSORY_NAME,
				softwareVersion: PKOM_PLUGIN_VERSION,
				context: {
					version: PKOM_PLUGIN_VERSION,
					lastPeriodDate: new Date(),
					lastPeriodEnergy: 0.0,
					lastSimulatedPower: 0.0,
				},
			};
			
			// Matter accessory registration will occur once device communication completed 
			this.pkomMatterAccessory = new PKOM4MatterAccessory(this, this.cachedMatterAccessory, this.session);
			this.pkomMatterAccessory.connectAndSetup().then(() => {
				if (this.cachedMatterAccessory) {
					this.api.matter?.registerPlatformAccessories(PKOM_PLUGIN_NAME, PKOM_PLATFORM_NAME, [this.cachedMatterAccessory]);
					this.log.info('Pichler platform Matter accessory registration done');
				}
			});
		}
	}
}
