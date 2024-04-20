#!/bin/bash#
#
# NPM install script
# This script is run during npm package installation. It will install python dependencies
# such as python virtual env. or library.
#
virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/"
pythonPath="$virtualEnvFolder/bin/python3"
pipPath="$virtualEnvFolder/bin/pip"
modbusPath="$virtualEnvFolder/lib/python3.9/site-packages/minimalmodbus.py"
errorPattern="Error:"

# Create virtual python env.
if [[ ! -f "$pythonPath" ]]; then
	result=$(/usr/bin/python3 -m venv "$virtualEnvFolder" 2>&1)
	
	if [[ $result =~ $errorPattern ]]; then
		echo "Could not install virtual environment ; $result"
	else
		echo "Installed python virtual environment"
	fi
fi

# Update pip
if [[ -f "$pythonPath" ]]; then
	result=$($pythonPath -m pip install --upgrade pip 2>&1)
fi

# Install minimal modbus
if [[ -f "$pipPath" ]] && [[ ! -f "$modbusPath" ]]; then
	result=$($pipPath install minimalmodbus 2>&1)
	
	if [[ $result =~ $errorPattern ]]; then
		echo "Could not install minimal modbus ; $result"
	else
		echo "Installed minimal modbus library"
	fi
fi
