import { API } from 'homebridge';
import { PichlerPlatform } from './pichler-platform.js';
import { PLATFORM_NAME } from './settings.js';

export default (api: API) => {
  api.registerPlatform(PLATFORM_NAME, PichlerPlatform);
};
