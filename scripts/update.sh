#!/bin/bash
#
# Update script for PKOM Homebridge plugin
# This script is use to do a keep ut-to-date homebridge components.
#
pkomVersion="2.0.0"
pipVersion="24.0"
modbusVersion="2.1.1"

function version {
	echo "$@" | awk -F. '{ printf("%d%03d%03d%03d\n", $1,$2,$3,$4); }';
}

isDarwinOS=$(/usr/bin/uname -a | /usr/bin/grep -c "Darwin")
if [[ $isDarwinOS -eq 1 ]]; then
	virtualEnvFolder="/usr/local/lib/node_modules/homebridge-pichler-pkom4/scripts"
	/bin/echo "Installing into default macOS destination"
else
	virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/scripts"
	/bin/echo "Installing into default Linux destination"
fi

pipPath="$virtualEnvFolder/bin/pip"

# Homebridge upgrades
hb-service add homebridge-pichler-pkom4@"$pkomVersion"

# Dependencies updates
installedModbus=$($pipPath show minimalmodbus | /usr/bin/grep "Version:" | /usr/bin/awk '{print $2}')
installedPip=$($pipPath show pip | /usr/bin/grep "Version:" | /usr/bin/awk '{print $2}')

if [[ $(version "$installedPip") -lt $(version "$pipVersion") ]]; then
	$pipPath install --upgrade --upgrade-strategy "only-if-needed" pip
else
	echo "Pip is already up-to-date"
fi

if [[ $(version "$installedModbus") -lt $(version "$modbusVersion") ]]; then
	$pipPath install --upgrade --upgrade-strategy "only-if-needed" minimalmodbus
else
	echo "MinimalModbus is already up-to-date"
fi
