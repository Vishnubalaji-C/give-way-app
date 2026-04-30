const { SerialPort } = require('serialport');
SerialPort.list().then(ports => {
  console.log(JSON.stringify(ports, null, 2));
});
