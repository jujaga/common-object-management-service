exports.up = function (knex) {
  return Promise.resolve()
    // Rename versionId to s3VersionId
    .then(() => knex.schema.alterTable('version', table => {
      table.renameColumn('versionId', 's3VersionId');
    }))
    // Change tag table lengths to align with AWS standards
    .then(() => knex.schema.alterTable('tag', table => {
      table.string('key', 128).alter();
      table.string('value', 256).alter();
    }));
};

exports.down = function (knex) {
  return Promise.resolve()
    // Revert tag table lengths
    .then(() => knex.schema.alterTable('tag', table => {
      table.string('key', 255).alter();
      table.string('value', 255).alter();
    }))
    // Revert s3VersionId to versionId
    .then(() => knex.schema.alterTable('version', table => {
      table.renameColumn('s3VersionId', 'versionId');
    }));
};
