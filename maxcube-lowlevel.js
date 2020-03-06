var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');

function MaxCubeLowLevel(ip, port){
  this.ip = ip;
  this.port = port;

  this.socket = new net.Socket();
  this.isConnected = false;

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception error: ', err);
  });

	initSocket.call(this);
}

util.inherits(MaxCubeLowLevel, EventEmitter);

function initSocket () {
  var self = this;
  var previousPacketData = '';

  this.socket.on('data', function(dataBuff) {
    var dataStr = dataBuff.toString('utf-8');

    if (!dataStr.endsWith('\r\n')) {
      previousPacketData = dataStr;
      return;
    }

    // Delete timeout after data has been received
    self.socket.setTimeout( 0 );

    dataStr = previousPacketData + dataStr;
    previousPacketData = '';

    // multiple commands possible
    var commandArr = dataStr.split("\r\n");
    commandArr.forEach(function (command) {
      if (command) {
        var commandType = command.substr(0, 1);
        var payload = command.substring(2) + "\r\n"; // reappend delimiter
        self.emit('command', { type: commandType, payload: payload });
      }
    });
  });

  // If send has been called with timeout, this event will be emitted if there is no activity on the stream for the configured timeout
  this.socket.on( 'timeout', function() {
    console.error( 'Maxcube: Connection timed out.' );
    // Timeout indicates a problem with the Cube, so emit error
    self.emit( 'error', new Error( 'Maxcube: Connection timed out.' ) );
  } );

  this.socket.on('close', function() {
    self.isConnected = false;
    self.emit('closed');
  });

  this.socket.on('error', function(err) {
    console.error(err);
    self.emit('error', err);
  });
}

function connect () {
  var self = this;

  if (self.isConnected) {
    self.connectionPromise = Promise.resolve();
  } else if (!(self.connectionPromise && self.connectionPromise.isPending())) {
    self.connectionPromise = new Promise(function(resolve, reject) {
      self.socket.connect(self.port, self.ip, function() {
        self.isConnected = true;
        self.emit('connected');
        resolve();
      });
    });
  }

  return self.connectionPromise;
}

function close () {
  if (this.socket) {
    this.socket.destroy();
  }
}

// Can be called with and without timeout
function send( dataStr, timeout=0 ) {
  this.socket.write(dataStr);
  // Setting timeout to 0 disables the timeout
  this.socket.setTimeout( timeout );
}

function isConnected () {
  return this.isConnected;
}

MaxCubeLowLevel.prototype.connect = connect;
MaxCubeLowLevel.prototype.close = close;
MaxCubeLowLevel.prototype.send = send;
MaxCubeLowLevel.prototype.isConnected = isConnected;

module.exports = MaxCubeLowLevel;
