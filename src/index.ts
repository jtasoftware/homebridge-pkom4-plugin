import { API } from 'homebridge';
import { PichlerPlatform } from './pichler-platform.js';
import { PKOM_PLATFORM_NAME } from './settings.js';

export default (api: API) => {
  api.registerPlatform(PKOM_PLATFORM_NAME, PichlerPlatform);
};
