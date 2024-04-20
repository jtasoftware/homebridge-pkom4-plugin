#!/bin/bash#
#
# Update script for PKOM Homebridge plugin
# This script is use to do a keep ut-to-date homebridge components.
#
virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/"
pipPath="$virtualEnvFolder/bin/pip"
pkomVersion="1.1.3"
pipVersion="24.0"
modbusVersion="2.1.1"

function version {
	echo "$@" | awk -F. '{ printf("%d%03d%03d%03d\n", $1,$2,$3,$4); }';
}

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
