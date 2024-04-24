#!/bin/bash
#
# Install script for PKOM Homebridge plugin
# This script is used to install python dependencies such as virtual env. or libraries
#
if [ $# -ge 1 ] && [ -n $1 ]; then
	virtualEnvFolder=$1
else
	virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/scripts"
fi

echo "Installing into destination $virtualEnvFolder"
pipPath="$virtualEnvFolder/bin/pip"

# Create virtual python env.
echo "Creating private python virtual environment…"
/usr/bin/python3 -m venv "$virtualEnvFolder"

# Install dependencies
if [ -f $pipPath ]; then
	echo "Installing minimal modbus…"
	$pipPath install minimalmodbus
	
	installedModbus=$($pipPath show minimalmodbus | /usr/bin/grep -c "Version:")
	if [ $installedModbus -eq 0 ]; then
		echo "Error: Failed to install minimal modbus"
	fi
else
	echo "Error: Failed to install python virtual environment"
fi
