'use strict';

var path = require('path');

var nml = require('node-mod-load');


// Add old helpers, which are now part of this module instead of being part of the loose NML-module list.
// For compatibility, the modules still have to be added to NML
// path.parse(__filename).dir
nml.addPath(__dirname + '/helpers/sqlCol.js', true);
nml.addPath(__dirname + '/helpers/sqlConditionBuilder.js', true);
nml.addPath(__dirname + '/helpers/sqlQueryBuilder.js', true);
nml.addPath(__dirname + '/helpers/sqlRow.js', true);
nml.addPath(__dirname + '/helpers/sqlTable.js', true);

// Proxy old library
module.exports = require('./index-sql.old');
