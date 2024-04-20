import {AccessoryPlugin, API, HAP, Logging, PlatformConfig, StaticPlatformPlugin} from "homebridge";
import {PKOM4Accessory} from "./pkom4-accessory";

const PLUGIN_NAME = "homebridge-pichler-pkom4";
const PLATFORM_NAME = "homebridge-pichler-pkom4";
const PKOM4_NAME = "PKOM Heat Pump";

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerPlatform(PLATFORM_NAME, PichlerPKOM4Platform);
};

class PichlerPKOM4Platform implements StaticPlatformPlugin {

  private readonly log: Logging;
  private readonly config: PlatformConfig;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
	this.config = config;
	    
    log.info("Copyright © 2022/2024 by J. Tarantino, released under EUPL license");
    log.info("Pichler-PKOM4 platform finished initializing");
  }

  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    callback([
      new PKOM4Accessory(hap, this.log, this.config, PKOM4_NAME)
    ]);
  }
}
