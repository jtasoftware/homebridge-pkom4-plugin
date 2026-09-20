#!/bin/bash
#
# Install script for PKOM Homebridge plugin
# This script is used to install python dependencies such as virtual env. or libraries
#
# There's no need to handle version upgrade as any plugin update will trigger a full reinstallation
#

if [[ $# -ge 1 ]] && [[ -n $1 ]]; then
	virtualEnvFolder=$1
	/bin/echo "Installing into destination $virtualEnvFolder"
else
	isDarwinOS=$(/usr/bin/uname -a | /usr/bin/grep -c "Darwin")
	if [[ $isDarwinOS -eq 1 ]]; then
		virtualEnvFolder="/usr/local/lib/node_modules/homebridge-pichler-pkom4/scripts"
		/bin/echo "Installing into default macOS destination"
	else
		virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/scripts"
		/bin/echo "Installing into default Linux destination"
	fi
fi

pipPath="$virtualEnvFolder/bin/pip"

# Check existing installation
modbusInstalled=0
venvInstalled=$(/usr/bin/command -v $pipPath 2>&1 | /usr/bin/grep -c "/bin/pip")

if [[ $venvInstalled -eq 1 ]]; then
	/bin/echo "Checking available python virtual environment"	
	modbusInstalled=$($pipPath show minimalmodbus 2>&1 | /usr/bin/grep -c "Version:")
fi

# Deal with possibly corrupted environment
if [[ $venvInstalled -eq 1 ]] && [[ $modbusInstalled -eq 0 ]]; then
	/bin/echo "Removing previous python virtual environment"
	venvInstalled=0
	
	/bin/rm -rf "$virtualEnvFolder/lib"
	/bin/rm -rf "$virtualEnvFolder/bin"
	/bin/rm -rf "$virtualEnvFolder/include"
fi

# Create virtual python env.
if [[ $venvInstalled -eq 0 ]]; then
	/bin/echo "Creating private python virtual environment"
	/usr/bin/python3 -m venv "$virtualEnvFolder"
fi

# Install dependencies
if [[ -f $pipPath ]] && [[ $modbusInstalled -eq 0 ]]; then
	/bin/echo "Installing minimal modbus"
	$pipPath install minimalmodbus
	
	modbusInstalled=$($pipPath show minimalmodbus | /usr/bin/grep -c "Version:")
	if [[ $modbusInstalled -eq 0 ]]; then
		/bin/echo "Error: Failed to install minimal modbus"
	fi
elif [[ -f $pipPath ]]; then
	/bin/echo "Completed installation"
else
	/bin/echo "Error: Failed to install python virtual environment"
fi
