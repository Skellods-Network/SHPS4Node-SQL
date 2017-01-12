'use strict';

var nml = require('node-mod-load')('SHPS4Node-SQL');
nml.addDir(__dirname + '/interface', true);
nml.addDir(__dirname + '/src', true);
module.exports = nml.libs['sql.h'];
