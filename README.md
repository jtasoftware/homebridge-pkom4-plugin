
<p align="center">
<img src="homebridge-logo.png" width="150">
</p>


# Homebridge PKOM4 Plugin

This is an Homebridge plugin to be used with Pichler PKOM4 heatpump devices.


## Install Development Dependencies

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```
npm install
```

## Build Plugin

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```
npm run build
```

## Link To Homebridge

Run this command so your global install of Homebridge can discover the plugin in your development environment:

```
npm link
```

You can now start Homebridge, use the `-D` flag so you can see debug log messages in your plugin:

```
homebridge -D
```

## Watch For Changes and Build Automatically

If you want to have your code compile automatically as you make changes, and restart Homebridge automatically between changes you can run:

```
npm run watch
```

This will launch an instance of Homebridge in debug mode which will restart every time you make a change to the source code. It will load the config stored in the default location under `~/.homebridge`. You may need to stop other running instances of Homebridge while using this command to prevent conflicts.

## Setup Plugin

You can customise plugin behaviour for test or debug purpose.

* `Simulate mode` - Simulate PKOM4 behaviour without any actual connected device (used for demos)
* `Read only mode` - Report any data from PKOM4 but won't send any command (used for debugging)
* `Modbus logs level` - Define the verbosity of modbus debug logs (None/Low/High)

## Use Plugin

Use the plugin with HomeBrige on any HomeBridge-compatible asset. It has been tested with MacBook using [`localhost:8581`](http://localhost:8581) & Raspberry Zero using WiFi or Ethernet connectivity over local network [`homebridge.local:8581`](http://homebridge.local).

Once running in HomeBridge bind with your iOS device in Apple Home App. For improved user experience you can display all services as separated items.

The following services will be available depending on your PKOM version:
* **Fan** (all models): view current VCM speed or adjust manually. You can turn it off (standby mode).
* **Filter Maintenance** (all models): view remaining life for filters and get alert when they need to be changed.
* **Air Conditioner** (all models): setup air temperatures for cooling or heating. You can turn off either heating or cooling. 
* **Air Purifier** (models with dioxide sensor): view air quality or force ventilation until better quality is reached. You can turn it off.
* **Deshumidifier** (models with humidity sensor): view humidity level or force ventilation until deshumidified. You can turn it off.
* **Water Header** (PKOM Classic): setup water temperature from 35° to 55°. You can reach 65° if you have water resistance installed.

Involved PKOM features:
* CVM level 1 to 4 based on Fan speed (25/50/75/90%)
* Automatic mode when air conditioner is auto
* Winter mode when only heating is enabled
* Summer mode when only cooling is enabled or AC is disabled
* Hot Water mode when both fan and AC are disabled
* Air filter alerts

Available PKOM settings:
* Setpoint for water heating
* Setpoint for room heating & cooling
* Dioxide concentration threshold
* Max humidity threshold

All other settings and features (incl. Holidays mode) need to be done with Pichler app or device console.

#### Simulation

If you enable `Simulate mode` you won't need any hardware. Interact with a simulated PKOM4 Classic with all available options (humidity & dioxide sensors, water resistance, duct battery). Dioxide regulation will trigger automatically when max level is reached. Deshumidifier will trigger automatically when max humidity is reached. In both case ventilation will run at max speed. If min humidity is reached ventilation will run at lower speed. Fan can also run at any speed level (25%, 50%, 75%, 90%) using manual setting - and will revert to default speed after 10 min. Humidity and dioxide will increase slightly every 5 min for simulation purpose.

Water Heater will automatically loose temperature every 5 min for simulation purpose and reheat automatically when min temperature is reached.

#### Connect to PKOM device

To connect to a PKOM device use a Raspberry Pi (model Zero is fine) and a Modbus/USB converter. You might need to adjust the name of USB driver depending on the chip used by the converter - see `/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/scripts/modbus.py` using HomeBridge terminal. You can alternatively use a Raspberry Pi HAT with the 40-pin GPIO header.

You can customize `Modbus logs level` to see modbus communication status from HomeBridge logs.
