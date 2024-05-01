#!/bin/bash
#
# Install script for PKOM Homebridge plugin
# This script is used to install python dependencies such as virtual env. or libraries
#
# There's no need to handle version upgrade as any plugin update will trigger a full reinstallation
#
if [ $# -ge 1 ] && [ -n $1 ]; then
	virtualEnvFolder=$1
	echo "Installing into destination $virtualEnvFolder"
else
	virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/scripts"
	echo "Installing into default destination"
fi

pipPath="$virtualEnvFolder/bin/pip"

# Check existing installation
modbusInstalled=0
venvInstalled=$(command -v $pipPath 2>&1 | /usr/bin/grep -c "/bin/pip")

if [ $venvInstalled -eq 1 ]; then
	echo "Checking available python virtual environment"	
	modbusInstalled=$($pipPath show minimalmodbus 2>&1 | /usr/bin/grep -c "Version:")
fi

# Deal with possibly corrupted environment
if [ $venvInstalled -eq 1 ] && [ $modbusInstalled -eq 0 ]; then
	echo "Removing previous python virtual environment"
	venvInstalled=0
	
	/bin/rm -rf "$virtualEnvFolder/lib"
	/bin/rm -rf "$virtualEnvFolder/bin"
	/bin/rm -rf "$virtualEnvFolder/include"
fi

# Create virtual python env.
if [ $venvInstalled -eq 0 ]; then
	echo "Creating private python virtual environment"
	/usr/bin/python3 -m venv "$virtualEnvFolder"
fi

# Install dependencies
if [ -f $pipPath ] && [ $modbusInstalled -eq 0 ]; then
	echo "Installing minimal modbus"
	$pipPath install minimalmodbus
	
	modbusInstalled=$($pipPath show minimalmodbus | /usr/bin/grep -c "Version:")
	if [ $modbusInstalled -eq 0 ]; then
		echo "Error: Failed to install minimal modbus"
	fi
elif [ -f $pipPath ]; then
	echo "Completed installation"
else
	echo "Error: Failed to install python virtual environment"
fi
