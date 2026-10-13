'use strict';

try {
    module.exports = require('@zone-eu/wild-config');
} catch (err) {
    module.exports = require('../packages/node_modules/@zone-eu/wild-config');
}
