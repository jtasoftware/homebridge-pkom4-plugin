#!/usr/bin/env python3
#
# Modbus script for PKOM Homebridge plugin
# This script if used to send modbus messages through serial interface
#
# Installation notes
# Install MinimalModbus dependency using command line "python3 -m pip install minimalmodbus"
# This script supports both Headcan & FTDI USB adapters on Raspberry or FTDI adapters on Mac
#	no extra driver required on both platforms, you'll only need to adjust adapter ID bellow
#	use 'ls /dev/ | egrep '(ttyUSB|ttyAMA|cu.usbserial).*' to find connected ports
#
# More context
# Register types/format or modbus speed are used as defined in Pichler documentation
# Errors & debug infos are sent to system log
# 
# Usage
# Pass the verb 'get' or 'set' to read or write a set of registers
# Pass the verb 'demo' to get a full list or register with fake values
#
# Documentation
# Minimal Modbus: https://minimalmodbus.readthedocs.io/en/stable/apiminimalmodbus.html
# Function mode: https://medium.com/analytics-vidhya/what-are-the-function-codes-of-modbus-rtu-and-their-requests-and-responses-8c33a467aed3
#
import sys
import json
import syslog
import platform

READ_HOLDING_REGISTER	= 3
READ_INPUT_REGISTER		= 4
WRITE_SINGLE_REGISTER	= 6

if (len(sys.argv) > 1):
	verb = sys.argv[1]

if (len(sys.argv) > 2):
	param2 = sys.argv[2]
else:
	param2 = ""

if (param2 == ""):
	param2 = '{}'

modbusRegistersType = {
  '0': 'unsigned',
  '9': 'unsigned',
  '10': 'signed',
  '11': 'signed',
  '16': 'unsigned',
  '19': 'signed',
  '24': 'unsigned',
  '25': 'unsigned',
  '30': 'unsigned',
  '36': 'unsigned',
  '37': 'signed',
  '38': 'unsigned',
  '46': 'unsigned',
  '56': 'unsigned',
  '58': 'unsigned',
  '71': 'unsigned',
  '75': 'unsigned',
  '101': 'unsigned',
  '102': 'unsigned',
  '103': 'unsigned',
  '129': 'signed',
  '136': 'unsigned',
  '137': 'unsigned',
  '149': 'unsigned',
  '162': 'signed',
  '191': 'unsigned',
  '201': 'signed',
  '315': 'unsigned',
  '483': 'unsigned',
  '484': 'unsigned',
#  '1006': 'string',
  '1019': 'signed'
}
modbusRegistersDecimal = {
  '0': 0,
  '9': 0,
  '10': 2,
  '11': 2,
  '16': 0,
  '19': 2,
  '24': 1,
  '25': 1,
  '30': 0,
  '36': 1,
  '37': 0,
  '38': 0,
  '46': 0,
  '56': 0,
  '58': 0,
  '71': 0,
  '75': 0,
  '101': 0,
  '102': 1,
  '103': 1,
  '129': 2,
  '136': 0,
  '137': 0,
  '149': 0,
  '162': 2,
  '191': 0,
  '201': 2,
  '315': 0,
  '483': 0,
  '484': 1,
#  '1006': 4,
  '1019': 2
}
modbusRegistersMode = {
  '0': 'RW',
  '9': 'RW',
  '10': 'RW',
  '11': 'RW',
  '16': 'RW',
  '19': 'RW',
  '24': 'RO',
  '25': 'RO',
  '30': 'RO',
  '36': 'RO',
  '37': 'RO',
  '38': 'RO',
  '46': 'RW',
  '56': 'RW',
  '58': 'RO',
  '71': 'RW',
  '75': 'RW',
  '101': 'RW',
  '102': 'RW',
  '103': 'RW',
  '129': 'RW',
  '136': 'RW',
  '137': 'RW',
  '149': 'RW',
  '162': 'RO',
  '191': 'RO',
  '201': 'RW',
  '315': 'RW',
  '483': 'RO',
  '484': 'RO',
#  '1006': '',
  '1019': 'RO'
}
modbusRegistersMigration = {
  '1006': '129'
}
modbusRegisters = json.loads(param2)

# Setup logging
syslog.openlog("Modbus")
syslog.syslog(syslog.LOG_INFO, "Ongoing Modbus communication (" + verb + ")")

