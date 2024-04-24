import { API, HAP, Logging, PlatformConfig, DynamicPlatformPlugin, PlatformAccessory } from "homebridge";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { PKOM4Accessory, PKOM_ACCESSORY_NAME, PKOM_ACCESSORY_UUID } from "./pkom4-accessory";

export class PichlerPlatform implements DynamicPlatformPlugin {

  public readonly api: API;
  public readonly log: Logging;
  public readonly config: PlatformConfig;
  private cachedAccessory?: PlatformAccessory;
  private pkomAccessory?: PKOM4Accessory;
  
  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
	this.config = config;
    this.api = api;

	this.log.info("Copyright © 2022/2024 by J. Tarantino, released under EUPL license");
    
    if (!this.log.success) {
      this.log.success = log.info;
    }
    
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
	  this.log.info("Pichler-PKOM4 platform finished initializing");
      this.discoverDevices();
    });
  }
  
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);
    this.cachedAccessory = accessory;
  }
  
  discoverDevices() {
    // As there's only one accessory, we don't care about device search
	if (this.cachedAccessory) {
	  this.log.info('Restoring existing accessory from cache:', this.cachedAccessory.displayName);
	
	  this.pkomAccessory = new PKOM4Accessory(this, this.cachedAccessory);
	  this.api.updatePlatformAccessories([this.cachedAccessory]);
	  
	} else {
	  let name = this.config["name"] as string;
	  this.log.info('Adding new accessory: %s', name);
	  
	  this.cachedAccessory = new this.api.platformAccessory(name, PKOM_ACCESSORY_UUID);
	  this.pkomAccessory = new PKOM4Accessory(this, this.cachedAccessory);
	  this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.cachedAccessory]);
	}
  }
}
