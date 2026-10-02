'use strict';

module.exports = {
  ...require('./core/werkz-core'),
  ...require('./modules/module-registry'),
  ...require('./modules/management'),
  ...require('./commercial/catalog'),
  ...require('./integrations/approval-channel'),
  ...require('./integrations/foundation'),
  ...require('./integrations/lifecycle'),
  ...require('./integrations/durable'),
  ...require('./integrations/oauth-flow'),
  ...require('./integrations/device-authorization'),
  ...require('./time/production'),
  ...require('./time/durable'),
  ...require('./time/recovery'),
  ...require('./time/application'),
  ...require('./time/http'),
  ...require('./time/offline'),
  ...require('./security/licensing'),
  ...require('./security/identity'),
  ...require('./security/durable'),
  ...require('./security/lifecycle')
};
