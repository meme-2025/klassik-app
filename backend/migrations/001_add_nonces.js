/* add nonces table to support pre-registration wallet nonces */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('nonces', {
    address: { type: 'varchar(255)', notNull: true },
    nonce: { type: 'varchar(255)', notNull: true },
    expires_at: { type: 'timestamp', notNull: true }
  });
  pgm.addConstraint('nonces', 'nonces_pkey', { primaryKey: ['address'] });
};

exports.down = (pgm) => {
  pgm.dropTable('nonces');
};
