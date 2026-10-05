const prisma = require('./db');

const createAuditLog = async ({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
  metadata = null,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
      },
    });
  } catch (error) {
    console.error('Audit log creation failed:', error.message);
  }
};

module.exports = { createAuditLog };
