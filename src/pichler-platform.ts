import { API, HAP, Logging, PlatformConfig, DynamicPlatformPlugin, PlatformAccessory } from "homebridge";
import { PLATFORM_NAME, PLUGIN_NAME, PKOM4_ACCESSORY_NAME, PKOM4_ACCESSORY_UUID } from "./settings";
import { PKOM4Accessory } from "./pkom4-accessory";

export class PichlerPlatform implements DynamicPlatformPlugin {

  public readonly api: API;
  public readonly log: Logging;
  public readonly config: PlatformConfig;
  private accessory?: PlatformAccessory;
  
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
    this.accessory = accessory;
  }
  
  discoverDevices() {	
	if (this.accessory) {
	  this.log.info('Restoring existing accessory from cache:', this.accessory.displayName);
	
	  // If you need to update the accessory.context this.api.updatePlatformAccessories([existingAccessory])
	  new PKOM4Accessory(this, this.accessory);
	} else {
	  this.log.info('Adding new accessory:', PKOM4_ACCESSORY_NAME);
	  
	  // As there's only one accessory we don't care about unique ID generation
	  const uuid = this.api.hap.uuid.generate(PKOM4_ACCESSORY_UUID);
	  const accessory = new this.api.platformAccessory(PKOM4_ACCESSORY_NAME, uuid);	  
	  new PKOM4Accessory(this, accessory);
	  
	  this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	}
  }
}
