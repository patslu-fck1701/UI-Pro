'use strict';

module.exports = {
  ...require('./core/werkz-core'),
  ...require('./modules/module-registry'),
  ...require('./modules/management'),
  ...require('./commercial/catalog'),
  ...require('./integrations/approval-channel'),
  ...require('./integrations/foundation'),
  ...require('./time/production'),
  ...require('./time/durable'),
  ...require('./time/application'),
  ...require('./time/offline')
};
