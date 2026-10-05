const { createAuditLog } = require('../utils/audit');

const audit = (action, options = {}) => {
  return (req, res, next) => {
    const originalSend = res.json;
    res.json = function (data) {
      if (data && data.success) {
        createAuditLog({
          userId: req.user?.id,
          action: typeof action === 'function' ? action(req) : action,
          entityType: options.entityType,
          entityId: req.params.id || req.body?.id || null,
          details: options.details || null,
          metadata: data,
          ip: req.ip,
        });
      }
      originalSend.call(this, data);
    };
    next();
  };
};

module.exports = { audit };
