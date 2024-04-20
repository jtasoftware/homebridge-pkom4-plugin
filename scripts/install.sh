#!/bin/bash#
#
# Install script for PKOM Homebridge plugin
# This script is used to install python dependencies such as virtual env. or libraries
#
virtualEnvFolder="/var/lib/homebridge/node_modules/homebridge-pichler-pkom4/"
pipPath="$virtualEnvFolder/bin/pip"

# Create virtual python env.
/usr/bin/python3 -m venv "$virtualEnvFolder"

# Install dependencies
$pipPath install minimalmodbus
