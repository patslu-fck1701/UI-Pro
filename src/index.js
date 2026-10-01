'use strict';

module.exports = {
  ...require('./core/werkz-core'),
  ...require('./modules/module-registry'),
  ...require('./modules/management'),
  ...require('./commercial/catalog'),
  ...require('./integrations/approval-channel')
};
