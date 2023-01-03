#!/usr/bin/env python3
#
# Installation
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
  '11': 'unsigned',
  '16': 'unsigned',
  '29': 'signed',
  '36': 'unsigned',
  '38': 'unsigned',
  '46': 'unsigned',
  '58': 'unsigned',
  '101': 'unsigned',
  '102': 'unsigned',
  '103': 'unsigned',
  '136': 'unsigned',
  '137': 'unsigned',
  '149': 'unsigned',
  '153': 'signed',
  '166': 'unsigned',
  '196': 'unsigned',
  '201': 'signed',
  '208': 'unsigned',
  '315': 'unsigned',
  '483': 'unsigned',
  '484': 'unsigned',
  '1001': 'unsigned',
  '1002': 'unsigned',
  '1003': 'unsigned',
  '1004': 'unsigned',
  '1005': 'unsigned',
  '1006': 'string'
}
modbusRegistersDecimal = {
  '0': 0,
  '9': 0,
  '11': 2,
  '16': 0,
  '29': 2,
  '36': 1,
  '38': 0,
  '46': 0,
  '58': 0,
  '101': 0,
  '102': 1,
  '103': 1,
  '136': 0,
  '137': 0,
  '149': 0,
  '153': 2,
  '166': 2,
  '196': 2,
  '201': 2,
  '208': 0,
  '315': 0,
  '483': 0,
  '484': 1,
  '1001': 0,
  '1002': 0,
  '1003': 0,
  '1004': 0,
  '1005': 0,
  '1006': 4
}
modbusRegisters = json.loads(param2)

# Setup logging
syslog.openlog("Modbus")
syslog.syslog(syslog.LOG_INFO, "Ongoing Modbus communication (" + verb + ")")

# Setup platform-dependent attributes
# /dev/ttyAMA0 is used on Raspberry with RS485 headcan
# /dev/ttyUSB0 is used on Raspberry with FTDI-based USB adapters
# /dev/cu.usbserial-XXX is used on Mac with FTDI-based USB adapters
# You can either change this code or use symlink e.g /dev/serial0 -> /dev/ttyUSB0
platform = platform.system()
if (platform == "Darwin"):
	serialPort = '/dev/cu.usbserial-AQ027PRJ'
else:
	serialPort = '/dev/serial0'

if (verb == "get" or verb == "set"):
	try:
		# Setup instrument using serial port name & address (ignored for demo mode)
		import serial
		import minimalmodbus
	
		instrument = minimalmodbus.Instrument(serialPort, 41, minimalmodbus.MODE_RTU)
		instrument.serial.baudrate = 19200
		instrument.serial.parity = serial.PARITY_EVEN

		# Handle modbus communications
		if (verb == "get"):
			for addressStr in modbusRegisters.keys():
				address = int(addressStr)
				if (modbusRegistersType[addressStr] == 'string'):
					value = instrument.read_string(address, modbusRegistersDecimal[addressStr], READ_HOLDING_REGISTER)
				else:
					value = instrument.read_register(address, modbusRegistersDecimal[addressStr], READ_HOLDING_REGISTER, (modbusRegistersType[addressStr] == 'signed'))
				modbusRegisters[addressStr] = value
				syslog.syslog(syslog.LOG_INFO, "Received register " + addressStr + ":" + str(value) + " from bus " + serialPort)
		elif (verb == "set"):
			for addressStr in modbusRegisters.keys():
				address = int(addressStr)
				value = modbusRegisters[addressStr]
				instrument.write_register(address, value, modbusRegistersDecimal[addressStr], WRITE_SINGLE_REGISTER, (modbusRegistersType[addressStr] == 'signed'))
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
	  '29': 26,
	  '36': '1.1',
	  '38': 1,
	  '46': 2,
	  '58': 2,
	  '101': 1000,
	  '102': 70,
	  '136': 0,
	  '149': 4,
	  '153': 25,
	  '166': 55,
	  '196': 47,
	  '201': 22,
	  '315': 4320,
	  '483': 951,
	  '484': 65,
	  '1001': 1,
	  '1003': 1,
	  '1004': 1,
	  '1005': 1,
	  '1006': 'Q87E31YL'
	}
	
# Return results
print(json.dumps(modbusRegisters))
sys.stdout.flush();