# Setup platform-dependent attributes
# /dev/ttyAMA0 is used on Raspberry with RS485 headcan
# /dev/ttyUSB0 is used on Raspberry with FTDI-based USB adapters
# /dev/cu.usbserial-XXX is used on Mac with FTDI-based USB adapters
# You can either change this code or use symlink e.g /dev/serial0 -> /dev/cu.usbserial-AQ027PRJ
platform = platform.system()
if (platform == "Darwin"):
	serialPort = '/dev/serial0'
else:
	serialPort = '/dev/ttyUSB0'

if (verb == "get" or verb == "set"):
	try:
		# Setup instrument using serial port name & address (ignored for demo mode)
		# PKOM uses modbus 8E1 setup at 19200 bauds over slave address 41
		import serial
		import minimalmodbus
	
		instrument = minimalmodbus.Instrument(serialPort, 41, minimalmodbus.MODE_RTU)
		instrument.serial.baudrate = 19200
		instrument.serial.parity = serial.PARITY_EVEN

		# Handle modbus communications
		for addressStr in modbusRegisters.keys():
			# Migration might be required for retro-compatibility with legacy code
			if (addressStr in modbusRegistersMigration.keys()):
				alias = modbusRegistersMigration[addressStr]
			else:
				alias = addressStr
			
			address = int(alias)

			# Holding & input behaviour is defined by 'mode' definition - undefined addresses are skipped
			if (verb == "get" and modbusRegistersMode[alias] == 'RW'):
				mode = READ_HOLDING_REGISTER
			elif (verb == "get" and modbusRegistersMode[alias] == 'RO'):
				mode = READ_INPUT_REGISTER
			elif (verb == "set" and modbusRegistersMode[alias] == 'RW'):
				mode = WRITE_SINGLE_REGISTER
			else:
				mode = 0

			# Specific trick for duplicated adresses with holding & input variants
			# Input version is used by adding 1000 by caller 
			if (address > 1000):
				address = address - 1000
				mode = READ_INPUT_REGISTER

			if (verb == "get" and mode != 0):
				if (modbusRegistersType[alias] == 'string'):
					value = instrument.read_string(address, modbusRegistersDecimal[alias], mode)
				else:
					value = instrument.read_register(address, modbusRegistersDecimal[alias], mode, (modbusRegistersType[alias] == 'signed'))
				modbusRegisters[addressStr] = value
				syslog.syslog(syslog.LOG_INFO, "Received register " + addressStr + ":" + str(value) + " from bus " + serialPort)
			elif (verb == "set" and mode != 0):
				value = modbusRegisters[addressStr]
				instrument.write_register(address, value, modbusRegistersDecimal[alias], mode, (modbusRegistersType[alias] == 'signed'))
				syslog.syslog(syslog.LOG_INFO, "Writing register " + addressStr + ":" + str(value) + " to bus " + serialPort)
	
	except ImportError:
		syslog.syslog(syslog.LOG_INFO, "Error: Missing minimalmodbus components, please check installation")
		sys.exit("(missing serial bus installation)")
	except serial.serialutil.SerialException:
		syslog.syslog(syslog.LOG_INFO, "Error: Missing serial bus, please check connections")
		sys.exit("(serial bus is not connected)")
	except minimalmodbus.NoResponseError:
		syslog.syslog(syslog.LOG_INFO, "Error: No bus response, instrument is either disconnected or unavailable")
		sys.exit("(instrument is not responding)")
	except minimalmodbus.InvalidResponseError:
		syslog.syslog(syslog.LOG_INFO, "Error: Bad data format, double check modbus decimal or signed setup")
		sys.exit("(format error in response)")
	except minimalmodbus.IllegalRequestError:
		syslog.syslog(syslog.LOG_INFO, "Error: Illegal address, double check modbus address")
		sys.exit("(illegal data address)")
	except Exception as error:
		syslog.syslog(syslog.LOG_INFO, "Error: Generic exception catched " + str(error))
		sys.exit("(unexpected error)")
elif (verb == "demo"):
	modbusRegisters = {
	  '0': 3,
	  '9': 0,
	  '16': 3,
	  '19': 26,
	  '36': '1.1',
	  '38': 1,
	  '46': 2,
	  '58': 2,
	  '101': 1000,
	  '102': 70,
	  '129': 55,
	  '136': 0,
	  '149': 3,
	  '162': 47,
	  '201': 22,
	  '315': 470,
	  '483': 951,
	  '484': 65,
	  '1006': 'F220100001',
	  '1019': 20.5
	}
	
# Return results
print(json.dumps(modbusRegisters))
sys.stdout.flush();
