import { API } from 'homebridge';
import { PLATFORM_NAME } from './settings';
import { PichlerPlatform } from './pichler-platform';

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, PichlerPlatform);
};
